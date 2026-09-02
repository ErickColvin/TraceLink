import { randomBytes } from "node:crypto";

import { hmacSha256 } from "./fingerprint.js";

const SESSION_TOKEN_PATTERN = /^v1\.[A-Za-z0-9_-]{43}$/;

export function generateSessionToken(): string {
  return `v1.${randomBytes(32).toString("base64url")}`;
}

export function isSessionToken(value: string): boolean {
  return SESSION_TOKEN_PATTERN.test(value);
}

export function hashSessionToken(secret: string, token: string): Buffer {
  return hmacSha256(secret, "session-token", token);
}

