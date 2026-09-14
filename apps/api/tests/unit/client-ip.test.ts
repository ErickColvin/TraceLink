import { describe, expect, it } from "vitest";

import {
  canonicalizeIpAddress,
  getCanonicalClientIp,
} from "../../src/shared/security/client-ip.js";

describe("client IP canonicalization", () => {
  it("collapses equivalent IPv6 and IPv4-mapped spellings", () => {
    expect(canonicalizeIpAddress("2001:0db8:0:0:0:0:0:1")).toBe("2001:db8::1");
    expect(canonicalizeIpAddress("::ffff:c000:0201")).toBe("192.0.2.1");
    expect(canonicalizeIpAddress("::ffff:192.0.2.1")).toBe("192.0.2.1");
  });

  it("falls back to the socket address for attacker-controlled invalid input", () => {
    expect(
      getCanonicalClientIp({
        ip: "rotating-host.example:1234",
        socket: { remoteAddress: "::ffff:127.0.0.1" },
      }),
    ).toBe("127.0.0.1");
  });

  it("uses one constant when neither address is valid", () => {
    expect(
      getCanonicalClientIp({ ip: "invalid-one", socket: { remoteAddress: "invalid-two" } }),
    ).toBe("unknown");
  });
});
