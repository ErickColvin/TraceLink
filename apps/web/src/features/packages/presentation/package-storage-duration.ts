import type { StaffPackage } from "../domain";

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

export type PackageStorageDuration = Readonly<{
  storedSince: string;
  endedAt?: string;
  milliseconds: number;
  hours: number;
  days: number;
}>;

export function getPackageStorageDuration(
  customerPackage: StaffPackage,
  now = Date.now(),
): PackageStorageDuration | null {
  const storedEventIndex = customerPackage.events
    .map((event) => event.newStatus)
    .lastIndexOf("STORED");
  if (storedEventIndex < 0) return null;

  const storedEvent = customerPackage.events[storedEventIndex];
  if (!storedEvent) return null;
  const exitEvent = customerPackage.events
    .slice(storedEventIndex + 1)
    .find((event) => event.newStatus !== "STORED");
  const endTime = exitEvent ? Date.parse(exitEvent.createdAt) : now;
  const storedTime = Date.parse(storedEvent.createdAt);
  if (!Number.isFinite(endTime) || !Number.isFinite(storedTime)) return null;

  const milliseconds = Math.max(0, endTime - storedTime);
  return {
    storedSince: storedEvent.createdAt,
    endedAt: exitEvent?.createdAt,
    milliseconds,
    hours: Math.floor(milliseconds / HOUR_MS),
    days: Math.floor(milliseconds / DAY_MS),
  };
}
