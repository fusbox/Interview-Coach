# Dashboard Progress Visualization Contract

Status: Ratified production UI design contract
Last updated: 2026-07-30

## Purpose

Dashboard progress visuals help a candidate answer three different questions without collapsing them into a readiness score:

1. **Coverage:** What parts of the baseline have I practiced?
2. **Achievement:** How many baseline questions have reached the highest-earned Strong band?
3. **Latest feedback:** What did my most recent practice show, and what should I do next?

Coverage, highest-earned achievement, and latest feedback remain separate facts. This document maps those facts to the Coach Desk composition defined in [Candidate Dashboard Composition](./dashboard-composition-direction.md).

The source contract is [Question Preparedness Progress](../04-architecture/question-preparedness-progress-contract.md). The dashboard does not persist or calculate an independent score.

## Non-Goals

The first release does not provide:

- a readiness percentage or probability of interview success;
- an overall plan grade or candidate ranking;
- numeric criterion averages;
- hidden evaluator scores or score deltas;
- activity volume presented as achievement;
- unpracticed questions presented as weak;
- a trend or regression chart before regression policy is ratified;
- an analytics-card grid on the dashboard home.

## Source Mapping

| Candidate-facing meaning | Existing authoritative field or source | Presentation rule |
| --- | --- | --- |
| Canonical baseline | `coverage.canonicalQuestionCount` | Denominator for coverage and Strong-of-plan |
| Practiced coverage | `coverage.attemptedQuestionCount` | Secondary `X of Y practiced` context |
| Unpracticed coverage | `coverage.unpracticedQuestionCount` and question `state` | Neutral, never Emerging or weak |
| Strong achievement | `achievement.strong` | Primary Plan-rail anchor |
| Clear achievement | `achievement.clear` | Plan detail and compact labeled Plan-rail question breakdown |
| Emerging achievement | `achievement.emerging` | Plan detail and compact labeled Plan-rail question breakdown |
| Incomplete | `coverage.incompleteQuestionCount` and question `state` | Needs a complete usable answer; not a low band |
| Evaluation unavailable | `coverage.evaluationUnavailableQuestionCount` and question `state` | Coaching unavailable; not unpracticed or weak |
| Question status | `questions[].state` and `questions[].band` | Compact Plan rail and opened Plan detail |
| Canonical category | Coach Plan `questions[].category` | Category aggregation and drilldown |
| Latest feedback | Latest accepted Coach Update and latest-attempt coaching | Coach Update/Practice Next only, not achievement visuals |
| Criterion balance | Accepted evaluator-run criterion appraisals | Future derived Skills projection; no UI-side recomputation |

If the canonical Coach Plan or preparedness projection is unavailable or internally inconsistent, progress visuals fail closed. The rest of the dashboard remains usable.

## Strong-Of-Plan Anchor

Strong-of-plan is the primary progress read:

`achievement.strong` out of `coverage.canonicalQuestionCount`.

This is the overall indicator of progress toward completing the practice plan. Plan completion has one explicit terminal condition: every canonical Plan question has a highest-earned Strong result. `Strong Y of Y` may therefore be labeled `Plan complete`. This completion claim applies only to the candidate's practice plan; it is not a claim that the candidate is ready for an interview or likely to succeed.

Candidate-facing examples:

- `2 of 5 plan questions have reached Strong`
- `Strong on 2 of 5 plan questions`
- `No questions at Strong yet` with an encouraging next action
- `Plan complete · 5 of 5 Strong`

Coverage remains adjacent but secondary. It may appear as concise count language or through the neutral `Not practiced` rows in a complete canonical question list:

- `You have practiced 3 of 5 questions`
- `2 questions are still unpracticed`

The compact home treatment uses one enlarged progress ring in an `Overall plan` cell beside a vertical `By question` breakdown. The two cells have equal width and centered distribution inside one inset progress field; neither receives more layout weight. The darker rail shell remains visible as the `32px` side gutters around that field. The ring owns the Strong-of-plan story; the breakdown uses question number, a circular state badge, and a visible state label to explain which canonical questions contribute. Strong alone uses the filled preparedness value with a checkmark. Clear, Emerging, not practiced, incomplete, and unavailable use lighter treatments from their truthful preparedness roles so they remain secondary without losing their distinct labels. The rail does not repeat the breakdown as a horizontal segment chart. The UI must not convert the ratio to percentage copy, label it readiness, or imply that Plan completion is required before the candidate can interview successfully.

