# Interview Preparedness Signal Contract

Date: 2026-05-31
Status: Working architecture contract
Implementation status: first read-model alignment landed for immutable lane ids, signal-level progression/regression behavior, and first-pass `feedbackPlan.primaryAnchor` signal derivation; normalized persisted signal tables remain future work.

> [!NOTE]
> Canonical product and data summaries now live in [SPEC](../SPEC.md) and [DATA_CONTRACT](../DATA_CONTRACT.md). This file remains the detailed working contract for interview-preparedness signal rules until those rules are finalized or superseded by an ADR.

## Purpose

This document defines the first stable contract for the candidate dashboard's interview preparedness model.

It is the bridge between the mature session-coaching engine and the newer dashboard experience. The dashboard should not infer preparedness from page copy, placeholder lane states, or a single latest recommendation. It should read from traceable preparation signals, evidence refs, and qualitative progression rules.

Related docs:

- [SPEC](../SPEC.md)
- [DATA_CONTRACT](../DATA_CONTRACT.md)
- [HANDOFF](../HANDOFF.md)
- [Interview Preparedness Data Inventory](./role-preparedness-data-inventory.md)
- [Candidate Dashboard And Practice V2 Disposable Spec](../candidate-dashboard-practice-v2-disposable-spec.md)
- [Postgres Candidate Data Contract](../reference-archive/architecture/postgres-candidate-data-contract.md)
- [Candidate Session Engine Port Plan](../reference-archive/architecture/session-engine-port-plan.md)

## Product Contract

The candidate-facing model is interview preparedness.

Interview preparedness means:

- the candidate knows what this target interview is likely to test;
- the candidate has practiced across the expected interview range;
- the candidate has evidence that their answers show the right skills, judgment, structure, and communication;
- the candidate can see what is already supported, what is still thin, and what to practice next.

It does not mean:

- a hiring score;
- a candidate quality rating;
- a recruiter/hiring-manager assessment;
- a claim that the candidate is likely to be selected.

The top-level lane scaffold is stable across target roles. What changes per `prepProfile` is the signal mix underneath each lane.

## Immutable Lanes

These lanes are the top-level dashboard scaffold. They should stay fixed unless a product decision intentionally changes the preparedness model.

| Lane | Candidate-Facing Purpose | What Varies By PrepProfile |
| --- | --- | --- |
| Role Fit | Shows whether the candidate can connect their background to the target role and JD | Direct, adjacent, transferable, and gap-bridging signals selected from the resume/JD context |
| Answer Substance | Shows whether answers contain relevant, specific, complete, outcome-oriented content | Role-specific evidence expectations, required examples, tool/process depth, and decision rationale |
| Interview Structure | Shows whether answers are organized in ways interviewers can follow | Framework usage, sequencing, signposting, setup-action-result clarity, and behavioral/story patterns |
| Communication Delivery | Shows whether answers are clear, concise, confident, and appropriately spoken or written | Voice/text modality signals, readability, concision, pacing, and answer focus |
| Interview Range | Shows whether the candidate has practiced the kinds of interview moments this role is likely to include | Behavioral, culture fit, technical, screening, case/scenario, and role-specific coverage expectations |

Confidence is not a lane. Confidence is a self-reported trend that can sit near the scaffold, but it should not be treated as performance evidence.

Resume/JD context is not a lane. Resume and JD evidence shape Role Fit, Answer Substance, Interview Range, and signal wording across the scaffold.

## Signal Units

A `PrepSignal` is the lowest-level preparedness claim the dashboard can make.

```ts
type PrepSignal = {
    signalId: string;
    prepProfileId: string;
    lane:
        | "role_fit"
        | "answer_substance"
        | "interview_structure"
        | "communication_delivery"
        | "interview_range";
    label: string;
    candidateFacingDescription: string;
    evidenceState: "not_practiced" | "emerging" | "clear" | "strong";
    evidenceCounts: Record<"not_practiced" | "emerging" | "clear" | "strong", number>;
    priority: "primary" | "supporting" | "background";
    sourceRefs: PrepEvidenceRef[];
    lastObservedAt?: string;
};
```

The dashboard may group signals visually by lane, but the app should preserve individual signal evidence. A strong signal in one part of a lane should not hide a weak signal in another part of the same lane.

## Initial Signal Taxonomy

This taxonomy should use existing generation and feedback signals first. New extraction should be added only where the current app cannot make a safe claim.

### Role Fit

Role Fit is about connecting candidate background to the target role.

Initial signals:

