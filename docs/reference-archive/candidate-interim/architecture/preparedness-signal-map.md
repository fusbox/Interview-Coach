# Preparedness Signal Map

Status: Historical reference

> [!WARNING]
> This file is archived historical context and does not govern current V2 implementation.

Original status: Working reference
Last updated: 2026-06-01

## Purpose

This file maps the dashboard preparedness read model from source data to visible dashboard behavior.

It is intentionally concrete. It answers:

- which low-level signals exist now;
- which top-level lane each signal feeds;
- how evidence is constructed;
- how evidence state drives lane color, fill, and modal content.

Canonical contract: [Preparedness Signal Contract](./preparedness-signal-contract.md)

## Release Source Flow

```mermaid
---
id: 79184746-7eb1-4100-b297-7557dbef5efc
---
flowchart TD
    Questions[Completed session questions] --> CategoryCards[Question category read model]
    Answers[Submitted answers] --> Analysis[Answer analysis JSON]
    Analysis --> Scores[hidden numeric scores]
    Scores --> Lanes[Substance / Structure / Delivery lane states]
    Scores --> CategoryCards
    Scores --> Matrix[Lane x Category matrix cells]
    Analysis --> Feedback[feedbackPlan, contentPulse, deliveryPulse, recommendation]
    Feedback --> Modal[Candidate-safe modal explanations]
    CategoryCards --> Modal
    Lanes --> Matrix
    CategoryCards --> Matrix
    Matrix --> Map[Preparedness Map]
```

## Release Dashboard Model

For this release, the dashboard should not derive preparedness from qualitative
`contentPulse`, `deliveryPulse`, or `feedbackPlan.primaryAnchor` inference.
Those fields can explain evidence in modals, but visible lane state and fill
come from the hidden numeric scores on completed-session feedback. Scores only
contribute to release lane/category averages when their dimension applicability
is `observed` or legacy-unspecified with a valid numeric score.

### Performance Lanes

| Lane ID | User-facing lane | What it shows |
| --- | --- | --- |
| `substance` | Answer Substance | Relevant, concrete, outcome-oriented, well-reasoned answer content. |
| `structure` | Interview Structure | Organization and signposting that make answers easy to follow. |
| `delivery` | Communication Delivery | Concision, clean delivery, and composure. |

Score dimensions:

- Substance: `focus_relevance`, `specificity_concreteness`, `outcome_explicitness`, `decision_rationale`.
- Structure: `structural_clarity`, `signposting`.
- Delivery: `filler_words`, `conciseness`, `resilience`.

### Score Mapping

| Average score | State | Surface |
| --- | --- | --- |
| No score | `not_practiced` | Gray, fully filled. |
| `1.0` to `<2.0` | `emerging` | Amber, fully filled. |
| `2.0` to `<3.0` | `emerging` | Amber with proportional blue fill. |
| `3.0` to `<4.0` | `clear` | Blue with proportional green fill. |
| `>=4.0` | `strong` | Green, fully filled. |

### Question Category Cards

Interview Range is not a lane for this release. Instead, the dashboard uses
question categories as the second axis of the Preparedness Map matrix:

- Behavioral;
- Culture Fit;
- Technical / Role-Specific;
- Case / Scenario;
- Screening.

Each category carries completed-session question count and a composite average
across all nine internal score dimensions for questions in that category. Each
category also carries lane-specific score states for Substance, Structure, and
Delivery so the dashboard can render the matrix cell for "this lane in this
kind of question" without inventing a new candidate-facing score.

When category evidence is aggregated across sessions, the dashboard recomputes
the visible category state from the weighted average score. It should not keep a
category green just because one historical session was strong. Category
ordering may still sort by practice need for lists. The release matrix presents
question categories as rows and the three performance lanes as columns so the
grid stays narrow enough for mobile and row, column, and cell drilldowns remain
predictable.

Screening means screening-only questions such as interest, background,
availability, logistics, or basic qualifications. Screening Basics in practice
setup can emphasize Culture Fit, but Culture Fit remains its own dashboard
category.

## Legacy PrepSignal Notes

The earlier `PrepSignal` map remains useful historical context, but it should
not drive the release dashboard. If kept in code temporarily, it should be
treated as a fallback or transitional read model only.

## Release Evidence Construction

Lane and category modal content should be built from completed-session question
evidence:

| Source | Candidate modal use |
| --- | --- |
| Question text | Shows what was practiced. |
| Answer modality | Shows whether evidence came from text or voice, once modality is reliably persisted. |
| `feedbackPlan.centralRead` | Candidate-safe explanation of what the coach noticed. |
| `contentPulse` / `deliveryPulse` | Short coach-language evidence when useful. |
| `recommendation` / `nextAction` | Candidate-safe next-step wording. |
| `scores` | Drives state and color, but should not be displayed as raw numeric scores in normal candidate UI. |

Lane, category, and matrix-cell drilldowns should share the same mobile-first interaction model:

1. open the lane, category, or cell modal;
2. show practiced question and candidate answer transcript/mode cards;
3. open a focused coach-read modal for candidate-safe evaluation copy.

Lane coach-read copy should be scoped to the lane's dimension group. Category coach-read copy should be scoped to the question category. Matrix-cell drilldowns should show the intersection: the practiced questions in that category whose evidence supports the selected lane. Normal dashboard UI must not show raw prompts, raw resume content, hidden numeric scores, or AI-quality debug payloads. Showing the candidate their own answer transcript is allowed in dashboard evidence drilldowns.

## Release Lane Rollup

```mermaid
flowchart LR
    Scores[Completed answer scores] --> Dimensions[Lane dimension groups]
    Dimensions --> Average[Average lane score]
    Average --> State[State color]
    Average --> Fill[Lane fill cue]
    Scores --> Modal[Question evidence modal]
```

Fill is a visual cue only. Do not show percentages or numeric readiness in
normal candidate UI.

Non-observed dimension entries (`not_elicited`, `insufficient_data`, or
`unscoreable`) are excluded from the average and should not be treated as weak
performance. They are internal evaluator facts until a later UX slice decides
how to explain them safely.

## Current Known Gaps

- Same-title target interviews are still grouped by target role until a profile selector lands.
- Role Fit is intentionally out of release scope.
- Category-card and lane modal copy needs browser validation and product tuning against real candidate sessions.
- Confidence is intentionally separate and not included as a lane.
