import { MockProductService } from "./services/mock-product-service";
import type { ProductService } from "./services/product-service";

export const productService: ProductService = new MockProductService();