- Direct role experience is named and connected to the JD.
- Transferable experience is explained concretely.
- Resume-listed tools, industries, or responsibilities are used accurately.
- Experience gaps are addressed honestly and constructively.
- The answer shows understanding of the role's real work, not only generic enthusiasm.
- Candidate examples are framed at the right seniority and responsibility level.

Primary sources:

- target role and JD snapshot;
- processed resume context;
- question generation context;
- hints and strong-response resume usage;
- answer feedback `feedbackPlan`;
- answer feedback `contentPulse`;
- session summary patterns.

### Answer Substance

Answer Substance is about what the answer actually proves.

Initial signals:

- Answer directly addresses the question.
- Answer includes a specific example or situation.
- Answer explains actions taken by the candidate.
- Answer names a result, impact, lesson, or outcome.
- Answer includes enough role-relevant detail without drifting.
- Answer explains rationale, tradeoffs, or judgment when the role calls for it.

Primary sources:

- answer analysis;
- `contentPulse`;
- `feedbackPlan.primaryAnchor`;
- visible feedback dimensions;
- summary strengths and growth areas.

### Interview Structure

Interview Structure is about whether the answer is easy to follow and remember.

Initial signals:

- Answer has a clear beginning, middle, and ending.
- Behavioral/story answers include setup, action, and result.
- Candidate avoids jumping between unrelated examples.
- Candidate uses signposting when the answer is complex.
- Candidate closes the answer by connecting back to the question or role.
- Candidate can adapt structure without sounding scripted.

Primary sources:

- answer analysis;
- feedback dimensions;
- `feedbackPlan.intervention`;
- question category;
- strong-response explanation.

### Communication Delivery

Communication Delivery is about clarity, concision, confidence, and mode-specific presentation.

Initial signals:

- Answer is concise enough for an interview setting.
- Candidate uses plain, understandable language for the role context.
- Spoken answer avoids excessive filler or wandering.
- Typed answer is readable and not over-polished.
- Candidate sounds confident without overclaiming.
- Candidate keeps the answer focused under pressure.

Primary sources:

- answer modality from persisted answer state;
- `deliveryPulse`;
- transcript/typed answer analysis;
- feedback plan intervention;
- future voice metrics when available.

### Interview Range

Interview Range is about coverage across likely interview moments for this target role.

Initial signals:

- Candidate has practiced behavioral questions.
- Candidate has practiced culture fit or working-style questions.
- Candidate has practiced technical, tool, or role-specific questions where relevant.
- Candidate has practiced screening-style baseline questions where relevant.
- Candidate has practiced scenario/case judgment where relevant.
- Candidate has practiced questions that explicitly test resume/JD alignment where relevant.

Primary sources:

- question generation plan;
- unified question category mapping;
- candidate practice focus;
- question snapshots;
- completed-session coverage;
- future role-specific question-bank or practice-path rules.

## Evidence States

Evidence states are qualitative. They are not scores.

| State | Meaning | Safe Candidate Claim |
| --- | --- | --- |
| `not_practiced` | The signal matters for this prepProfile, but the app has no usable answer evidence yet | "Not practiced yet" |
| `emerging` | The candidate attempted the signal, but the evidence is thin, incomplete, unclear, or growth-oriented | "Starting to build evidence" |
| `clear` | The candidate showed usable evidence, though there may still be focused improvement available | "Clear evidence in practice" |
| `strong` | The candidate showed strong or repeated support for this signal | "Strong evidence shown" |

The UI may use color, fill, chips, or drilldowns to show these states. It should not show raw counts, ratios, percentages, or numeric preparedness scores.

## Progression And Regression Rules

Preparedness should encourage growth without pretending that weak evidence never happened.

Signal-level rules:

- Latest strong evidence should immediately elevate the current signal state to `strong`, even if prior evidence was weak.
- Latest clear evidence should immediately elevate the current signal state to `clear`, even if prior evidence was weak.
- A single weak latest answer should not erase a strong history by itself.
- Repeated weak evidence after strong evidence should pull the current state down when the pattern is meaningful.
- Weak and strong observations must both remain available in evidence history.
- The dashboard should be able to explain both "you have shown this before" and "your latest answer needs work."

Lane-level rules:

- Lanes roll up from signal states, not raw answer scores.
- A lane can show progress while still containing unresolved weaker signals.
- A lane should not become `strong` solely because one signal is strong if other primary signals remain unpracticed or repeatedly weak.
- A lane can become `clear` when primary signals have usable evidence even if supporting signals remain emerging.
- A lane can become `strong` when primary signals are strong or repeatedly clear and no high-priority unresolved growth pattern remains.

Initial dashboard fill rules:

- Fill is a qualitative cue only.
- Fill should suggest movement toward the next evidence state.
- Fill should not be described as percent complete.
- Drilldowns should explain the evidence behind the fill instead of exposing calculation internals.

Future versions can add more challenging appraisal modes, but the default candidate experience should avoid demotivating regression behavior unless the user deliberately selects a more rigorous practice mode.

## Evidence Refs

Every signal state needs traceable evidence.

```ts
type PrepEvidenceRef = {
    type:
        | "job_description"
        | "resume"
        | "question"
        | "answer"
        | "coach_feedback"
        | "summary"
        | "confidence";
    sourceId?: string;
    label: string;
    excerpt?: string;
    observedAt?: string;
    state?: "emerging" | "clear" | "strong";
};
```

Evidence refs power dashboard drilldowns:

- why this lane matters;
- what the app has seen;
- where the candidate has evidence;
- what remains thin;
- what to practice next.

They should use candidate-safe excerpts. Sensitive raw resume content, full transcripts, and AI-quality internals should not be surfaced unless the route intentionally allows that user to see that data.

## Source Mapping

Use the mature session engine before adding new AI calls.

| Source | Current Maturity | PrepProfile Use |
| --- | --- | --- |
| Question generation | Mature enough for first pass | Seeds Interview Range and target-role expectations |
| Hints | Mature enough for contextual evidence | Shows what the app thought the question was testing |
| Strong response | Mature enough for contextual evidence | Shows "what good looks like" for a signal |
| Answer feedback | Strongest existing source | Drives signal observations, evidence states, and next coach focus |
| Summary/debrief | Mature but session-level | Synthesizes repeated patterns and session-level coach signal |
| Resume/JD context | Present but needs tighter contract | Shapes Role Fit and evidence wording; not a standalone lane |
| Confidence | Not yet implemented | Self-report trend only, separate from evidence states |
| User helpfulness feedback | Existing, separate purpose | Product/coaching quality feedback, not preparedness evidence |

### FeedbackPlan Anchor Mapping

`feedbackPlan.primaryAnchor` can create a preparedness signal when no `contentPulse` or `deliveryPulse` already covers the same dimension for the same answer. This lets the dashboard use the mature answer-analysis schema without waiting for normalized observation tables.

Initial mapping:

| Anchor Source / Dimension | Signal ID Shape | Lane | Label Source |
| --- | --- | --- | --- |
| `source = delivery` | `delivery:{dimension}` | Communication Delivery | Existing delivery pulse labels when present |
| `source = content`, `dimension = structural_clarity` | `content:structural_clarity` | Interview Structure | Existing content pulse labels |
| `source = content`, other content dimensions | `content:{dimension}` | Answer Substance | Existing content pulse labels |
| `source = fallback` | `content:{dimension}` | Dimension-based fallback lane | Existing content pulse labels or plain dimension label |

The anchor contributes candidate-safe source refs using candidate evidence and keeps resume/JD refs attached when available. It should not create a duplicate count when a pulse already produced the same signal.

## Recommendation Rules

Practice Next is the only dashboard action surface for now.

Recommendation priority:

1. Resume unfinished candidate-owned session.
2. If no unfinished session exists, use the latest high-priority unresolved signal with current or repeated `emerging` evidence.
3. If no unresolved growth signal exists, choose the next unpracticed primary signal for the prepProfile.
4. If all primary signals have clear or strong evidence, recommend a polish or interview-range expansion practice.

Targeted mini-practice is a valid future direction, but the first implementation should launch through the normal session route. Inline modal practice would create a second practice engine and should wait until the data contract is stable.

## Open Implementation Questions

These are not blockers for the contract, but they should be answered before deeper dashboard automation:

- Which additional `feedbackPlan` values, beyond primary anchor source/dimension and signal detectability, should map to distinct signal states?
- Which signals are primary for each generated practice focus?
- How many sessions should influence current state before historical evidence becomes background?
- How should repeated weak evidence be detected without making the dashboard punitive?
- Should session-level `coachSignal` be persisted before normalized `prep_observations`?
- What candidate-safe language should be used when evidence comes from resume content?

## Current Acceptance Criteria

- The dashboard has one immutable lane scaffold.
- Resume/JD context is used as evidence and signal framing, not as a standalone lane.
- Signal state progression rewards latest clear/strong evidence immediately.
- Regression requires meaningful repeated weak evidence, not one bad answer.
- Every visible preparedness claim can point to source evidence.
- Confidence and helpfulness remain separate from performance evidence.
- No numeric preparedness score is introduced.
