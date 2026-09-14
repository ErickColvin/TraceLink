import type { PackageStatus } from "../domain";

const STANDARD_NEXT_STATUS: Readonly<
  Partial<Record<PackageStatus, PackageStatus>>
> = {
  EXPECTED: "RECEIVED",
  RECEIVED: "STORED",
  STORED: "READY_FOR_PICKUP",
  READY_FOR_PICKUP: "PICKED_UP",
};

const ALLOWED_TRANSITIONS: Readonly<Record<PackageStatus, readonly PackageStatus[]>> = {
  EXPECTED: ["RECEIVED", "INCIDENT", "LOST"],
  RECEIVED: ["STORED", "INCIDENT", "RETURNED", "LOST"],
  STORED: ["READY_FOR_PICKUP", "INCIDENT", "RETURNED", "LOST"],
  READY_FOR_PICKUP: ["PICKED_UP", "INCIDENT", "RETURNED", "LOST"],
  INCIDENT: ["STORED", "RETURNED", "LOST"],
  PICKED_UP: [],
  RETURNED: [],
  LOST: [],
};

export const PACKAGE_EXCEPTION_STATUSES = [
  "INCIDENT",
  "RETURNED",
  "LOST",
] as const satisfies readonly PackageStatus[];

export type PackageExceptionStatus =
  (typeof PACKAGE_EXCEPTION_STATUSES)[number];

export function getNextStandardPackageStatus(
  status: PackageStatus,
): PackageStatus | null {
  return STANDARD_NEXT_STATUS[status] ?? null;
}

export function getAllowedPackageTransitions(
  status: PackageStatus,
): readonly PackageStatus[] {
  return ALLOWED_TRANSITIONS[status];
}

export function canTransitionPackage(
  fromStatus: PackageStatus,
  toStatus: PackageStatus,
): boolean {
  return ALLOWED_TRANSITIONS[fromStatus].includes(toStatus);
}

export function isPackageExceptionStatus(
  status: PackageStatus,
): status is PackageExceptionStatus {
  return PACKAGE_EXCEPTION_STATUSES.some((candidate) => candidate === status);
}
