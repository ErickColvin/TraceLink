import { randomBytes } from "node:crypto";

import { hmacSha256, secureBufferEquals } from "../../shared/security/fingerprint.js";

const PICKUP_CODE_PURPOSE = "package-pickup-code";

export function generatePickupCode(): string {
  return randomBytes(12).toString("base64url");
}

export function hashPickupCode(
  secret: string,
  organizationId: string,
  packageId: string,
  pickupCode: string,
): Buffer {
  return hmacSha256(
    secret,
    PICKUP_CODE_PURPOSE,
    `${organizationId}\0${packageId}\0${pickupCode}`,
  );
}

export function verifyPickupCode(
  secret: string,
  organizationId: string,
  packageId: string,
  pickupCode: string,
  expectedHash: Buffer,
): boolean {
  return secureBufferEquals(
    hashPickupCode(secret, organizationId, packageId, pickupCode),
    expectedHash,
  );
}
