import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(
    mode,
    fileURLToPath(new URL("../..", import.meta.url)),
    "",
  );

  return {
    envDir: "../..",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": {
          target:
            environment.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3001",
          changeOrigin: false,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("react-router") || id.includes("react-dom") || id.includes("/react/")) {
                return "vendor-react";
              }
              if (id.includes("@tanstack")) return "vendor-query";
              if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("/zod/")) {
                return "vendor-forms";
              }
              if (id.includes("lucide-react")) return "vendor-icons";
              return "vendor";
            }
            if (
              id.includes("/features/service-composition") ||
              id.includes("/features/mock-context") ||
              id.includes("/features/") && id.includes("/data/mock-") ||
              id.includes("/features/") && id.includes("/services/mock-")
            ) {
              return "application-services";
            }
            return undefined;
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
      css: true,
      testTimeout: 10_000,
    },
  };
});
