import { applicationServices } from "../service-composition";
import type { PackageService } from "./services/package-service";
import type { StaffPackageService } from "./services/staff-package-service";

export const packageService: PackageService = applicationServices.packageService;
export const staffPackageService: StaffPackageService =
  applicationServices.staffPackageService;
