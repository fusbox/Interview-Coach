# Invited Practice Live Runtime

Status: Implemented and verified in Slice 153
Last updated: 2026-07-20

## Purpose

This contract connects a clean invite-scoped browser session to the shared V2 typed-practice, evaluator, feedback, progress, and completion boundaries. It preserves invited recipient/session ownership without creating a candidate profile or passing the invitation bearer beyond `/s/[token]`.

## Prior Behavior Disposition

| Prior behavior | Disposition | V2 direction |
| --- | --- | --- |
| Recruiter-authored ordered questions drive one invited round | Preserve | Recover the immutable V2 plan and wording snapshots from the invited session envelope. |
| The original link resumes practice | Preserve and harden | Re-exchange the link into a bounded invite cookie and recover the exact question and answer/coaching stage from durable invited state. |
| Every session API receives the invitation token | Retire | All live reads and mutations resolve only the invite cookie and require its exact bound session and recipient. |
| One mutable answer is stored per question | Retire | Drafts remain mutable projections; submissions append immutable answer attempts and feedback retry appends linked attempts. |
| Retry clears or overwrites earlier feedback | Retire | Earlier attempts and evaluator runs remain immutable evidence. The latest accepted attempt drives the live projection. |
| Candidate and invited flows use the same session interaction | Preserve through shared domain code | Reuse the same typed-answer mutation states, evidence-first evaluator runtime, candidate-safe coaching projection, staged feedback, and live shell through audience-specific persistence and route adapters. |

## Ownership And Persistence

`invited_practice_answer_attempts` belongs to one exact `invited_practice_session_id` plus `recruiter_invitation_recipient_id`. `invited_practice_answer_evaluation_runs` belongs to one immutable invited answer attempt. Composite foreign keys prevent cross-recipient or cross-session attachment.

The lifecycle mirrors the ratified candidate-led V2 contract:

1. pre-submission edits update `invited_practice_sessions.answer_drafts_json` only;
2. initial submit appends attempt one;
3. coach-authorized retry appends the next attempt and points to the immediately prior attempt;
4. evaluator retries append leased generations against the same fixed attempt;
5. one accepted candidate-coaching result may project into `answer_analysis_snapshots_json` for each attempt/input fingerprint;
6. `answer_submissions_json`, `answer_analysis_snapshots_json`, `feedback_actions_json`, and `progress_state_json` are latest-state recovery projections, not complete history.

Invited tables deliberately remain separate from candidate-led tables because their principals, authorization proofs, retention policy, and recruiter visibility differ. Shared behavior lives above those adapters rather than through nullable or polymorphic ownership columns.

## Route And Recovery Contract

The browser remains on `/candidate/invited`. Mutation routes are scoped below `/candidate/invited/session/[sessionId]` for progress, drafts, submissions, analysis, feedback actions, and completion. Every route:

- hashes and resolves `ic_invited_access`;
- requires an active browser session and active source invitation;
- requires the route session id to equal the session bound to that invitation;
- ignores candidate-led and recruiter cookies;
- returns no recruiter, recipient, email, token, or token-hash data.

Refresh and a second tab recover the exact durable state:

- `planned` returns to the invited landing after initials have been recorded;
- `live_question` returns to the stored question index;
- a saved draft remains editable;
- an accepted answer remains locked while coaching is pending, retryable, unavailable, or ready;
- a persisted feedback-retry action reopens the latest answer as the next draft without erasing its source attempt;
- `completed` returns a simple invited completion acknowledgement.

## Completion Boundary

Finishing the last question writes an `invited_session_completed` snapshot and terminal progress through the invited session owner. It does not generate a candidate Coach Update, candidate dashboard record, recruiter read model, debrief, rating, practice-again attempt, or email event. Those require separate product and visibility contracts.

## Slice 153 Acceptance

- invited session, attempt, and evaluator ownership is enforced in PostgreSQL;
- draft, submit, evaluator, analysis-recovery, feedback action, progress, and completion routes reject missing, stale, foreign, or mismatched invite sessions;
- concurrent/replayed answer and evaluator work follows the same V2 lifecycle as candidate-led practice;
- the clean invited page enters and recovers the shared live-practice shell without a candidate profile;
- the original invitation link remains the cross-browser return mechanism;
- focused tests and disposable-database smoke prove lineage, immutability, ownership denial, and completion.

## Deferred

- recruiter dashboard and answer-visibility reads;
- invited debrief and optional non-gating experience feedback;
- whole-session practice again and attempt creation;
- token regeneration/revocation UI;
- production TTS, voice, and photo modes;
- retention schedules and production edge-log proof.
