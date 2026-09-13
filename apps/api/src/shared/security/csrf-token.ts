import { randomBytes } from "node:crypto";

import { hmacSha256, secureBufferEquals } from "./fingerprint.js";

const CSRF_PATTERN = /^v1\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/;

function csrfMessage(
  sessionId: string,
  sessionTokenHash: Buffer,
  nonce: string,
): string {
  return `${sessionId}.${sessionTokenHash.toString("base64url")}.${nonce}`;
}

export function createCsrfToken(
  secret: string,
  sessionId: string,
  sessionTokenHash: Buffer,
): string {
  const nonce = randomBytes(16).toString("base64url");
  const signature = hmacSha256(
    secret,
    "csrf-token",
    csrfMessage(sessionId, sessionTokenHash, nonce),
  ).toString("base64url");
  return `v1.${nonce}.${signature}`;
}

export function verifyCsrfToken(
  secret: string,
  sessionId: string,
  sessionTokenHash: Buffer,
  token: string,
): boolean {
  const match = CSRF_PATTERN.exec(token);
  const nonce = match?.[1];
  const signature = match?.[2];
  if (nonce === undefined || signature === undefined) return false;

  const expected = hmacSha256(
    secret,
    "csrf-token",
    csrfMessage(sessionId, sessionTokenHash, nonce),
  );
  const received = Buffer.from(signature, "base64url");
  return secureBufferEquals(expected, received);
}

