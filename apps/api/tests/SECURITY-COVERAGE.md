# Phase 3 security test matrix

This matrix maps each required security boundary to its focused PostgreSQL and
Supertest coverage. The dedicated security suite adds only gaps that were not
already exercised by a domain integration suite.

| Boundary | Test coverage | Result asserted |
| --- | --- | --- |
| Missing CSRF | `auth.integration.test.ts`, `inventory.integration.test.ts`, `orders.integration.test.ts`, `packages.integration.test.ts`, `administration.integration.test.ts` | `403 CSRF_INVALID` and no mutation |
| Invalid CSRF | `security.integration.test.ts` | Tampered token returns `403 CSRF_INVALID`; session remains valid |
| Cross-tenant access | `commerce.integration.test.ts`, `inventory.integration.test.ts`, `orders.integration.test.ts`, `packages.integration.test.ts`, `administration.integration.test.ts`, `dashboard-reports.integration.test.ts` | Foreign records are absent or return `404` |
| Cross-customer access | `orders.integration.test.ts`, `packages.integration.test.ts` | Customer ownership comes from the session and foreign resources return `404` |
| Permission denied | `inventory.integration.test.ts`, `orders.integration.test.ts`, `packages.integration.test.ts`, `administration.integration.test.ts`, `dashboard-reports.integration.test.ts` | Insufficient RBAC permission returns `403 FORBIDDEN` |
| Revoked session | `auth.integration.test.ts`, `administration.integration.test.ts` | Logout/access revocation makes `/auth/me` return `401` |
| Disabled user | `security.integration.test.ts` | Existing session returns `401`; new login returns `403 ACCOUNT_DISABLED` |
| Expired session | `security.integration.test.ts` | Idle-expired session returns `401 SESSION_EXPIRED`, clears cookie, and is revoked in PostgreSQL |
| Invalid login | `auth.integration.test.ts` | Existing-email/wrong-password and unknown-email responses are identical `401` errors |
| Rate limit | `auth.integration.test.ts`, `client-ip.test.ts` | Independent account and global-IP buckets stop repeated-account/rotated-email abuse; equivalent IPv6 and IPv4-mapped spellings share a canonical key; invalid forwarded values fall back safely; successful login does not reset the IP budget; expired rows are pruned in bounded batches |
| Invalid state transition | `orders.integration.test.ts`, `packages.integration.test.ts` | Skipped/terminal transitions return `409 INVALID_STATE_TRANSITION` |
| Negative inventory | `inventory.integration.test.ts` | Excessive decrement returns `409 INSUFFICIENT_STOCK`; persisted balance remains nonnegative |
| Idempotency replay | `inventory.integration.test.ts`, `orders.integration.test.ts`, `packages.integration.test.ts` | Same key/body returns stored response with `Idempotency-Replayed: true` |
| Idempotency conflict | `inventory.integration.test.ts`, `orders.integration.test.ts`, `packages.integration.test.ts` | Same key/different body returns `409 IDEMPOTENCY_CONFLICT` |
| Seed boundary | `seed-environment.test.ts` plus isolated double-seed integration | Missing/production `NODE_ENV` and documented placeholders fail before DB work without echoing values; development/test and password fallback remain valid |
| Runner cleanup | `runner-lifecycle.test.ts` | Cleanup failures cannot false-PASS; later finalizers still run; primary errors remain attached; spawn errors and TERM→KILL are bounded and observable |
| Log redaction | `logger.test.ts` | Real Pino and pino-http output removes nested aliases, JSON, credentials and raw/encoded URL secrets while retaining safe fields |
