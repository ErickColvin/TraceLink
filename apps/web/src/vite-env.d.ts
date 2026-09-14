/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_DATA_MODE?: "mock" | "http";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
