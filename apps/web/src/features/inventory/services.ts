import { MockInventoryService } from "./services/mock-inventory-service";
import type { InventoryService } from "./services/inventory-service";

export const inventoryService: InventoryService = new MockInventoryService();
