import { parseCookie, stringifySetCookie } from "cookie";

export const PRODUCTION_SESSION_COOKIE = "__Host-tl_session";
export const DEVELOPMENT_SESSION_COOKIE = "tl_session_dev";

export function getSessionCookieName(nodeEnv: string): string {
  return nodeEnv === "production"
    ? PRODUCTION_SESSION_COOKIE
    : DEVELOPMENT_SESSION_COOKIE;
}

export function readSessionCookie(
  cookieHeader: string | undefined,
  cookieName: string,
): string | undefined {
  if (cookieHeader === undefined) return undefined;
  try {
    return parseCookie(cookieHeader)[cookieName];
  } catch {
    return undefined;
  }
}

export function serializeSessionCookie(options: Readonly<{
  name: string;
  token: string;
  maxAgeSeconds: number;
  secure: boolean;
}>): string {
  return stringifySetCookie({
    name: options.name,
    value: options.token,
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeSeconds,
    priority: "high",
  });
}

export function serializeExpiredSessionCookie(options: Readonly<{
  name: string;
  secure: boolean;
}>): string {
  return stringifySetCookie({
    name: options.name,
    value: "",
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    priority: "high",
  });
}
