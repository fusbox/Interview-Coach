# Candidate App Handoff

Status: Active resumption contract
Last updated: 2026-07-18
Current milestone: Slice 133 is committed and pushed as `e2cfd7d` on `feature/candidate-v2-rebuild`.

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
| Setup and prep context | Generic setup creates a candidate-owned prep context. Job-aware launch stages canonical role/JD read-only; identity-only launch permits manual setup. Duplicate active role/JD paths require an explicit user choice. Setup staging is consumed atomically with the first session or existing-path selection. | [Practice setup](./02-requirements/practice-setup-scope.md), [Platform launch and prep identity](./04-architecture/platform-launch-prepprofile-migration.md) |
| Session planning and wording | Deterministic category planning, immutable plan snapshots, strict slot/order wording validation, fixture wording, and the production-shaped ready landing are landed. Production question wording is the next missing provider boundary. | [DATA_CONTRACT](./DATA_CONTRACT.md), [Question categories](./04-architecture/question-category-contract.md) |
| Live practice and state | Typed candidate-led practice is functional through autosave, refresh/new-tab recovery, immutable feedback retries, pause/return, completion, and role-scoped dashboard return. Drafts remain drafts until submit; accepted answers and evaluator attempts are immutable. Candidate recovery is designed to return to the exact session/question/stage. | [SPEC](./SPEC.md), [Evaluator contract](./05-quality/evidence-first-evaluator-contract.md) |
| Answer evaluation | The first candidate-serving `gemini-2.5-flash` evidence-first profile is ratified and credentialed-live validated. Exact configuration fingerprints, fenced evaluator runs, bounded repair, candidate-safe projection, and continue-without-coaching behavior are durable. Technical accuracy remains `not_assessed` without a trusted reference. | [Production evaluator contract](./05-quality/production-evaluator-integration-contract.md), [Live evaluator runbook](./05-quality/live-evaluator-validation-runbook.md) |
| Feedback and Coach Update | In-session feedback is immediate question-level coaching. Coach Update is an immutable practiced-question-only post-round synthesis. Its first Google profile passed synthetic and disposable-DB completion/replay/dashboard reconciliation. Partial artifacts are forbidden; eligible completed-round evaluator gaps can be repaired explicitly. | [Dashboard IA](./04-architecture/evidence-first-dashboard-information-architecture.md), [Coach Update runbook](./05-quality/live-coach-update-validation-runbook.md) |
| Dashboard and follow-up practice | The dashboard is scoped by opaque candidate-owned prep-context id. Active round, latest Coach Update, Practice Next, Coach Plan, durable editable queue, one-question/fixed-set actions, and follow-up ready/session flow are wired. Attempt lineage is retained for later trend, recruiter, and BI uses but is not current candidate UI. | [Dashboard IA](./04-architecture/evidence-first-dashboard-information-architecture.md), [SPEC](./SPEC.md) |
| Shared candidate/invited runtime | The live-practice shell, runtime facts, completion adapters, and landing composition are audience-neutral. Invited initials/auth/visibility/route persistence and recruiter-created constraints are not wired into V2. | [V1 SWOT and runway](./04-architecture/v1-swot-and-rebuild-runway.md) |
| UI posture | Setup and pre-session landing have received design attention. Session and dashboard behavior/data are production-shaped, but most current UI remains provisional scaffolding pending the larger surface rebuild. | [Design system foundation](./03-design/design-system-foundation.md) |

## Next Slice

134. Review V1 question generation, the original refactor prompt/context boundary, the deterministic plan/wording contract, and the evaluator/Coach Update production patterns. Ratify and implement the first production question-wording provider profile with bounded role, JD, optional resume, stage, and plan-slot context; strict slot/order/schema validation; exact immutable configuration identity; fail-closed retry/recovery; metadata-only telemetry; and an explicit credentialed synthetic gate. Preserve the ready landing. Do not begin final session/dashboard UI redesign, invited-flow wiring, or technical-reference retrieval.

## Major Phase Progress

Percentages are directional engineering estimates, not schedule or release-readiness claims. A phase can be implementation-heavy and still blocked from deployment by external acceptance.

| Phase | Progress | Characterization | Main work remaining |
| --- | ---: | --- | --- |
| A. Host launch, identity, setup | 75% | Core IC-side TA engineering is production-shaped; deployment acceptance is unproven. | Live TA signed-token/network matrix, least-privilege/secret operations, upstream query redaction, RW identity adapter, cross-device setup drafts, resume/stage evolution. |
| B. Session planning and question wording | 45% | Durable plan and fixture wording contracts are sound; the serving generator is absent. | Slice 134 provider profile, prompt/context policy, immutable configuration capture, retry/error UX, live gate, telemetry. |
| C. Live session and answer analysis | 80% | Candidate text practice works end to end with live evidence-first coaching and recovery. | Trusted technical references, production TTS, voice/photo media, final presentation pass, invited route wiring. |
| D. Dashboard, Coach Update, follow-up | 72% | Behavioral and persistence foundations are mature; composition and longitudinal meaning are not final. | Final UI, multi-round progress/coverage, trend views, coach bundles, resume-version staging, fixed-intent idempotency, justified projections. |
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

- Production question wording is the immediate functional gap.
- Resume upload/OCR, storage, revision labels, and question reconciliation are unratified. Interview-stage changes should create linked blank-slate prep contexts rather than mutating evidence history.
- Setup start and direct fixed-intent creation still need request-level idempotency; intent consume/session create needs final transaction hardening.
- Pending Coach Update does not poll. Explicit repair exists for unavailable completed work, but background/long-running generation needs a lease, refresh, and retry contract.
- Full-history dashboard reads are correct but may require a versioned projection after volume measurements justify it.
- Production TTS, voice, photo capture, and invited/recruiter convergence remain separate privacy and authorization projects.

### Accepted Transitional Debt

- `/practice2`, `/session2/[sessionId]`, and `/dashboard2` are compatibility redirects only.
- A nonproduction browser bridge remains where durable identity/storage is unavailable.
- Candidate-visible attempt counts and trends are deliberately deferred; lineage and rollups must remain intact.
- `feedback_actions_json` stores latest recovery state, not full append-only engagement history. Decide before BI work whether a separate event boundary is required.
- V1 app data requires no V2 compatibility, but V2 development rows must remain honestly represented rather than backfilled with invented provider/configuration history.

## Recent Milestones

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
