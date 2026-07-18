# Candidate App Handoff

Status: Active resumption contract
Last updated: 2026-07-18
Current milestone: Slices 134-139 are complete and committed on `feature/candidate-v2-rebuild`. The production question-generation and follow-up-launch durability milestone passed automated, disposable-database, concurrency, live-provider, and manual browser acceptance.

## Agent Bootstrap

- Work on `feature/candidate-v2-rebuild`; candidate routes are canonical under `/candidate/*`.
- Read [SPEC](./SPEC.md) for product behavior, [DATA_CONTRACT](./DATA_CONTRACT.md) for durable shapes, and [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md) for runtime/database commands.
- Before a meaningful workflow slice, inspect matching V1 behavior from `feature/candidate-module` and classify it as `preserve`, `reinterpret`, `retire`, or `defer`.
- Use `.agents/skills/senior-slice-pass` for meaningful slices, `senior-milestone-pass` at integrated boundaries, and `senior-release-pass` before deployment, pilot, or release decisions.
- Default verification: focused tests, `npm run test:candidate`, `npm run typecheck`, applicable lint/build checks, and `git diff --check`. Run both fresh-database and existing-upgrade readiness when migrations change or a milestone closes.
- Do not infer completion from this summary. Follow the linked contract or runbook for the subsystem being changed.

## Current State

| Area | Current truth | Primary references |
| --- | --- | --- |
| Routes and identity | Public root plus launch, setup, ready, session, and dashboard routes exist. Production launch is a one-time, two-minute HS256 credential exchange into an independently governed seven-day HttpOnly app session. TA identity and optional owned-job context resolve server-side through bounded MSSQL queries. RW remains disabled. | [Authenticated access](./02-requirements/authenticated-candidate-access.md), [Host launch guide](./09-dev/host-launch-api-implementation.md) |
| Setup and prep context | Generic setup creates a candidate-owned prep context. Job-aware launch stages canonical role/JD read-only; identity-only launch permits manual setup. Duplicate active role/JD paths require an explicit user choice. Setup start uses a candidate-owned leased request claim: accepted replay returns one session without another provider call, while provider failure remains retryable and trusted staging is consumed only by the successful fenced generation. | [Practice setup](./02-requirements/practice-setup-scope.md), [Setup-start idempotency](./04-architecture/candidate-setup-start-idempotency.md) |
| Session planning and wording | Deterministic category planning, immutable plan snapshots, and the first production `gemini-2.5-flash` question-wording profile are landed. Setup fails closed before session creation unless one exact, distinct, slot-mapped set is accepted; follow-up rounds reuse source wording. Synthetic, disposable-DB, and guarded live-browser gates have passed. | [Question wording contract](./05-quality/production-question-wording-integration-contract.md), [Live wording runbook](./05-quality/live-question-wording-validation-runbook.md) |
| Live practice and state | Typed candidate-led practice is functional through autosave, refresh/new-tab recovery, immutable feedback retries, pause/return, completion, and role-scoped dashboard return. Drafts remain drafts until submit; accepted answers and evaluator attempts are immutable. Candidate recovery is designed to return to the exact session/question/stage. | [SPEC](./SPEC.md), [Evaluator contract](./05-quality/evidence-first-evaluator-contract.md) |
| Answer evaluation | The first candidate-serving `gemini-2.5-flash` evidence-first profile is ratified and credentialed-live validated. Exact configuration fingerprints, fenced evaluator runs, bounded repair, candidate-safe projection, and continue-without-coaching behavior are durable. Technical accuracy remains `not_assessed` without a trusted reference. | [Production evaluator contract](./05-quality/production-evaluator-integration-contract.md), [Live evaluator runbook](./05-quality/live-evaluator-validation-runbook.md) |
| Feedback and Coach Update | In-session feedback is immediate question-level coaching. Coach Update is an immutable practiced-question-only post-round synthesis. Its first Google profile passed synthetic and disposable-DB completion/replay/dashboard reconciliation. Partial artifacts are forbidden; eligible completed-round evaluator gaps can be repaired explicitly. | [Dashboard IA](./04-architecture/evidence-first-dashboard-information-architecture.md), [Coach Update runbook](./05-quality/live-coach-update-validation-runbook.md) |
| Dashboard and follow-up practice | The dashboard is scoped by opaque candidate-owned prep-context id. Active round, latest Coach Update, Practice Next, Coach Plan, durable editable queue, one-question/fixed-set actions, and follow-up ready/session flow are wired. Direct actions use candidate-owned keyed creation so concurrent or response-lost replay returns one immutable ready intent while a new key permits later intentional repractice. That 24-hour intent atomically consumes into exactly one owned session, and prep-context serialization protects attempt numbering. Attempt lineage is retained for later trend, recruiter, and BI uses but is not current candidate UI. | [Dashboard IA](./04-architecture/evidence-first-dashboard-information-architecture.md), [Direct-intent idempotency](./04-architecture/candidate-direct-practice-intent-creation-idempotency.md), [Fixed-intent launch](./04-architecture/candidate-fixed-intent-session-launch.md) |
| Shared candidate/invited runtime | The live-practice shell, runtime facts, completion adapters, and landing composition are audience-neutral. Invited initials/auth/visibility/route persistence and recruiter-created constraints are not wired into V2. | [V1 SWOT and runway](./04-architecture/v1-swot-and-rebuild-runway.md) |
| UI posture | Setup and pre-session landing have received design attention. Session and dashboard behavior/data are production-shaped, but most current UI remains provisional scaffolding pending the larger surface rebuild. | [Design system foundation](./03-design/design-system-foundation.md) |

