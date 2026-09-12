import { describe, expect, it } from "vitest";

import {
  API_ERROR_CODES,
  PERMISSIONS,
  ROLE_CODES,
  apiErrorResponseSchema,
  authSessionEnvelopeSchema,
  booleanQuerySchema,
  cancelPaymentRequestSchema,
  checkoutResponseSchema,
  createCheckoutRequestSchema,
  createFullRefundRequestSchema,
  createInventoryMovementRequestSchema,
  orderTransitionRequestSchema,
  packageTransitionTargetSchema,
  paymentLifecycleStatusSchema,
  paymentProviderSchema,
  paginationQuerySchema,
  productCommercialInputSchema,
  productListParamsSchema,
  receivePackageRequestSchema,
  roleCodeSchema,
  settingsSchemaForTest,
  staffOrderListParamsSchema,
  staffPackageListParamsSchema,
} from "./test-exports.js";

describe("catálogos autoritativos", () => {
  it("conserva exactamente las 20 permissions y seis roles", () => {
    expect(PERMISSIONS).toHaveLength(20);
    expect(new Set(PERMISSIONS)).toHaveLength(20);
    expect(PERMISSIONS).toContain("orders.refund");
    expect(ROLE_CODES).toHaveLength(6);
    expect(roleCodeSchema.safeParse("WAREHOUSE").success).toBe(true);
    expect(roleCodeSchema.safeParse("OWNER").success).toBe(false);
  });

  it("conserva el catálogo común de errores", () => {
    expect(API_ERROR_CODES).toHaveLength(20);
    expect(
      apiErrorResponseSchema.safeParse({
        error: { code: "NOT_FOUND", message: "No encontrado" },
        requestId: "req-123",
      }).success,
    ).toBe(true);
  });
});

