import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chromePath) {
  throw new Error("No se encontró Chrome o Edge. Define CHROME_PATH para ejecutar la revisión.");
}

const baseUrl = process.env.TRACELINK_URL ?? "http://127.0.0.1:5173";
const reviewDate = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const outputDirectory = join(tmpdir(), `tracelink-visual-review-${reviewDate}`);
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const unexpectedOverflows = [];
const pageErrors = [];

page.on("pageerror", (error) => pageErrors.push(error.message));

function assertReview(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForUi() {
  await page.locator("#root").waitFor({ state: "attached" });
  await page.waitForTimeout(700);
}

async function capture(name, width, height, path) {
  await page.setViewportSize({ width, height });
  if (path) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
    await waitForUi();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const metrics = await page.evaluate(() => {
    const overflowing = [...document.querySelectorAll("body *")]
      .filter(
        (element) =>
          !element.closest('[data-allow-horizontal-overflow="true"]'),
      )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === "string" ? element.className : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.right > window.innerWidth + 1 || item.left < -1)
      .slice(0, 8);

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      path: window.location.pathname,
      overflowing,
    };
  });

  const screenshotPath = join(outputDirectory, `${name}.png`);
  await page.screenshot({ path: screenshotPath, animations: "disabled" });
  process.stdout.write(`${name}: ${JSON.stringify(metrics)} -> ${screenshotPath}\n`);
  if (metrics.scrollWidth > metrics.innerWidth) {
    unexpectedOverflows.push(name);
  }
  return metrics;
}

async function openAdminRoute(linkName, expectedPath, heading) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const navigation = page.getByRole("navigation", {
    name: "Navegación administrativa",
  });
  await navigation.getByRole("link", { name: linkName, exact: true }).click();
  await page.waitForURL(`**${expectedPath}`);
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}