## Next Slice

140. Run a senior scope pass for the next candidate milestone before implementation. Reconcile the current phase map, V1 behavior, the original refactor direction, the newly staged UI/design artifacts, and the shortest path to a production-demonstrable candidate app; then ratify one bounded sequence rather than mixing final session/dashboard presentation, resume ingestion and revision, invited-flow convergence, media/TTS, host deployment acceptance, or QA reviewer tooling in one pass.

## Major Phase Progress

Percentages are directional engineering estimates, not schedule or release-readiness claims. A phase can be implementation-heavy and still blocked from deployment by external acceptance.

| Phase | Progress | Characterization | Main work remaining |
| --- | ---: | --- | --- |
| A. Host launch, identity, setup | 75% | Core IC-side TA engineering is production-shaped; deployment acceptance is unproven. | Live TA signed-token/network matrix, least-privilege/secret operations, upstream query redaction, RW identity adapter, cross-device setup drafts, resume/stage evolution. |
| B. Session planning and question wording | 88% | The serving profile, strict runtime, immutable configuration capture, safe failure boundary, telemetry, synthetic gate, disposable-DB proof, guarded live-browser recovery, and setup-start idempotency are landed. | Broader role/stage quality set and deployment approval. |
| C. Live session and answer analysis | 80% | Candidate text practice works end to end with live evidence-first coaching and recovery. | Trusted technical references, production TTS, voice/photo media, final presentation pass, invited route wiring. |
| D. Dashboard, Coach Update, follow-up | 78% | Behavioral and persistence foundations are mature; direct intent creation and fixed-intent session launch are now atomic and replay-safe, while composition and longitudinal meaning are not final. | Final UI, multi-round progress/coverage, trend views, trusted coach-bundle production, resume-version staging, justified projections. |
| E. QA/evaluation and model comparison | 78% | First serving profile and repeatable live gate are established. | Human reviewer workflow, approved comparison profiles, technical-reference policy/source, operational masking, promotion/rollback evidence. |
| F. Shared invited/candidate convergence | 25% | Shared runtime seams exist; invited product flow remains mostly V1-only. | Invited auth/initials, route and persistence wiring, employer visibility boundaries, recruiter-created session constraints. |
| G. Recruiter/admin V2 disposition | 10% | No migration decision has been ratified beyond preserving current V1 behavior as reference. | Inventory recruiter/admin surfaces, decide preserve/rebuild/retire, define shared read models and route ownership. |
| H. Production hardening | 50% | Strong local security, failure, migration, and provider gates exist; release operations are incomplete. | Accessibility/performance pass, full observability/alerts, dependency disposition, deployment env and rollback, real-host acceptance, senior release pass. |
| I. Retirement and documentation cleanup | 20% | Cleanroom discipline and first archive/compaction passes are underway. | Remove compatibility redirects, browser bridges, fixture-only paths, obsolete V1 helpers/tests, historical scripts, and superseded docs after replacements are verified. |

## Open Decisions And Risks

### Deployment And Release Gates

- Run the real TA signed-token staging matrix and prove network access, least-privilege MSSQL credentials, issuer/source values, mint-per-click behavior, secret rotation, and upstream launch-token query redaction.
- Obtain organizational approval for Gemini account, service terms, candidate-data handling, telemetry, and rollback. Any serving prompt/model/schema/settings change advances immutable configuration identity and reruns its live gate.
- Resolve or formally accept the high `nodemailer` advisory and Next-bundled moderate PostCSS advisory before pilot/release.
- Complete accessibility, performance, operational alerting, environment, rollback, and post-deploy smoke evidence through a senior release pass.
- Historical tracked staging CSVs under `09-dev` contain candidate/job discovery rows. No new raw exports should be committed; current-tip quarantine/removal and any required history remediation need an explicit security cleanup pass.

### Near-Term Architecture

- Production question wording passed synthetic, disposable-DB, guarded browser reconciliation, and request-idempotent setup replay; broader role/stage quality review and deployment approval remain open.
- Resume upload/OCR, storage, revision labels, and question reconciliation are unratified. Interview-stage changes should create linked blank-slate prep contexts rather than mutating evidence history.
- Direct fixed-intent creation and intent-consume/session-create are separate, landed idempotency boundaries. Editable next-round queue launch remains distinct and uses its own draft/version contract.
- Pending Coach Update does not poll. Explicit repair exists for unavailable completed work, but background/long-running generation needs a lease, refresh, and retry contract.
- Full-history dashboard reads are correct but may require a versioned projection after volume measurements justify it.
- Production TTS, voice, photo capture, and invited/recruiter convergence remain separate privacy and authorization projects.

