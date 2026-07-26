# Recruiter Dashboard Read Contract

Status: Implemented and verified in Slice 154
Last updated: 2026-07-20

## Purpose

This contract defines the first V2 recruiter-owned dashboard read over invitation, delivery, invited-entry, session, and immutable answer-attempt facts. It is an operational workspace for the recruiter who created the invitation, not a candidate evaluation report and not a bridge into candidate-led practice.

## V1 Disposition

| V1 behavior | Disposition | V2 direction |
| --- | --- | --- |
| Recruiter sees only invitations they own | Preserve and harden | Every selected batch, recipient, session, delivery attempt, entry signal, and progress aggregate is fenced by the authenticated recruiter id. |
| Candidate, role, invitation, progress, initials, and completion status are scan-friendly | Preserve | Derive them from V2 normalized facts rather than mutable legacy session flags. |
| Submitted-question progress is visible | Preserve | Count distinct answered question slots in the current session; answer retries never inflate the count. |
| Session attempt number is retained | Preserve | Carry invited session attempt lineage and show attempts above one without conflating them with per-question answer attempts. |
| `Delivered` means an email provider accepted a message | Reinterpret | Display `Email accepted` and explain that provider acceptance does not prove mailbox delivery. |
| Link viewed and initials match/mismatch are operational signals | Preserve with limits | Distinguish not opened, opened, initials match, and initials mismatch. Initials remain a possible-misinvitation signal, never authentication. |
| Average active time and 48-hour stale buckets drive the dashboard | Retire for this read | V2 has no ratified engagement clock or follow-up policy. Last observed durable activity is shown without inventing active duration or a stale threshold. |
| Recruiter can delete sessions from the dashboard | Retire | Immutable evidence and invitation lineage require a separate revoke/retention contract, not destructive row deletion. |
| Recruiter can resend by mutating one sent flag | Retire | Delivery is an append-on-retry per-recipient lifecycle; delivery actions remain on their explicit command boundary. |
| Session detail exposes candidate response transcript | Preserve through a separate read | The dashboard still selects no answer text. Its opaque session destination opens the separately owner-fenced [Recruiter Invited Transcript Read Contract](./recruiter-invited-transcript-read-contract.md). |
| Scores or legacy feedback summarize candidate quality | Retire | No score, readiness, hiring recommendation, or model-derived candidate ranking enters the recruiter read. |

## Employer Visibility Boundary

The authenticated recruiter may read operational facts for invitation aggregates they own:

- candidate name and email supplied by that recruiter;
- optional requisition reference;
- target role, interview stage, batch creation time, and invited session attempt number;
- email delivery lifecycle and attempt number, without provider credentials or exception detail;
- link-open and immutable initials match/mismatch state;
- invited session lifecycle, total planned questions, distinct answered-question count, completion time, and last observed durable activity.

This slice does not authorize recruiter access to:

- candidate-led profiles, setup, sessions, answers, Coach Updates, or dashboard facts;
- invited answer text, drafts, candidate-safe coaching prose, feedback-action history, or debrief content;
- evaluator extraction, criteria, pattern gaps, verifier facts, hidden plans, prompts, raw output, configuration manifests, fingerprints, errors, latency, or token usage;
- invitation bearer hashes/ciphertext, browser-session hashes, cookies, provider references, or recipient access secrets;
- score-like, hiring, selection, readiness, or candidate-ranking claims.

The separately owner-fenced invited-session detail may expose the immutable question set and latest submitted answer text under the [Recruiter Invited Transcript Read Contract](./recruiter-invited-transcript-read-contract.md). It still exposes no drafts, superseded retries, coaching, evaluator content, timing/engagement, or candidate-led content.

## Read Model

One `recruiter_dashboard_recipient` represents the newest invited session attempt for one recruiter-owned invitation recipient. It carries:

- batch, recipient, and session ids for server-side navigation and lineage;
- candidate display identity, role/stage, requisition reference, and creation time;
- active/revoked invitation state;
- email state: `not_requested`, `queued`, `sending`, `provider_accepted`, `failed_retryable`, `failed_terminal`, or `outcome_unknown`;
- entry state: `not_opened`, `opened`, `initials_match`, or `initials_mismatch`;
- practice state: `not_started`, `in_progress`, `completed`, `abandoned`, or `revoked`;
- question count, distinct answered-question count, session attempt number, completed time, and last observed activity.

The dashboard summary is derived in application code from those owned rows:

- total invitations;
- not started;
- in practice;
- completed;
- needs attention, limited to initials mismatch, failed delivery, or unknown delivery outcome.

`not_requested` is not automatically an error because copy-link handoff is an approved delivery fallback. Revoked/abandoned rows remain historically visible but do not masquerade as active work.

## Query And Failure Contract

- The repository accepts one authenticated recruiter id and scopes every ownership-bearing join to it.
- It selects the newest invited session attempt per recipient and the newest delivery attempt per recipient.
- It may join access-token identity only to derive whether an invite-scoped browser session was created; token material is never selected or returned.
- Answer attempts are aggregated only as distinct answered question slots plus latest submission time. Answer text is never selected.
- Evaluator tables are not joined.
- The page is dynamic and `no-store` by construction. Missing app authentication redirects to login; a logged-in non-recruiter receives the existing access-denied surface.
- Database failure must fail the page rather than display fabricated zero states.

## Slice 154 Acceptance

- one recruiter sees all and only their invitation recipients;
- a foreign recruiter receives no rows even when they know batch, recipient, or session ids;
- email, entry, practice, progress, attempt, completion, and attention states map truthfully from durable V2 facts;
- answer retries do not inflate answered-question counts;
- the SQL and returned model exclude answer/coaching/evaluator/token content;
- empty and populated dashboards are responsive and expose precise provider-acceptance language;
- focused tests, the recruiter suite, typecheck, lint, and an ownership database smoke pass are green.

The disposable-database smoke is `npm run db:smoke-recruiter-dashboard`. It creates two temporary recruiter identities inside a rolled-back transaction and proves owner-only visibility, newest-session selection, distinct-question counting under a feedback retry, and exclusion of planted answer/token material.

## Deferred

- invited coaching and recruiter debrief;
- whole-session practice again and attempt actions;
- resend/revoke controls on the dashboard;
- search, filtering, stale thresholds, and saved recruiter views;
- engagement-time instrumentation and enterprise BI projections;
- recruiter settings, TA recruiter launch, and host messaging handback.