try {
  for (const viewport of [
    { name: "home-375", width: 375, height: 1200 },
    { name: "home-768", width: 768, height: 1200 },
    { name: "home-1024", width: 1024, height: 900 },
    { name: "home-1440", width: 1440, height: 1000 },
  ]) {
    await capture(viewport.name, viewport.width, viewport.height, "/");
  }

  // Public: Home → Catalog → Product → Cart → Checkout.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await waitForUi();
  await page.getByRole("link", { name: "Productos", exact: true }).first().click();
  await page.waitForURL("**/productos");
  await page.getByRole("heading", {
    name: "Encuentra lo que necesitas, sin vueltas",
  }).waitFor();
  await capture("catalog-1440", 1440, 1000);

  await page
    .locator('a[href="/productos/filetes-de-merluza-austral-800-g"]')
    .first()
    .click();
  await page.waitForURL("**/productos/filetes-de-merluza-austral-800-g");
  await page.getByRole("heading", { name: "Filetes de merluza austral 800 g" }).waitFor();
  await capture("product-detail-768", 768, 1100);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "1 unidad agregada al carrito." })
    .waitFor();
  await page.getByRole("link", { name: "Carrito con 1 producto" }).click();
  await page.waitForURL("**/carrito");
  await page.getByRole("heading", { name: "Carrito" }).waitFor();
  await capture("cart-375", 375, 1100);

  await page.getByRole("link", { name: "Continuar al checkout" }).click();
  await page.waitForURL("**/checkout");
  await page.getByRole("heading", { name: "Prepara tu pedido" }).waitFor();
  await capture("checkout-375", 375, 1200);
  await page.getByLabel("Nombre", { exact: true }).fill("Ana");
  await page.getByLabel("Apellido", { exact: true }).fill("Pérez");
  await page.getByLabel("Correo", { exact: true }).fill("ana.perez@example.cl");
  await page.getByLabel("Teléfono", { exact: true }).fill("+56 9 1234 5678");
  await page.getByRole("button", { name: "Simular pedido" }).click();
  await page.getByRole("heading", { name: "Pedido recibido" }).waitFor();
  assertReview(
    (await page.getByText(/CH-\d+/).count()) > 0,
    "El checkout no generó el código visual del pedido.",
  );
  await capture("checkout-success-768", 768, 1000);

  // Customer: Login → My Account → Orders → Packages → Tracking.
  await capture("login-375", 375, 1000, "/login");
  await page.getByRole("button", { name: "Entrar como cliente" }).click();
  await page.waitForURL("**/mi-cuenta");
  await page.getByRole("heading", { name: /Hola,/ }).waitFor();
  await capture("customer-home-375", 375, 1100);

  let customerNavigation = page.getByRole("navigation", {
    name: "Navegación de mi cuenta",
  }).first();
  await customerNavigation.getByRole("link", { name: "Mis pedidos" }).click();
  await page.waitForURL("**/mi-cuenta/pedidos");
  await page.getByRole("heading", { name: "Mis pedidos" }).waitFor();
  await capture("customer-orders-768", 768, 1100);

  customerNavigation = page.getByRole("navigation", {
    name: "Navegación de mi cuenta",
  }).first();
  await customerNavigation.getByRole("link", { name: "Mis paquetes" }).click();
  await page.waitForURL("**/mi-cuenta/paquetes");
  const packageSearch = page.getByLabel(/Buscar por código o contenido/i);
  await packageSearch.fill("Pescado");
  await page.getByRole("heading", { name: "CHM-40991-CL" }).waitFor();
  assertReview(
    (await page.getByRole("heading", { name: "CHM-41028-CL" }).count()) === 0,
    "La búsqueda por contenido de paquete no filtró los resultados.",
  );
  await packageSearch.fill("");
  await page.getByRole("heading", { name: "CHM-41028-CL" }).waitFor();
  await page.locator('a[href="/mi-cuenta/paquetes/package-ch-41028"]').click();
  await page.waitForURL("**/mi-cuenta/paquetes/package-ch-41028");
  await page.getByRole("heading", { name: "Recorrido del paquete" }).waitFor();
  await capture("customer-tracking-375", 375, 1100);

  await page.getByRole("button", { name: "Cerrar sesión" }).last().click();
  await page.waitForURL(`${baseUrl}/`);

  // Staff shell and accessible mobile drawer.
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await waitForUi();
  await page.getByRole("button", { name: "Entrar como personal" }).click();
  await page.waitForURL("**/app/dashboard");
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  await capture("admin-dashboard-1024", 1024, 900);
  await capture("admin-dashboard-375", 375, 1000);

  await page.getByRole("button", { name: "Abrir menú administrativo" }).click();
  const adminDialog = page.getByRole("dialog", { name: "Menú administrativo" });
  await adminDialog.waitFor();
  const openDrawerState = await page.evaluate(() => {
    const content = document.querySelector("[data-admin-content]");
    const dialog = document.querySelector('[role="dialog"]');
    return {
      backgroundIsInert: content instanceof HTMLElement && content.inert,
      bodyScrollIsLocked: document.body.style.overflow === "hidden",
      focusIsInsideDialog:
        dialog instanceof HTMLElement && dialog.contains(document.activeElement),
    };
  });
  assertReview(
    Object.values(openDrawerState).every(Boolean),
    `El drawer administrativo no aisló correctamente el fondo: ${JSON.stringify(openDrawerState)}`,
  );
  await page.keyboard.press("Escape");
  await adminDialog.waitFor({ state: "hidden" });
  await page.waitForTimeout(100);
  const closedDrawerState = await page.evaluate(() => ({
    backgroundIsInteractive:
      document.querySelector("[data-admin-content]") instanceof HTMLElement &&
      !document.querySelector("[data-admin-content]").inert,
    bodyScrollIsRestored: document.body.style.overflow !== "hidden",
    focusReturnedToTrigger:
      document.activeElement?.getAttribute("aria-label") ===
      "Abrir menú administrativo",
  }));
  assertReview(
    Object.values(closedDrawerState).every(Boolean),
    `El drawer administrativo no restauró correctamente el fondo: ${JSON.stringify(closedDrawerState)}`,
  );

  await page.getByRole("button", { name: "Abrir menú administrativo" }).click();
  await adminDialog.waitFor();
  await page.setViewportSize({ width: 1024, height: 900 });
  await adminDialog.waitFor({ state: "hidden" });
  const resizedDrawerState = await page.evaluate(() => {
    const content = document.querySelector("[data-admin-content]");
    return {
      backgroundIsInteractive: content instanceof HTMLElement && !content.inert,
      bodyScrollIsRestored: document.body.style.overflow !== "hidden",
    };
  });
  assertReview(
    Object.values(resizedDrawerState).every(Boolean),
    `El drawer bloqueó la vista al cambiar a desktop: ${JSON.stringify(resizedDrawerState)}`,
  );

  // Staff: Products → Inventory → Orders → Packages → Customers.
  await openAdminRoute("Productos", "/app/products", "Productos");
  await capture("admin-products-1440", 1440, 1000);
  await capture("admin-products-375", 375, 1100);

  await openAdminRoute("Inventario", "/app/inventory", "Inventario");
  await capture("admin-inventory-1440", 1440, 1000);
  await capture("admin-inventory-768", 768, 1100);

  await openAdminRoute("Pedidos", "/app/orders", "Cola de pedidos");
  await capture("admin-orders-1440", 1440, 1000);
  await capture("admin-orders-768", 768, 1100);

  await openAdminRoute("Paquetes", "/app/packages", "Paquetes");
  await capture("admin-packages-1440", 1440, 1000);
  await capture("admin-packages-768", 768, 1100);

  await openAdminRoute("Clientes", "/app/customers", "Clientes");
  await capture("admin-customers-1440", 1440, 1000);
  await capture("admin-customers-375", 375, 1100);

  // Package critical flow: Receive → Store → Ready → Pickup.
  await openAdminRoute("Paquetes", "/app/packages", "Paquetes");
  await page.getByRole("link", { name: "Recibir paquete" }).click();
  await page.waitForURL("**/app/packages/new");
  await page.getByRole("heading", { name: "Recibir paquete" }).waitFor();
  await page
    .getByLabel("Cliente", { exact: true })
    .selectOption("customer-valentina-rojas");
  await page.getByLabel("Código de seguimiento").fill("CHM-E2E-9001");
  await page.getByLabel("Transportista").fill("Blue Express");
  await page.getByLabel("Descripción del contenido").fill("Pedido E2E congelado");
  await page.getByLabel("Cantidad de artículos").fill("2");
  await page.getByLabel("Requiere cadena de frío").check();
  await page.getByLabel("Ubicación inicial").fill("Cámara fría · E2E-01");
  await page.getByLabel("Notas operativas (opcional)").fill("Recepción crítica Playwright");
  await page.getByRole("button", { name: "Registrar recepción" }).click();
  await page.waitForURL("**/app/packages/**?received=1");
  await page.getByRole("heading", { name: "CHM-E2E-9001" }).waitFor();
  await page.getByRole("status").filter({ hasText: "Recepción registrada" }).waitFor();
  await capture("package-flow-received-1024", 1024, 1000);

  await page.getByLabel("Ubicación de almacenamiento").fill("Cámara fría · E2E-02");
  await page.getByRole("button", { name: "Marcar como Almacenado" }).click();
  await page.getByRole("status").filter({ hasText: "avanzó a Almacenado" }).waitFor();
  await page.getByRole("button", { name: "Marcar como Listo" }).waitFor();
  await capture("package-flow-stored-1024", 1024, 1000);

  await page.getByRole("button", { name: "Marcar como Listo" }).click();
  await page.getByRole("status").filter({ hasText: "avanzó a Listo para retiro" }).waitFor();
  await page.getByRole("button", { name: "Confirmar entrega" }).waitFor();
  await capture("package-flow-ready-1024", 1024, 1000);

  await page.getByRole("button", { name: "Confirmar entrega" }).click();
  const deliveryDialog = page.getByRole("alertdialog", {
    name: "Entregar CHM-E2E-9001",
  });
  await deliveryDialog.waitFor();
  await deliveryDialog.getByLabel("Código de retiro").fill("4821");
  await deliveryDialog.getByLabel("Nombre de quien recibe").fill("Valentina Rojas");
  await deliveryDialog.getByRole("button", { name: "Confirmar entrega" }).click();
  await page.getByRole("status").filter({ hasText: "Entrega confirmada" }).waitFor();
  await page.getByRole("heading", { name: "Comprobante de entrega" }).waitFor();
  await page.getByText("Código: verificado, no almacenado").waitFor();
  await capture("package-flow-picked-up-1024", 1024, 1000);

  if (unexpectedOverflows.length > 0) {
    throw new Error(
      `Se detectó overflow horizontal en: ${unexpectedOverflows.join(", ")}`,
    );
  }
  if (pageErrors.length > 0) {
    throw new Error(`Errores de página detectados: ${pageErrors.join(" | ")}`);
  }
} finally {
  await browser.close();
}
