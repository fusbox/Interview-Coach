=============================================
# Design Gate Decisions — System-Level Record
=============================================

## Purpose

This document records **design gate decisions applied to core system behaviors**.

Entries are intentionally grounded in **system-level behaviors**, not individual user stories,
test scenarios, or documentation artifacts. Stories, scenarios, and gates are used as
*evidence* during reasoning, but the decisions recorded here reflect **what the system is
allowed to do** at trust-sensitive boundaries.

This document exists to:
- Preserve design intent across iterations
- Prevent accidental re-litigation of settled constraints
- Provide future readers with rationale rather than procedural history

Only materially meaningful gate decisions are recorded here.

---

## Decision Scope Rule

A gate decision is recorded when a **system behavior**:
- introduces or constrains access
- emits interpretive signals
- reveals or withholds user-generated content
- establishes responsibility boundaries between system and human judgment
- meaningfully affects trust, privacy, or misuse risk

Gate decisions are *not* recorded for:
- purely internal refactors
- cosmetic UI changes
- implementation details that do not affect system boundaries

---

## Decision Review Policy

Gate decisions are considered **stable by default**.

A decision may be revisited **only if**:
- the underlying system behavior materially changes
- a new trust boundary or misuse vector is introduced
- the intended audience or usage context changes
- a future version explicitly re-scopes responsibility or authority

Revisiting a decision requires:
- a new entry documenting the change
- explicit rationale for why prior constraints no longer apply

Historical entries are never deleted; superseded decisions are annotated.

---

## Gate Coverage Index

| System Behavior                                  | Gates Applied                 | Status  |
|--------------------------------------------------|-------------------------------|---------|
| Candidate Access via Invite Links                | Gate 3 (Threat)               | Active  |
| Readiness Signaling to Recruiters                | Gate 1, Gate 2, Gate 3        | Active  |
| Readiness Classification Semantics               | Gate 2 (Eval)                 | Active  |
| Recruiter Visibility into Candidate Responses    | Gate 3 (Interpretation)       | Active  |

This index is informational only. Authoritative details live in the entries below.

---

========================
Design Gate Decision Log
========================

## Candidate Access via Invite Links

**System Behavior:**  
Unauthenticated access to candidate practice sessions via recruiter-generated links.

**Gates Applied:**  
- Gate 3 (Threat)

**Decision:**  
PASS

**Decision Status:**  
Active — Stable unless access model changes

**Decision Date:**  
2026-01-30

**Rationale:**  
Invite links are treated as single-session, single-candidate access tokens.
Links are unguessable, cannot be reused to submit new responses after completion,
and expose only the intended session. This behavior balances ease of access with
acceptable misuse risk for a practice-oriented tool.

---

## Readiness Signaling to Recruiters

**System Behavior:**  
The system communicates candidate preparation through a categorical readiness signal.

**Gates Applied:**  
- Gate 1 (Spec)  
- Gate 2 (Eval)  
- Gate 3 (Interpretation Framing)

**Decision:**  
PASS

**Decision Status:**  
Active — Locked for V1 semantics

**Decision Date:**  
2026-01-30

**Rationale:**  
Readiness is expressed as a single categorical level (RL1–RL4) with supportive descriptors.
No numeric scores, rankings, or comparative signals are emitted. The system supports
recruiter preparation without asserting hiring judgment or decision authority.

---

## Readiness Classification Semantics

**System Behavior:**  
Assignment of readiness levels across varying response quality, modality, and delivery styles.

**Gates Applied:**  
- Gate 2 (Eval)

**Decision:**  
PASS

**Decision Status:**  
Active — Re-evaluated only if readiness meaning changes

**Decision Date:**  
2026-01-30

**Rationale:**  
Evaluation scenarios confirm that readiness meaning is preserved across text and voice input,
strong substance with uneven delivery, polished delivery with thin examples, and verbosity.
No proxy metrics, modality bias, or scoring behavior are introduced.

---

## Recruiter Visibility into Candidate Responses

**System Behavior:**  
Recruiters can view detailed candidate responses to support follow-up guidance.

**Gates Applied:**  
- Gate 3 (Interpretation Framing)

**Decision:**  
PASS (Compatible)

**Decision Status:**  
Active — Guarded by non-interpretation constraint

**Decision Date:**  
2026-01-30

**Rationale:**  
Candidate responses are presented as raw, candidate-generated content.
The system does not annotate, score, rank, or interpret individual responses.
Responsibility for interpretation and judgment explicitly rests with the recruiter.
