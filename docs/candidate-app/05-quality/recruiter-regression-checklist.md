# Recruiter Regression Checklist For Candidate PRs

Date: 2026-05-12
Status: Working checklist

## Purpose

Candidate work now lands in the same deployable app as recruiter, admin, QA, and invite-token flows.

This checklist keeps candidate PRs honest about shared-host risk so a candidate slice does not quietly break recruiter-led Interview Coach behavior.

## When To Use

Use this checklist for any candidate PR that touches:

- `src/app/page.tsx`
- middleware or auth behavior
- route groups under `src/app`
- shared layout, global CSS, design tokens, or public assets
- shared APIs, session services, AI services, metrics, rate limits, idempotency, or Postgres migrations
- package scripts, CI, build config, or environment variables

If the PR only changes isolated candidate docs, mark this checklist as not applicable in the PR.

## Route Ownership Checks

- `/` remains public and candidate-owned.
- `/practice`, `/dashboard`, `/session/[sessionId]`, and `/summary/[sessionId]` remain candidate-auth protected.
- `/recruiter` still lands on the recruiter create experience.
- `/recruiter/create`, `/recruiter/templates`, `/recruiter/settings`, `/admin/feedback`, and `/qa/ai-quality` keep their current ownership and auth requirements.
- `/s/[token]` still uses recruiter invite-token access and is not claimed by candidate SSO routes.
- New top-level routes are checked against [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md).

## Auth And Cookie Checks

- Candidate auth middleware does not accept recruiter app-session cookies as candidate identity.
- Recruiter middleware does not claim candidate routes.
- Admin and QA role guards still reject ordinary recruiter users.
- Candidate login return targets remain allowlisted.
- Local dev auth and e2e test bypasses are impossible in production mode.

## Data And API Checks

- Candidate-owned reads never return recruiter dashboard/session data.
- Recruiter invite-token reads still work for `/s/[token]`.
- Shared APIs resolve actor/ownership explicitly when used by both candidate and recruiter surfaces.
- New candidate persistence does not change recruiter-owned table constraints without a migration and smoke plan.
- Resume or candidate answer content is not logged or emitted as ordinary telemetry.

## UI And Asset Checks

- Candidate design-system changes do not break recruiter component styling.
- Public assets used by recruiter invite flows still resolve.
- Global CSS changes are reviewed for recruiter/admin/QA page impact.
- Shared components still have accessible names, focus states, and stable layout at mobile and desktop widths.

## Required Local Verification

Minimum for candidate PRs that touch shared code:

```powershell
npm run lint
npm run typecheck
npm run build
```

Add targeted tests based on changed surface:

```powershell
npx vitest run src/app/shared-host-routes.test.ts src/lib/server/auth/middleware.test.ts
npx playwright test e2e/candidate/primary-routes.spec.ts --workers=1
```

Run recruiter e2e smoke when the PR touches recruiter routes, shared auth, shared APIs, global layout/CSS, or Postgres session/invite behavior:

```powershell
npx playwright test e2e/recruiter/create-invite.spec.ts e2e/recruiter/manage-invites.spec.ts --workers=1
```

## PR Description Copy

Use this in candidate PRs:

```markdown
## Recruiter Regression Review

- Shared host route ownership checked:
- Auth/cookie boundaries checked:
- Recruiter/admin/QA route risk:
- Invite-token `/s/[token]` risk:
- Shared API/data risk:
- Verification run:
- Residual risk:
```

## Current Known Gaps

- Full candidate setup-to-summary browser smoke still needs a seeded candidate profile/session environment.
- Admin and QA e2e role coverage currently verifies protection, not full privileged page content.
- Production deployment validation still needs the integration team's final auth handoff details.
