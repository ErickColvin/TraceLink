import { MockInventoryService } from "./inventory/services/mock-inventory-service";
import type { InventoryService } from "./inventory/services/inventory-service";
import { MockProductService } from "./products/services/mock-product-service";
import type { ProductService } from "./products/services/product-service";

const mockInventoryService = new MockInventoryService();
const mockProductService = new MockProductService(
  undefined,
  (productId) => mockInventoryService.getAvailableStockByProductId(productId),
);

export const inventoryService: InventoryService = mockInventoryService;
export const productService: ProductService = mockProductService;
