import { StagingInitEnvironmentError } from "../config/staging-init-env.js";
import { initializeStaging, StagingInitConflictError } from "../modules/staging/staging-initialization.js";

void initializeStaging(process.env).then((result) => {
  process.stdout.write(`STAGING_INIT_OK: CH Market initialized; admin=${result.admin}.\n`);
}).catch((error: unknown) => {
  const message = error instanceof StagingInitEnvironmentError || error instanceof StagingInitConflictError
    ? error.message
    : "STAGING_INIT_FAILED: database or initialization failure. No error details are logged.";
  // Do not log error objects, SQL, driver detail, env, email, password, hash or connection URL.
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
