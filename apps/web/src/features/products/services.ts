import { applicationServices } from "../service-composition";
import type { ProductService } from "./services/product-service";

export const productService: ProductService = applicationServices.productService;
