# Shared Host Routing Contract

Date: 2026-05-08
Status: Confirmed deployment direction

## Purpose

This document records the confirmed route and deployment shape for Interview Coach now that recruiter and candidate implementations are expected to share the same app host.

## Confirmed Facts

- `https://interviewcoach.talentarbor.com` is the confirmed host for both recruiter-led and candidate-led Interview Coach.
- `/` is the public Interview Coach home page. The current candidate landing page at [src/app/page.tsx](/c:/dev/Interview-Coach-Candidate/src/app/page.tsx) is the source design, though content and CTA behavior still need edits.
- Recruiter-owned routes live under `/recruiter/*`; `/recruiter` itself should redirect or guard to the default recruiter destination.
- Existing recruiter/admin/QA pages keep their relative paths: `/recruiter/dashboard`, `/recruiter/templates`, `/recruiter/settings`, `/admin/feedback`, and `/qa/ai-quality`.
- Candidate protected routes live under `/candidate/*`; `/candidate` itself should redirect or guard to the default candidate destination.
- Authenticated candidate launch should land at `/candidate/dashboard`.
- Candidate code should be integrated into the existing Azure project/repo branch path rather than deployed as a separate Azure project.

## Route Map

| Path | Owner | Access | Notes |
| --- | --- | --- | --- |
| `/` | Candidate/public | Public | Public Interview Coach page and funnel. |
| `/candidate` | Candidate | Candidate auth required | Namespace index only. Redirects or guards to `/candidate/dashboard`; no standalone UI. |
| `/candidate/setup` | Candidate | Candidate auth required | Self-serve candidate practice setup. |
| `/candidate/dashboard` | Candidate | Candidate auth required | Candidate post-login landing target and preparedness dashboard. |
| `/candidate/session/[sessionId]` | Candidate | Candidate auth required | Candidate-owned session resume path. |
| `/candidate/summary` or `/candidate/summary/[sessionId]` | Candidate | Candidate auth required | Candidate-owned review/summary surface if shipped separately. |
| `/candidate/settings` | Candidate | Candidate auth required | Candidate settings/profile if shipped. |
| `/recruiter` | Recruiter | Recruiter auth/ATS launch required | Namespace index only. Redirects or guards to the default recruiter destination; no standalone UI. |
| `/recruiter/create` | Recruiter | Recruiter auth required | Existing create-invite page and compatibility target for new-invite actions. |
| `/recruiter/dashboard` | Recruiter | Recruiter auth required | Existing migrated recruiter dashboard restored as the deployed dashboard compatibility route. |
| `/recruiter/templates` | Recruiter | Recruiter auth required | Existing recruiter templates. |
| `/recruiter/settings` | Recruiter | Recruiter auth required | Existing recruiter settings. |
| `/admin/feedback` | Admin | Admin auth required | Existing admin feedback. |
| `/qa/ai-quality` | QA | QA auth required | Existing QA AI-quality review. |
| `/s/[token]` | Recruiter invite candidate flow | Candidate token required | Preserve for recruiter-issued candidate invite links. |

## Namespace Rules

- Reserve `/recruiter/**`, `/admin/**`, and `/qa/**` for recruiter-led app roles.
- Reserve `/candidate/**` for authenticated candidate-led flows.
- Keep `/candidate` and `/recruiter` as routing boundaries, not product UI surfaces.
- Preserve `/s/[token]` for recruiter-issued invite-token sessions.
- Namespace APIs by actor wherever possible:
  - `/api/candidate/**`
  - `/api/recruiter/**`
  - `/api/admin/**`
  - `/api/qa/**`
  - `/api/auth/**` only for shared or clearly routed auth concerns
- Avoid new generic API paths such as `/api/session` unless the route resolves ownership through a shared access boundary and is tested for recruiter invite and candidate self-serve modes.

## Deployment Implication

The least risky target is one deployable Next app for `interviewcoach.talentarbor.com`.

Two independently deployed Next apps behind one host can work only with careful proxying and path partitioning. It becomes brittle when both apps expect to own `/_next/**`, `/api/**`, middleware, cookies, public assets, and shared host headers.

The standalone candidate repo can still be useful as an incubation workspace, but the deployable implementation should be ported into an Azure branch based on the migrated recruiter Postgres branch.

## Watch-Outs

- Cookie names and middleware must not confuse recruiter sessions with candidate sessions.
- Candidate dashboard must remain `/candidate/dashboard`; recruiter dashboard must remain `/recruiter/dashboard`.
- Public `/` should not load candidate-only private data or require auth.
- `NEXT_PUBLIC_APP_URL` should resolve to `https://interviewcoach.talentarbor.com` in production so invite, debrief, and redirect links use the canonical host.
- CTA login redirects must preserve only allowlisted internal targets such as `/candidate/setup` and `/candidate/dashboard`.
- Route tests should include unauthenticated, candidate-authenticated, recruiter-authenticated, admin, QA, and invite-token contexts.
- Analytics and observability should label actor mode so candidate funnel events do not mix with recruiter workflow metrics.
- Candidate PRs that touch shared host behavior should use the [Recruiter Regression Checklist For Candidate PRs](../05-quality/recruiter-regression-checklist.md).

## Acceptance Criteria

- `/candidate` redirects or guards to `/candidate/dashboard` without rendering a separate candidate index UI.
- `/recruiter` redirects or guards to the default recruiter experience without breaking existing `/recruiter/create` links.
- `/recruiter/dashboard` remains recruiter-owned and renders the migrated recruiter dashboard for authenticated recruiters.
- `/candidate/dashboard` is candidate-owned and never resolves to recruiter dashboard data.
- `/candidate/setup` requires candidate access and supports return-after-login.
- `/s/[token]` remains invite-token based.
- Route ownership is documented in PRs that add or move top-level paths.
- Branch and PR strategy follows [ADR-0006](../08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).
