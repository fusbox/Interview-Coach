---
name: senior-release-pass
description: Assess production and rollout readiness for a release candidate, deployment, pilot, migration, or major launch. Use after milestone reviews when code must be judged against real identity, data, security, privacy, operations, accessibility, capacity, rollback, and support conditions. Produces a release, conditional-release, or hold verdict backed by evidence.
---

# Senior Release Pass

Judge whether the system can be operated safely, not merely whether it builds. Do not substitute this pass for formal security, legal, privacy, accessibility, or infrastructure approval where those are required.

## Establish The Release Model

1. Record the exact commit/artifact, environment, deployment topology, traffic/audience, data stores, providers, feature controls, and release owner.
2. Confirm production identity, authorization, tenancy, secrets, network, and trust boundaries. Do not infer production behavior from dev bypasses.
3. Inventory migrations, backfills, compatibility windows, destructive changes, rollback limits, and data-retention effects.
4. State assumptions and request targeted confirmation for any assumption that changes release risk.
5. Inventory producer, prompt, schema, and projection versions present in the target data store. Compare them with the release artifact's strict write versions and compatible read allowlists. Quantify records that would become unreadable, unavailable, or eligible for repair before approving rollout.

## Readiness Lenses

- **Product:** critical journeys and recovery paths meet current acceptance criteria without scaffold or fixture claims.
- **Data:** migrations are ordered, repeatable, backed up, smoke tested, and compatible with rollback or forward repair.
- **Security:** authentication, authorization, replay/abuse controls, input validation, dependency exposure, and secret handling are reviewed.
- **Privacy/AI:** consent/disclosure, minimization, provider boundaries, redaction, retention, deletion, access, and audit expectations are explicit.
- **Reliability:** timeouts, retries, idempotency, concurrency, degraded states, dependency failure, and recovery objectives are tested.
- **Observability/support:** structured errors, correlation identifiers, metrics, alerts, dashboards, runbooks, and escalation ownership exist for critical failures.
- **Performance/capacity:** representative payloads, concurrency, provider latency, rate limits, database behavior, and cost ceilings are understood.
- **Accessibility/device:** keyboard, screen reader, focus, contrast, reduced motion, responsive/mobile, and supported-browser journeys are validated.
- **Configuration:** required variables, secret rotation, environment parity, ingress/origin behavior, and safe defaults are documented and checked.
- **Delivery:** CI gates, artifact provenance, deployment order, smoke checks, canary/feature-control strategy, and rollback/forward-fix commands are rehearsed.
- **Governance:** known risks have owners, due triggers, and acceptance authority; no critical risk is hidden in a generic backlog.

Invoke or recommend specialist reviews when warranted: security best practices, threat modeling, Postgres review, framework review, accessibility, browser automation, and deployment validation. Cite their evidence; do not merely say they were considered.

## Adversarial Scenarios

Test or explicitly assess: stolen/expired/replayed identity, cross-user resource access, malformed or oversized inputs, duplicate concurrent mutations, provider timeout or invalid output, database interruption, partial deploy, stale clients, migration failure, rollback after writes, log/URL leakage, rate-limit exhaustion, and support recovery from durable state.

For releases with historical projections or repeated-item lineage, also assess: a supported prior-version record after deployment; an unsupported older record failing truthfully; local-key reuse across rounds/contexts; a recommendation whose correct item is not first; and cross-surface reconciliation of canonical display identity versus exact action occurrence. Monitoring must distinguish genuine weak/missing evidence from records dropped by version or lineage parsing.

## Verdict

Classify findings as `release blocker`, `accepted risk`, or `post-release action` with owner and trigger. Return one verdict:

- `release`: required evidence is present and no blocker remains;
- `conditional release`: named controls bound the remaining risk;
- `hold`: a blocker, missing evidence, or material unknown remains.

Report the exact verification performed, what was not validated, rollout and rollback sequence, monitoring window, and first-response actions. Never approve from unit tests and a build alone.
