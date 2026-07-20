# Recruiter Invited Transcript Read Contract

Status: Implemented and verified in Slice 155
Last updated: 2026-07-20

## Purpose

This contract defines the smallest employer-facing detail read for a recruiter-owned invited practice session. Its purpose is factual review: the recruiter can see the questions in the invitation and the candidate's latest submitted response to each question. It is not an evaluator, coaching, readiness, engagement, or hiring-decision surface.

## V1 Disposition

V1 artifacts conflict: the implemented session-detail page and `UC-R2` expose exact transcripts, while `UF-R2` says recruiters must not see answers verbatim. The current product decision resolves that conflict in favor of factual question-and-answer transcript visibility for recruiter-invited practice only.

| V1 behavior | Disposition | V2 direction |
| --- | --- | --- |
| Dashboard row opens an owned session detail | Preserve and harden | Use opaque `/recruiter/sessions/[sessionId]` navigation and prove recruiter ownership again on the detail query. |
| Question set and submitted response transcript are shown in order | Preserve | Render the immutable invited question wording and the latest submitted answer attempt for each question slot. |
| A retry replaces the visible response | Reinterpret | Keep all attempts immutable internally, but show only the latest submitted attempt for that question in the recruiter transcript. |
| Unanswered questions are visible as pending | Preserve | Show the question and an explicit `No answer submitted` state. Draft text is never employer-visible. |
| Candidate, role, stage, progress, and whole-session attempt identify the record | Preserve with restraint | Show only the context needed to distinguish the invited session; do not add per-answer attempt counts or timing. |
| Active-engagement and per-question time are shown | Retire from recruiter UI | Reserve engagement instrumentation for authorized enterprise reporting and engineering/QA. |
| Coaching, scores, readiness, or qualitative model judgments are shown | Retire | Recruiter reads select none of this content. Candidate-safe AI coaching remains candidate-only. |
| Resend, delete, practice-again, and export actions live beside review | Defer or retire | Transcript detail is read-only. Delivery, revocation/retention, whole-session practice again, and export require separate command and policy contracts. |

## Visibility Boundary

An authenticated recruiter or admin may read this detail only when the session, recipient, and invitation batch all carry the authenticated recruiter's stable `app_users.user_id`. Knowing a session UUID is not authorization.

The read may return:

- invited candidate name and email supplied by the owning recruiter;
- optional requisition reference;
- target role and interview stage;
- session lifecycle, distinct answered-question progress, and whole-session attempt number;
- the ordered immutable question wording snapshot;
- only the latest submitted answer text for each exact question slot.

The read must not select, return, or render:

- pre-submission drafts;
- superseded answer text or per-question retry counts;
- candidate-safe coaching, feedback actions, debrief content, or Coach Update data;
- evaluator runs, evidence markers, qualitative bands, verifier output, prompts, raw provider output, configuration, latency, token usage, or errors;
- active time, per-question time, dwell time, browser activity, or engagement inference;
- candidate-led profiles, prep contexts, sessions, answers, or dashboard facts;
- invitation tokens, ciphertext, browser-session hashes, cookies, or provider references;
- scores, rankings, readiness, fit, selection, or hiring recommendations.

The invited pre-session disclosure remains the authority for candidate notice: the recruiting team may review submitted answers, while AI coaching is visible only to the candidate and the coach does not score or make hiring decisions.

## Read Semantics

- Submitted answers become visible as the invited round progresses; round completion is not required.
- One question slot contributes at most one visible answer. The highest immutable `attempt_number` is the current submitted transcript.
- Unsubmitted draft text remains private across autosave, refresh, pause, and recovery.
- The recruiter detail is read-only and opening it creates no candidate, invitation, or learning-state mutation.
- Revoked or completed historical sessions may remain readable by their owner unless a future retention policy requires otherwise.
- Malformed question snapshots, answer rows that do not map to the immutable question set, and impossible progress counts fail the page rather than fabricate or silently relabel evidence.
- Missing, stale, foreign-owned, or guessed session ids return the same not-found boundary and reveal no record existence.

## Acceptance Evidence

- the dashboard exposes an accessible `View responses` destination for the exact invited session;
- the owned detail renders questions in snapshot order, latest submitted answers, and explicit unanswered states;
- a feedback retry replaces only the visible transcript while immutable prior attempts remain persisted;
- a second recruiter cannot read the route or repository result for the same session id;
- drafts, coaching, evaluator data, timing/engagement, candidate-led content, and bearer material are absent from the SQL selection and returned model;
- focused tests, the recruiter suite, typecheck/lint, and a rolled-back disposable-database ownership smoke pass are green.

## Deferred

- recruiter download/export and retention rules;
- whole-session practice again and attempt navigation;
- delivery/revoke actions from detail;
- enterprise engagement reporting and engineering/QA diagnostics;
- invited candidate debrief and experience rating;
- TalentArbor recruiter launch and host messaging handback.
