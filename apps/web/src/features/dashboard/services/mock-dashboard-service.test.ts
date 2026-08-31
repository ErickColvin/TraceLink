import type { InventoryItem } from "@/features/inventory/domain";
import { mockInventoryItems, mockInventoryMovements } from "@/features/inventory/data/mock-inventory";
import { MockInventoryService } from "@/features/inventory/services/mock-inventory-service";
import type { StaffOrder } from "@/features/orders/domain";
import { mockStaffOrders } from "@/features/orders/data/mock-staff-orders";
import { MockStaffOrderService } from "@/features/orders/services/mock-staff-order-service";
import {
  mockStaffPackageCustomers,
  mockStaffPackages,
} from "@/features/packages/data/mock-staff-packages";
import { MockStaffPackageService } from "@/features/packages/services/mock-staff-package-service";
import { MockSettingsService } from "@/features/settings/services/mock-settings-service";
import { describe, expect, it } from "vitest";

import { MockDashboardService } from "./mock-dashboard-service";

const FIXED_NOW = new Date("2026-08-30T18:00:00.000Z");

function createDashboardService() {
  return new MockDashboardService(
    {
      inventoryService: new MockInventoryService(
        mockInventoryItems,
        mockInventoryMovements,
        () => FIXED_NOW,
      ),
      staffOrderService: new MockStaffOrderService({
        latencyMs: 0,
        now: () => FIXED_NOW,
      }),
      staffPackageService: new MockStaffPackageService({
        latencyMs: 0,
        now: () => FIXED_NOW,
      }),
      settingsService: new MockSettingsService(),
    },
    { latencyMs: 0, now: () => FIXED_NOW },
  );
}

