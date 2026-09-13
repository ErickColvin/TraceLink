import { applicationServices } from "../service-composition";
import type { InventoryService } from "./services/inventory-service";

export const inventoryService: InventoryService =
  applicationServices.inventoryService;
