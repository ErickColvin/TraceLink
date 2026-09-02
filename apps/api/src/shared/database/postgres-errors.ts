export function postgresErrorCode(error: unknown): string | undefined {
  const code =
    typeof error === "object" && error !== null
      ? Reflect.get(error, "code")
      : undefined;
  return typeof code === "string" ? code : undefined;
}

export function postgresConstraint(error: unknown): string | undefined {
  const constraint =
    typeof error === "object" && error !== null
      ? Reflect.get(error, "constraint")
      : undefined;
  return typeof constraint === "string" ? constraint : undefined;
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  return postgresErrorCode(error) === "23505";
}
