import { MockPackageService } from "./services/mock-package-service";
import type { PackageService } from "./services/package-service";

export const packageService: PackageService = new MockPackageService();
