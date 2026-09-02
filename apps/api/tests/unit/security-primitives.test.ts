import { describe, expect, it } from "vitest";

import { createCsrfToken, verifyCsrfToken } from "../../src/shared/security/csrf-token.js";
import { hmacSha256, stableJson } from "../../src/shared/security/fingerprint.js";
import { hashPassword, verifyPassword, verifyPasswordWithoutEnumeration } from "../../src/shared/security/password.js";
import {
  DEVELOPMENT_SESSION_COOKIE,
  PRODUCTION_SESSION_COOKIE,
  getSessionCookieName,
  readSessionCookie,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
} from "../../src/shared/security/session-cookie.js";
import { generateSessionToken, hashSessionToken, isSessionToken } from "../../src/shared/security/session-token.js";

const secret = "security-test-secret-with-at-least-32-characters";

describe("security primitives", () => {
  it("hashes passwords with Argon2id and safely rejects malformed hashes", async () => {
    const passwordHash = await hashPassword("a secure test password");
    expect(passwordHash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(passwordHash, "a secure test password")).resolves.toBe(true);
    await expect(verifyPassword(passwordHash, "wrong password")).resolves.toBe(false);
    await expect(verifyPassword("not-a-hash", "password")).resolves.toBe(false);
    await expect(verifyPasswordWithoutEnumeration(undefined, "password")).resolves.toBe(false);
  });

  it("generates opaque session tokens and stores only a deterministic HMAC", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();
    expect(isSessionToken(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(hashSessionToken(secret, first)).toHaveLength(32);
    expect(hashSessionToken(secret, first)).toEqual(hashSessionToken(secret, first));
  });

  it("binds CSRF tokens to both the session id and token hash", () => {
    const tokenHash = hmacSha256(secret, "session", "one");
    const csrf = createCsrfToken(secret, "session-1", tokenHash);
    expect(verifyCsrfToken(secret, "session-1", tokenHash, csrf)).toBe(true);
    expect(verifyCsrfToken(secret, "session-2", tokenHash, csrf)).toBe(false);
    expect(verifyCsrfToken(secret, "session-1", Buffer.alloc(32), csrf)).toBe(false);
    expect(verifyCsrfToken(secret, "session-1", tokenHash, `${csrf}x`)).toBe(false);
  });

  it("uses hardened production cookies and a separate localhost name", () => {
    expect(getSessionCookieName("production")).toBe(PRODUCTION_SESSION_COOKIE);
    expect(getSessionCookieName("development")).toBe(DEVELOPMENT_SESSION_COOKIE);
    const value = serializeSessionCookie({
      name: PRODUCTION_SESSION_COOKIE,
      token: generateSessionToken(),
      maxAgeSeconds: 3_600,
      secure: true,
    });
    expect(value).toContain("HttpOnly");
    expect(value).toContain("Secure");
    expect(value).toContain("SameSite=Lax");
    expect(value).toContain("Path=/");
    expect(value).not.toContain("Domain=");
    expect(readSessionCookie(value, PRODUCTION_SESSION_COOKIE)).toMatch(/^v1\./);
    expect(serializeExpiredSessionCookie({ name: PRODUCTION_SESSION_COOKIE, secure: true })).toContain("Max-Age=0");
  });

  it("canonicalizes JSON before request fingerprinting", () => {
    expect(stableJson({ b: 2, a: { d: 4, c: 3 } })).toBe(
      stableJson({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});
