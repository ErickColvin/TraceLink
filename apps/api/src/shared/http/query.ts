export function normalizeArrayQuery(
  query: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): Readonly<Record<string, unknown>> {
  const normalized: Record<string, unknown> = { ...query };
  for (const key of keys) {
    const value = normalized[key];
    if (typeof value === "string") normalized[key] = [value];
  }
  return normalized;
}
