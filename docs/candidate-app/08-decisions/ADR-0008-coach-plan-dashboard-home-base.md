# ADR-0008: Coach Plan Dashboard Home Base

Date: 2026-06-27
Status: Accepted

## Context

The candidate dashboard has proven the core read-model logic: selected target interview scoping, planned category coverage, score-driven Substance / Structure / Delivery lanes, Practice Next, and evidence drilldowns all work as implementation foundations.

The current Quick View plus matrix direction is useful for validation, but it still reads too much like analytics UI with coach copy attached. The release dashboard should instead simulate a human jobs coach between practice activities: orient the candidate to the interview plan, explain what the coach is looking for, show current progress toward the preparedness benchmark, and recommend what to practice next.

## Decision

The dashboard home base will be organized around a Coach Plan object.

The Coach Plan has fixed framing plus three faces:

- fixed framing: target role, interview stage, baseline count, short plan rationale, preparedness target, and compact movement/progress microcopy;
- Categories face: interview-demand categories present in the plan;
- Skills face: the three answer-quality lanes: Answer Substance, Interview Structure, and Communication Delivery;
- Question Set face: the planned coach sequence of baseline questions.

The fixed framing persists while the candidate rotates between faces. First visit defaults to Categories; after the candidate changes the face, the dashboard may remember the last selected face for that prep context.

The preparedness target is a durable visual outside any one face. It combines:

- baseline coverage: answered baseline questions over baseline question count;
- current aggregate prep state from practiced question evidence;
- movement indicators for repeat practice, such as improved and watch counts.

Repeat practice does not increase baseline coverage, but it can improve or caution the current read.

Each face uses one primary selector and a teaching-first coaching sheet:

- Category face: category chart segments and labels are selectors. The sheet opens with role/stage/JD-specific category explanation, then offers progress, practiced/planned questions, and coach comments.
- Skills face: only parent lanes are tap/click targets. Child dimensions are shown inside the lane sheet, not as first-pass chart targets.
- Question Set face: the default order is the planned coach sequence. Answered questions are visible; unanswered questions are hidden by default with a reveal option.

Post-practice feedback creates a Coach Update entry on the dashboard. The update should feel like the coach has a fresh read from the latest practice. The entry opens a sparse guided sequence with escape paths: close, skip to recommendation, or drill into evidence. The debrief leads with coach priority, supported by skill/category/question chips.

The existing matrix remains available during transition as the evidence-backed detail view. It should not receive more polish unless that work supports migration or validation. The expected product direction is to absorb normal candidate evidence exploration into the Coach Plan faces and coaching sheets before retiring the matrix from primary UI.

## Voice Rules

Neutral UI structure names the model. Coach narrative speaks like a person.

Use product terms in headings, labels, chips, and short fragments:

- **Structure** improved
- **Case / Scenario** still unpracticed
- **Behavioral** answer needs clearer impact

Use natural language in narrative coach copy:

- "Your repeat work made the answer structure clearer, but the client impact still needs more detail."

Avoid narrative copy that treats model labels as nouns:

- "Your repeat work strengthened Structure."

## Consequences

The current Quick View / Details toggle is no longer the release direction. It can remain during transition, but the new implementation should move toward face-to-face Coach Plan navigation. Desktop may use arrows. Mobile should support swipe. Animation should read as rotating between faces rather than a generic carousel when feasible.

The new direction depends on two hardening tracks:

- question generation must treat Case / Scenario as a first-class category rather than relying on behavioral-key name detection;
- answer scoring must better represent applicability, insufficient evidence, and unscoreable answers before dimension-level claims become too prominent.

The implementation should land in phases:

1. Coach Plan fixed framing and preparedness target.
2. Category face and coaching sheet.
3. Skills face and lane coaching sheet.
4. Question Set face.
5. Coach Update guided debrief.
6. Practice Next paired recommendation rules and alternatives.

No candidate-facing numeric readiness score should be introduced.
