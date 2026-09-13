const webUrl = requireOrigin("SMOKE_WEB_URL");
const apiUrl = requireOrigin("SMOKE_API_URL");

const checks = [
  { label: "frontend", url: webUrl },
  { label: "SPA /mi-cuenta", url: new URL("/mi-cuenta", webUrl).toString() },
  {
    label: "SPA checkout result",
    url: new URL("/checkout/resultado", webUrl).toString(),
  },
  {
    expectedStatus: "ok",
    label: "API health",
    url: new URL("/api/v1/health", apiUrl).toString(),
  },
  {
    expectedStatus: "ready",
    label: "API readiness",
    url: new URL("/api/v1/health/ready", apiUrl).toString(),
  },
];

for (const check of checks) {
  await waitUntilHealthy(check);
}

process.stdout.write(`Smoke deployment passed (${checks.length} checks).\n`);

function requireOrigin(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an HTTPS origin without credentials or path.`);
  }
  return url.origin;
}

async function waitUntilHealthy(check) {
  const deadline = Date.now() + 5 * 60_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(check.url, {
        headers: { "user-agent": "TraceLink-deployment-smoke/1.0" },
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (check.expectedStatus) {
        const payload = await response.json();
        if (payload?.status !== check.expectedStatus) {
          throw new Error(`unexpected status ${String(payload?.status)}`);
        }
      }
      process.stdout.write(`PASS ${check.label}\n`);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
  }

  throw new Error(`${check.label} did not become healthy.`, {
    cause: lastError,
  });
}
