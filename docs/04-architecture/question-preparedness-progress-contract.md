# Question Preparedness Progress Contract

Status: Ratified implementation contract
Last updated: 2026-07-25

## Purpose

Interview Coach needs to show progress toward preparedness without claiming that a candidate is generally ready for an interview. The unit of progress is one canonical question in one candidate-owned prep context.

Each accepted answer attempt already carries five universal criterion appraisals. Application code derives one qualitative question band from those facts. This is a transparent synthesis for learning progress, not a model-authored score, a hiring judgment, a probability of success, or an overall preparedness rating.

## Attempt-Level Derivation

The five universal criteria remain the only rated inputs:

1. `answer_focus`
2. `organization`
3. `evidence_specificity`
4. `role_skill_signal`
5. `impact_judgment_takeaway`

Category-specific signals inform those criterion appraisals. They are evidence lenses and are not separately rated or averaged.

Code derives one attempt result:

- `emerging` = 1
- `clear` = 2
- `strong` = 3
- `not_elicited` is excluded from both numerator and denominator
- `insufficient_data` and `unscoreable` are unavailable criteria, not low ratings

The internal mean is used only to select a qualitative band and is not persisted or exposed:

| Internal mean | Attempt band |
| --- | --- |
| `1.00` through `1.49` | `emerging` |
| `1.50` through `2.49` | `clear` |
| `2.50` through `3.00` | `strong` |

Availability and safety rules override the ordinary band:

- one unavailable criterion permits a band but caps it at `clear`;
- two or more unavailable criteria produce `incomplete`;
- a non-answer, off-topic answer, or unclear transcription produces `incomplete`;
- sensitive-disclosure handling produces `incomplete` while still receiving the dedicated professional reframe;
- a trusted technical contradiction caps the result at `emerging`;
- `technicalAccuracy: not_assessed` is neutral and does not lower the result;
- no rated criterion produces `incomplete`.

The derivation retains counts and reason codes for QA, but no candidate-facing surface receives the numeric mean.

## Evidence Basis

An accepted category signal can have one of three evidence bases:

- `span`: one or more exact answer spans support the signal and may be eligible for provenance-safe transcript annotation;
- `whole_answer`: the meaning of the response supports the signal, but no unique exact span is reliable enough to highlight;
- `absence`: an expected signal was not observed.

Evaluation does not depend on locating a highlight. A `whole_answer` signal may inform a criterion appraisal without inventing an exact quote. An `absence` signal may inform coaching or an adjacent indicator without fabricating a transcript anchor. Inline transcript annotation remains limited to exact, unique accepted spans.

## Question-Level Progress

Every accepted evaluator result is attached to one immutable answer attempt and one canonical baseline-question lineage. The question's current progress band is the highest band earned by any accepted, rateable attempt:

`strong` > `clear` > `emerging`.

An incomplete or unavailable later attempt does not erase a previously earned band. The read model retains latest-attempt state, attempt count, and source lineage so a later regression policy can be added without rewriting history.

For the first release:

- question progress is monotonic;
- the first or any later regression does not lower the displayed question band;
- unanswered questions are neutral and do not enter a band calculation;
- supplemental questions do not expand the canonical prep-plan denominator;
- immediate feedback and the latest Coach Update still respond to the latest attempt rather than the highest attempt.

Future regression behavior is deliberately deferred. The product direction is to keep question and plan indicators stable on the first regression and reconsider them after a later regression, but consecutive-window, pattern-equivalence, recovery, and communication rules must be ratified before implementation.

## Prep-Context Progress

The prep-context read model reports achievement and coverage separately:

- canonical question count;
- unpracticed question count;
- attempted question count;
- evaluated question count;
- incomplete/unavailable question count;
- counts currently at `emerging`, `clear`, and `strong`.

Unanswered questions do not lower achievement. For example, two Strong questions out of five and two Strong questions out of two practiced questions both report two Strong achievements; coverage explains the difference. The UI must not collapse these facts into a readiness percentage or imply that unpracticed questions are weak.

## Persistence And Ownership

The immutable answer attempt and accepted evaluator run remain durable truth. Question and prep-context progress are read-time projections derived from candidate-owned practice-plan baselines, practice-session lineage, answer attempts, and accepted evaluator runs. No new score column or mutable aggregate table is required. If optional attempt or evaluator history cannot be read, the preparedness projection is unavailable while the rest of the dashboard remains usable; the app must not reinterpret missing input as unpracticed or weak evidence.

If query volume later justifies a materialized projection, it must be versioned, rebuildable from immutable facts, fenced against stale writes, and preserve the same unanswered-neutral and highest-earned rules.

## Prior-Behavior Disposition

- Preserve: immutable attempts, accepted evaluator facts, category-aware evidence signals, stable baseline-question lineage, and separate immediate/latest coaching.
- Reinterpret: the prior ban on an overall band prohibits opaque answer/readiness scoring, not this transparent code-owned question synthesis.
- Retire: weakest-criterion-wins remediation and any dashboard inference that treats coverage as quality.
- Defer: regression-driven band reduction, trend visualization, candidate-facing numeric values, and plan-level readiness claims.
