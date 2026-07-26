# Practice Plan Baseline And Round Selection

Status: Landed in Slice 149
Last updated: 2026-07-19

## Purpose

This contract separates the coach's stage-defined practice-plan baseline from any one practice round. A round is a flexible unit of activity. Completing a round does not necessarily complete the Coach Plan.

## Stage Baseline

One candidate prep context owns one immutable baseline question set for its interview stage:

| Interview stage | Baseline questions |
| --- | ---: |
| Not sure yet / general practice | 5 |
| Screening | 5 |
| First interview | 7 |
| Follow-up interview | 10 |
| Final interview | 10 |

Changing interview stage creates a new linked prep context rather than silently changing the existing baseline.

## Round Selection

Candidate-led setup may still recommend the stage baseline while allowing the candidate to select a different first-round count.

- When the selected count is smaller than the baseline, the first round contains a representative subset of baseline questions.
- When the selected count equals the baseline, the first round may contain the full baseline.
- When the selected count is larger than the baseline, the round contains the full baseline plus explicitly supplemental questions. Supplemental questions do not increase the baseline denominator.
- A round snapshot carries stable references to its source baseline questions. Repeated practice and follow-up rounds add evidence to those questions rather than creating new baseline coverage.

The prep context must persist both the immutable baseline plan and the corresponding worded baseline question set. Generating only the first-round wording is insufficient because the coach cannot safely recommend an unexposed question that has no stable identity or wording.

## Completion Meaning

- **Round complete** means the candidate reached the terminal boundary for that session.
- **Round unfinished** means one or more questions exposed in that session still need an answer or terminal disposition.
- **Plan coverage complete** means every baseline question has at least one usable submitted answer.
- **Upcoming plan coverage** means a baseline question has not yet been exposed in a round or has been exposed without usable evidence.

Candidate-facing UI must not use `finished` without naming the object. Finishing a round must not imply that the broader Coach Plan is complete.

## Dashboard Priority

1. Resume an active unfinished round.
2. Continue baseline questions that still lack evidence, whether they were skipped in a completed round or have not yet been exposed.
3. Practice from feedback on questions with existing evidence.
4. Offer supplemental or new-context practice after the baseline and higher-priority remediation needs are clear.

When the initial round is unfinished, its active-round surface should state how many questions in that round remain. Coach Plan may separately explain that additional baseline questions will follow after the current round, but it should not compete with the resume action.

## Persistence Boundary

The durable target is prep-context ownership rather than inference from the earliest session:

- immutable stage-defined baseline plan snapshot;
- immutable worded baseline question-set snapshot with stable plan-question ids;
- per-round plan and wording snapshots referencing baseline ids or marking supplemental questions;
- answer and repeat-practice lineage resolving to the stable baseline question id;
- dashboard coverage derived from baseline ids plus usable answer evidence.

No V1 data compatibility is required. Existing V2 development fixtures and local databases may be regenerated when this contract lands.

## Landed Runtime Boundary

Slice 149 persists `rigorBaselineSnapshot` and `rigorBaselineQuestionWordingSnapshot` on the prep context before saving round one. One provider result is deterministically projected into the full baseline and the selected round. Round slots carry stable plan-question references and a baseline/supplemental classification. Dashboard and follow-up services read the prep baseline, while persisted session snapshots remain scoped to the questions actually exposed in that round.

An unexposed baseline question uses the earliest original session only as a lineage anchor; its identity and wording come from the prep-context snapshot. This keeps existing intent/session machinery stable without rewriting historical session content in storage.
