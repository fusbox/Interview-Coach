# Interview Coach V2 Handoff

Status: Active resumption contract
Last updated: 2026-07-23
Current branch: `feature/candidate-v2-rebuild`

## Resume Here

V2 is a clean rebuild with locally accepted candidate-led, invited-candidate, and standalone recruiter journeys. The latest milestone adds an individually granted AI-eval operator workbench plus a 32-case synthetic scenario lab and an explicitly gated credentialed worker. Two four-case live runs form an operator-accepted representative calibration gate; they are not full-corpus or release evidence.

Read in this order:

1. [SPEC](./SPEC.md): product behavior and boundaries.
2. [DATA_CONTRACT](./DATA_CONTRACT.md): durable ownership, state, and lineage.
3. [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md): current environment, database, and verification commands.
4. The subsystem contract linked from the current-state table.
5. [Production UI Workstream](./03-design/production-ui-workstream.md) when changing tracked product UI.

Before a meaningful workflow slice, inspect matching V1 behavior from `feature/candidate-module` and classify it as `preserve`, `reinterpret`, `retire`, or `defer`. Use `.agents/skills/senior-slice-pass` for meaningful slices, `senior-milestone-pass` at integrated boundaries, and `senior-release-pass` before deployment, pilot, migration, or release decisions.

## Next Work

### Core Lane

187. Complete the bounded AI-eval calibration backlog without changing serving behavior: execute the full current baseline through the credentialed profile, add deterministic provider-fault cases for candidate-visible unavailable paths, triage the recorded semantic mismatch, and promote only representative actionable defects into remediation/regression lineage.

After Slice 187, prioritize the remaining release-critical work that is not externally blocked: deployed worker/retention controls, technical-reference policy, cleanup jobs, dependency disposition, telemetry/alert sinks, and release evidence. Real TA staging integration remains dependent on final host/network access and upstream acceptance details.

### Production UI Lane

Tracked production UI may proceed in parallel on `feature/candidate-v2-production-ui` from its dedicated worktree. It must consume current route/read/mutation contracts, preserve all failure and recovery states, and avoid duplicating domain logic. The first UI pass should establish the shared shell, surface ownership, and state matrix before replacing individual candidate, invited, recruiter, or QA surfaces.

Only one lane may own a shared file at a time. Treat `src/index.css`, shared design-system components, route pages, `package.json`, `SPEC.md`, `DATA_CONTRACT.md`, and this handoff as explicit integration files. See [Production UI Workstream](./03-design/production-ui-workstream.md).

## Current State

