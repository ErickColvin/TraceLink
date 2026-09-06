import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright-core";

const baseUrl = process.env.TRACELINK_E2E_URL ?? "http://127.0.0.1:5173";
const credentials = Object.freeze({
  admin: {
    audience: "staff",
    email: process.env.TRACELINK_E2E_ADMIN_EMAIL ?? "admin@chmarket.test",
    password:
      process.env.TRACELINK_E2E_ADMIN_PASSWORD ?? "Test-Phase3-Admin!42",
  },
  customer: {
    audience: "customer",
    email:
      process.env.TRACELINK_E2E_CUSTOMER_EMAIL ?? "customer@chmarket.test",
    password:
      process.env.TRACELINK_E2E_CUSTOMER_PASSWORD ?? "Test-Phase3-Admin!42",
  },
});
const fixtures = Object.freeze({
  categoryName: "Categoría E2E",
  inventoryProductName: "Producto inventario E2E",
  orderNumber: "CHM-E2E-1001",
  packageTrackingCode: "CHM-E2E-PKG-1001",
});

function findBrowserExecutable() {
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    chromium.executablePath(),
    localAppData && join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    localAppData && join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFiles && join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    programFiles && join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    programFilesX86 && join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    programFilesX86 && join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

function isApiResponse(response, method, path) {
  const url = new URL(response.url());
  return response.request().method() === method && url.pathname === `/api/v1${path}`;
}

async function assertStatus(response, expectedStatus) {
  if (response.status() !== expectedStatus) {
    assert.fail(
      `${response.request().method()} ${response.url()} respondió ` +
        `${response.status()}: ${await response.text()}`,
    );
  }
}

async function step(name, operation) {
  process.stdout.write(`  • ${name}... `);
  try {
    await operation();
    process.stdout.write("OK\n");
  } catch (error) {
    process.stdout.write("FALLÓ\n");
    throw error;
  }
}

async function runWithCleanup(run, cleanupTasks) {
  let outcome;
  try {
    outcome = { succeeded: true, value: await run() };
  } catch (error) {
    outcome = { succeeded: false, error };
  }

  const cleanupFailures = [];
  for (const task of cleanupTasks) {
    try {
      await task.run();
    } catch (error) {
      cleanupFailures.push(new Error(`${task.label}: ${String(error)}`, { cause: error }));
    }
  }

  if (!outcome.succeeded) {
    if (cleanupFailures.length === 0) throw outcome.error;
    throw new AggregateError(
      [outcome.error, ...cleanupFailures],
      "FallÃ³ el flujo E2E y tambiÃ©n su limpieza.",
      { cause: outcome.error },
    );
  }
  if (cleanupFailures.length > 0) {
    throw new AggregateError(cleanupFailures, "FallÃ³ la limpieza del navegador E2E.");
  }
  return outcome.value;
}

async function signIn(page, identity, expectedPath) {
  if (new URL(page.url()).pathname !== "/login") {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  }
  await page.getByRole("heading", { name: "Inicia sesión" }).waitFor();
  await page.locator(`input[name="audience"][value="${identity.audience}"]`).check();
  await page.getByLabel("Correo electrónico").fill(identity.email);
  await page.getByLabel("Contraseña").fill(identity.password);
  const responsePromise = page.waitForResponse((response) =>
    isApiResponse(response, "POST", "/auth/login"),
  );
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  const response = await responsePromise;
  await assertStatus(response, 200);
  await page.waitForURL((url) => url.pathname === expectedPath);
}

async function verifyRestoredSession(page, audience) {
  const responsePromise = page.waitForResponse((response) =>
    isApiResponse(response, "GET", "/auth/me"),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const response = await responsePromise;
  await assertStatus(response, 200);
  const payload = await response.json();
  assert.equal(payload.session.audience, audience);
}

async function signOut(page) {
  const responsePromise = page.waitForResponse((response) =>
    isApiResponse(response, "POST", "/auth/logout"),
  );
  await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
  const response = await responsePromise;
  await assertStatus(response, 204);
  await page.waitForURL((url) => url.pathname === "/");
}

async function selectOptionContaining(select, text) {
  const option = select.locator("option").filter({ hasText: text }).first();
  const value = await option.getAttribute("value");
  assert.ok(value, `No se encontró la opción '${text}'.`);
  await select.selectOption(value);
}

const browserExecutable = findBrowserExecutable();
if (!browserExecutable) {
  throw new Error(
    "No se encontró Chromium, Chrome o Edge. Define CHROME_PATH para ejecutar test:e2e.",
  );
}

const browser = await chromium.launch({
  executablePath: browserExecutable,
  headless: true,
  args: process.platform === "linux" ? ["--no-sandbox"] : [],
});
const browserErrors = [];

await runWithCleanup(async () => {
  const customerContext = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1280, height: 900 },
  });
  const customerPage = await customerContext.newPage();
  customerPage.on("pageerror", (error) => browserErrors.push(error.message));

  await step("auth real: ruta protegida, login, /me y sesión restaurada", async () => {
    await customerPage.goto(`${baseUrl}/mi-cuenta/pedidos`, {
      waitUntil: "domcontentloaded",
    });
    await customerPage.waitForURL((url) =>
      url.pathname === "/login" && url.searchParams.has("returnTo"),
    );
    await signIn(customerPage, credentials.customer, "/mi-cuenta/pedidos");
    await customerPage.getByRole("heading", { name: "Mis pedidos" }).waitFor();
    await verifyRestoredSession(customerPage, "customer");
    await customerPage.getByRole("heading", { name: "Mis pedidos" }).waitFor();
  });

  await step("cliente: pedidos propios, paquetes y trazabilidad persistida", async () => {
    await customerPage.getByRole("heading", { name: fixtures.orderNumber }).waitFor();
    await customerPage
      .getByRole("link", { name: `Ver detalle de ${fixtures.orderNumber}` })
      .click();
    await customerPage.waitForURL("**/mi-cuenta/pedidos/**");
    await customerPage.getByRole("heading", { name: fixtures.orderNumber }).waitFor();
    await customerPage.getByRole("heading", { name: "Productos" }).waitFor();

    await customerPage.goto(`${baseUrl}/mi-cuenta/paquetes`);
    await customerPage.getByRole("heading", { name: "Mis paquetes" }).waitFor();
    await customerPage.getByLabel(/Buscar por código o contenido/i).fill(
      fixtures.packageTrackingCode,
    );
    await customerPage
      .getByRole("heading", { name: fixtures.packageTrackingCode })
      .waitFor();
    await customerPage.getByRole("link", { name: "Ver trazabilidad" }).click();
    await customerPage.waitForURL("**/mi-cuenta/paquetes/**");
    await customerPage.getByRole("heading", { name: "Recorrido del paquete" }).waitFor();
    await customerPage.getByText("Almacenado", { exact: true }).first().waitFor();
  });

  await step("auth real: logout invalida la sesión y vuelve a proteger rutas", async () => {
    await signOut(customerPage);
    await customerPage.goto(`${baseUrl}/mi-cuenta/paquetes`);
    await customerPage.waitForURL((url) => url.pathname === "/login");
  });
  await customerContext.close();

  const staffContext = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1440, height: 1000 },
  });
  const staffPage = await staffContext.newPage();
  staffPage.on("pageerror", (error) => browserErrors.push(error.message));

  await step("personal: login real y alta de producto por API", async () => {
    await signIn(staffPage, credentials.admin, "/app/dashboard");
    await staffPage.getByRole("heading", { name: "Dashboard" }).waitFor();
    await verifyRestoredSession(staffPage, "staff");
    await staffPage.goto(`${baseUrl}/app/products/new`);
    await staffPage.getByRole("heading", { name: "Nuevo producto" }).waitFor();
    await staffPage.getByLabel("SKU", { exact: true }).fill("E2E-NEW-2001");
    await staffPage.getByLabel("Nombre", { exact: true }).fill("Producto creado por E2E");
    await staffPage.getByLabel("Slug", { exact: true }).fill("producto-creado-por-e2e");
    await staffPage.getByLabel("Descripción (opcional)").fill(
      "Creado desde Playwright contra Express y PostgreSQL.",
    );
    await staffPage.getByLabel("Marca (opcional)").fill("TraceLink E2E");
    await staffPage.getByLabel("Categoría").selectOption({
      label: fixtures.categoryName,
    });
    await staffPage.getByLabel("Precio de venta (CLP)").fill("7990");
    await staffPage.getByLabel("Stock mínimo").fill("3");
    const responsePromise = staffPage.waitForResponse((response) =>
      isApiResponse(response, "POST", "/staff/products"),
    );
    await staffPage.getByRole("button", { name: "Crear producto" }).click();
    const response = await responsePromise;
    await assertStatus(response, 201);
    await staffPage.getByRole("heading", { name: "Producto creado por E2E" }).waitFor();
    await staffPage.getByRole("status").filter({
      hasText: "Producto creado correctamente",
    }).waitFor();
  });

  await step("personal: movimiento de inventario auditable", async () => {
    await staffPage.goto(`${baseUrl}/app/inventory/movements`);
    await staffPage.getByRole("heading", {
      name: "Movimientos de inventario",
    }).waitFor();
    const itemSelect = staffPage.getByLabel("Producto y lote");
    await selectOptionContaining(itemSelect, fixtures.inventoryProductName);
    await staffPage.getByLabel("Tipo de movimiento").selectOption("PURCHASE_RECEIPT");
    await staffPage.getByLabel("Cantidad").fill("3");
    await staffPage.getByLabel(/Motivo/).fill("Recepción E2E verificada");
    await staffPage.getByRole("button", { name: "Revisar movimiento" }).click();
    const dialog = staffPage.getByRole("alertdialog", {
      name: "Confirmar movimiento de inventario",
    });
    await dialog.waitFor();
    const responsePromise = staffPage.waitForResponse((response) =>
      isApiResponse(response, "POST", "/staff/inventory/movements"),
    );
    await dialog.getByRole("button", { name: "Registrar movimiento" }).click();
    const response = await responsePromise;
    await assertStatus(response, 201);
    await staffPage.getByRole("status").filter({
      hasText: fixtures.inventoryProductName,
    }).waitFor();
  });

  await step("personal: transición autoritativa de pedido", async () => {
    await staffPage.goto(`${baseUrl}/app/orders`);
    await staffPage.getByRole("heading", { name: "Cola de pedidos" }).waitFor();
    await staffPage.getByLabel("Buscar").fill(fixtures.orderNumber);
    await staffPage
      .getByRole("link", { name: `Ver detalle de ${fixtures.orderNumber}` })
      .click();
    await staffPage.getByRole("heading", { name: fixtures.orderNumber }).waitFor();
    const responsePromise = staffPage.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" &&
        /\/api\/v1\/staff\/orders\/[^/]+\/transitions$/u.test(url.pathname);
    });
    await staffPage.getByRole("button", { name: "Avanzar a En preparación" }).click();
    const response = await responsePromise;
    await assertStatus(response, 200);
    await staffPage.getByRole("status").filter({
      hasText: `${fixtures.orderNumber} avanzó a En preparación`,
    }).waitFor();
  });

  await step("personal: transición de paquete y nuevo evento de tracking", async () => {
    await staffPage.goto(`${baseUrl}/app/packages`);
    await staffPage.getByRole("heading", { name: "Paquetes" }).waitFor();
    await staffPage.getByLabel("Tracking").fill(fixtures.packageTrackingCode);
    await staffPage
      .getByRole("link", {
        name: `Ver trazabilidad de ${fixtures.packageTrackingCode}`,
      })
      .click();
    await staffPage.getByRole("heading", {
      name: fixtures.packageTrackingCode,
    }).waitFor();
    const responsePromise = staffPage.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === "POST" &&
        /\/api\/v1\/staff\/packages\/[^/]+\/transitions$/u.test(url.pathname);
    });
    await staffPage.getByRole("button", { name: "Marcar como Listo" }).click();
    const response = await responsePromise;
    await assertStatus(response, 200);
    await staffPage.getByRole("status").filter({
      hasText: `${fixtures.packageTrackingCode} avanzó a Listo para retiro`,
    }).waitFor();
  });
  await signOut(staffPage);
  await staffContext.close();

  const observerContext = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: 1280, height: 900 },
  });
  const observerPage = await observerContext.newPage();
  observerPage.on("pageerror", (error) => browserErrors.push(error.message));

  await step("cliente observa los cambios reales de pedido y paquete", async () => {
    await signIn(observerPage, credentials.customer, "/mi-cuenta");
    await observerPage.goto(`${baseUrl}/mi-cuenta/pedidos`);
    await observerPage.getByRole("heading", { name: fixtures.orderNumber }).waitFor();
    await observerPage.getByText("En preparación", { exact: true }).waitFor();
    await observerPage.goto(`${baseUrl}/mi-cuenta/paquetes`);
    await observerPage.getByLabel(/Buscar por código o contenido/i).fill(
      fixtures.packageTrackingCode,
    );
    await observerPage
      .getByRole("heading", { name: fixtures.packageTrackingCode })
      .waitFor();
    await observerPage.getByText("Listo", { exact: true }).waitFor();
    await observerPage.getByRole("link", { name: "Ver trazabilidad" }).click();
    await observerPage.getByText("Listo para retiro", { exact: true }).first().waitFor();
  });
  await observerContext.close();

  assert.deepEqual(browserErrors, [], `Errores de página: ${browserErrors.join(" | ")}`);
}, [{ label: "navegador E2E", run: () => browser.close() }]);
