import argon2 from "argon2";

const ARGON2ID_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19 * 1_024,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
});

let dummyHashPromise: Promise<string> | undefined;

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2ID_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

async function getDummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(
    `dummy-login-comparison-${crypto.randomUUID()}`,
  );
  return dummyHashPromise;
}

/** Performs one Argon2 verification even when no account was found. */
export async function verifyPasswordWithoutEnumeration(
  storedHash: string | undefined,
  password: string,
): Promise<boolean> {
  const passwordHash = storedHash ?? (await getDummyPasswordHash());
  const matches = await verifyPassword(passwordHash, password);
  return storedHash === undefined ? false : matches;
}