### State Rules

- An unanswered baseline question contributes only to the denominator and unpracticed coverage.
- A question contributes to exactly one highest-earned achievement band.
- A later incomplete or unavailable attempt does not erase a previously earned band.
- Supplemental questions do not expand the denominator.
- Repeated attempts do not increase coverage or weight the Plan anchor.
- The completion state is true only when `achievement.strong === coverage.canonicalQuestionCount` and the canonical count is greater than zero.
- A missing projection produces an unavailable progress state, not `0 Strong`.
- A zero-question or unresolved baseline suppresses the visual and exposes setup/recovery guidance.

The compact question breakdown preserves canonical question order and shows each canonical question once. Badge treatment and text carry meaning together; color is supporting only. The Strong checkmark supplies a non-color confirmation affordance, while every other state remains a lighter circular badge with its visible label. Unpracticed questions remain neutral, and incomplete or evaluation-unavailable questions keep their distinct truthful labels rather than collapsing into a low band. The breakdown is explanatory context for the overall anchor, not an interactive chart or a second completion measure.

## Pattern Chart

The pattern chart explains where evidence clusters across the selected Coach Plan. It is not a second score and does not repeat the five-criteria radar.

### Placement

No Categories face or other fixed Plan navigation is required. If the pattern view survives design review, it belongs in the opened Coach Plan or a deliberate question/category drilldown. A compact pattern peek may appear in the Plan rail only if it does not compete with Strong-of-plan or create another home chart.

### Default Grain

The default grain is category with question peek:

- preserve canonical Coach Plan category order;
- group canonical questions by their plan category;
- show counts or compact marks for `unpracticed`, `emerging`, `clear`, `strong`, `incomplete`, and `evaluation unavailable`;
- allow the candidate to open a category and inspect its canonical questions;
- keep exact question order inside each category.

The chart may use a status board, segmented strip, or aligned dot/mark system. It must keep labels visible without relying on color alone.

### Aggregation

Each canonical question contributes one current status:

- `not_practiced` → unpracticed;
- `rated + emerging` → Emerging;
- `rated + clear` → Clear;
- `rated + strong` → Strong;
- `incomplete` → incomplete;
- `evaluation_unavailable` → unavailable.

Category totals are counts of canonical questions in those states. They are not averages. Repeated practice of one question does not increase its weight. If question-to-category joining is incomplete or crosses prep-context identity, the affected category is unavailable rather than partially inferred.

### Interaction

- Selecting a category reveals the constituent canonical questions.
- Selecting a question opens selected-context question detail or the relevant practice action, not Coach Update content for an unrelated session.
- Unpracticed wording remains hidden until the candidate deliberately reveals it when the governing Question Set contract requires that disclosure.
- Hover may enhance desktop explanation; tap and focus provide the complete interaction.

## Five-Criteria Radar

The radar is an optional cross-question view of balance across the five universal criteria:

1. Answer Focus
2. Organization
3. Evidence Specificity
4. Role/Skill Signal
5. Impact, Judgment, and Takeaway

It is not a required Coach Plan face, home hero, per-answer carousel decoration, or numeric competency score.

### Candidate-UI Decision

Candidate-facing qualitative criterion balance remains a bounded design option, not an approved production requirement. Before it is authorized, transcript-canvas evaluation and dashboard probes must show that candidates need a cross-question balance view that cannot be explained more accurately through accepted answer evidence. If retained, the chart uses the same `Emerging`, `Clear`, and `Strong` vocabulary as accepted criterion appraisals, with no raw values, decimal means, or numeric vertex labels.

This placement does not authorize exposing evaluator internals, technical-verification state, raw evidence classifications, or provider output.

### Required Projection

The current question-preparedness projection does not expose a prep-context criterion aggregate. Production UI must not derive the radar from hydrated question cards or recompute evaluator meaning in the browser.

Before implementation, the core lane must provide a candidate-owned, prep-context-scoped read projection derived from accepted evaluator runs and canonical baseline lineage.

The projection uses this aggregation rule:

