# Feedback Chain Specification

## Purpose

This document defines how answer-level feedback should be structured, generated, and evaluated so the candidate experiences one coherent coaching response rather than a collection of unrelated UI sections.

It is intentionally implementation-aware. It is meant to guide changes to:
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)
- [prompts.ts](../../src/lib/ai/prompts.ts)
- [schemas.ts](../../src/lib/domain/schemas.ts)
- [FeedbackDrawer.tsx](../../src/features/session/components/FeedbackDrawer.tsx)

---

## Problem Statement

The current system generates a compact feedback object with:
- `ack`
- `contentPulse`
- optional `deliveryPulse`
- `nextAction`
- `recommendation`

This is directionally correct, but under-specified.

The main risk is not that any one field is weak in isolation. The deeper risk is that the fields can feel like parallel outputs from the same prompt rather than a staged coaching response built from one central read of the answer.

This shows up most visibly in `ack`. Acknowledgment often sounds warm and specific, but not necessarily instructive or connected to the deeper content and delivery coaching that follows.

The target experience is:

> one coach speaking from one central read of the answer

That is the governing design principle for the full chain.

---

## Product Intent

Feedback is not only evaluative. It is educational.

Each answer review should do four things:
- prove the candidate was heard
- identify the most meaningful signal in the answer
- connect that signal to what interviewers value or what the question is testing
- give the candidate one clear next move

Across repeated practice, the system should teach interview craft:
- how strong answers are structured
- what specific question types are really testing
- what behaviors signal credibility, judgment, and readiness
- how to improve content and delivery with intention

---

## Design Principles

### 1. Coherence Over Coverage

The sections should reinforce one another. They should not compete to say different things about the same answer.

### 2. Instruction Over Atmosphere

Warmth matters, but warmth without interpretation is not enough. Every section should teach something.

### 3. Specificity Over Generic Praise

The feedback should identify a real phrase, behavior, decision pattern, or omission. It should not rely on empty praise such as "nice job" or "I appreciate how you answered."

### 4. Role-Relevant Interpretation

Feedback should connect behaviors to the target role, not just to generic communication quality.

### 5. Honest Support

Low-signal answers should still feel respectful and encouraging, but the system must not invent strengths that are not actually present.

### 6. Single-Response Integrity

For the current product, one model call is the preferred architecture. The response should be internally structured well enough that multiple calls are unnecessary.

---

## Current Chain

Today, the answer-level flow is:

1. The candidate submits a typed or spoken answer in [UnifiedSessionScreen.tsx](../../src/features/session/components/UnifiedSessionScreen.tsx).
2. The answer is persisted via [useSessionAnswerMutations.ts](../../src/features/session/hooks/session-mutations/useSessionAnswerMutations.ts) and the submit route.
3. The analysis route gathers question, blueprint, intake, retry, and progress context.
4. [buildAnalysisContext()](../../src/lib/ai/prompts.ts) constructs the prompt context.
5. [AIService.analyzeAnswer()](../../src/lib/server/services/ai-service.ts) asks the model for one JSON payload.
6. The parsed analysis is saved back to the session.
7. [FeedbackDrawer.tsx](../../src/features/session/components/FeedbackDrawer.tsx) renders the returned fields.

This flow is correct at the systems level. The redesign should focus on the analysis contract, not on adding extra network stages unless later evidence requires it.

---

## Proposed Hidden Logic Model

Before the model writes visible feedback sections, it should implicitly determine:

1. What is the central read of this answer?
2. What is the strongest usable signal?
3. What interviewer value or interview pattern does that signal point to?
4. What is the highest-value coaching intervention?
5. How should that intervention be staged across the visible sections?

This hidden logic should become explicit in the response schema.

### Signal Must Be Split Into Two Axes

In this spec, `signal` should not be treated as a single concept.

It needs two distinct axes:

1. **Valence / Directionality**
   - What is the coach's read of the answer on the relevant dimension?
   - Suggested values:
     - `strength`
     - `mixed`
     - `growth`

2. **Detectability / Interpretive Confidence**
   - How clear is the evidence?
   - How confident should the coach be in the interpretation?
   - Suggested values:
     - `clear`
     - `moderate`
     - `ambiguous`
     - `thin`

These axes solve different problems:
- valence determines whether the coach is amplifying, sharpening, or repairing
- detectability determines how assertive or tentative the coach should sound

Examples:
- A candidate can show a **positive but ambiguous** signal.
- A candidate can show a **negative but clear** signal.
- A candidate can give a **mixed answer with thin evidence**, which should produce a more tentative and framing-oriented response.

### Proposed Planning Fields

These fields are internal design fields. They do not need to be shown directly in the UI.

```json
{
  "feedbackPlan": {
    "centralRead": "string",
    "signal": {
      "valence": "strength|mixed|growth",
      "detectability": "clear|moderate|ambiguous|thin"
    },
    "primaryAnchor": {
      "source": "content|delivery|fallback",
      "signalType": "quote|behavior|pattern|effort|omission",
      "dimension": "focus_relevance",
      "candidateEvidence": "string",
      "interviewerValue": "string"
    },
    "intervention": {
      "type": "amplify_strength|sharpen_signal|repair_foundation|polish_response",
      "reason": "string"
    }
  }
}
```

These fields give the system:
- a single source of truth for what the answer means
- a stable anchor for all visible sections
- better debug visibility
- better evalability

---

## Visible Feedback Contracts

The visible fields should each do a distinct rhetorical job.

### Ack

**Job**
- Attunement plus framing

**What it must do**
- Reference a specific thing the candidate said or demonstrated
- Connect that signal to interviewer value, question intent, or answer quality
- Lead naturally into the deeper feedback that follows

**What it must not do**
- Generic praise with no instructional value
- Empty politeness
- A disconnected compliment that does not align with later feedback

**Desired effect**
- "You were heard, and there is a meaningful reason this detail matters."

**Shape**
- Exactly 1 sentence
- Brief
- Supportive
- Specific
- Interpretable as the opening move of a real coach

### Content Pulse

**Job**
- Deliver the most important answer-content insight

**What it must do**
- Focus on the highest-value content-related dimension
- Use exact evidence when possible
- Explain the interviewer-facing meaning of the behavior
- Clarify how to strengthen the candidate's response pattern

**Desired effect**
- "Here is the key thing that made your answer stronger or weaker in interview terms."

### Delivery Pulse

**Job**
- Highlight delivery or mechanics only when it materially matters

**What it must do**
- Address modality-appropriate mechanics
- Remain subordinate to the central read
- Only appear when there is urgent weakness or exceptional strength worth naming
- Recognize that polish can come from either content or delivery; do not use delivery as a catch-all home for any smaller coaching note

**Desired effect**
- "Your delivery either supported or distracted from the core signal."

### Recommendation

**Job**
- Translate the read into the next move

**What it must do**
- Match the actual opportunity:
  - foundational repair
  - targeted retry
  - move on with one polish note
  - finish and reflect

**Desired effect**
- "I know what to do next and why."

---

## Section Dependency Order

The visible chain should be conceptually generated in this order:

1. `feedbackPlan.centralRead`
2. `feedbackPlan.primaryAnchor`
3. `ack`
4. `contentPulse`
5. `deliveryPulse` if justified
6. `recommendation`
7. `nextAction`

This does not require multiple API calls.

It means the prompt and schema must enforce the dependency order inside the one response.

---

## Signal-Level Behavior

### Clear Strength Signal

Use when the answer contains a real, defensible positive signal.

The chain should:
- open with an energized but specific acknowledgment
- explain why the signal works in interview terms
- preserve momentum with coaching that sharpens or amplifies the strength

Ack pattern:
- name the signal
- connect it to interviewer value
- optionally tease the explanation to come

Example shape:
- "When you explained why you slowed the customer down before troubleshooting, that showed the calm control interviewers look for in frontline support."

### Mixed Signal

Use when the answer contains usable material but still misses something important.

The chain should:
- affirm the real starting point
- pivot clearly to what the interviewer is actually listening for
- avoid overstating strength

Example shape:
- "You gave a real customer-service instinct here, and questions like this are really testing whether you can pair empathy with a clear troubleshooting plan."

### Low Signal

Use when the answer is thin, vague, generic, or largely off-target.

The chain should:
- respect the effort
- avoid fabricated praise
- name what the question is testing
- orient the candidate toward the missing structure or evidence

Example shape:
- "You gave us a starting point to work with, and this kind of question is really about showing how you calm the user and move into a clear first troubleshooting step."

### Detectability Rules

Detectability should shape coach certainty.

#### Clear

Use when the answer contains direct evidence that strongly supports the interpretation.

Coach behavior:
- be direct
- name the signal confidently
- make a clear interviewer-value connection

#### Moderate

Use when the answer supports a likely interpretation, but not decisively.

Coach behavior:
- stay specific
- avoid overstating certainty
- frame the interpretation as a likely read rather than a definitive truth

#### Ambiguous

Use when multiple interpretations are plausible.

Coach behavior:
- avoid hard claims
- orient the candidate toward the more useful target pattern
- prefer language like "what interviewers are trying to hear here is..."

#### Thin

Use when there is not enough evidence to make a high-confidence read.

Coach behavior:
- do not fake insight
- acknowledge the limited signal
- coach toward the missing evidence, structure, or specificity

This distinction is important because a coach should sound different when saying:
- "You clearly demonstrated prioritization"
versus
- "You gave the beginning of a prioritization signal, but not enough yet for an interviewer to fully trust it"

---

## Role, Stage, And Modality Calibration

The feedback chain should continue to adapt to:
- target role
- seniority / rigor
- interview stage
- struggle area
- primary goal
- typed vs spoken modality

But those calibrations should shape the language and standard of judgment, not fracture the coherence of the chain.

Examples:
- A frontline candidate should get simpler language and more concrete coaching.
- A senior candidate should get more demanding interpretation of tradeoffs and impact.
- Spoken answers can be coached on pacing or filler words; typed answers should not be.

---

## Prompt Contract Changes

The current prompt already encodes useful pieces:
- role impact
- graceful pivot
- modality awareness
- next action logic

What is missing is an explicit coherence contract.

### Add A Coherence Rule

The prompt should include a rule like:

> The ACK, Content Pulse, Delivery Pulse, Recommendation, and Next Action must all read like one coach responding from one central interpretation of the answer. The ACK should preview or frame the main pulse, not compete with it.

### Strengthen The Ack Rule

Replace the current `ACK` rule with something closer to:

- ACK is not generic praise.
- ACK is the opening coaching move.
- ACK must come from the strongest usable signal in the answer.
- ACK must do two things in one sentence:
  - name one specific thing the candidate said or demonstrated
  - connect it to interviewer value or to what the question is testing
- If signal is mixed, affirm the real starting point and pivot.
- If signal is low, do not invent praise; acknowledge effort and frame the target.

### Add Internal Planning Output

The prompt should ask for a compact planning object before the visible prose fields.

This planning object should be machine-validated, not optional hand-waving.

### Replace Score-Routed Action Logic

The live implementation should not rely on raw score thresholds to determine:
- `nextAction`
- whether `deliveryPulse` appears

Instead:
- `nextAction` should be driven by intervention type, valence, and detectability
- `deliveryPulse` should be driven by whether delivery/mechanics materially affect interpretation or demonstrate standout mastery

This keeps the visible coaching chain aligned with the hidden planning model rather than a parallel numeric-routing system.

---

## Schema Direction

The current [AnalysisResultSchema](../../src/lib/domain/schemas.ts) is permissive enough to evolve without immediate breakage, but the intended contract should be explicit.

Recommended additions:
- `feedbackPlan`
- `feedbackPlan.centralRead`
- `feedbackPlan.signal.valence`
- `feedbackPlan.signal.detectability`
- `feedbackPlan.primaryAnchor`
- `feedbackPlan.intervention`

Recommended constraints:
- `ack` remains required in normal successful analysis
- `contentPulse` remains required
- `deliveryPulse` remains optional and exception-based
- `recommendation` remains required in successful analysis

---

## Rendering Implications

The UI should continue to show a concise staged experience.

No major UI restructure is required to benefit from this spec.

However, the UI should preserve the rhetorical order:
1. acknowledgment
2. main coaching insight
3. secondary delivery insight if warranted
4. recommended next step

If future UI changes are made, they should reinforce that order rather than flattening all feedback into equal-weight cards.

---

## Evaluation Criteria

Use these criteria to judge whether the chain is working.

### Ack Quality

1. Does it clearly point to something specific?
2. Does it teach or interpret rather than merely praise?
3. Does it connect to interviewer value or question intent?
4. Does it naturally set up the rest of the feedback?
5. Does it remain brief and confidence-building?

### Chain Coherence

1. Do all sections seem to come from the same central read?
2. Does the content pulse expand on what the ack framed?
3. Does the delivery pulse, if present, support rather than distract from the central intervention?
4. Does the recommendation feel like the logical next move from the rest of the feedback?

### Educational Value

