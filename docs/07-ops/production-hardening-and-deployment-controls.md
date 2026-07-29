# Candidate Production Hardening And Deployment Controls

Status: Ratified baseline; deployment acceptance pending
Last updated: 2026-07-28

## Purpose

This contract defines the minimum production gate for the candidate-led V2 app without inventing unknown TalentArbor behavior. It separates locally provable build/runtime controls from staging evidence that requires a real host-minted launch credential, deployed secrets, and network access.

It does not approve a pilot or release. Real TA launch acceptance, organizational AI/privacy approval, dependency disposition, alert delivery, and a senior release pass remain release gates.

## Required Quality Gates

Before deployment promotion:

```powershell
vercel env pull ".env.vercel.production.local" --environment=production
npm run env:check:vercel
npm run lint
npm run typecheck
npm run test:candidate
npm run db:smoke-candidate-readiness
npm run test:e2e:candidate-seeded
npm run test:e2e:candidate-production
```

The first command creates an ignored local snapshot of the environment currently configured on the
linked Vercel project. Vercel replaces Sensitive values with `[SENSITIVE]` in that snapshot, so
`env:check:vercel` proves required-variable presence and validates only values Vercel leaves readable.
The strict `npm run env:check` mode must also run inside the deployment build/runtime environment,
where it can validate shapes, bounds, canonical origins, exact provider/profile identities, and the
absence of local fixture/fault controls without printing values.
`vercel-app` covers the candidate, invited-candidate, and recruiter web deployment. Run `host-launch`,
`ai-eval-worker`, and `ai-eval-retention` separately only when those add-ons are being deployed; they
have different owners, secrets, and runtime postures and do not belong in the first Vercel promotion.
The committed [.env.example](../../.env.example) is the complete current/future variable manifest, not
a file to upload with blank placeholders.

`test:e2e:candidate-production` creates isolated optimized output, starts `next start` on a free port, and then removes that output. It proves the public shell at desktop and mobile, WCAG 2.2 A/AA axe rules, no horizontal overflow, bounded local navigation/resource metrics, and production denial of dev launch and candidate prototype routes. It deliberately blanks database, launch, and Gemini credentials.

The local timing and transfer limits are regression budgets, not internet-user service-level objectives. Staging and production need separately observed latency percentiles after real ingress, host launch, database, and provider traffic exist.

Next App Router entry modules are part of the gate. `page.tsx` may expose only supported page exports; `route.ts` may expose only supported HTTP/config exports. Testable renderers, repositories, dependency types, and request handlers belong in adjacent implementation modules.

## Metadata-Only Telemetry Map

| Boundary | Safe fields | Never record |
| --- | --- | --- |
| Host launch assembly and verification | random request id, phase, allowlisted outcome/reason, source portal/workspace label, canonical destination, duration | token, launch URL/query, token fingerprint, `jti`, candidate/job ids, email, cookie/session value, MSSQL row data |
| MSSQL launch context | request id, lookup kind (`identity` or `job`), success/not-found/ownership-denied/unavailable, duration, timeout class | query parameters, candidate/job ids, name/email, role, JD, resume, connection string |
| Setup start and question wording | request id, claim outcome, replay/conflict/generation status, provider/profile/config fingerprint, slot count, duration, safe error code | role, JD, resume, generated questions, prompt/request/response body, idempotency key |
| Resume ingestion | source, admitted/replayed/denied/failed/superseded outcome, safe reason, status, claim generation, coarse input-size/page/latency classes | candidate/setup/operation/artifact ids, filename, resume text or bytes, OCR output, removed PII, fingerprints, provider error detail |
| Answer analysis | request id, provider/profile/config fingerprint, accepted/rejected/failed status, evaluator generation, duration, retryable flag, safe error code, optional token counts | answer/question text, evaluator output, evidence excerpts, prompts, candidate/session/attempt/run ids, provider exception body |
| Session completion and repair | request id, completion outcome, bounded answered/repair status counts, Coach Update eligibility/status, duration | answers, coaching, ids, role/JD/resume, provider payloads |
| Coach Update | synthesis fingerprint, provider/profile/model/prompt/evaluator versions, accepted/failed/rejected status, duration, attempt count, safe error code, optional token counts | candidate/prep/session ids, transcript, questions, coaching, prompts, raw model output, credentials |
| Route health | normalized route family, method, status class, duration, environment/deployment id | full URL/query, request/response body, cookie/header values, free-form exception details |

Telemetry payloads use allowlisted enums and bounded counts. A random request id may correlate application phases for one request, but it must not be a durable candidate identifier. Product analytics and enterprise BI require a separate reviewed data contract; ordinary operational logs are not that store.

## Initial Alert Map

The thresholds below are starting hypotheses and must be tuned from staging traffic. This document does not claim an alert sink is already provisioned.

