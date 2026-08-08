# Practice Plan Baseline And Round Selection

Status: Ratified implementation contract
Last updated: 2026-08-06

## Purpose

This contract separates the coach's stage-defined practice-plan baseline from any one practice round. A round is a flexible unit of activity. Completing a round does not necessarily complete the Coach Plan.

## Stage Baseline

One candidate prep context owns one immutable canonical question set. The stage recommendation is the minimum size of that set:

| Interview stage | Baseline questions |
| --- | ---: |
| Not sure yet / general practice | 5 |
| Screening | 5 |
| First interview | 7 |
| Follow-up interview | 10 |
| Final interview | 10 |

Changing interview stage creates a new linked prep context rather than silently changing the existing baseline.

The count selected at setup changes the canonical set only when it is larger than the stage recommendation. In that case the selected count becomes the immutable baseline denominator and the deterministic category sequence scales to that count. A smaller selection never shrinks the baseline; it becomes the candidate's preferred pace through the full canonical set.

## Round Selection

Candidate-led setup still recommends the stage baseline while allowing the candidate to select a different count.

- When the selected count is smaller than the stage recommendation, the app creates and persists the full stage baseline, then uses the selected count as a pace limit before returning the candidate to the dashboard.
- When the selected count equals the stage recommendation, the canonical set and pace are equal.
- When the selected count is larger than the stage recommendation, every generated question belongs to the canonical baseline and the selected count becomes its denominator.
- The persisted initial session owns the complete canonical plan and wording. Questions are not moved into plan-continuation sessions merely because a paced visit ended.
- Repeated practice after first-pass completion may create follow-up sessions that reference canonical plan questions. Questions intentionally added beyond that immutable set remain supplemental and do not change the denominator.

The prep context must persist both the immutable baseline plan and the corresponding worded baseline question set. The original candidate practice session persists the same complete set; its current cursor and submitted-answer map are the sole first-pass continuation boundary.

## Paced Session Contract

The candidate may leave the canonical session after a bounded amount of new work without finishing or replacing it.

- `Continue round` resumes the same session at the shared next-unanswered resolver and applies the setup pace.
- `One-question round` resumes the same session, permits one newly settled answer, then returns to the dashboard.
- Direct first-pass practice from Coach Plan or Coach Update targets an unanswered canonical question in the same session and returns after that question is settled.
- A paced exit does not complete the session, create a follow-up intent, copy question wording, or reset the canonical cursor.
- A paced exit claims navigation once, presents the dedicated dashboard-return transition before document navigation, and describes the visit as saved/resumable rather than complete.
- Every terminal feedback action carries one opaque practice-visit id. Question-settled Coach Update artifacts remain independently replayable, while the dashboard groups artifacts sharing that visit id into one ordered Coach Update carousel. The compatibility fallback may group the latest setup-pace-sized artifact set for pre-visit-id development rows; it is not new-write authority.
- The resolver uses immutable canonical order after the requested focus, wraps once, and skips every question with a durable submitted answer. Array position, dashboard display order, and feedback-carousel order are not completion authority.

## Completion Meaning

- **Initial session complete** means every canonical baseline question has at least one usable submitted answer and the terminal completion boundary has been persisted.
- **Initial session unfinished** means at least one canonical baseline question lacks a usable submitted answer, regardless of how many paced visits have ended.
- **Plan coverage complete** means every baseline question has at least one usable submitted answer.
- **Upcoming plan coverage** means a baseline question does not yet have usable evidence.

Candidate-facing UI must not use `finished` without naming the object. Finishing a round must not imply that the broader Coach Plan is complete.

## Dashboard Priority

1. Resume the one active unfinished canonical session.
2. Continue baseline questions that still lack evidence.
3. Practice from feedback on questions with existing evidence.
4. Offer supplemental or new-context practice after the baseline and higher-priority remediation needs are clear.

When the initial session is unfinished, the dashboard derives all continuation actions from the same unanswered set. `Continue round` resumes the shared cursor; `One-question round` targets its next member. A read-only progress/status object may orient the candidate, but the UI must not present a separate continuation round or imply that a new round is required to finish the plan.

## Persistence Boundary

The durable target is prep-context ownership rather than inference from the earliest session:

- immutable stage-defined baseline plan snapshot;
- immutable worded baseline question-set snapshot with stable plan-question ids;
- the initial session plan and wording snapshot matching the complete baseline one-to-one;
- follow-up plan and wording snapshots referencing baseline ids or marking genuinely post-baseline supplemental questions;
- answer and repeat-practice lineage resolving to the stable baseline question id;
- dashboard coverage derived from baseline ids plus usable answer evidence.

Existing V1 baseline and session-level Coach Update artifacts remain readable compatibility rows, but no synthetic question history or baseline rewrite is required. Existing V2 development fixtures and local databases may be regenerated when this contract lands.

## Runtime Version Boundary

Baseline V2 writes the effective canonical count, the stage-recommended count, and the setup pace. V1 baseline snapshots remain readable for historical development rows but are never written by the active setup path. No compatibility migration or synthetic answer history is required for the disposable test context.

## Follow-Up Launch Invariant

Before initial-plan completion, canonical unanswered questions never enter the durable next-round draft. `Practice now`, `Continue round`, and `One-question round` resolve into the original canonical session. Already answered questions expose no practice or queue mutation action during that phase. The existing queue/intent/session machinery remains the post-completion boundary for repeat practice and genuine supplemental work.

## Coach Update Checkpoint

Coach Update production is question-settled, not session-terminal. A question becomes eligible after its latest answer attempt is durably submitted, its accepted coaching evaluation is persisted, its terminal feedback action is saved, and the canonical cursor can advance. Generation failure must not block that settled transition. The resulting immutable update item is keyed by the exact answer attempt and accepted evaluator run, while the source session and canonical plan-question identity remain provenance. Replays are idempotent; later attempts create new items without overwriting history.

The closed dashboard presents the latest practice visit as one Coach Update even though each settled question is generated independently. The opened Coach Plan does not borrow that current carousel as its evidence source. It resolves the latest compatible accepted answer and evaluator run for every practiced canonical question across the complete selected prep context, so reviewing one current update never hides earlier practiced-question evidence.
