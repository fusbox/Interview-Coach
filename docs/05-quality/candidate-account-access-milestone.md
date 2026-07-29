# Candidate Account Access Milestone

Status: Local milestone pass
Date: 2026-07-28
Scope: Slices 197-201

## Outcome Contract

This milestone proves that app-owned candidate access is a complete, independently authenticated
entry path into the same candidate-owned product capabilities as TalentArbor host launch. It does not
link, merge, refresh, or otherwise depend on a host identity. Candidate, recruiter, invited-candidate,
and host-launch credentials may coexist in one browser without one audience gaining another
audience's ownership.

The integrated boundary includes:

- shared password hashing and opaque hashed app sessions with audience-specific cookies;
- transactional candidate registration, profile/contact/consent creation, and explicit email
  verification;
- candidate login/logout, bounded return targets, and fail-closed protected routes;
- single-use password recovery that revokes all app-owned sessions without touching host launch;
- database-backed rate controls and metadata-only authentication audit evidence;
- deterministic primary and alternate local candidate accounts for repeatable ownership checks.

## Prior-Behavior Decisions

- **Preserve:** V1 recruiter credential hashing, opaque session tokens, server-owned identity,
  lockout, revocation, and same-origin mutation posture.
- **Reinterpret:** the shared credential/session infrastructure as an audience-neutral app-auth
  foundation with candidate-specific role/profile authorization and cookies.
- **Retire:** any implication that candidate product access is anonymous, host-only, email-keyed, or
  allowed to fall through from an invalid candidate app cookie to a host session.
- **Defer:** social login, SMS authentication, MFA/passkeys, automatic TA account creation, and
  app/host profile linking or history merging.

## Acceptance Matrix

| Boundary | Required proof |
| --- | --- |
| Fresh account | Registration creates one candidate user/profile and immutable receipts; verification GET is inert; explicit confirmation activates login. |
| Recovery | Generic request response, single-use reset, old-password rejection, new-password login, reset replay denial, and revocation of every pre-reset app session. |
| Continuity | A second browser/device can authenticate and recover candidate-owned durable product state. |
| Ownership | The alternate candidate cannot read or mutate a session, setup artifact, prep context, or follow-up intent owned by the primary candidate. |
| Audience coexistence | Candidate and recruiter sessions remain valid simultaneously; logging out one audience does not clear the other. |
| Host/app isolation | App-account access invokes no host lookup. A valid app cookie has precedence when host and app cookies coexist; candidate app logout leaves host access intact. A present invalid app cookie fails closed. |
| Operations | Rate-control failure is closed, denials are bounded, reset/verification credentials are hashed, and token-bearing URLs are marked for deployed redaction. |

## Verification Protocol

Automated evidence must include:

1. migrations `042-045` over the disposable Postgres database;
2. candidate account lifecycle and recovery database smokes;
3. focused app-auth, account-lifecycle, and protected-route tests;
4. one deterministic Playwright milestone journey covering the browser-visible acceptance matrix;
5. the complete candidate regression suite, typecheck, lint, documentation-link validation,
   optimized build, and `git diff --check`;
6. a senior milestone pass over the integrated diff and browser/database evidence.

Manual browser confirmation remains required for the candidate-facing copy and interaction sequence.
Production host acceptance, real SMTP delivery, production DB grants, deployed log redaction, and
release approval remain separate release gates.

## Accepted Evidence

- `npm run test:e2e:candidate-account`: 4 serial Chromium journeys passed against the named local
  smoke database. The gate creates and explicitly verifies one synthetic account, proves generic
  pre-verification login denial, resets that account's password while two sessions are active,
  proves both sessions revoked and the reset token non-replayable, recovers one durable practice
  session on another browser context, denies an alternate candidate's read and mutation attempts,
  and proves candidate/recruiter/host cookies can coexist without audience crossover.
- The browser runner always targets `interviewcoach_smoke`, uses fixture AI and account-email
  providers, selects an available local port, and removes the synthetic account and its product
  history after the run. It does not mutate the deterministic primary candidate's password,
  sessions, or practice history.
- Candidate account lifecycle migrations and smokes passed for migrations `042-045`.
- Focused suites passed: 55 shared-auth/host-isolation tests and 72 account-lifecycle tests.
- Broader regressions passed: 683 candidate tests and 195 recruiter/invited tests.
- Typecheck, lint with zero warnings, documentation links, optimized build, and
  `git diff --check` passed.

The senior milestone review found no local correctness, ownership, concurrency, or audience-isolation
blocker. The principal remaining risks are deployment controls rather than missing account behavior:
real SMTP/mailbox evidence, least-privilege production database grants for security-definer functions,
deployed token-URL redaction, and real TalentArbor host acceptance.

## Verdict

`ready` for commit and movement back to the core rebuild runway. This is not a production-release
verdict; the named deployment controls remain release gates.
