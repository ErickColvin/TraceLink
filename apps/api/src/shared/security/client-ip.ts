import { isIP, SocketAddress } from "node:net";

type ClientAddressSource = Readonly<{
  ip: string | undefined;
  socket: Readonly<{ remoteAddress: string | undefined }>;
}>;

export function canonicalizeIpAddress(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (candidate === undefined || candidate === "" || candidate.includes("%")) {
    return undefined;
  }

  const version = isIP(candidate);
  if (version === 0) return undefined;

  try {
    const canonical = new SocketAddress({
      address: candidate,
      family: version === 4 ? "ipv4" : "ipv6",
    }).address.toLowerCase();
    if (version === 6 && canonical.startsWith("::ffff:")) {
      const mappedIpv4 = canonical.slice("::ffff:".length);
      if (isIP(mappedIpv4) === 4) return mappedIpv4;
    }
    return canonical;
  } catch {
    return undefined;
  }
}

export function getCanonicalClientIp(request: ClientAddressSource): string {
  return (
    canonicalizeIpAddress(request.ip) ??
    canonicalizeIpAddress(request.socket.remoteAddress) ??
    "unknown"
  );
}