### Accepted Transitional Debt

- `/practice2`, `/session2/[sessionId]`, and `/dashboard2` are compatibility redirects only.
- A nonproduction browser bridge remains where durable identity/storage is unavailable.
- Candidate-visible attempt counts and trends are deliberately deferred; lineage and rollups must remain intact.
- `feedback_actions_json` stores latest recovery state, not full append-only engagement history. Decide before BI work whether a separate event boundary is required.
- Expired setup-start claim rows are indexed but do not yet have a scheduled retention job; add bounded cleanup before production volume makes it operationally relevant.
- Expired direct-intent creation request rows are indexed but do not yet have a scheduled retention job; add bounded cleanup before production volume makes it operationally relevant.
- V1 app data requires no V2 compatibility, but V2 development rows must remain honestly represented rather than backfilled with invented provider/configuration history.

## Recent Milestones

- Slice 139: integrated Slices 134-138 as one milestone, fixed refresh-retained direct-action request identity and stale-key conflict recovery, reconciled browser-supplied prep/intent/session ids to durable rows, clarified fixed-set launch versus active-session resume, removed an artificial role-heading wrap constraint, aligned resume copy with durable live progress before the first answer, and passed 606 candidate tests plus type, focused lint, database, concurrency, browser, and responsive Playwright checks. Case 4 was correctly not exercisable because the fixture exposed active-round recovery rather than eligible unanswered fixed-set coverage.
- Slice 138: converged one-question and fixed-set producers on one keyed POST boundary, retired durable mutation from GET rendering, hashed candidate-scoped request identity, fingerprinted exact ordered intent snapshots, atomically created one request pointer and ready intent, proved replay/conflict/rollback/cross-candidate/new-key behavior, and passed real eight-connection concurrency plus upgrade and fresh-database readiness.
- Slice 137: made ready intents immutable 24-hour one-use launch identities, atomically inserted one owned follow-up session and consumed the intent, replayed response-lost/concurrent starts, serialized prep-context attempt numbering, enforced source/session snapshot ownership, and passed focused, upgrade, fresh-database, and cross-feature wording-reuse reconciliation.
- Slice 136: added candidate-owned setup-start request hashes, 60-second fenced claims, 24-hour accepted-session replay, browser-retained same-attempt keys, atomic session/claim/trusted-staging completion, failure retry generations, route concurrency/conflict handling, fresh/upgrade migration proof, and disposable-DB replay reconciliation without another provider call.
- Slice 135: rolled-back disposable-DB reconciliation and a guarded live-browser run proved accepted wording/configuration persistence, immutable recovery, truthful retry with draft preservation, trusted-staging preservation on failure, and exact follow-up wording reuse without regeneration.
- Slice 134: first production question-wording profile, bounded untrusted context, strict plan mapping, immutable configuration identity, fail-closed setup integration, metadata-only telemetry, and one accepted credentialed synthetic gate (`live_question_wording_d2e342492a3c518f`).
- Slices 125-133: hardened one-time TA launch, direct MSSQL context resolution, trusted setup staging, completed-round evaluator repair, first production Coach Update profile, credentialed validation, exact artifact identity, and integrated migration/security/privacy/dependency audit. Milestone commit: `e2cfd7d`.
- Slices 114-124: production evaluator integration contract, fenced run lifecycle, exact configuration manifests, Google adapter, recovery matrix, credentialed seven-case live validation, route/DB reconciliation, and first serving-profile ratification.
- Slices 101-113: evidence-first dashboard architecture, opaque prep-context propagation, immutable Coach Update artifacts, durable next-round drafts, atomic queue launch, duplicate-path setup choice, stable dashboard shell, Coach Plan, and shared Practice Next actions.
- Slices 93-100: production-shaped pre-session landing, shared live-practice shell, productized answer mutation states, immutable answer/evaluator lineage, staged evidence-first feedback, and browser-validated candidate session arc.
- Slices 1-92: cleanroom route/design/setup foundation, durable session and answer lifecycle, first dashboard, follow-up intent/session flow, and attempt-context infrastructure. See the archived handoff snapshots for numbered detail.

## Archive And Operating Rules

- Full Slice 85-133 ledger and pre-compaction state: [2026-07-18 handoff snapshot](./reference-archive/handoff-pre-compaction-2026-07-18.md).
- Earlier cleanroom history: [2026-07-12 handoff snapshot](./reference-archive/handoff-pre-compaction-2026-07-12.md).
- Historical V1/interim contracts and SQL: [Reference Archive](./reference-archive/README.md).
- V1 is a behavior reference, not a default source-code donor. Name divergences among V1, the original refactor pack, and current V2 before implementing.
- Before removing a superseded path, search callers and classify it as `keep as transition`, `remove now`, or `mark for retirement`.
- At the end of a meaningful slice, update this file only with current truth, changed risk, phase movement, the next numbered slice, and a short milestone entry. Put long evidence in the governing contract, runbook, or reference archive.