1. Would the candidate learn something about interviewing from this review alone?
2. Does the feedback reveal what the question is actually testing?
3. Does it reinforce a reusable interview pattern, not just a one-off opinion?

---

## Known Failure Modes To Guard Against

- Warm but empty ack that does not teach
- Overpraising low-signal answers
- Treating detectability and directionality as the same thing
- Sounding too certain when the evidence is actually ambiguous or thin
- Content pulse and recommendation pointing in different directions
- Delivery pulse stealing attention from the actual main issue
- Role impact language becoming generic corporate filler
- Typed-mode feedback accidentally critiquing spoken delivery
- Retry feedback failing to acknowledge meaningful improvement

---

## Current Logic Review And Likely Cleanup Targets

This section tracks current implementation details that may become obsolete or need consolidation as the feedback chain is redesigned.

The goal is to make cleanup explicit and auditable rather than letting outdated logic survive by accident.

### Current Live Behavior

The current answer-analysis system in [ai-service.ts](../../src/lib/server/services/ai-service.ts):
- silently scores 9 dimensions
- uses those scores to derive readiness via `calculateReadiness()`
- uses prompt rules to drive `nextAction`
- uses prompt rules to decide whether `deliveryPulse` should appear
- returns a compact visible chain:
  - `ack`
  - `contentPulse`
  - optional `deliveryPulse`
  - `recommendation`
  - `nextAction`

The current candidate-facing UI in [FeedbackDrawer.tsx](../../src/features/session/components/FeedbackDrawer.tsx) renders that pulse-based chain, not the older broader feedback shape.

### Legacy Or Redundant Elements To Watch

#### `coachReaction`

Current state:
- `coachReaction` is populated as a duplicate of `ack` in [ai-service.ts](../../src/lib/server/services/ai-service.ts).

Risk:
- duplicate field with no distinct semantic role

Likely action:
- remove unless a separate purpose is introduced

#### `readinessBand` versus `meta.readinessLevel`

Current state:
- both are populated from the same derived readiness calculation

Risk:
- duplicated readiness state in the analysis object

Likely action:
- consolidate to one canonical answer-level readiness field, while preserving any session-level readiness field that is independently needed

#### `meta.signalQuality`

Current state:
- exists in the schema
- appears in exports
- is only set in fallback/error returns
- is not computed in the successful analysis path

Risk:
- misleading field that suggests signal detectability is modeled when it is not

Likely action:
- either replace with the new explicit detectability model or remove

#### Old Debug Contract

Current state:
- [debug/ai_context.md](./debug/ai_context.md) still reflects an older schema including `taggedObservations` and `primaryFocus`

Risk:
- future work may reason from outdated prompt structure instead of the live implementation

Likely action:
- update, archive, or clearly label as historical

#### Hidden 9-Dimension Scoring

Current state:
- still actively used for readiness calculation
- was used indirectly for prompt-time routing
- still used by session-summary generation

Risk:
- if the new feedback chain no longer depends on all 9 scores in the same way, legacy scoring logic may survive without real product value

Likely action:
- re-evaluate dimension-by-dimension whether each score still has a distinct job:
  - visible feedback routing
  - readiness calculation
  - telemetry
  - session summary synthesis

### Cleanup Tracking

When implementation begins, track each item in this section as one of:
- `keep`
- `refactor`
- `consolidate`
- `remove`

The redesign is not complete until this cleanup pass is finished.

### Current Dispositions

These are the current recommended dispositions based on the live code review.

#### `coachReaction`

Disposition:
- `remove`

Reason:
- It is currently populated as a duplicate of `ack` with no separate behavioral contract.
- Keeping both fields invites drift without adding product value.

#### Answer-Level `readinessBand` versus `meta.readinessLevel`

Disposition:
- `consolidate`

Reason:
- The answer analysis currently stores both from the same derivation.
- One canonical answer-level readiness field is enough.
- The likely direction is:
  - keep one answer-level readiness field for telemetry/debug use
  - keep session-level readiness only where it serves a distinct session-summary purpose

Implementation note:
- Check any dev-eval or export consumers before removing the duplicate field.

#### `meta.signalQuality`

Disposition:
- `refactor`

Reason:
- The field exists in the schema and export path but is not computed in the successful analysis path.
- It appears to be an incomplete attempt to represent detectability.
- It should either be replaced by the new explicit detectability model or removed during schema cleanup.

#### Old Debug Contract (`taggedObservations`, `primaryFocus`)

Disposition:
- `remove` from active references
- `archive` or relabel if retained historically

