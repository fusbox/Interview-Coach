# Release Gate Checklist

Date: 2026-03-25  
Primary status reference: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)  
Primary execution reference: [production_execution_plan_2026-03-26.md](./production_execution_plan_2026-03-26.md)

---

## Purpose

Use this checklist when deciding whether a release candidate may be promoted to production.

This is the current approval gate. It should be filled out for a concrete release candidate, not used as a running project note.

---

## Current Gate Position

Current default recommendation:

- `NO-GO`

Reason:

- `P0-R3` still requires deployment-team evidence of live alert delivery

If that evidence is attached and all checklist items below are satisfied, the gate may be re-evaluated.

---

## Release Record

- Release candidate identifier:
- Commit SHA:
- Environment:
- Approval date:
- Approvers:

Decision:

- [ ] `GO`
- [ ] `NO-GO`

---

## Production Blockers

All of the following must be true:

- [x] Shared rate limiting is active in production-backed code paths
- [x] Invite creation has production-safe consistency semantics
- [x] Invite recovery state and safe retry behavior are implemented
- [x] Protected auth and required server environment dependencies fail fast in production
- [x] Canonical public origin is sourced from trusted configured environment in production
- [x] Production origin handling does not rely on request-host fallback
- [x] Durable metrics backend is enforced in application scope
- [ ] Live alert delivery / paging routing has been validated for the current release target
- [ ] If live alert delivery is deployment-managed, ownership and evidence are attached to the release record

If any item above remains incomplete:

- [ ] Production release is blocked
- [ ] Any non-production promotion is explicitly recorded as risk-accepted

---

## Correctness And Reliability

- [ ] Invite create, resend, and candidate access flows were validated against the current build
- [ ] Partial invite-batch failure behavior was validated
- [ ] Retry behavior for tracked failed batches was validated
- [ ] Idempotent behavior for critical write paths was validated
- [ ] Canonical app-origin generation was validated in the target deployment environment

---

## Security And Privacy

- [ ] Required production secrets are present
- [ ] Candidate token verification behavior matches documented policy
- [ ] Abuse-sensitive routes are protected by the shared limiter
- [ ] Logging behavior for the release scope was reviewed for privacy and redaction expectations

---

## AI And Product Quality

- [ ] If recruiter-facing readiness is reactivated, readiness meaning remains aligned with [readiness-band-definition.md](./readiness-band-definition.md)
- [ ] If recruiter-facing readiness is reactivated, readiness scenarios were spot-checked or fully run as appropriate
- [ ] Feedback quality changes were reviewed against [feedback-chain-spec.md](./feedback-chain-spec.md) when applicable
- [ ] No candidate-facing copy implies ranking, scoring, or hiring judgment

---

## Performance And Operability

- [ ] Key latency budgets were reviewed for the current build
- [ ] Metrics and structured logs are visible in the target environment
- [ ] Durable metrics are active in the target environment
- [ ] Alert routes and intended responders are still correct
- [ ] Incident runbook and alert policy are current for the changed behaviors in this release
- [ ] Current release was reviewed against [initial_slos_2026-03-26.md](./initial_slos_2026-03-26.md)

---

## Accessibility And UX

- [ ] Keyboard and focus behavior were verified for critical recruiter flows
- [ ] Keyboard and focus behavior were verified for critical candidate flows
- [ ] Async error and success announcement behavior was verified where touched
- [ ] Mobile behavior was checked for changed interactive surfaces

---

## Documentation And Handoff

- [ ] Release-facing quality docs are current
- [ ] Deployment validation notes are attached where required
- [ ] Environment contract changes are reflected in [environment_variable_matrix.md](./environment_variable_matrix.md)
- [ ] Alert ownership and routing notes are reflected in [ops_alert_policy.md](./ops_alert_policy.md)
- [ ] Tracker status is aligned with the actual release decision

---

## Final Notes

- Summary:
- Known risks accepted:
- Rollback considerations:
- Follow-up work after release:
