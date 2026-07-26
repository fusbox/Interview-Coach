# Invited Practice Completion And Repeat

Status: Ratified for Slice 158
Last updated: 2026-07-20

## Purpose

This contract defines what an invited candidate can recover after completing a recruiter-authored round and how whole-round practice again creates a new immutable attempt. It extends the clean invite access and shared live-runtime contracts without creating a candidate profile or broadening recruiter visibility.

## Prior Behavior Disposition

| Prior behavior | Disposition | V2 direction |
| --- | --- | --- |
| A completed invited round ends on a candidate debrief | Preserve | Recover a useful candidate-only debrief from the completed attempt's persisted answers and accepted candidate-safe coaching. |
| Practice again repeats the complete recruiter-authored question set | Preserve | Create a new invited session attempt from the same immutable setup, plan, and wording snapshots. |
| A repeated round clears the prior session and answers | Retire | Preserve every session attempt, answer attempt, evaluator run, and completion snapshot. |
| Repeated questions receive new unrelated question identities | Retire | Reuse the immutable recruiter-owned question-slot identities so progress and attempt lineage remain comparable. |
| The browser navigates through a newly exposed invitation token | Retire | Rotate the clean invite browser session server-side and remain on `/candidate/invited`. |
| The original invitation link can be used again | Preserve and harden | The bearer proves access to one invitation recipient lineage and resolves its latest session attempt, while remaining fenced to the original recruiter-owned recipient and question set. |
| Initials are entered again for every session attempt | Retire | Initials remain one lightweight invitation-entry signal. They are not authentication and are not repeated within the same recipient lineage. |
| A generated free-form summary is required before completion can recover | Retire | Debrief recovery never waits on or invents a second model output. It renders only durable candidate-safe question, answer, and coaching projections already created during practice. |

## Access And Ownership Meaning

An active invitation bearer belongs to exactly one `recruiter_invitation_recipient_id`. Its original access-token row remains immutable and continues to identify the invitation recipient. Access resolution selects the recipient's highest `attempt_number` session under the same recruiter and recipient ownership fence.

This is a deliberate refinement of the earlier exact-attempt access rule:

- the bearer never crosses recipient, recruiter, batch, or question-set ownership;
- the initial session remains the source invitation identity and is never mutated;
- each later session is linked to its immediate predecessor and carries the same immutable setup, plan, and wording snapshots;
- live mutation routes still require the route session id to equal the latest session resolved from the clean browser context.

The immutable initials signal remains attached to the original invitation-entry session. Access projections reuse that recipient-scoped signal for later attempts rather than manufacturing a new initials event.

## Debrief Contract

A completed attempt recovers:

- role, stage, question count, and session attempt number;
- ordered recruiter-authored questions;
- the latest submitted answer for each question in that attempt;
- accepted candidate-safe coaching already projected for that answer;
- truthful answered and coached coverage from the completion snapshot.

The debrief must not expose evaluator internals, evidence spans, provider metadata, configuration identity, recruiter notes, superseded answer attempts, engagement timing, or any candidate-led prep data. A question without accepted coaching remains a saved answer without fabricated feedback.

The debrief is read-only. Refresh, a new tab, and reopening the original invitation link recover the same latest completed attempt until practice again creates a later attempt.

The completion surface may offer **Practice again** and tells the candidate they can close the window when finished. It does not render a script-driven close control: browsers generally permit `window.close()` only for windows opened by script, so presenting it as a dependable app action would be false.

## Practice-Again Transition

Practice again is valid only when the latest owned invited session is `completed`. One operation:

1. resolves the active clean browser session and its original active invitation token;
2. locks the invitation recipient lineage;
3. selects the highest attempt number;
4. returns its existing direct child if one already exists, otherwise inserts one new `planned` session;
5. copies the parent's immutable setup, plan, and wording snapshots exactly;
6. initializes empty progress, drafts, submissions, analysis, feedback, and completion projections;
7. creates a fresh invite browser session against the same active invitation token;
8. returns the new session id and clean-cookie material.

`parent_invited_practice_session_id` is unique for repeated sessions. That natural operation identity makes a double-click, concurrent tabs, and response-lost retry converge on exactly one child attempt without accepting a caller-selected attempt number or question set. The prior bounded browser session is not synchronously revoked: a lost response must be able to retry, and reopening the reusable invitation already permits multiple bounded browser sessions. All active browser sessions resolve the same latest recipient attempt and expire no later than the source invitation token.

The new attempt starts at the invited landing, then uses the existing `Entering practice space` transition before live question one. It does not repeat the initials screen. Completing an invited round uses a brief `Preparing your summary` transition before the candidate-only review; `debrief` remains an internal contract term rather than candidate-facing copy.

## Failure And Replay

- Missing, expired, revoked, foreign, or malformed invite access returns the generic unavailable boundary.
- Practice-again accepts the same browser-facing origin rules as initials submission; an internal development bind address cannot invalidate a request carrying the real direct or forwarded host.
- An incomplete or abandoned latest session cannot create a repeat attempt.
- A stale completed tab returns the already-created direct child when the lineage has advanced exactly once.
- A stale ancestor cannot fork a second lineage; latest-session ownership and the unique-parent constraint fail closed.
- If browser-session rotation cannot complete, no partially created child attempt is committed.
- Earlier completion/debrief state remains recoverable from durable history even after a later attempt exists, but the original invite URL intentionally opens the latest attempt.

## Out Of Scope

- candidate-led cherry-pick or queue practice;
- recruiter settings, token regeneration, or invitation revocation UI;
- new debrief-generation model calls or email delivery;
- recruiter access to candidate coaching or evaluator output;
- attempt-trend visualization and enterprise BI;
- host-platform launch integration;
- voice, photo, or production TTS behavior.

## Slice 158 Acceptance

- completion refresh/new-tab/original-link recovery renders the latest completed attempt and candidate-safe debrief;
- practice again creates exactly one child session under replay and concurrency;
- the child reuses exact recruiter-owned question-slot, plan, and wording snapshots;
- every prior session, answer attempt, evaluator run, and completion snapshot remains unchanged;
- a fresh clean browser cookie resolves the child while a response-lost prior cookie can replay safely;
- the original invitation bearer resolves the latest attempt without crossing recipient ownership;
- the child enters through invited landing and transition before live practice;
- focused tests and disposable-database smoke prove ownership, replay, immutability, and access rotation.
