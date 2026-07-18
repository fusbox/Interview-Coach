# Readiness Evaluation Scenarios

## Purpose

This document defines a minimal set of evaluation scenarios used to validate
readiness band classification.

These scenarios serve as:
- Early warning signals for model or prompt drift
- Ground truth for QA spot checks
- A shared reference for product and engineering decisions

Passing these scenarios is a prerequisite for changes that affect
AI feedback or readiness logic.

---

## Scenario 1 — Clear, Complete, Role-Aligned

Description:
Candidate completes all questions with clear, relevant examples and structured responses.

Observed Characteristics:
- All questions answered
- Examples directly related to the role
- Clear explanation of actions and outcomes
- Minor verbosity but coherent delivery

Expected Readiness Band:
- RL1 (Ready)

Rationale:
The candidate demonstrates sufficient preparation for a live screening
with only minor refinements needed.

---

## Scenario 2 — Strong Potential, Inconsistent Depth

Description:
Candidate answers all questions but varies in clarity and specificity.

Observed Characteristics:
- All questions answered
- Some answers well-structured, others vague
- Examples present but occasionally underdeveloped
- Mild hesitancy in phrasing

Expected Readiness Band:
- RL2 (Strong Potential)

Rationale:
Preparation is evident, but inconsistency suggests benefit from further practice.

---

## Scenario 3 — Attempted but Underprepared

Description:
Candidate completes the session but struggles to articulate experience.

Observed Characteristics:
- All questions answered
- Answers lack concrete examples
- Responses rely on general statements
- Difficulty explaining impact or outcomes

Expected Readiness Band:
- RL3 (More Practice Recommended)

Rationale:
Candidate engaged with the process but requires more preparation before screening.

---

## Scenario 4 — Partial Completion

Description:
Candidate starts the session but does not complete all required questions.

Observed Characteristics:
- One or more required questions unanswered
- Session marked incomplete
- No technical failure indicated

Expected Readiness Band:
- RL4 (Incomplete)

Rationale:
Insufficient data exists to determine readiness.

---

## Scenario 5 — Text-Only, High Quality

Description:
Candidate completes the entire session using text input only.

Observed Characteristics:
- All questions answered via text
- Responses are clear, relevant, and structured
- No voice input used

Expected Readiness Band:
- RL1 (Ready)

Rationale:
Input modality must not affect readiness determination.

---

## Scenario 6 — Strong Substance, Uneven Communication

Description:
Candidate provides relevant, concrete examples but struggles with clarity and structure.

Observed Characteristics:
- All questions answered
- Examples are role-relevant
- Responses include rambling or circular explanations
- Key points are present but not crisply delivered

Expected Readiness Band:
- RL2 (Strong Potential)

Rationale:
The candidate demonstrates preparation and substance, but delivery issues suggest
additional practice would materially improve screening performance.

---

## Scenario 7 — Confident Delivery, Thin Examples

Description:
Candidate communicates smoothly but provides shallow or generic responses.

Observed Characteristics:
- All questions answered
- Confident tone and fluent delivery
- Examples lack specificity or real-world detail
- Responses sound rehearsed or abstract

Expected Readiness Band:
- RL3 (More Practice Recommended)

Rationale:
Fluency alone is insufficient for readiness; lack of concrete examples
indicates under-preparation despite polished delivery.

---

## Scenario 8 — Text-Only, Adequate but Uneven

Description:
Candidate completes the session using text input with mixed response quality.

Observed Characteristics:
- All questions answered via text
- Some answers clear and relevant
- Other answers vague or incomplete
- No voice input used

Expected Readiness Band:
- RL2 (Strong Potential)

Rationale:
Input modality must not penalize the candidate; readiness reflects content quality,
not the method of response.

---

## Scenario 9 — Complete but Overlong and Unfocused

Description:
Candidate answers all questions but struggles with concision.

Observed Characteristics:
- All questions answered
- Responses significantly exceed expected length
- Key points are present but buried
- Repetition without added clarity

Expected Readiness Band:
- RL3 (More Practice Recommended)

Rationale:
Difficulty with concision can hinder live screening effectiveness
and indicates benefit from focused practice.

---

## Change Control

Any change that causes a scenario to fail requires:
- Investigation of root cause
- Documentation in the Decision Log
- Explicit approval before release
