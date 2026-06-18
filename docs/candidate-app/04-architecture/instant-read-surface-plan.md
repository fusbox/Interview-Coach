# Instant Read Surface Plan

Status: Working plan
Last updated: 2026-06-17

## Purpose

The instant-read surface is the candidate dashboard's first read of interview preparedness. It should answer, in a few seconds:

- What is the coach's high-level read of my preparation?
- Where is my evidence strongest or thinnest?
- What kind of interview ground have I practiced?
- Where can I tap next to understand the evidence?

The matrix remains the evidence-backed detail layer. The instant-read surface should not become a second matrix, a score report, or a text-heavy coaching card.

## Product Contract

- The front-facing dashboard should feel encouraging, graphical, and low-friction.
- It must not expose raw numeric scores, hidden scoring dimensions, model internals, or diagnostic terms.
- It should use the same selected target-interview scope as the matrix.
- It should be derived from existing dashboard evidence until a later persistence decision is explicit.
- It should work as a fast snapshot after one practice round and still make sense after repeated rounds.
- It should preserve the drilldown model: high-level visual first, evidence and My Read details on deliberate interaction.

## Current Direction

Use an instant-read front surface backed by the existing matrix detail surface.

The preferred release trajectory is:

- front: qualitative preparedness snapshot;
- back/detail: matrix of question category by answer lane;
- drilldowns: existing row, column, cell, lane, category, and Q/A modals;
- guidance card: static between-round coach read unless a distinct selected-state use case is later approved.

The current implementation is a foothold, not the final shape: it renders a Recharts-backed Quick View beside the matrix-backed Details view. That is useful for validation, but the exact snapshot/current-state semantics and final visual polish are still open.

## Nine-Slice Implementation Path

### 1. Derived Read Model

Status: Done, first pass.

Create `InstantReadPreparednessModel` from the same selected-target evidence as the matrix:

- `overallRead`;
- three lane nodes for Substance, Structure, Delivery;
- question-category coverage marks.

No new persistence. No model call. No hidden score exposure.

### 2. Static Front Surface

Status: Done, first Recharts pass.

Render a front-facing graphical surface that is visually distinct from the matrix and can stand alone as the first dashboard read.

The first release-safe pass uses:

- a two-level Answer Skills ring for Substance, Structure, and Delivery plus child dimensions;
- a rounded Question Mix pie sized by the planned category distribution;
- a concise coach-read text block that updates when the candidate focuses a lane or question type;
- existing lane/category evidence modals as the deliberate drilldown layer.

Implementation note: the child-dimension ring now uses dimension-level preparedness state when the score-driven read model exposes it. Legacy/scoreless rows still fall back to parent-lane state so older data remains readable. The Question Mix pie now treats planned category count as the total distribution and splits each category into practiced and upcoming arcs. Practiced arcs use the category's scored preparedness state; upcoming arcs stay muted so unanswered questions communicate scope/coverage rather than weak performance. Revisit D3 or a stronger visualization library only if future zoom/reveal/force layout/trend interactions outgrow fixed chart helpers.

Question Mix note: the pie should be able to segment before the first answer is submitted. Active generated sessions use generated/planned question categories as upcoming coverage, while category state remains `to practice` until submitted answers produce scored evidence. Segment size answers "what question types are planned"; practiced/upcoming arc treatment answers "how much of that plan has been practiced"; preparedness color answers "what the practiced evidence shows."

### 3. Front/Back Shell

Status: Done, first pass.

Introduce a dashboard-level container that treats the instant-read surface and matrix as two views of the same Preparedness Map.

Current decision: explicit Quick View / Details toggle.

The literal flip-card treatment can be revisited later, but the release-safe implementation keeps the matrix component intact behind the Details tab and avoids animation or layout complexity while the visual language is still maturing.

### 4. Interaction Routing

Status: Partially done, with focus-to-read and click-to-drilldown behavior in place.

Lane and category marks should route to the same evidence surfaces already used by the matrix.

Rules:

- the first/default state is the overall coach read;
- focusing or hovering a lane or question-type mark updates the coach read without opening a modal;
- tapping/clicking a lane or question-type mark opens the same lane/category evidence drilldown used elsewhere;
- keyboard focus should provide the same selected-read context as pointer focus;
- matrix cells continue to open cell-scoped evidence;
- the snapshot does not need a separate nested evidence system.

### 5. Guidance Card Decision

Status: Direction set for current release.

Current direction: the instant-read coach read acts as the guidance surface. It starts with the overall read, then updates when the candidate focuses a lane or question type. This gives the front side a reason to be interactive without creating a parallel evidence system.

The selected read should stay lightweight:

- explain what the selected lane or question type means in plain candidate-facing language;
- avoid raw scores, hidden scoring terms, and diagnostic language;
- tell the candidate why opening the detail matters;
- leave actual Q/A evidence and My Read detail in the existing drilldown modals.
- preserve keyboard access with focus-triggered selected reads.

### 6. Responsive And Accessible Motion

Status: Planned.

The surface should be built with simple React/Recharts/CSS before adopting heavier visualization tooling.

Requirements:

- keyboard-accessible controls;
- focus states equivalent to hover states;
- reduced-motion fallback;
- no layout breakage on narrow mobile;
- tap targets large enough for thumb use;
- animation clarifies hierarchy instead of adding noise.

### 7. Snapshot Versus Current-State Semantics

Status: Product decision pending.

Define when the dashboard shows:

- latest-session snapshot;
- accumulated current state across sessions;
- trajectory or confidence modifier after two or more sessions.

Do not add trend or trajectory visuals until the semantics are settled.

### 8. Real-Data Validation

Status: Ongoing.

Validate against actual candidate sessions after each pass:

- one answered question;
- partially completed session;
- completed session with mixed category coverage;
- repeated sessions for the same target interview;
- same candidate with multiple target interviews.

Check whether the visual claim matches the feedback the candidate actually received.

### 9. Hardening And Release Readiness

Status: Planned.

Before release:

- test read-model helpers;
- test snapshot interactions;
- verify matrix drilldowns still work;
- document the final interaction contract in `SPEC.md` and `DATA_CONTRACT.md`;
- remove or demote prototype-only components;
- keep recruiter-created session behavior unaffected.

## Next Pass

The next instant-read pass should validate Slice 2 and prepare Slice 5 decisions:

1. Browser-validate Quick View and Details on mobile and desktop.
2. Keep Quick View as the default and keep Details as the matrix breakdown.
3. Tune the Answer Skills ring and Question Mix pie for readability against real candidate data, including active sessions with generated questions and 0 answered responses.
4. Refine selected-read copy and spatial composition so it feels like a coach interpretation, not a tooltip or duplicate modal.
5. Continue validating dimension-level child slices against real sessions so the ring reads as answer-skill evidence, not a duplicate of the parent lane.
6. Do not add trajectory, animation-heavy visualization, or new persistence until snapshot/current-state semantics are settled.

Rationale: the explicit toggle is now the stable view contract. The next value is making the Quick View readable and trustworthy before adding motion or deeper progression semantics.
