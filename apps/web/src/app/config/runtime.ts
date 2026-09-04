export const DATA_MODES = ["mock", "http"] as const;

export type DataMode = (typeof DATA_MODES)[number];

export type RuntimeConfig = Readonly<{
  apiBaseUrl: string;
  dataMode: DataMode;
}>;

export function parseDataMode(value: string | undefined): DataMode {
  if (value === undefined || value === "") return "mock";
  if (value === "mock" || value === "http") return value;

  throw new Error(
    `VITE_DATA_MODE debe ser 'mock' o 'http'; se recibió '${value}'.`,
  );
}

export function normalizeApiBaseUrl(value: string | undefined): string {
  const baseUrl = (value?.trim() || "/api/v1").replace(/\/+$/, "");
  if (/^https?:\/\//iu.test(baseUrl) || baseUrl.startsWith("/")) {
    return baseUrl;
  }
  return `/${baseUrl}`;
}

export function readRuntimeConfig(
  environment: Readonly<{
    VITE_API_BASE_URL?: string;
    VITE_DATA_MODE?: string;
  }> = import.meta.env,
): RuntimeConfig {
  return Object.freeze({
    apiBaseUrl: normalizeApiBaseUrl(environment.VITE_API_BASE_URL),
    dataMode: parseDataMode(environment.VITE_DATA_MODE),
  });
}

export const runtimeConfig = readRuntimeConfig();
