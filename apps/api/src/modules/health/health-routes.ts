import { Router } from "express";

import { getResponseRequestId } from "../../middleware/request-id.js";

export type ReadinessCheck = () => Promise<void>;

type HealthState = Readonly<{
  ready: boolean;
  database: "up" | "down";
}>;

async function resolveHealthState(
  readinessCheck: ReadinessCheck,
): Promise<HealthState> {
  try {
    await readinessCheck();
    return { ready: true, database: "up" };
  } catch {
    return { ready: false, database: "down" };
  }
}

export function createHealthRouter(
  readinessCheck: ReadinessCheck,
  releaseCommit?: string,
): Router {
  const router = Router();
  const release = releaseCommit === undefined
    ? {}
    : { release: { commit: releaseCommit } };

  router.get("/live", (_request, response) => {
    response.status(200).json({
      status: "ok",
      checks: { application: "up" },
      ...release,
      requestId: getResponseRequestId(response),
    });
  });

  router.get("/ready", async (_request, response) => {
    const state = await resolveHealthState(readinessCheck);
    response.status(state.ready ? 200 : 503).json({
      status: state.ready ? "ready" : "not_ready",
      checks: { application: "up", database: state.database },
      ...release,
      requestId: getResponseRequestId(response),
    });
  });

  router.get("/", (_request, response) => {
    response.status(200).json({
      status: "ok",
      checks: { application: "up" },
      ...release,
      requestId: getResponseRequestId(response),
    });
  });

  return router;
}