describe("MockDashboardService", () => {
  it("derives six KPIs, a seven-day trend and filtered operational alerts", async () => {
    const overview = await createDashboardService().getOverview();

    expect(overview.generatedAt).toBe(FIXED_NOW.toISOString());
    expect(overview.kpis).toEqual({
      salesTodayClp: 0,
      ordersToday: 0,
      pendingOrders: 4,
      storedPackages: 1,
      criticalStockItems: 2,
      expiringSoonItems: 2,
    });
    expect(overview.salesTrend).toHaveLength(7);
    expect(overview.salesTrend).toContainEqual({
      date: "2026-08-28",
      salesClp: 6_570,
      orders: 1,
    });
    expect(overview.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "CRITICAL_STOCK",
          inventoryItemId: "inventory-papas-l1208",
          href: "/app/inventory?status=OUT",
        }),
        expect.objectContaining({
          type: "EXPIRING_BATCH",
          inventoryItemId: "inventory-jugo-l1808",
          href: "/app/inventory?expiry=WITH_EXPIRY",
        }),
        expect.objectContaining({
          type: "PACKAGE_INCIDENT",
          packageId: "package-ch-38107",
          href: "/app/packages?status=INCIDENT&search=CHM-38107-CL",
        }),
        expect.objectContaining({
          type: "PACKAGE_STORED_TOO_LONG",
          packageId: "package-ch-40991",
          href: "/app/packages?status=STORED&tracking=CHM-40991-CL",
        }),
        expect.objectContaining({
          type: "DELAYED_ORDER",
          orderId: "order-2026-0814",
          href: "/app/orders?status=PREPARING&query=CH-2026-0814",
        }),
      ]),
    );
  });

  it("reflects mutations made through the injected operational services", async () => {
    const inventoryItem = {
      id: "inventory-test",
      productId: "product-test",
      sku: "SKU-TEST",
      productName: "Producto prueba",
      categoryId: "category-test",
      categoryName: "Pruebas",
      physicalStock: 2,
      reservedStock: 0,
      availableStock: 2,
      minimumStock: 5,
      location: "Bodega A",
      status: "LOW",
      updatedAt: "2026-08-30T11:00:00.000Z",
    } satisfies InventoryItem;
    const order = {
      id: "order-test",
      orderNumber: "CH-TEST-1",
      customerId: "customer-test",
      customer: {
        id: "customer-test",
        fullName: "Cliente Prueba",
        email: "cliente@example.cl",
      },
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      fulfillmentMethod: "PICKUP",
      items: [],
      subtotal: 5_000,
      discountTotal: 0,
      deliveryFee: 0,
      total: 5_000,
      createdAt: "2026-08-30T12:00:00.000Z",
      updatedAt: "2026-08-30T12:00:00.000Z",
      estimatedReadyAt: "2026-08-30T22:00:00.000Z",
      packageIds: [],
      statusEvents: [
        {
          id: "order-test-event-1",
          orderId: "order-test",
          fromStatus: null,
          toStatus: "PENDING_PAYMENT",
          occurredAt: "2026-08-30T12:00:00.000Z",
          actorId: "system",
          actorName: "Sistema demo",
        },
      ],
    } satisfies StaffOrder;
    const customerPackage = mockStaffPackages.find(
      (candidate) => candidate.status === "STORED",
    );
    if (!customerPackage) {
      throw new Error("El escenario requiere un paquete almacenado.");
    }
    const inventoryService = new MockInventoryService([inventoryItem], []);
    const staffOrderService = new MockStaffOrderService({
      seed: [order],
      latencyMs: 0,
      now: () => FIXED_NOW,
    });
    const staffPackageService = new MockStaffPackageService({
      seed: [customerPackage],
      customers: mockStaffPackageCustomers,
      latencyMs: 0,
      now: () => FIXED_NOW,
    });
    const dashboardService = new MockDashboardService(
      {
        inventoryService,
        staffOrderService,
        staffPackageService,
        settingsService: new MockSettingsService(),
      },
      { latencyMs: 0, now: () => FIXED_NOW },
    );

    const before = await dashboardService.getOverview();
    expect(before.kpis).toMatchObject({
      salesTodayClp: 0,
      ordersToday: 1,
      pendingOrders: 1,
      storedPackages: 1,
      criticalStockItems: 1,
    });

    await inventoryService.createMovement({
      inventoryItemId: inventoryItem.id,
      type: "PURCHASE_RECEIPT",
      quantity: 4,
      adjustmentDirection: "INCREASE",
    });
    await staffOrderService.transitionStatus({
      orderId: order.id,
      toStatus: "PAID",
      actor: { id: "staff-test", name: "Personal prueba" },
    });
    await staffOrderService.transitionStatus({
      orderId: order.id,
      toStatus: "PREPARING",
      actor: { id: "staff-test", name: "Personal prueba" },
    });
    await staffOrderService.transitionStatus({
      orderId: order.id,
      toStatus: "READY",
      actor: { id: "staff-test", name: "Personal prueba" },
    });
    await staffOrderService.transitionStatus({
      orderId: order.id,
      toStatus: "COMPLETED",
      actor: { id: "staff-test", name: "Personal prueba" },
    });
    await staffPackageService.transitionStatus({
      packageId: customerPackage.id,
      toStatus: "READY_FOR_PICKUP",
      actor: { id: "staff-test", name: "Personal prueba" },
    });

    const after = await dashboardService.getOverview();
    expect(after.kpis).toMatchObject({
      salesTodayClp: 5_000,
      ordersToday: 1,
      pendingOrders: 0,
      storedPackages: 0,
      criticalStockItems: 0,
    });
    expect(after.alerts).toHaveLength(0);
  });

  it("uses independent operational instances instead of static dashboard fixtures", async () => {
    const service = new MockDashboardService(
      {
        inventoryService: new MockInventoryService([], []),
        staffOrderService: new MockStaffOrderService({
          seed: mockStaffOrders.slice(0, 0),
          latencyMs: 0,
        }),
        staffPackageService: new MockStaffPackageService({
          seed: mockStaffPackages.slice(0, 0),
          latencyMs: 0,
        }),
        settingsService: new MockSettingsService(),
      },
      { latencyMs: 0, now: () => FIXED_NOW },
    );

    await expect(service.getOverview()).resolves.toMatchObject({
      kpis: {
        salesTodayClp: 0,
        ordersToday: 0,
        pendingOrders: 0,
        storedPackages: 0,
        criticalStockItems: 0,
        expiringSoonItems: 0,
      },
      salesTrend: [],
      alerts: [],
    });
  });
});
