# Shared Host Routing Contract

Last updated: 2026-07-27
Status: Confirmed deployment direction

## Purpose

This document records the confirmed route and deployment shape for Interview Coach now that recruiter and candidate implementations are expected to share the same app host.

## Confirmed Facts

- `https://interviewcoach.talentarbor.com` is the confirmed host for both recruiter-led and candidate-led Interview Coach.
- `/` is the public Interview Coach home page. The current implementation lives at [src/app/page.tsx](../../src/app/page.tsx).
- Recruiter-owned routes live under `/recruiter/*`; `/recruiter` itself should redirect or guard to the default recruiter destination.
- The immediate recruiter V2 baseline uses app-owned authentication. A future TalentArbor recruiter exchange is reserved under `/recruiter/launch` and must bind to the same internal recruiter principal through an explicit external-identity mapping.
- Recruiter and QA pages keep their approved relative paths: `/recruiter/dashboard`, `/recruiter/settings`, and `/qa/ai-eval`. The legacy `/recruiter/templates` surface is retired from V2 and must not be restored as a question-seeding path.
- Candidate protected routes live under `/candidate/*`; `/candidate` itself should redirect or guard to the default candidate destination.
- App-owned candidate login and verified host launch are independent candidate entry modes with the same downstream feature access.
- Candidate code should be integrated into the existing Azure project/repo branch path rather than deployed as a separate Azure project.

## Route Map

| Path | Owner | Access | Notes |
| --- | --- | --- | --- |
| `/` | Candidate/public | Public | Public Interview Coach page and funnel. |
| `/login` | Employee auth | Public entry; app session on success | Immediate recruiter/admin/QA app-owned login. Return targets must be allowlisted internal employee routes. |
| `/candidate` | Candidate | Public router | Redirects authenticated candidates to setup/dashboard and unauthenticated candidates to `/candidate/login`; no standalone UI. |
| `/candidate/login` | Candidate account | Public entry; candidate app session on success | App-owned candidate login. Candidate-only return targets are allowlisted. |
| `/candidate/register` | Candidate account | Public entry | Creates an app-owned candidate account and starts email verification. |
| `/candidate/verify-email` | Candidate account | Single-use verification token | Verifies the app-owned candidate account before protected access. |
| `/candidate/forgot-password` | Candidate account | Public entry | Enumeration-safe password-reset request. |
| `/candidate/reset-password` | Candidate account | Single-use reset token | Replaces the app-owned password and revokes prior candidate sessions. |
| `/candidate/launch` | Candidate | Signed host launch token required | TalentArbor launch-token handoff. Verifies host token, resolves candidate identity, sets Interview Coach candidate session, and redirects away from the token URL. RangamWorks remains disabled. |
| `/candidate/dev/launch` | Candidate development | Explicit nonproduction fixture only | Produces production-shaped local candidate sessions; unavailable in production. |
| `/candidate/setup` | Candidate | Candidate auth required | Self-serve candidate practice setup. |
| `/candidate/dashboard` | Candidate | Candidate auth required | Candidate post-login landing target and preparedness dashboard. |
| `/candidate/session/[sessionId]` | Candidate | Candidate auth required | Candidate-owned session resume path. |
| `/candidate/practice/ready/[intentId]` | Candidate | Candidate auth required | Candidate-owned pre-session landing for newly assembled follow-up practice. |
| `/candidate/invited` | Recruiter invite candidate flow | Invite-scoped HttpOnly session required | Clean initials/landing/recovery route after `/s/[token]` exchange; it ignores candidate and employee cookies. |
| `/recruiter` | Recruiter | Recruiter auth required | Namespace index only. Redirects or guards to the default recruiter destination; no standalone UI. App-owned login is the immediate baseline. |
| `/recruiter/launch` | Recruiter | Future signed host launch token | Reserved TalentArbor recruiter exchange. It is not implemented and must not reuse the candidate route or candidate cookie. |
| `/recruiter/create` | Recruiter | Recruiter auth required | Existing create-invite page and compatibility target for new-invite actions. |
| `/recruiter/dashboard` | Recruiter | Recruiter auth required | Existing migrated recruiter dashboard restored as the deployed dashboard compatibility route. |
| `/recruiter/templates` | Retired | No V2 entry | Legacy template data and UI are not migrated. The route must not expose the retired V1 surface. |
| `/recruiter/settings` | Recruiter | Recruiter auth required | Existing recruiter settings. |
| `/qa/ai-eval` | QA | Individually granted app auth required | AI-eval operator workbench and scenario lab. |
| `/s/[token]` | Recruiter invite candidate flow | Invitation bearer required | Server-only exchange into a bounded invite session, followed by a no-store/no-referrer redirect to `/candidate/invited`. |

