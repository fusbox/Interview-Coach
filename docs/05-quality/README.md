# Quality Documentation

This folder collects the documents used to evaluate whether the system is safe to ship, stable to operate, and consistent with product intent.

Use this section when you need to:
- review code or architecture from a production-readiness perspective
- validate release quality across UX, AI behavior, and operational safeguards
- understand current QA, incident, and alerting expectations
- check environment, readiness, or debug references that support quality work

---

## How To Read This Section

Start with the document that matches the kind of quality question you are trying to answer:

1. Use the review docs if you are evaluating implementation quality or preparing a remediation pass.
2. Use the QA and readiness docs if you are validating product behavior, coaching tone, or AI output consistency.
3. Use the ops docs if you are preparing for incidents, environment setup, or alert triage.

If you are doing a release-readiness check, you will usually need material from all three groups.

---

## Document Map

### Review And Remediation

#### [comprehensive_code_review.md](./comprehensive_code_review.md)
Deep production-readiness review of the codebase, including completed remediations and remaining gaps.

Covers:
- high-risk correctness and concurrency paths
- security and contract hardening status
- testing, CI, observability, and operability posture
- release recommendation at a given point in time

Read this when:
- you want the highest-signal quality assessment of the current system
- you are planning a hardening roadmap
- you need context for why certain quality work was prioritized

#### [code_review_request.md](./code_review_request.md)
Reusable code-review checklist that defines the review dimensions expected in this repo.

Covers:
- correctness
- maintainability
- architecture
- validation
- security
- performance
- testing
- observability

Read this when:
- you are requesting or performing a structured review
- you want a consistent review rubric across contributors

#### [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)
Time-stamped production-readiness review used as the source assessment for the current remediation pass.

Read this when:
- you want the most recent dated review snapshot
- you need the exact severity board and production gate rationale for the current hardening effort

#### [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)
Repo-specific execution plan that turns the 2026-03-25 review into workstreams, phases, exit criteria, and delivery order.

Read this when:
- you are planning remediation execution
- you need the phase-by-phase hardening roadmap
- you want the repo-specific module plan

#### [production_remediation_issue_breakdown_2026-03-25.md](./production_remediation_issue_breakdown_2026-03-25.md)
GitHub-issue style breakdown of the remediation work.

Read this when:
- you are creating or managing implementation tickets
- you need acceptance criteria and dependencies for each finding

#### [production_remediation_issue_bodies_2026-03-25.md](./production_remediation_issue_bodies_2026-03-25.md)
Copy-paste-ready issue bodies for the first remediation wave.

Read this when:
- you are creating GitHub issues or Linear tickets
- you want ready-to-use engineering ticket text for the P0/P1 startup work

#### [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
Live administration tracker for monitoring remediation progress and production gate status.

Read this when:
- you are overseeing execution
- you need a current status view by severity and work item

#### [production_remediation_sprint1_board_2026-03-25.md](./production_remediation_sprint1_board_2026-03-25.md)
Focused sprint board for the first hardening sprint.

Read this when:
- you are planning or administering the first remediation sprint
- you want a bounded in-scope/out-of-scope board for P0 foundation work

#### [production_remediation_phase2_board_2026-03-25.md](./production_remediation_phase2_board_2026-03-25.md)
Active execution board for the post-P0 remediation backlog.

Read this when:
- you are managing the remaining P1/P2 work
- you need the current active item, ready queue, and phase-level sequencing

#### [durable_metrics_plan_2026-03-25.md](./durable_metrics_plan_2026-03-25.md)
Bounded design note for `P1-4` durable metrics and SLO work.

Read this when:
- you are implementing or reviewing the durable metrics path
- you need the chosen dual-write direction, guardrails, and first-slice scope
- you want the minimum SLO set and storage boundaries for the operability phase

#### [initial_slos_2026-03-26.md](./initial_slos_2026-03-26.md)
Initial SLO proposal mapped to the durable metrics now validated in production.

Read this when:
- you are defining release-relevant reliability objectives
- you need exact metric-to-SLO mapping for session start, AI reliability, and latency
- you want to distinguish primary SLOs from supporting operational indicators

#### [release-gate-checklist.md](./release-gate-checklist.md)
Operational release gate for deciding whether a build may be promoted to production.

Read this when:
- you are preparing a release decision
- you need a repeatable production go/no-go checklist

#### [production-hardening-runbook.md](./production-hardening-runbook.md)
Administrative runbook for executing and governing the remediation program itself.

Read this when:
- you are running weekly remediation reviews
- you need to verify what must be updated before a remediation item is considered complete

### QA And Product Quality

#### [feedback-chain-spec.md](./feedback-chain-spec.md)
Design specification for how answer-level coaching feedback should be generated as one coherent chain.

Covers:
- the intended relationship between `ack`, `contentPulse`, `deliveryPulse`, and recommendation
- hidden planning fields and schema direction
- prompt-contract changes for coherence
- evaluation criteria and failure modes for answer-level feedback quality

