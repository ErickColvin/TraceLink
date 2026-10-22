const apiUrl = requireOrigin("RELEASE_API_URL");
const expectedCommit = requireCommit("RELEASE_COMMIT");
const timeoutMinutes = requireMinutes("RELEASE_TIMEOUT_MINUTES", 25);
const liveUrl = new URL("/api/v1/health/live", apiUrl).toString();
const deadline = Date.now() + timeoutMinutes * 60_000;
let lastObserved;

while (Date.now() < deadline) {
  const observed = await readReleasedCommit();
  if (observed === expectedCommit) {
    process.stdout.write(`PASS API serves ${expectedCommit}\n`);
    process.exit(0);
  }
  if (observed !== lastObserved) {
    process.stdout.write(`Waiting: API reports ${observed}\n`);
    lastObserved = observed;
  }
  await new Promise((resolve) => setTimeout(resolve, 15_000));
}

throw new Error(
  `API did not serve ${expectedCommit} within ${timeoutMinutes} minutes (last: ${lastObserved}).`,
);

async function readReleasedCommit() {
  try {
    const response = await fetch(liveUrl, {
      headers: { "user-agent": "TraceLink-release-wait/1.0" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return `HTTP ${response.status}`;
    const payload = await response.json();
    const commit = payload?.release?.commit;
    return typeof commit === "string" ? commit : "no release commit";
  } catch (error) {
    return error instanceof Error ? error.name : "unreachable";
  }
}

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

function requireCommit(name) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(`${name} must be a full Git SHA.`);
  }
  return value;
}

function requireMinutes(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 60) {
    throw new Error(`${name} must be an integer between 1 and 60.`);
  }
  return value;
}
