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
- `/candidate/setup`, `/candidate/dashboard`, `/candidate/session/[sessionId]`, and `/candidate/practice/ready/*` resolve authenticated candidate ownership through the app-owned launch session.
- `/recruiter` still lands on the recruiter create experience.
- `/recruiter/dashboard`, `/recruiter/create`, `/recruiter/settings`, `/admin/feedback`, and `/qa/ai-eval` keep their current ownership and auth requirements.
- `/recruiter/templates` does not restore or expose the retired V1 template surface.
- `/s/[token]` still uses recruiter invitation-token access, exchanges to clean `/candidate/invited`, and is not claimed by candidate SSO routes.
- New top-level routes are checked against [Shared Host Routing Contract](../04-architecture/shared-host-routing-contract.md).

## Auth And Cookie Checks

- Candidate route resolvers do not accept recruiter app-session cookies as candidate identity.
- Recruiter middleware does not claim candidate routes.
- Admin and QA role guards still reject ordinary recruiter users.
- Host launch redirects resolve only canonical candidate entry routes.
- Dev host-launch fixtures and e2e test bypasses are impossible in production mode.

## Data And API Checks

- Candidate-owned reads never return recruiter dashboard/session data.
- Recruiter invite-token reads still work for `/s/[token]`; raw tokens do not survive in the clean URL, client payload, cookie, or diagnostics.
- Invite-session cookies do not authorize candidate-led or employee routes, and those actors' cookies do not authorize `/candidate/invited`.
- Initials match and mismatch both proceed; the first signal is durable, cannot be rewritten, and is not identity proof.
- Shared APIs resolve actor/ownership explicitly when used by both candidate and recruiter surfaces.
- New candidate persistence does not change recruiter-owned table constraints without a migration and smoke plan.
- Resume or candidate answer content is not logged or emitted as ordinary telemetry.
- Invitation creation remains separate from delivery; creating or copying an invite never marks it sent.
- Bulk delivery sends one candidate-specific bearer link per provider message and never uses BCC.
- Provider-accepted recipients are not resent by exact replay or a later retry action.
- Only retryable failed or never-attempted recipients receive a new append-only delivery attempt.
- Indeterminate provider outcomes are labeled for review and are not automatically retried.
- Delivery telemetry excludes invite tokens, message bodies, candidate content, and raw provider responses.
- The recruiter dashboard selects only operational facts owned by the signed-in recruiter; it does not select answer text, coaching, evaluator payloads, provider references, or bearer/session material.
- Dashboard question progress counts distinct answered slots, so feedback retries do not inflate progress.
- `/recruiter/sessions/[sessionId]` independently proves session, recipient, and batch ownership before showing the immutable question set and latest submitted response per question.
- The recruiter transcript never shows drafts, superseded retry text, candidate coaching, evaluator output, engagement timing, candidate-led content, or bearer/session material.

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
npx vitest run src/features/candidate-auth-v2/candidate-launch-session-resolver.test.ts src/features/recruiter-auth-v2/recruiter-boundary.test.ts src/app/s/[token]/route.test.ts
npx playwright test e2e/candidate/primary-routes.spec.ts --project=chromium --workers=1
```

The current `e2e/candidate/primary-routes.spec.ts` still represents the retired V1 route/login shell and must be replaced during production UI integration before it can count as V2 release evidence.

Run recruiter e2e smoke when the PR touches recruiter routes, shared auth, shared APIs, global layout/CSS, or Postgres session/invite behavior:

```powershell
npx playwright test e2e/recruiter/create-invite.spec.ts e2e/recruiter/manage-invites.spec.ts --workers=1
```

For the V2 recruiter create/delivery boundary, also run:

```powershell
npm run test:recruiter-invites
npm run db:smoke-recruiter-invitation-create
npm run db:smoke-recruiter-invitation-delivery
npm run db:smoke-recruiter-dashboard
npm run db:smoke-recruiter-transcript
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