Reason:
- The debug artifact reflects an older analysis schema, not the current live contract.
- Leaving it unqualified increases the chance of designing against stale behavior.

#### Hidden 9-Dimension Scoring

Disposition:
- `refactor`

Reason:
- It still powers real system behavior today:
  - answer-level readiness derivation
  - session-summary synthesis
- It should not be removed blindly.
- But it should be re-justified dimension by dimension during the redesign.

Audit question for implementation:
- For each dimension, is its current job:
  - visible feedback routing
  - readiness derivation
  - telemetry only
  - session-summary synthesis
  - no longer needed

#### `scores` Payload Itself

Disposition:
- `keep` for now, then `refactor`

Reason:
- The scores object is currently the backbone of readiness and summary generation.
- It is not directly candidate-facing, which is consistent with current product rules.
- The active answer-feedback path should not depend on scores for pulse selection or next-step routing.
- Once the new hidden planning layer is in place, the team should reassess whether all nine numeric ratings are still the best internal primitive for:
  - coaching routing
  - detectability modeling
  - summary synthesis

#### Session-Level `readinessBand`

Disposition:
- `keep` for now

Reason:
- It is persisted on the session record and used outside the immediate answer-feedback chain.
- This is not the same cleanup question as answer-level duplicated readiness fields.

### Audit Summary

Current recommendation:
- `remove`: `coachReaction`, stale active references to the old debug contract
- `consolidate`: answer-level duplicated readiness fields
- `refactor`: `meta.signalQuality`, hidden 9-dimension scoring, eventual `scores` contract
- `keep`: session-level readiness until a broader summary/readiness redesign says otherwise

---

## Recommended Implementation Order

1. Update this spec if the target chain changes.
2. Audit existing fields and mark likely cleanup targets as `keep`, `refactor`, `consolidate`, or `remove`.
3. Add `feedbackPlan` fields to the schema.
4. Rewrite the answer-analysis prompt around coherence and planning.
5. Preserve one-call generation.
6. Log and inspect the new planning fields in debug output.
7. Remove or consolidate obsolete analysis fields and stale debug artifacts.
8. Build a small evaluation set of real candidate answers covering:
   - clear strength
   - mixed signal
   - low signal
   - typed vs spoken
   - entry-level vs senior
   - retry improvement
9. Tune language only after the structural contract is working and obsolete logic is cleaned up.

---

## Implementation Checklist

This checklist translates the design into an execution plan.

The intended rollout is:
- Phase 1: introduce the hidden planning layer without breaking the visible UI contract
- Phase 2: remove or consolidate legacy analysis logic after validation

### Phase 1: Introduce Planning Layer

#### 1. Update Domain Types

Files:
- [schemas.ts](../../src/lib/domain/schemas.ts)
- [types.ts](../../src/lib/domain/types.ts)

Tasks:
- add `feedbackPlan` to `AnalysisResult`
- add:
  - `feedbackPlan.centralRead`
  - `feedbackPlan.signal.valence`
  - `feedbackPlan.signal.detectability`
  - `feedbackPlan.primaryAnchor`
  - `feedbackPlan.intervention`
- keep current visible fields intact:
  - `ack`
  - `contentPulse`
  - `deliveryPulse`
  - `recommendation`
  - `nextAction`
- keep `scores` temporarily
- keep schema tolerant enough for previously persisted analysis payloads during migration

Done when:
- new planning fields parse successfully
- existing persisted sessions still load

#### 2. Rewrite Answer-Analysis Prompt Contract

File:
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)

Tasks:
- add a coherence rule
- explicitly require one central read
- explicitly require one selected primary anchor
- split signal into:
  - valence
  - detectability
- rewrite `ACK` guidance so it:
  - opens from the anchor
  - connects to interviewer value or question intent
  - leads into the rest of the feedback
- preserve the limited-scope pulse design:
  - one required `contentPulse`
  - one optional `deliveryPulse`

Done when:
- model is instructed to return both planning fields and visible fields
- pulse count remains constrained

#### 3. Add Internal Ranking Logic Expectations

File:
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)

Tasks:
- document in the prompt that ranking is for internal selection only
- prefer categorical signal labels in the returned contract
- if the prompt uses ranking logic, frame it as:
  - determine candidate dimensions
  - choose the best coaching intervention
  - select the most teachable, well-supported signal

Notes:
- do not expose ranking numbers in the schema unless needed later
- if numbers are used internally for ranking, keep them ephemeral

