import { describe, expect, it } from "vitest";

import { mockStaffPackages } from "../data/mock-staff-packages";
import { getPackageStorageDuration } from "./package-storage-duration";

describe("getPackageStorageDuration", () => {
  it("measures an ongoing storage period against the supplied clock", () => {
    const storedPackage = mockStaffPackages.find(
      (candidate) => candidate.id === "package-ch-40991",
    );
    if (!storedPackage) throw new Error("Falta el paquete almacenado de prueba.");

    expect(
      getPackageStorageDuration(
        storedPackage,
        Date.parse("2026-08-30T18:00:00.000Z"),
      ),
    ).toMatchObject({
      storedSince: "2026-08-27T16:04:00.000Z",
      days: 3,
    });
  });

  it("stops counting when the package leaves storage", () => {
    const readyPackage = mockStaffPackages.find(
      (candidate) => candidate.id === "package-ch-41028",
    );
    if (!readyPackage) throw new Error("Falta el paquete listo de prueba.");

    expect(getPackageStorageDuration(readyPackage)).toMatchObject({
      storedSince: "2026-08-28T13:36:00.000Z",
      endedAt: "2026-08-29T13:25:00.000Z",
      hours: 23,
      days: 0,
    });
  });
});
