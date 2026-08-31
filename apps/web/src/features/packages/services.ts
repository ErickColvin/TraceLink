import { MockPackageService } from "./services/mock-package-service";
import { MockStaffPackageService } from "./services/mock-staff-package-service";
import type { PackageService } from "./services/package-service";
import type { StaffPackageService } from "./services/staff-package-service";

export const packageService: PackageService = new MockPackageService();
export const staffPackageService: StaffPackageService = new MockStaffPackageService();
