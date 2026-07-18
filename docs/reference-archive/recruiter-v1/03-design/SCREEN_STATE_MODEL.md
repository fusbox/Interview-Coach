# SCREEN_STATE_MODEL.md

Purpose: Define the canonical state model that selects Screens without using URL shape. This makes refresh/resume deterministic and keeps routing boring (a compliment).

---

## Core idea

Screens are selected from **derived session state** (“now”), not from routes.

- Routes identify *which session* (invite_token)
- State identifies *where the user is in that session*

---

## State layers (three levels)

### 1) Domain state (source of truth)
The persisted session record(s), typically including:
- session identifiers (invite/session ids)
- question set snapshot
- attempts / answers (draft + submitted)
- evaluation results (per attempt)
- retry/attempt counts
- engagement tracking (time tracking entries)
- candidate identity signals (candidate_entered_initials, etc.)

This layer should be serializable and rehydratable.

---

### 2) Derived “Now” state (what UI actually runs on)
A computed projection of domain state used solely for rendering decisions.

Example fields (illustrative):
- `now.isLoaded`
- `now.requiresInitials`
- `now.hasEnteredInitials`
- `now.hasStartedSession`
- `now.status` (high-level lifecycle)
- `now.screen` (explicit screen id)
- `now.activeQuestionIndex`
- `now.activeQuestionId`
- `now.activeAttemptNumber`
- `now.canRetry`
- `now.isAwaitingEval`
- `now.hasFeedbackForActiveAttempt`
- `now.isComplete`

This is produced by selectors, not stored.

---

### 3) ScreenId (final rendering decision)
A stable set of Screen identifiers that map to actual components.

Example (candidate flow):
- `INITIALS`
- `LANDING`
- `ACTIVE_QUESTION`
- `PENDING_EVAL`
- `REVIEW_FEEDBACK`
- `SUMMARY`
- `ERROR` (optional)

---

## Canonical enums

### SessionStatus (high-level lifecycle)
This captures “what phase are we in.”

Recommended (v1):
- `BOOTSTRAPPING`  (loading/rehydrating)
- `IN_PROGRESS`    (candidate actively answering)
- `AWAITING_EVAL`  (submitted; waiting for eval)
- `REVIEWING`      (feedback available to view)
- `COMPLETED`      (session completed)
- `ERROR`          (fatal state)

Notes:
- The exact labels may match your existing `status.ts` / `now.types.ts`.
- Keep this enum stable—Screens should not explode combinatorially.

---

### ScreenId (render targets)
Recommended (v1):
- `INITIALS`
- `LANDING`
- `ACTIVE_QUESTION`
- `PENDING_EVAL`
- `REVIEW_FEEDBACK`
- `SUMMARY`
- `ERROR`

Rule:
- ScreenId is for rendering only; do not encode business logic in Screen components.

---

## Screen selection: deterministic mapping

Screen selection must be:
- deterministic (same state → same screen)
- total (covers all states)
- prioritized (guards come first)

### Priority order (guards first)

1) Not loaded / bootstrapping  
2) Error state  
3) Requires initials  
4) Not started (landing)  
5) Awaiting evaluation  
6) Feedback ready / reviewing  
7) In progress (active question)  
8) Completed (summary)

---

## Recommended selection logic (pseudocode)

Given `now`:

1) If `now.isLoaded === false`  
   -> ScreenId = `PENDING_EVAL` (or `LOADING` if you prefer a separate screen)

2) If `now.status === ERROR`  
   -> ScreenId = `ERROR`

3) If `now.requiresInitials === true && now.hasEnteredInitials === false`  
   -> ScreenId = `INITIALS`

4) If `now.hasStartedSession === false`  
   -> ScreenId = `LANDING`

5) If `now.isAwaitingEval === true`  
   -> ScreenId = `PENDING_EVAL`

6) If `now.hasFeedbackForActiveAttempt === true && now.status === REVIEWING`  
   -> ScreenId = `REVIEW_FEEDBACK`

7) If `now.status === IN_PROGRESS`  
   -> ScreenId = `ACTIVE_QUESTION`

8) If `now.status === COMPLETED`  
   -> ScreenId = `SUMMARY`

Else  
   -> ScreenId = `ERROR` (fail closed)

---

## Refresh & resume invariant

Invariant:
- Opening the invite link again should restore the candidate to the correct UI state.

Mechanism:
- Domain state rehydrates from persistence
- Selectors derive `now`
- Screen selection picks ScreenId
- The candidate lands exactly where they left off (draft, pending eval, feedback, etc.)

No URL-based progress reconstruction is allowed.

---

## Candidate initials gating

### Inputs
- `candidate_expected_first_initial`
- `candidate_expected_last_initial`
- `candidate_entered_initials` (required, persisted once per invite)

### Rules
- Prompt for initials once per invite session until captured.
- Once captured, never reprompt.
- Recruiter view displays:
  - `candidate_expected_initials` (derived from recruiter entry)
  - `candidate_entered_initials`
  - match badge: green if match, red if mismatch

Candidate sees:
- only the initials prompt (no mismatch warnings)

---

## Retry model: state expectations

Retries are per-question and history-preserving.

Minimum derived fields needed:
- `now.activeAttemptNumber`
- `now.retryCountForActiveQuestion`
- `now.canRetry` (policy-derived)
- `now.hasFeedbackForActiveAttempt`

Rules:
- Retry is offered only after feedback is shown (post-eval).
- Retry creates a new attempt; prior attempts remain read-only.
- Retry does not mutate question content.

(See Retry Policy doc for details; this model just needs the fields.)

---

## Attempt + evaluation state expectations

Each question has attempts:
- attempt `n` has:
  - draft text (optional)
  - submitted text (required for eval)
  - evaluation status: `NOT_SUBMITTED | QUEUED | COMPLETE | FAILED`
  - feedback payload (if complete)

Derived fields:
- `now.isAwaitingEval` is true when the active attempt is submitted and eval not complete.
- `now.hasFeedbackForActiveAttempt` is true when eval complete and feedback available.

---

## Analytics rollups dependency (minimal)

For screen selection, analytics are irrelevant.

But the domain model should still support:
- engagement tracking events / entries
- total session engagement time rollup (derived)

The UI may show “time spent” on Summary later, but it should not influence screen selection.

---

## Non-goals (explicit)

- The URL does not encode question index, attempt number, or screen.
- Screens do not perform redirects to “advance” the flow.
- Router state is not a source of truth.

---

## Acceptance criteria

This model is implemented when:

- Screen selection is a pure function of derived `now`
- Refresh/reopen always restores correct UI state
- No Screen imports router libraries
- Progression does not change URL
- Retry/pending eval/review states are deterministic and testable

---
