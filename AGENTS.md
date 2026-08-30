# AGENTS.md

## Purpose
TraceLink V2 is a digital commerce, inventory, order and package-traceability platform developed by Colvin Solutions.

The current delivery milestone is the CH Market frontend.

Codex must optimize for:
1. correctness,
2. maintainability,
3. security,
4. clear UX,
5. small reviewable changes,
6. future backend integration.

## Source of truth
Before changing code, read:
- `ARCHITECTURE.md`
- relevant files under `docs/`
- the current implementation of the feature being modified

If implementation and documentation disagree, do not invent a third design.
Prefer the documented architecture unless the current task explicitly changes it.

## Current scope
Build the CH Market frontend first.

The frontend contains:
1. Public CH Market website/storefront.
2. Authenticated customer portal.
3. Authenticated staff/admin portal.

Do not implement backend infrastructure unless explicitly requested.
Use a data/service abstraction so mock data can later be replaced by the real API.

## Tech baseline
- React
- TypeScript strict
- Vite
- React Router
- Tailwind CSS
- shadcn/ui where useful
- TanStack Query
- React Hook Form
- Zod
- Vitest
- React Testing Library
- Playwright for critical E2E flows

Do not add dependencies unnecessarily.

## TypeScript rules
- Do not use `any` unless justified.
- Prefer explicit domain types.
- Avoid unsafe assertions.
- Validate external data at boundaries.
- Prefer discriminated unions for finite states.
- CLP monetary values are integers.

## Frontend architecture
Use feature-oriented organization.

Business features belong under `src/features/`.
Reusable UI primitives belong under `src/components/`.
Routing/providers/bootstrap belong under `src/app/`.

Pages orchestrate features and must not contain large amounts of business logic.

Avoid oversized components and "god components".

## Data access
Components must not call `fetch` directly.

All data access goes through feature services/repositories.

The UI must support:
- mock adapters now;
- HTTP adapters later.

Mock implementation details must not leak into screens.

## Authentication and authorization
Frontend authorization is UX only, never the final security boundary.

Do not store secrets in frontend code.

Customer pages must model data as belonging to the authenticated customer.
Never implement customer data access through free-text name lookup.

## Multi-tenant readiness
CH Market is the first organization, but TraceLink is designed to become multi-tenant.

Do not scatter hard-coded organization IDs.
Brand-specific content must be centralized in configuration/theme files.

## UX rules
Public CH Market pages must feel like a modern retail storefront, not an ERP.

Staff/admin pages may be denser and operational.

Always design:
- loading states,
- empty states,
- error states,
- success feedback,
- disabled states.

Destructive actions require confirmation.

Public and customer experiences must be mobile responsive.

## Accessibility
- Semantic HTML.
- Inputs require labels.
- Keyboard accessible controls.
- Visible focus states.
- Do not communicate status by color alone.
- Correct focus handling for dialogs/menus.
- Meaningful alt text for non-decorative images.

## Styling
Use design tokens and centralized CH Market branding.
Avoid repeated arbitrary values and one-off inline styles.

## Testing
Prioritize tests for:
- route guards,
- permission rendering,
- forms and validation,
- cart calculations,
- order status rendering,
- package tracking timeline,
- critical customer flows.

## Required checks
Before declaring a task complete, run the available equivalents of:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

When Playwright exists and a critical flow changes:
- `pnpm test:e2e`

Do not delete tests or silence TypeScript errors to make checks pass.

## Change discipline
Work only on the requested scope.

Do not:
- rewrite unrelated modules,
- install architecture-changing dependencies casually,
- modify generated files manually,
- remove tests,
- hide errors with unsafe casts,
- leave debug logs,
- expose secrets.

Report unrelated technical debt separately.

## Git discipline
Inspect `git status` before and after changes.

Do not overwrite user work.
Do not reset, force-push or rewrite history unless explicitly requested.

## Definition of done
A task is complete only when:
1. requested behavior is implemented;
2. implementation follows `ARCHITECTURE.md`;
3. TypeScript is valid;
4. relevant tests pass;
5. lint/build checks pass when available;
6. loading/error/empty states are considered;
7. no unrelated behavior is broken;
8. documentation is updated if architecture changed.

At the end of each task summarize:
- files changed,
- behavior implemented,
- tests/checks run,
- unresolved risks/follow-ups.
