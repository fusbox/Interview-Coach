# Release Gate Checklist

Date: 2026-03-25  
Primary review source: [comprehensive_code_review_2026-03-25.md](./comprehensive_code_review_2026-03-25.md)  
Primary tracker: [production_remediation_tracker_2026-03-25.md](./production_remediation_tracker_2026-03-25.md)

---

## Purpose

Use this checklist before promoting a build to production.

This checklist is release-oriented. It is not a substitute for engineering judgment, but it is the minimum administrative gate for the current architecture and remediation plan.

---

## Release Decision

- [ ] `GO`
- [ ] `NO-GO`

Release date:

Release candidate identifier:

Approvers:

---

## P0 Production Blockers

Production must remain blocked unless all items below are checked.

- [ ] Shared rate limiting is active in production code paths
- [ ] Invite batch creation has production-safe consistency semantics:
  - transaction-safe persistence
  - or persisted reconciliation/retry state
- [ ] Protected auth/env dependencies fail fast in production
- [ ] Canonical public origin is sourced from trusted configured env in production
- [ ] Production origin generation does not trust request-derived host fallback
- [ ] Durable metrics backend is enforced in production
- [ ] Alert-to-paging routing has been validated for the current release posture
- [ ] Failure-mode tests for invite creation, origin contract, metrics contract, and auth/env contract are passing

If any item above is not complete:

- [ ] Production release is blocked
- [ ] Risk acceptance for staging only is explicitly recorded

---

## Correctness and Reliability

- [ ] Invite send, resend, and candidate access flows were tested against the current build
- [ ] Partial invite-batch failure and recovery behavior have been validated
- [ ] Idempotent retry behavior has been validated for critical write paths
- [ ] Canonical app origin generation is validated for the deployment environment

---

## Security and Privacy

- [ ] Required production secrets are present and validated
- [ ] Candidate token verification behavior is consistent with documented production policy
- [ ] Abuse-sensitive routes are protected by shared throttling
- [ ] PII and provider payload logging were reviewed for current release scope

---

## AI and Product Quality

- [ ] Readiness meaning remains aligned with [readiness-band-definition.md](./readiness-band-definition.md)
- [ ] Readiness eval scenarios were spot-checked or fully run as appropriate
- [ ] Feedback quality changes were reviewed against [feedback-chain-spec.md](./feedback-chain-spec.md) when applicable
- [ ] No new candidate-facing copy implies scoring, ranking, or hiring judgment

---

## Performance and Operability

- [ ] Key latency budgets were measured on the current build
- [ ] Metrics and structured logs are visible in the target environment
- [ ] Durable metrics backend is active in the target environment
- [ ] Alert routes and responders are still correct for this release
- [ ] Paging integration was exercised or otherwise validated for this release
- [ ] Incident runbook is current for any changed operational behavior
- [ ] Current release was reviewed against the active SLO proposal in [initial_slos_2026-03-26.md](./initial_slos_2026-03-26.md)

---

## Accessibility and UX

- [ ] Keyboard and focus behavior were verified for critical recruiter flows
- [ ] Keyboard and focus behavior were verified for critical candidate flows
- [ ] Async error/success announcement behavior was verified where touched
- [ ] Mobile behavior was checked for any changed interactive surfaces

---

## Documentation

- [ ] Relevant architecture docs were updated if system boundaries changed
- [ ] Relevant quality docs were updated if release posture changed
- [ ] Remediation tracker was updated if a tracked item was completed by this release
- [ ] Gate decision log was reviewed if a trust-sensitive system behavior changed

---

## Final Sign-Off Notes

Summary:

Known risks accepted:

Rollback considerations:

Follow-up actions after release:
