import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { RouteFocusManager } from "@/app/route-focus-manager";
import { AppRouter } from "@/app/router";
import "@/styles/index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el contenedor raíz de la aplicación.");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <RouteFocusManager />
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
);