Read this when:
- you are redesigning or tuning answer feedback generation
- you want to improve `ack` without breaking the rest of the feedback chain
- you need the target contract for AI-feedback implementation work

#### [QA-checklist.md](./QA-checklist.md)
Ship-blocking QA checklist for the product experience.

Covers:
- coaching tone and language restrictions
- tier integrity rules
- modality safety
- screen-level and regression expectations

Read this when:
- you are validating a release candidate
- you are checking whether product behavior still matches the coaching philosophy
- you need a cross-functional QA reference

#### [readiness-band-definition.md](./readiness-band-definition.md)
Defines the canonical meaning of readiness bands and their intended use.

Covers:
- readiness level semantics
- allowed and excluded inputs
- interpretation boundaries

Read this when:
- you are touching readiness logic
- you need to verify that readiness remains preparation-focused rather than evaluative

#### [readiness-eval-scenarios.md](./readiness-eval-scenarios.md)
Scenario-based validation set for readiness classification.

Covers:
- expected readiness outcomes for representative candidate sessions
- rationale for each scenario
- drift-detection reference points

Read this when:
- you are changing prompts, evaluation logic, or readiness behavior
- you want quick regression scenarios for AI quality checks

### Operations And Runtime Quality

#### [environment_variable_matrix.md](./environment_variable_matrix.md)
Current environment variable inventory and handling guidance.

Covers:
- required vs optional variables
- scope and sensitivity
- local-development and deployment expectations

Read this when:
- you are configuring a new environment
- you are auditing secrets and deployment readiness

#### [ops_alert_policy.md](./ops_alert_policy.md)
Defines current alert rules and intended responders.

Covers:
- alert IDs
- severity thresholds
- responder routing and ownership

Read this when:
- you are reviewing operational telemetry coverage
- you need to understand what conditions should page whom

#### [incident_runbook.md](./incident_runbook.md)
Operational triage guide for current alert classes.

Covers:
- symptoms
- immediate response steps
- likely causes
- mitigation guidance

Read this when:
- an operational alert has triggered
- you need a first-response playbook during an incident

### Debug And Supporting References

#### [debug/ai_context.md](./debug/ai_context.md)
Captured AI prompt/debug context used for inspection and troubleshooting.

Covers:
- representative prompt construction
- current coaching/debug context snapshots

Read this when:
- you are debugging AI output quality
- you need a concrete example of prompt context outside the running app

---

## Recommended Reading Paths

### For release readiness
Read in this order:
- [comprehensive_code_review.md](./comprehensive_code_review.md)
- [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)
- [release-gate-checklist.md](./release-gate-checklist.md)
- [QA-checklist.md](./QA-checklist.md)
- [environment_variable_matrix.md](./environment_variable_matrix.md)
- [ops_alert_policy.md](./ops_alert_policy.md)
- [incident_runbook.md](./incident_runbook.md)

### For code review
Read in this order:
- [code_review_request.md](./code_review_request.md)
- [comprehensive_code_review.md](./comprehensive_code_review.md)
- [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)
- [production_remediation_plan_2026-03-25.md](./production_remediation_plan_2026-03-25.md)
- [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

### For AI and coaching quality work
Read in this order:
- [feedback-chain-spec.md](./feedback-chain-spec.md)
- [QA-checklist.md](./QA-checklist.md)
- [readiness-band-definition.md](./readiness-band-definition.md)
- [readiness-eval-scenarios.md](./readiness-eval-scenarios.md)
- [debug/ai_context.md](./debug/ai_context.md)

### For operations and support
Read in this order:
- [environment_variable_matrix.md](./environment_variable_matrix.md)
- [ops_alert_policy.md](./ops_alert_policy.md)
- [incident_runbook.md](./incident_runbook.md)

---

## What This Section Is Not

This folder is not the source of truth for system structure or architectural boundaries.

- Use `docs/04-architecture` for architecture and ownership decisions.
- Use `docs/02-requirements` for product intent and acceptance criteria.
- Use `docs/03-design` for user flows and interaction design.

The quality docs answer a different question:

> "Given the intended product and current architecture, is the implementation good enough, safe enough, and observable enough to ship and operate?"

---

## Change Expectations

These documents do not all have the same lifecycle.

- Time-stamped assessments like [comprehensive_code_review.md](./comprehensive_code_review.md) should preserve historical context rather than being rewritten as if they were timeless truth.
- Operational references like [environment_variable_matrix.md](./environment_variable_matrix.md), [ops_alert_policy.md](./ops_alert_policy.md), and [incident_runbook.md](./incident_runbook.md) should be kept current as implementation changes.
- Product-quality references like [QA-checklist.md](./QA-checklist.md) and the readiness docs should evolve carefully to avoid drifting away from the intended coaching posture.