| Domain | Landed contract | Main remaining work | References |
| --- | --- | --- | --- |
| Host identity, setup, and resume | One-time two-minute TA launch exchange becomes a seven-day HttpOnly app session. Candidate-owned prep contexts, explicit duplicate-role choice, idempotent setup start, bounded PDF/DOCX/photo/paste ingestion, PII scrubbing, review, exact artifact selection, and safe source disposal are durable. RW remains disabled. | Real TA token/network matrix, least-privilege MSSQL operations, trusted-host resume lookup, deployed parser/OCR containment and alerts, later stage/resume evolution. | [Authenticated access](./02-requirements/authenticated-candidate-access.md), [Practice setup](./02-requirements/practice-setup-scope.md), [Resume ingestion](./04-architecture/storage-and-resume-ingestion.md) |
| Practice planning and wording | Stage owns one immutable 5/5/7/10/10 prep-context baseline and complete wording set. Round-one count selects from that baseline; follow-up rounds reuse stable question lineage; supplemental questions never expand the denominator. Production Gemini wording is configuration-fingerprinted and fail-closed. | Broader role/stage review, deployment approval, and future baseline evolution only when product requirements demand it. | [Practice Plan baseline](./04-architecture/practice-plan-baseline-and-round-selection.md), [Question wording](./05-quality/production-question-wording-integration-contract.md) |
| Live session and evaluation | Candidate-led and invited paths share typed/voice practice, immutable attempts, autosave and exact recovery, retries, question audio, transcript-first recording, evidence-first evaluation, immediate coaching, and truthful continue-without-coaching behavior. Technical accuracy remains `not_assessed` without a trusted reference. | Technical-reference policy/source, provider-side audio approval, deployed device evidence, later audio hardening; photo answers remain deferred. | [Evaluator](./05-quality/production-evaluator-integration-contract.md), [Voice](./04-architecture/voice-answer-transcription-contract.md), [Question audio](./04-architecture/shared-question-audio-contract.md) |
| Dashboard, Coach Update, and follow-up | Opaque prep-context scoping, active-round recovery, immutable practiced-question Coach Update, provenance-bound transcript canvas, Coach Plan coverage, editable next-round queue, one-question/fixed-set actions, and idempotent follow-up launch are wired. | Multi-round trends, trusted coach bundles, resume-version staging, broader annotation evidence, background generation contract, and release-environment proof. | [Dashboard IA](./04-architecture/evidence-first-dashboard-information-architecture.md), [Transcript canvas](./03-design/coach-update-v2-card-spec.md) |
| Invited and recruiter V2 | Invites exchange bearer links into isolated sessions; initials are a non-gating match signal. Shared live practice, pause/recovery, summary, whole-round repeat, latest-answer-only recruiter transcript, app-owned recruiter auth/settings, fixed-slot invite creation, durable delivery ledger, dashboard, handoff, and guarded SMTP verification are locally accepted. | Deployed SMTP/network evidence, key rotation window, recruiter rate/cleanup controls, optional experience feedback, and future TA recruiter integration. | [Invited runtime](./04-architecture/invited-practice-live-runtime.md), [Recruiter delivery](./04-architecture/recruiter-v2-delivery-and-host-integration.md), [Recruiter milestone](./05-quality/recruiter-standalone-flow-milestone.md) |
| AI-eval operations | Migrations `037-040` provide an individually granted workbench, exact source review, findings, remediation/rechecks, 32 versioned scenarios, deterministic and credentialed runs, operation checkpoints, cost/call preview, complete candidate-visible layer inspection, and same-profile comparison. Browser routes never call providers. | Full baseline live run, deterministic fault paths, semantic-failure triage/promotion, deployed worker and retention, grant procedure, masking/alert evidence. Alternate-profile A/B remains deferred. | [Workbench](./05-quality/ai-eval-operator-workbench.md), [Scenario lab](./05-quality/evidence-first-coaching-scenario-lab.md), [Milestone](./05-quality/ai-eval-scenario-lab-milestone.md) |
| Production UI | Functional and several production-shaped candidate/recruiter surfaces exist; local-only demo routes remain design input and return 404 in production. A separate UI lane is now defined so accepted visual work can land without destabilizing domain execution. | Integrate the current production UI direction across the full state matrix, then run responsive, accessibility, overflow, and behavior regression gates at each surface boundary. | [Design system](./03-design/design-system-foundation.md), [UI workstream](./03-design/production-ui-workstream.md), [V1 runway](./04-architecture/v1-swot-and-rebuild-runway.md) |
| Quality and operations | Candidate/recruiter suites, migration smokes, type/lint/build, deterministic browser journeys, WCAG automation, local production budgets, metadata-only telemetry contracts, and provider/mailbox gates are established. The app is locally demonstration-ready, not release-ready. | Real-host and deployed SMTP/provider evidence, alert delivery, staging performance, manual accessibility, dependency risk disposition, rollback ownership, and senior release pass. | [Production controls](./07-ops/production-hardening-and-deployment-controls.md), [Accessibility](./05-quality/accessibility-baseline.md), [Test strategy](./05-quality/test-strategy.md) |

## Phase Map

Percentages are directional implementation estimates, not schedule or release claims.

| Phase | Progress | Characterization |
| --- | ---: | --- |
| A. Host launch, identity, setup | 95% | IC-side TA candidate engineering is production-shaped; live host acceptance and deployed resume operations remain external/release gates. |
| B. Planning, session, and coaching engine | 96% | Baseline planning, wording, shared text/voice runtime, evidence-first evaluation, and Coach Update are mature; technical references and deployment evidence remain. |
| C. Dashboard and follow-up practice | 96% | Core feedback/feedforward loop, stable prep-context scoping, queue, and direct practice actions are durable; later trends and resume evolution are enhancements. |
| D. Invited and standalone recruiter | 98% | End-to-end local flow is accepted, including email, repeat practice, operational dashboard, and transcript boundary; deployed SMTP and future host integration remain. |
| E. QA/evaluation operations | 96% | Operator workflow and scenario lab are complete enough for iterative calibration; exhaustive live/fault calibration and deployed operations remain. |
| F. Production UI integration | 55% | Core functional surfaces and design-system direction exist; systematic tracked UI replacement now proceeds as a parallel controlled workstream. |
| G. Production hardening and release | 87% | Local technical gates are strong; host, network, alerts, dependencies, manual accessibility, organizational approvals, and release evidence remain. |
| H. Retirement and docs cleanup | 30% | Three handoff snapshots and an active-doc index exist; compatibility paths, fixtures, historical probes, and superseded docs still need classified retirement. |

## Release-Critical Risks

