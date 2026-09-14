import { createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256(
  secret: string,
  purpose: string,
  value: string,
): Buffer {
  return createHmac("sha256", secret)
    .update("tracelink:v1\0")
    .update(purpose)
    .update("\0")
    .update(value)
    .digest();
}

export function secureBufferEquals(left: Buffer, right: Buffer): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Readonly<Record<string, unknown>>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
  return `{${entries.join(",")}}`;
}