1. For each canonical question and criterion, select the highest accepted rateable criterion level across that question's attempts.
2. Exclude `not_elicited`, `insufficient_data`, `unscoreable`, missing accepted runs, and technically unverifiable inputs from that criterion's denominator; never map them to Emerging.
3. Give each canonical question at most one contribution per criterion so repeat practice cannot dominate the shape.
4. For each criterion, select the median qualitative level across contributing canonical questions. An even split resolves to the lower of the two middle levels until a more expressive distribution view is ratified.
5. Retain contributing-question count and excluded/unavailable count for candidate-safe support copy and QA.

Internal ordinal steps may support the deterministic median, but they are neither persisted as candidate scores nor exposed.

### Evidence Threshold

Render the radar only when:

- every axis has at least one rateable contribution; and
- at least two distinct canonical questions contribute across the shape.

Otherwise do not draw the radar. The owning surface may explain which criteria the coach uses and invite more practice without presenting a misleading polygon. Any retained axis with materially thinner evidence than the others receives a visible support cue and accessible explanation.

### Visual Rules

- Axis labels remain visible.
- Rings are labeled qualitatively, not numerically.
- Missing evidence uses a neutral state rather than a zero-length weak axis.
- The chart includes `Based on X practiced plan questions` or equivalent coverage context.
- Color supports the shape but is not the sole carrier of meaning.
- Selecting or focusing an axis opens criterion teaching and evidence coverage, not a score breakdown.

## Latest Feedback Boundary

Coach Update and immediate coaching respond to the latest accepted attempt or latest completed round. Strong-of-plan, the pattern chart, and the radar use bounded cross-session progress projections.

Therefore:

- a latest attempt may receive remediation while the question's highest-earned band remains Strong;
- Coach Update may describe a current focus without lowering the Plan anchor;
- a candidate can revisit the exact latest feedback from Coach Update;
- progress visuals never rewrite latest coaching into a global trend claim.

The UI must explain this distinction through placement and copy rather than inventing a blended status.

## Candidate-Safe Copy

### Allowed

- `Strong on 2 of 5 plan questions`
- `You have practiced 3 of 5 questions`
- `Behavioral questions are mostly Clear, with one still unpracticed`
- `This Skills view is based on 3 practiced plan questions`
- `More practice will give me enough evidence to show your skills pattern`
- `Coaching is unavailable for one practiced question`

### Prohibited

- `40% ready`
- `Your readiness score is 72`
- `You are interview ready`
- `Only 60% strong`
- `Behavioral is your weakest category` when the category contains unpracticed or unavailable questions
- `Your communication declined` without a ratified regression contract
- `0 in Role/Skill Signal` when the criterion was not elicited or unavailable

## Accessibility And Responsive Rules

- Every chart has an equivalent text summary and ordered data representation.
- Labels do not depend on hover or color alone.
- Focus order follows the visible category, criterion, or question order.
- At 320px and 200% zoom, charts may recompose to rows, lists, or horizontally bounded scrollers without losing labels or actions.
- Screen-reader copy states the evidence basis and separates practiced coverage from achievement.
- Reduced motion removes chart morphing and face-transition perspective.
- Touch targets meet the effective 44px contract.

## Failure And Recovery

- Missing accepted evaluator history makes the relevant progress projection unavailable; it does not make questions unpracticed.
- Malformed or cross-context lineage fails closed.
- A partially available pattern board may show categories whose complete canonical join is proven, while explicitly marking an unavailable category; it must not silently change the plan denominator.
- The radar is all-or-start-state. It does not draw a partial polygon that resembles a low result.
- Chart failure never removes Active Round, Coach Update, Practice Next, Coach Plan teaching, or queue access.

## Implementation Gate

Before production implementation:

1. the dashboard composition direction and this visualization contract are linked from SPEC and HANDOFF;
2. the production transcript canvas is reviewed with representative accepted evaluator outputs, exact-span rejection, and plain-transcript fallback;
3. mobile Plan-rail and alternative opened-Plan probes pass human review without assuming faces;
4. the existing preparedness projection is used for Strong-of-plan and any retained pattern status;
5. if a radar survives that review, the criterion aggregate read projection is implemented and tested on the core lane before radar UI work;
6. fixtures cover zero evidence, partial evidence, unavailable evaluation, repeated practice, cross-context rejection, and mixed Strong/Clear/Emerging states;
7. rendered verification covers text alternatives, focus/tap behavior, 320px, representative mobile, 200% zoom, long labels, reduced motion, and contrast.
