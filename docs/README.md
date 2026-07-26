# Interview Coach V2 Documentation

Status: Canonical documentation authority index
Last updated: 2026-07-26

This is the one active documentation root for the clean V2 rebuild. It covers candidate-led practice, recruiter-invited practice, standalone recruiter operations, shared session/evaluation behavior, and release preparation.

Agents should not broad-scan the documentation tree. Start with the authority stack, then read only the subsystem documents linked from the active work.

## Authority Stack

Read these first, in order:

1. [HANDOFF](./HANDOFF.md): current implementation truth, active milestone, phase progress, risks, and next work.
2. [SPEC](./SPEC.md): product behavior, claims, journeys, and non-goals.
3. [DATA_CONTRACT](./DATA_CONTRACT.md): durable vocabulary, state, ownership, lineage, and payload boundaries.
4. [Local Dev Bootstrap](./09-dev/local-dev-bootstrap.md): environment, database, migrations, dev identity, and executable verification.
5. The active subsystem contract linked from `HANDOFF`.
6. [Autonomous Development Operating Model](./07-ops/autonomous-development-operating-model.md) when executing an approved multi-slice milestone.
7. [Production UI Workstream](./03-design/production-ui-workstream.md) when changing tracked product UI.

When sources conflict, use this order:

1. Product intent and user safety
2. Durable invariants and current repository evidence
3. `SPEC.md` and `DATA_CONTRACT.md`
4. Ratified ADRs and active subsystem contracts
5. `HANDOFF.md` execution wording
6. Historical plans and V1/reference behavior

Name and resolve conflicts before implementation. Do not silently combine incompatible directions.

## Documentation Lifecycle

| Label | Meaning | Agent use |
| --- | --- | --- |
| Canonical | Governs current product, data, or execution truth | Read by default when in scope |
| Supporting | Supplies detail for one canonical contract | Read only for that subsystem |
| Operational | Executable runbook, validation, incident, or release procedure | Read when running the operation |
| Transitional | Contains durable content still being consolidated | Do not treat as authority |
| Historical | Behavior archaeology, prior plans, or milestone history | Read only when explicitly comparing prior behavior |
| Local-only | Discovery output, imports, credentials, or design experiments | Keep outside tracked docs |

Every active document must have one clear job. Slice history and long validation evidence belong in milestone evidence or the reference archive, not product contracts.

## Read By Concern

### Product, Identity, And Setup

- [Practice Setup Scope](./02-requirements/practice-setup-scope.md)
- [Authenticated Candidate Access](./02-requirements/authenticated-candidate-access.md)
- [Host Launch Implementation](./09-dev/host-launch-api-implementation.md)
- [Host Launch Acceptance](./09-dev/host-launch-live-acceptance.md)
- [Storage And Resume Ingestion](./04-architecture/storage-and-resume-ingestion.md)

### Planning, Session, Evaluation, And Dashboard

- [Practice Plan Baseline And Round Selection](./04-architecture/practice-plan-baseline-and-round-selection.md)
- [Question Category Contract](./04-architecture/question-category-contract.md)
- [Question Preparedness Progress](./04-architecture/question-preparedness-progress-contract.md)
- [Evidence-First Evaluator Contract](./05-quality/evidence-first-evaluator-contract.md)
- [Production Evaluator Integration](./05-quality/production-evaluator-integration-contract.md)
- [Evidence-First Dashboard Architecture](./04-architecture/evidence-first-dashboard-information-architecture.md)
- [Coach Update Card And Transcript Canvas](./03-design/coach-update-v2-card-spec.md)
- [AI-Eval Operator Workbench](./05-quality/ai-eval-operator-workbench.md)
- [Evidence-First Coaching Scenario Lab](./05-quality/evidence-first-coaching-scenario-lab.md)

### Invited Practice And Recruiter

- [Invited Practice Identity And Session Foundation](./04-architecture/invited-practice-identity-session-foundation.md)
- [Invited Practice Access And Entry](./04-architecture/invited-practice-access-and-entry.md)
- [Invited Practice Live Runtime](./04-architecture/invited-practice-live-runtime.md)
- [Invited Practice Completion And Repeat](./04-architecture/invited-practice-completion-and-repeat.md)
- [Recruiter V2 Delivery And Host Integration](./04-architecture/recruiter-v2-delivery-and-host-integration.md)
- [Recruiter Standalone Milestone](./05-quality/recruiter-standalone-flow-milestone.md)

### Production UI

- [Design System Foundation](./03-design/design-system-foundation.md)
- [Production UI Workstream](./03-design/production-ui-workstream.md)
- [Candidate Production UI Milestone](./05-quality/candidate-production-ui-milestone.md)
- [Coach Update Card And Transcript Canvas](./03-design/coach-update-v2-card-spec.md)

The extracted design-system source, experiments, and UI lab remain under `.untracked`. The tracked design contracts govern production implementation.

### Security, Quality, And Operations

- [Security And Privacy Index](./06-security/README.md)
- [Threat Model](./06-security/threat-model.md)
- [Privacy And Consent Requirements](./06-security/privacy-disclosures-and-consent-requirements.md)
- [Test Strategy](./05-quality/test-strategy.md)
- [Accessibility Baseline](./05-quality/accessibility-baseline.md)
- [Production Hardening And Deployment Controls](./07-ops/production-hardening-and-deployment-controls.md)
- [Observability Plan](./07-ops/candidate-observability-plan.md)
- [Incident Runbook](./07-ops/candidate-incident-runbook.md)
- [AI-Eval Worker And Retention](./07-ops/ai-eval-worker-and-retention.md)
- [Decision Records](./08-decisions/README.md)

## Autonomous Work

- [Operating Model](./07-ops/autonomous-development-operating-model.md)
- [Milestone Template](./07-ops/autonomous-milestone-template.md)
- [Subagent Assignment Template](./07-ops/subagent-assignment-template.md)
- `.agents/skills/autonomous-milestone-run`: orchestrates internal slices and existing senior passes
- `.agents/skills/senior-slice-pass`: before and after each meaningful slice
- `.agents/skills/senior-milestone-pass`: before commit, push, or phase movement
- `.agents/skills/senior-release-pass`: before deployment, pilot, migration, or release decisions

`HANDOFF.md` owns the active milestone instance, internal slice status, shared-file claims, current risks, and verdict. Do not create a second active backlog.

## Reference Archives

- [Candidate V1 and interim V2 archive](./reference-archive/candidate-interim/README.md)
- [Recruiter-led V1/shared app archive](./reference-archive/recruiter-v1/README.md)

Reference archives are excluded from the default documentation link gate and agent reading path. V1 remains valuable for behavior comparison, but it is never a current contract by default.

## Maintenance Rules

- Update `SPEC.md` when product behavior or claims change.
- Update `DATA_CONTRACT.md` when durable vocabulary, ownership, lifecycle, or lineage changes.
- Update `HANDOFF.md` only for changed current truth, active milestone status, phase movement, risks, and concise milestone evidence.
- Put detailed validation in subsystem contracts, runbooks, or dated milestone artifacts.
- Keep raw staging queries, credentials, candidate/job rows, provider output, and design imports out of tracked docs.
- Run `npm run docs:check` after documentation moves or link changes.
- Archive a document when it no longer answers a live product, implementation, validation, or release question.
