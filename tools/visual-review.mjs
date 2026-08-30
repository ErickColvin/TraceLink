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
const outputDirectory = join(tmpdir(), "tracelink-visual-review-20260829");
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const unexpectedOverflows = [];

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

try {
  for (const viewport of [
    { name: "home-375", width: 375, height: 1200 },
    { name: "home-768", width: 768, height: 1200 },
    { name: "home-1024", width: 1024, height: 900 },
    { name: "home-1440", width: 1440, height: 1000 },
  ]) {
    await capture(viewport.name, viewport.width, viewport.height, "/");
  }

  await capture("catalog-375", 375, 1200, "/productos");
  await capture(
    "product-detail-768",
    768,
    1100,
    "/productos/filetes-de-merluza-austral-800-g",
  );
  await capture("login-375", 375, 1000, "/login");

  await page.getByRole("button", { name: "Entrar como cliente" }).click();
  await page.waitForURL("**/mi-cuenta");
  await page.getByRole("link", { name: "Mis paquetes" }).first().click();
  await page.waitForURL("**/mi-cuenta/paquetes");
  const packageSearch = page.getByLabel(/Buscar por código o contenido/i);
  await packageSearch.fill("Pescado");
  await page.getByText("CHM-40991-CL").waitFor();
  assertReview(
    (await page.getByText("CHM-41028-CL").count()) === 0,
    "La búsqueda por contenido de paquete no filtró los resultados.",
  );
  await packageSearch.fill("");
  await page.getByText("CHM-41028-CL").waitFor();
  await page.locator('a[href="/mi-cuenta/paquetes/package-ch-41028"]').click();
  await page.waitForURL("**/mi-cuenta/paquetes/package-ch-41028");
  await waitForUi();
  await capture("customer-tracking-375", 375, 1100);

  await page.getByRole("button", { name: "Cerrar sesión" }).last().click();
  await page.waitForURL(`${baseUrl}/`);
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await waitForUi();
  await page.getByRole("button", { name: "Entrar como personal" }).click();
  await page.waitForURL("**/app/dashboard");
  await waitForUi();
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

  if (unexpectedOverflows.length > 0) {
    throw new Error(
      `Se detectó overflow horizontal en: ${unexpectedOverflows.join(", ")}`,
    );
  }
} finally {
  await browser.close();
}
