import type { AuthenticatedSession } from "../model/auth";

export const CUSTOMER_HOME_PATH = "/mi-cuenta";
export const STAFF_HOME_PATH = "/app/dashboard";
export const LOGIN_PATH = "/login";

type InternalLocation = Readonly<{
  pathname: string;
  search: string;
  hash: string;
}>;

export function sanitizeInternalPath(path: string | null): string | null {
  if (path === null || path.length === 0 || path.includes("\\")) {
    return null;
  }

  try {
    const decodedPath = decodeURIComponent(path);
    const containsControlCharacter = Array.from(decodedPath).some(
      (character) => {
        const characterCode = character.charCodeAt(0);
        return characterCode <= 31 || characterCode === 127;
      },
    );

    if (
      !decodedPath.startsWith("/") ||
      decodedPath.startsWith("//") ||
      decodedPath.includes("\\") ||
      containsControlCharacter
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return path;
}

export function createLoginPath(location: InternalLocation): string {
  const intendedPath = sanitizeInternalPath(
    `${location.pathname}${location.search}${location.hash}`,
  );

  if (intendedPath === null) {
    return LOGIN_PATH;
  }

  return `${LOGIN_PATH}?returnTo=${encodeURIComponent(intendedPath)}`;
}

export function resolvePostAuthPath(
  session: AuthenticatedSession,
  requestedPath: string | null,
): string {
  const defaultPath =
    session.kind === "customer" ? CUSTOMER_HOME_PATH : STAFF_HOME_PATH;
  const safePath = sanitizeInternalPath(requestedPath);

  if (safePath === null || isLoginPath(safePath)) {
    return defaultPath;
  }

  if (session.kind === "customer" && isStaffPath(safePath)) {
    return defaultPath;
  }

  if (session.kind === "staff" && isCustomerPath(safePath)) {
    return defaultPath;
  }

  return safePath;
}

function isLoginPath(path: string): boolean {
  return path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}?`);
}

function isStaffPath(path: string): boolean {
  return path === "/app" || path.startsWith("/app/");
}

function isCustomerPath(path: string): boolean {
  return path === CUSTOMER_HOME_PATH || path.startsWith(`${CUSTOMER_HOME_PATH}/`);
}