describe("fronteras de seguridad", () => {
  it("rechaza actor y organizationId en movimientos", () => {
    const result = createInventoryMovementRequestSchema.safeParse({
      inventoryItemId: "inventory-1",
      type: "ADJUSTMENT",
      quantity: 2,
      adjustmentDirection: "INCREASE",
      reason: "Conteo físico",
      actor: { id: "spoofed", name: "Spoofed" },
      organizationId: "other-tenant",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza actor en recepción de paquetes", () => {
    const result = receivePackageRequestSchema.safeParse({
      trackingCode: "PKG-100",
      carrier: "Chilexpress",
      customerId: "customer-1",
      contents: {
        description: "Caja",
        itemCount: 1,
        requiresColdStorage: false,
      },
      storageLocation: "Bodega A",
      actor: { id: "spoofed", name: "Spoofed" },
    });

    expect(result.success).toBe(false);
  });

  it("excluye estados terminales de transiciones genéricas", () => {
    expect(
      orderTransitionRequestSchema.safeParse({ toStatus: "CANCELLED" }).success,
    ).toBe(false);
    expect(packageTransitionTargetSchema.safeParse("PICKED_UP").success).toBe(
      false,
    );
  });
});

describe("integridad de DTO", () => {
  it("acepta checkout pickup sin confiar en totales ni identidad del cliente", () => {
    expect(
      createCheckoutRequestSchema.safeParse({
        items: [{ productId: "product-1", quantity: 2 }],
        fulfillmentMethod: "PICKUP",
        notes: "Entregar por la tarde",
      }).success,
    ).toBe(true);
    expect(
      createCheckoutRequestSchema.safeParse({
        items: [{ productId: "product-1", quantity: 2 }],
        fulfillmentMethod: "DELIVERY",
      }).success,
    ).toBe(false);
    expect(
      createCheckoutRequestSchema.safeParse({
        items: [{ productId: "product-1", quantity: 2 }],
        fulfillmentMethod: "PICKUP",
        total: 1,
        customerId: "spoofed",
      }).success,
    ).toBe(false);
  });

  it("rechaza productos duplicados y cantidades no enteras en checkout", () => {
    expect(
      createCheckoutRequestSchema.safeParse({
        items: [
          { productId: "product-1", quantity: 1 },
          { productId: "product-1", quantity: 2 },
        ],
        fulfillmentMethod: "PICKUP",
      }).success,
    ).toBe(false);
    expect(
      createCheckoutRequestSchema.safeParse({
        items: [{ productId: "product-1", quantity: 1.5 }],
        fulfillmentMethod: "PICKUP",
      }).success,
    ).toBe(false);
  });

  it("mantiene enums y mutaciones de pago estrictos", () => {
    expect(paymentProviderSchema.safeParse("MERCADOPAGO").success).toBe(true);
    expect(paymentProviderSchema.safeParse("mercadopago").success).toBe(false);
    expect(paymentLifecycleStatusSchema.safeParse("APPROVED").success).toBe(true);
    expect(paymentLifecycleStatusSchema.safeParse("AUTHORIZED").success).toBe(false);
    expect(
      createFullRefundRequestSchema.safeParse({ reason: "Solicitud aprobada" })
        .success,
    ).toBe(true);
    expect(
      createFullRefundRequestSchema.safeParse({
        reason: "Solicitud aprobada",
        amount: 100,
      }).success,
    ).toBe(false);
    expect(
      cancelPaymentRequestSchema.safeParse({ reason: "Compra abandonada" })
        .success,
    ).toBe(true);
  });

  it("valida la respuesta autoritativa de checkout", () => {
    const now = "2026-09-06T12:00:00.000Z";
    const payment = {
      id: "payment-1",
      orderId: "order-1",
      provider: "FAKE",
      status: "PENDING",
      amount: 10_000,
      currency: "CLP",
      providerExternalReference: "payment-1",
      createdAt: now,
      updatedAt: now,
    };
    expect(
      checkoutResponseSchema.safeParse({
        order: {
          id: "order-1",
          orderNumber: "CH-1001",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          fulfillmentMethod: "PICKUP",
          subtotal: 10_000,
          discountTotal: 0,
          deliveryFee: 0,
          total: 10_000,
          createdAt: now,
        },
        payment,
        attempt: {
          id: "attempt-1",
          paymentId: "payment-1",
          attemptNumber: 1,
          status: "PENDING",
          checkoutUrl: "https://payments.example.invalid/checkout/attempt-1",
          startedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        checkoutUrl: "https://payments.example.invalid/checkout/attempt-1",
        reservationExpiresAt: "2026-09-06T12:15:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rechaza CLP fraccional", () => {
    const result = productCommercialInputSchema.safeParse({
      sku: "SKU-1",
      slug: "producto-1",
      name: "Producto",
      categoryId: "category-1",
      salePrice: 1_999.5,
      published: true,
      active: true,
    });

    expect(result.success).toBe(false);
  });

  it("limita la paginación", () => {
    expect(paginationQuerySchema.safeParse({ page: "1", pageSize: "100" }).success).toBe(true);
    expect(paginationQuerySchema.safeParse({ page: "0", pageSize: "101" }).success).toBe(false);
  });

  it("interpreta booleanos de query sin convertir 'false' en true", () => {
    expect(booleanQuerySchema.parse("true")).toBe(true);
    expect(booleanQuerySchema.parse("false")).toBe(false);
    expect(productListParamsSchema.parse({ featured: "false" }).featured).toBe(
      false,
    );
    expect(
      staffPackageListParamsSchema.parse({ coldStorage: "false" }).coldStorage,
    ).toBe(false);
  });

  it("valida filtros operacionales por proveedor de pago", () => {
    expect(
      staffOrderListParamsSchema.safeParse({
        paymentProviders: ["MERCADOPAGO", "FAKE"],
      }).success,
    ).toBe(true);
    expect(
      staffOrderListParamsSchema.safeParse({
        paymentProviders: ["UNKNOWN"],
      }).success,
    ).toBe(false);
  });

  it("exige contexto customer o staff coherente", () => {
    const base = {
      user: {
        id: "user-1",
        email: "customer@example.cl",
        firstName: "Ana",
        lastName: "Pérez",
      },
      organization: { id: "org-1", slug: "ch-market", name: "CH Market" },
      authenticatedAt: "2026-08-31T12:00:00.000Z",
      permissions: [],
      csrfToken: "x".repeat(32),
    };

    expect(
      authSessionEnvelopeSchema.safeParse({
        session: {
          ...base,
          csrfToken: undefined,
          audience: "customer",
          customer: { id: "customer-1" },
        },
        csrfToken: base.csrfToken,
      }).success,
    ).toBe(false);
  });

  it("mantiene settings como request estricto", () => {
    expect(
      settingsSchemaForTest.safeParse({
        organizationName: "CH Market",
        locale: "es-CL",
        currency: "CLP",
        timezone: "America/Santiago",
        contactEmail: "contacto@example.cl",
        contactPhone: "+56 9 1111 1111",
        pickupAddress: "Dirección 123",
        pickupInstructions: "Presentar identificación",
        lowStockThreshold: 5,
        packageAlertDays: 3,
        expirationWarningDays: 7,
        organizationId: "forbidden",
      }).success,
    ).toBe(false);
  });
});