| Signal | Initial trigger | Response |
| --- | --- | --- |
| Candidate route availability | five or more 5xx responses or more than 2% 5xx in ten minutes | inspect deployment, Postgres, and route-family telemetry; stop promotion |
| Host launch configuration | any sustained `assembly_unavailable` or accepted-launch rate unexpectedly drops to zero | verify secret/config presence, issuer/workspace, ingress redaction, MSSQL reachability; disable host quick-link if necessary |
| Host launch replay/claim rejection | unusual increase over established staging baseline | distinguish expected replay tests from stale links, clock skew, double exchange, or abuse; never weaken single-use validation during incident response |
| MSSQL launch lookup | five timeouts/unavailable outcomes in ten minutes or p95 above the approved staging budget | check tunnel/firewall, pool saturation, least-privilege login, and query plan |
| Question wording or answer analysis | ten or more calls with failure/rejection above 10% in ten minutes, or p95 above provider timeout posture | inspect provider/profile/config identity, quota, safe error codes, and fallback behavior |
| Completion/Coach Update | completion 5xx, repair backlog growth, or unavailable Coach Update above staging baseline | protect answer/session durability first; verify evaluator eligibility and provider state without rolling back completed practice |
| Database | connection failures, pool exhaustion, migration mismatch, or durable claim contention above baseline | stop promotion; verify schema and capacity; prefer reviewed fix-forward migration |

High-severity immediate alerts remain appropriate for suspected cross-candidate exposure, raw token/content logging, or recruiter-route regression.

## Environment And Secret Ownership

| Environment | Candidate runtime posture | Required controls |
| --- | --- | --- |
| Local development | dev host launch plus fixture providers; local smoke Postgres | `.env.local` only; no committed secrets; direct `/candidate/dev/launch`; deterministic candidates |
| CI production smoke | optimized production runtime with launch/database/provider secrets blank | isolated output and port; dev/prototype routes 404; no external network dependency |
| TA staging | production launch verifier, TA MSSQL lookup, staging Postgres, approved Gemini profiles | HTTPS; host-minted two-minute single-use launch; sensitive-query redaction; least-privilege DB users; staging-only secrets; metadata telemetry and alert test |
| Production | same contracts as accepted staging with production-owned secret instances | explicit promotion evidence, secret rotation procedure, backup/rollback owner, post-deploy smoke, senior release approval |

Configuration groups:

- Postgres: `DATABASE_URL`.
- Host verification/session: `CANDIDATE_HOST_LAUNCH_SECRET`, `CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER`, `CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE=talentarbor`, `CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS`, `CANDIDATE_HOST_LAUNCH_CLOCK_SKEW_SECONDS`, and `CANDIDATE_HOST_LAUNCH_SESSION_TTL_SECONDS`.
- App-owned candidate accounts: `CANDIDATE_ACCOUNT_EMAIL_PROVIDER=smtp`, `CANDIDATE_ACCOUNT_PUBLIC_ORIGIN`, optional `CANDIDATE_ACCOUNT_FROM_EMAIL`, `CANDIDATE_EMAIL_VERIFICATION_TTL_SECONDS`, and explicit deployed versions for `CANDIDATE_TERMS_VERSION`, `CANDIDATE_PRIVACY_VERSION`, `CANDIDATE_COOKIE_VERSION`, `CANDIDATE_RESPONSIBLE_AI_VERSION`, and `CANDIDATE_CONTACT_AUTHORIZATION_VERSION`.
- TA MSSQL: `CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER`, `_PORT`, `_DATABASE`, `_USER`, `_PASSWORD`, `_ENCRYPT`, `_TRUST_SERVER_CERTIFICATE`, `_CONNECT_TIMEOUT_MS`, `_REQUEST_TIMEOUT_MS`, and `_POOL_MAX`.
- Model selection: `CANDIDATE_QUESTION_WORDING_PROVIDER`/`_PROFILE`, `CANDIDATE_ANSWER_ANALYSIS_PROVIDER`/`_PROFILE`, `CANDIDATE_COACH_UPDATE_PROVIDER`/`_PROFILE`, and server-only `GEMINI_API_KEY`.
- Operations: deployment id/environment metadata, durable metrics configuration, and the approved alert destination secret.

The host/integration owner owns token minting, issuer, secret synchronization, quick-link behavior, and upstream query redaction. The IC deployment owner owns verifier/session settings, Postgres, MSSQL read credentials, provider profiles, telemetry, and rollback. Security owns secret-store and rotation policy. Product/AI owners approve serving profiles and candidate-facing behavior.

Fixture/fault modes, `CANDIDATE_ACCOUNT_EMAIL_PROVIDER=fixture`, and `CANDIDATE_HOST_LAUNCH_DEV_MODE` must be unavailable when `NODE_ENV=production`.

## Rollback Contract

1. Stop promotion and, when launch behavior is unsafe, disable the host quick-link before changing verification rules.
2. Capture deployment id, request ids, safe reason codes, environment, and time window. Do not capture launch URLs, tokens, cookies, resumes, answers, or coaching.
3. Roll the application back only to a build proven compatible with the currently applied schema. Candidate migrations are forward-owned; do not run ad hoc down migrations or delete evidence rows during incident response.
4. A model rollback changes the exact provider/profile tuple to a previously accepted configuration. Do not mutate an immutable configuration manifest to make new behavior look old.
5. If a credential may be exposed, revoke/rotate it at the owning secret stores, synchronize host and IC where applicable, and invalidate affected app sessions according to incident policy.
6. Re-run the production shell smoke and the applicable staging host/provider smoke before restoring traffic.