## Namespace Rules

- Reserve `/recruiter/**`, `/admin/**`, and `/qa/**` for recruiter-led app roles.
- Reserve `/candidate/**` for authenticated candidate-led flows.
- Keep `/candidate` and `/recruiter` as routing boundaries, not product UI surfaces.
- Keep candidate and recruiter launch routes, session cookies, principal resolution, and authorization policy explicit even if they later share low-level verification utilities.
- Preserve `/s/[token]` for recruiter-issued invitation exchange and `/candidate/invited` for its clean invite-session surface.
- Namespace APIs by actor wherever possible:
  - `/api/candidate/**`
  - `/api/recruiter/**`
  - `/api/admin/**`
  - `/api/qa/**`
  - `/api/auth/**` only for shared or clearly routed auth concerns
- Avoid new generic API paths such as `/api/session` unless the route resolves ownership through a shared access boundary and is tested for recruiter invite and candidate self-serve modes.
- `/api/candidate/auth/**` owns candidate registration, verification, login, logout, and password recovery.
- Shared app-auth modules may implement password/session primitives, but candidate and employee routes use separate cookies and audience authorization.
- Candidate launch and invite-token exchanges remain separate actor-specific boundaries.

## Deployment Implication

The least risky target is one deployable Next app for `interviewcoach.talentarbor.com`.

Two independently deployed Next apps behind one host can work only with careful proxying and path partitioning. It becomes brittle when both apps expect to own `/_next/**`, `/api/**`, middleware, cookies, public assets, and shared host headers.

The standalone candidate repo can still be useful as an incubation workspace, but the deployable implementation should be ported into an Azure branch based on the migrated recruiter Postgres branch.

## Watch-Outs

- Cookie names and middleware must not confuse recruiter sessions with candidate sessions.
- A candidate app-session cookie takes precedence on ordinary candidate routes and never falls through to host lookup when invalid.
- Host launch cannot resolve or mutate a candidate profile bound to an app user.
- A future host recruiter identity must bind by issuer/source plus immutable external recruiter id. Never merge or authorize accounts by matching email alone.
- Candidate dashboard must remain `/candidate/dashboard`; recruiter dashboard must remain `/recruiter/dashboard`.
- Public `/` should not load candidate-only private data or require auth.
- `NEXT_PUBLIC_APP_URL` should resolve to `https://interviewcoach.talentarbor.com` in production so invite, debrief, and redirect links use the canonical host.
- CTA login redirects must preserve only allowlisted internal targets such as `/candidate/setup` and `/candidate/dashboard`.
- Route tests should include unauthenticated, candidate-authenticated, recruiter-authenticated, admin, QA, and invite-token contexts.
- Analytics and observability should label actor mode so candidate funnel events do not mix with recruiter workflow metrics.
- Candidate PRs that touch shared host behavior should use the [Recruiter Regression Checklist For Candidate PRs](../05-quality/recruiter-regression-checklist.md).

## Acceptance Criteria

- `/candidate` routes authenticated candidates to setup/dashboard and unauthenticated candidates to login without rendering a separate candidate index UI.
- `/login` establishes only an app-owned employee session and cannot create candidate or invite-token identity.
- `/candidate/login` establishes only an app-owned candidate session and cannot create recruiter, host-launch, or invite-token identity.
- app-owned candidate login and registration perform no host token or MSSQL operation.
- `/recruiter` redirects or guards to the default recruiter experience without breaking existing `/recruiter/create` links.
- `/recruiter/launch` remains unavailable until recruiter identity, entitlement, external-identity binding, and host token claims are ratified.
- `/recruiter/dashboard` remains recruiter-owned and renders the migrated recruiter dashboard for authenticated recruiters.
- `/candidate/dashboard` is candidate-owned and never resolves to recruiter dashboard data.
- `/candidate/setup` requires candidate access and supports return-after-login.
- `/candidate/launch` fails closed when a signed host launch token is missing, invalid, expired, or not for Interview Coach.
- `/s/[token]` remains invite-token based.
- Route ownership is documented in PRs that add or move top-level paths.
- Branch and PR strategy follows [ADR-0006](../08-decisions/ADR-0006-shared-host-and-azure-branch-integration.md).