Done when:
- the contract supports selecting one main content dimension without feedback sprawl

#### 4. Update Analysis Mapping Logic

File:
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)

Tasks:
- map returned `feedbackPlan` into the persisted `AnalysisResult`
- continue to compute any still-needed readiness metadata during transition
- stop introducing new duplicate fields

Done when:
- parsed analysis contains the new planning layer
- existing UI still renders correctly

### Phase 2: Cleanup And Consolidation

#### 5. Remove `coachReaction`

Files:
- [types.ts](../../src/lib/domain/types.ts)
- [schemas.ts](../../src/lib/domain/schemas.ts)
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)
- any export/debug surfaces referencing it

Tasks:
- remove duplicate write path
- remove duplicate type/schema field
- verify no consumer still depends on it

Done when:
- `ack` is the only remaining field for the opening reaction

#### 6. Consolidate Answer-Level Readiness

Files:
- [types.ts](../../src/lib/domain/types.ts)
- [schemas.ts](../../src/lib/domain/schemas.ts)
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)
- dev export and eval tooling

Tasks:
- choose one canonical answer-level readiness field
- remove or deprecate the duplicate
- leave session-level readiness alone unless broader summary logic changes

Done when:
- answer analysis does not carry two fields for the same readiness meaning

#### 7. Replace Or Remove `meta.signalQuality`

Files:
- [types.ts](../../src/lib/domain/types.ts)
- [schemas.ts](../../src/lib/domain/schemas.ts)
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)
- export/dev-eval tooling

Tasks:
- either remove `meta.signalQuality`
- or replace it with the new explicit detectability model in `feedbackPlan`

Done when:
- there is no misleading placeholder signal-quality field that is only populated on fallback/error

#### 8. Audit Hidden 9-Dimension Scoring

Files:
- [ai-service.ts](../../src/lib/server/services/ai-service.ts)
- any summary or export consumers of `scores`

Tasks:
- for each dimension, determine whether it still serves a distinct purpose in:
  - feedback routing
  - readiness derivation
  - telemetry
  - session summary synthesis
- remove or reduce dimensions that no longer have a justified job
- preserve only what still contributes to product behavior or evaluability

Done when:
- every surviving hidden score has a documented reason to exist

#### 9. Update Debug And Eval Artifacts

Files:
- [ai_context.md](./debug/ai_context.md)
- [export-session route.ts](../../src/app/api/dev/export-session/[sessionId]/route.ts)
- [export-utils.ts](../../src/app/(recruiter)/recruiter/dev-eval/export-utils.ts)
- [types.ts](../../src/app/(recruiter)/recruiter/dev-eval/types.ts)

Tasks:
- remove stale references to old answer-feedback shapes
- align debug/export artifacts with the live schema
- clearly archive or relabel historical prompt examples if retained

Done when:
- docs and dev tooling no longer suggest outdated analysis fields are still active

### Validation

#### 10. Run Focused Output Review

Review sample answers covering:
- strong clear signal
- strong ambiguous signal
- mixed moderate signal
- growth clear signal
- low-signal thin evidence
- typed answer
- spoken answer
- retry with real improvement

Check:
- does `ack` frame the same signal the content pulse expands?
- does detectability influence certainty appropriately?
- does the recommendation feel like the logical next move?
- is delivery coaching present only when warranted?

Done when:
- the feedback chain reads as one coach, not parallel fragments

#### 11. Final Cleanup Pass

Tasks:
- remove deprecated code paths
- remove dead schema fields
- remove stale comments that describe previous logic
- update this spec with the final disposition of each tracked cleanup target

Done when:
- the implementation and the spec describe the same system

### Optional Tracking Format

For each cleanup item, track:

| Item | Status | Disposition | Notes |
|------|--------|-------------|-------|
| `coachReaction` | Not Started | remove | duplicate of `ack` |
| answer-level readiness duplicate | Not Started | consolidate | choose one canonical field |
| `meta.signalQuality` | Not Started | refactor | replace with detectability or remove |
| old debug contract | Not Started | remove/archive | stale schema references |
| hidden 9-dimension scoring | Not Started | refactor | justify each surviving dimension |

---

## Decision

For the current product stage:
- Keep one model call.
- Redesign the hidden feedback contract before doing surface-level wording polish.
- Treat `ack` as the first expression of the central read, not as a standalone compliment.

This is the current intended direction unless superseded by a later gate decision.