Rollback readiness requires the deployment owner to record the last known schema-compatible app build, database backup/restore owner, host quick-link owner, secret-rotation owner, and last accepted provider profiles before release.

## Post-Deploy Smoke

Run in order:

1. Public `/` returns 200 over HTTPS with assets, no browser errors, no horizontal overflow, and expected legal links.
2. `/candidate/dev/launch`, `/candidate/dashboard-demo`, `/candidate/session-demo`, and `/candidate/settings-demo` return 404.
3. Host mints a fresh staging URL through its authenticated UI. The token query is absent from CDN/proxy/application logs and is exchanged once into a clean `/candidate/*` URL plus the IC HttpOnly session cookie.
4. Run identity-new, identity-returning, job-owned, replay, invalid-ownership, and invalid/expired credential cases from [TA Host Launch Live Acceptance](../09-dev/host-launch-live-acceptance.md).
5. Register one app-owned candidate and confirm that registration and resend remain enumeration-safe, the email-verification link requires an explicit POST before activation, an expired or replayed token is rejected, verified login succeeds, and logout revokes only the candidate app session.
6. Confirm that `/candidate/launch?token=...`, `/s/[token]`, `/candidate/verify-email?token=...`, and `/candidate/reset-password?token=...` credentials are redacted from CDN, proxy, application, analytics, and error-reporting logs. Route-health telemetry may retain only the normalized route family.
7. Complete one synthetic candidate setup, three-question text round, immediate coaching, dashboard return, Coach Update, one-question follow-up, pause/resume, and refresh/new-tab recovery using the approved staging provider profiles.
8. Confirm metadata-only telemetry for each phase, expected dashboard/alert health, and no candidate content or credentials in logs.
9. Run the shared-host recruiter regression checklist before promotion if recruiter/admin routes ship in the same deployment.

The real host cases require fresh host-minted credentials. Local token minting, fabricated MSSQL rows, or manually set cookies are not substitutes for deployment acceptance.

## Dependency Advisory Disposition

The Slice 177 production audit reports four vulnerable package entries representing three underlying concerns. The previously vulnerable direct Nodemailer version has been replaced by `nodemailer@9.0.3`; live SMTP acceptance does not waive deployed-network evidence.

| Dependency path | Audit meaning | Current reachability | Required disposition |
| --- | --- | --- | --- |
| `@google/genai@1.39.0` cleanup chain -> `brace-expansion@2.0.3` | One high denial-of-service advisory affects exponential expansion of crafted brace groups. | App input is not supplied as a glob pattern, so no current application path is known to exercise the vulnerable behavior. | Test a compatible transitive or Google SDK update; otherwise record a time-bounded risk acceptance before pilot and recheck each provider-SDK update. |
| `next@15.5.20` -> nested `postcss@8.4.31` | One moderate PostCSS stringify XSS advisory is counted on PostCSS and contributes to the parent Next entry. The app's direct `postcss@8.5.19` is patched. | The app does not accept or stringify user-authored CSS. The affected nested copy is used through the framework/build toolchain, so current application reachability is low. | Track a tested Next upgrade and record explicit temporary risk acceptance before pilot. Do not follow npm's regressive Next downgrade suggestion or force an untested transitive override. |
| `next@15.5.20` -> `sharp@0.34.x` / libvips | One high Sharp entry aggregates four newly reported inherited libvips vulnerabilities and contributes to the parent Next entry. | Current resume-photo processing validates the container and passes bytes to the OCR provider; it does not invoke Sharp or Next image optimization. Static product assets may still use framework image tooling. | Evaluate a supported Next/Sharp update, confirm actual runtime image paths, and either patch or record explicit temporary risk acceptance before pilot. Do not add app-side image conversion on the affected path as a workaround. |

Severity describes the vulnerable package behavior, not proof that the app exposes an attack path. A vulnerable package retained for a near-term required capability must be upgraded before that capability becomes reachable.

Advisory references: [brace-expansion denial of service](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [PostCSS stringify XSS](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), and [Sharp inherited libvips vulnerabilities](https://github.com/advisories/GHSA-f88m-g3jw-g9cj).

## Remaining Release Gates

- Execute and retain the real TA staging acceptance evidence.
- Wire and validate the chosen telemetry/alert sink and production dashboards.
- Establish staging-derived performance objectives and capacity baselines.
- Re-audit the production tree after compatible Google SDK and Next/Sharp upgrades; record the owner and expiry for every temporary dependency-risk acceptance before pilot or release.
- Complete the manual accessibility matrix and organizational AI/privacy approvals.
- Run the senior release pass.
- Confirm the public `Employee login` affordance continues to resolve to the app-owned recruiter `/login` boundary and never to candidate account entry.