- **Host acceptance:** run the real TA signed-token/network matrix; confirm issuer/source values, mint-per-click behavior, least-privilege MSSQL access, secret rotation, and upstream token-query redaction. RW is not enabled.
- **Provider and email operations:** obtain organizational approval for Gemini use/data handling; prove deployed audio, evaluator, wording, Coach Update, OCR, and SMTP behavior with telemetry and rollback ownership.
- **Operational containment:** wire alert sinks, parser/OCR resource containment, retention cleanup, deployed AI-eval worker recovery, key rotation, and access-log redaction for `/candidate/launch` and `/s/[token]`.
- **Dependency posture:** resolve or explicitly accept the current `@google/genai` cleanup-chain, Next/PostCSS, and Sharp/libvips advisories through tested upgrades; do not apply npm's regressive Next downgrade or untested overrides.
- **Security cleanup:** tracked staging CSV discovery exports under `09-dev` require a deliberate current-tip/history disposition. Commit no new raw candidate/job exports.
- **Release evidence:** complete staging performance, manual accessibility, environment/rollback, post-deploy smoke, and a senior release pass. Local production-shell evidence is not a substitute.

## Bounded Debt And Deferred Product Work

- Compatibility redirects `/practice2`, `/session2/[sessionId]`, and `/dashboard2`, plus the nonproduction browser bridge, remain retirement candidates.
- Cleanup jobs are still needed for setup-start, direct-intent, resume-ingestion, recruiter question-set, and AI-eval scenario rows.
- Invitation token key rotation, recruiter action rate limits, recruiter-create draft recovery, and `outcome_unknown` operations policy remain before pilot.
- Pending Coach Update has explicit repair but no background polling/worker contract. Full-history dashboard reads may later justify a versioned projection.
- Attempt trends, engagement-event BI, resume replacement/question reconciliation, stage evolution, candidate photo answers, reference-library expansion, and alternate-model A/B are deferred product work.
- V1 data compatibility is not required. V2 development facts must remain truthful rather than backfilled with invented provider/configuration history.

## Recent Milestones

- **Slices 179-186, AI-eval operations:** individually granted exact-output review, findings/remediation/rechecks, 32-case scenario lab, gated worker, recovery/cost controls, and accepted representative live calibration. Verdict: `conditional`; see [operator evidence](./05-quality/ai-eval-operator-milestone.md) and [scenario evidence](./05-quality/ai-eval-scenario-lab-milestone.md).
- **Slices 165-178, voice and resume:** shared transcript-first voice answers plus bounded pasted/trusted-host/PDF/DOCX/photo resume processing, review, recovery, PII scrubbing, and multi-instance operations controls. See [voice evidence](./05-quality/transcript-first-voice-answer-milestone.md) and [resume evidence](./05-quality/resume-ingestion-milestone.md).
- **Slices 147-164, standalone recruiter and invited practice:** app-owned recruiter auth/create/delivery/dashboard/settings, clean invite entry, shared runtime, completion/repeat, recruiter transcript boundary, and credentialed SMTP gate. See [recruiter evidence](./05-quality/recruiter-standalone-flow-milestone.md).
- **Slices 140-146, candidate production demonstration:** production-shaped session/dashboard/Coach Update surfaces over the evidence-first engine plus local hardening and browser journeys. See [candidate milestone](./05-quality/candidate-led-production-demonstration-milestone.md).
- **Slices 125-139, host/question/follow-up hardening:** one-time TA launch, direct MSSQL context, trusted setup staging, production question wording/Coach Update, exact idempotency, baseline plan, and immutable follow-up intent/session launch.
- **Slices 1-124:** cleanroom foundation through the first production evaluator and evidence-first dashboard. Use the dated archive snapshots for numbered detail.

## Operating Rules And Archive

- V1 and the original refactor pack are behavior/architecture references, not default code donors. Name conflicts with current V2 before implementation.
- Product intent, user safety, durable invariants, and current repository evidence outrank a stale slice plan.
- Before removing a path, search callers and classify it as `keep as transition`, `remove now`, or `mark for retirement`.
- Update this handoff only with changed current truth, phase movement, next work, risks, and a short milestone range. Put detailed evidence in the governing contract or dated archive.
- Full pre-compression state through Slice 186: [2026-07-23 snapshot](./reference-archive/handoff-pre-compaction-2026-07-23.md).
- Earlier snapshots: [2026-07-18](./reference-archive/handoff-pre-compaction-2026-07-18.md) and [2026-07-12](./reference-archive/handoff-pre-compaction-2026-07-12.md).
- Historical V1/interim contracts and SQL: [Reference Archive](./reference-archive/README.md).
