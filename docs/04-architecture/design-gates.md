# Design Gates — Interview Coach for Recruiters

## Purpose

This document defines the **design gates** that every meaningful change to the Interview Coach must pass.

Design gates exist to:
- Prevent silent regressions
- Keep AI behavior aligned with product intent
- Enforce performance, accessibility, and trust requirements
- Replace opinion-based debates with observable evidence

A change is not “done” until all applicable gates pass.

---

## Gate 1 — Spec Gate (Intent Locked)

**Question:** Do we clearly know what this change is supposed to do?

Required:
- [ ] Relevant user story exists and is up to date
- [ ] Acceptance criteria are explicit and testable
- [ ] Non-goals and exclusions are stated
- [ ] Language avoids implied scoring, ranking, or hiring decisions

Artifacts:
- User Stories
- Acceptance Criteria
- Glossary (if new domain terms are introduced)

Fail condition:
- Ambiguous behavior
- “We’ll see how it feels”
- Logic inferred only from code

---

## Gate 2 — Eval Gate (Meaning Preserved)

**Question:** Does this change preserve the meaning of readiness and feedback?

Required:
- [ ] Change is compatible with Readiness Band Definition
- [ ] All readiness eval scenarios still pass
- [ ] No new hidden signals introduced (e.g., numeric proxies)

Artifacts:
- Readiness Band Definition
- Readiness Eval Scenarios
- Decision Log (if behavior changes)

Fail condition:
- Scenario misclassification
- Drift in readiness distribution without explanation
- Changes that cannot be explained in plain language

---

## Gate 3 — Threat Gate (Abuse Considered)

**Question:** What could go wrong if this is misused or attacked?

Required:
- [ ] Invite and access paths reviewed for abuse
- [ ] Candidate privacy impact considered
- [ ] Data exposure minimized to role-appropriate views
- [ ] Failure modes documented (expired links, replay, forwarding)

Artifacts:
- Threat notes (inline or Decision Log)
- Auth / Invite assumptions

Fail condition:
- “It’s probably fine”
- Security deferred to future phase without documentation

---

## Gate 4 — Performance Gate (Friction Controlled)

**Question:** Does this stay within agreed performance budgets?

Required:
- [ ] Page load time ≤ 3 seconds
- [ ] AI feedback latency ≤ 10 seconds
- [ ] No blocking UI during async operations
- [ ] Mobile performance considered explicitly

Artifacts:
- Performance requirements
- Measured timings (local or staging)

Fail condition:
- Performance assumed, not measured
- Regressions justified as “temporary” without plan

---

## Gate 5 — Observability Gate (Reality Visible)

**Question:** Will we know if this works or breaks?

Required:
- [ ] Key events logged (invite created, session started, completed)
- [ ] AI latency and error states observable
- [ ] Readiness band distribution trackable over time
- [ ] Drop-off points identifiable

Artifacts:
- Logging plan
- Metrics definitions

Fail condition:
- No way to detect failure without user complaints
- Success measured only anecdotally

---

## Gate Application

Not every change requires every gate, but **skipped gates must be explicitly justified**.

Default assumption: all gates apply.

---

## Ownership & Change Control

Owner: Product / Engineering  
Review cadence: Ongoing  
Amendments require:
- Decision Log entry
- Clear rationale
