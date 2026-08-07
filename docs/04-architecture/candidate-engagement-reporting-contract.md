# Candidate Engagement Reporting Contract

Status: Ratified implementation contract
Last updated: 2026-08-05

## Purpose

Candidate engagement reporting measures active use of candidate-led V2 practice for internal reporting and BI. It adapts the useful V0.5/V1 windowing behavior to current V2 ownership, privacy, idempotency, and multi-tab boundaries without restoring the legacy mutable session counter.

This contract does not measure answer quality, attention, intent, productivity, or hiring suitability. It does not authorize recruiter access to candidate practice behavior.

## Included Surface

The first implementation covers authenticated or trusted-host candidate-owned `/candidate/session/[sessionId]` practice only.

Recruiter-invited practice, setup, dashboard browsing, job search, resume work, passive reading, cross-product aggregation, and recruiter-facing reporting remain outside this slice. Invited practice requires its own owner-scoped persistence and disclosure decision before instrumentation.

## Adaptive Legacy Windowing

The V2 tracker preserves the more generous legacy posture:

- Tier 1, presence: the page is visible and the tab currently owns the session's local tracking lease. Presence permits accrual but never opens a window by itself.
- Tier 2, interaction: a meaningful practice interaction opens or extends a 30-second window. Examples include typing, navigation, question-audio controls, assistance controls, answer-mode controls, and voice controls.
- Tier 3, task progress: starting practice, submitting or retrying an answer, advancing after feedback, or finishing the round opens or resets a 60-second window.
- Continuous activity: active voice recording keeps a qualifying window open only while recording is actually underway.

The tracker accrues elapsed time only while presence and an open window are both true. It uses a monotonic browser clock for elapsed duration, closes immediately on page hiding, and never counts a suspended/background interval as active time.

One visible browser tab should own accrual for one candidate practice session at a time. Web Locks are the preferred ownership boundary; a bounded local lease is the compatibility fallback. A follower tab may display the session but must not accrue time until it obtains ownership.

## Durable BI Boundary

Durable engagement is an append-only collection of idempotent active-time slices owned by one candidate profile and one candidate practice session. Each slice carries:

- a client-generated slice id;
- a tracker-instance id and monotonically increasing local sequence;
- bounded active milliseconds;
- client interval start/end timestamps;
- allowlisted window-open, latest-activity, and flush reason codes;
- server receipt time.

The server proves candidate/session ownership before inserting. Exact replay is a no-op, changed identity cannot overwrite a slice, and report totals are derived by summing accepted slices. The browser batches approximately every ten active seconds and flushes on window close, visibility loss, session completion, navigation, and unmount where the platform permits. Failed batches remain retryable with the same ids.

The persistence repository must serialize each validated batch as one JSON document before PostgreSQL expands it through `jsonb_to_recordset`. It must not pass the JavaScript slice array through the database driver's native PostgreSQL-array encoder.

The durable ledger must not contain question text, answer or transcript text, resume or job-description content, coaching, assistance output, DOM labels, free-form event details, prompts, model output, IP address, user agent, or hidden evaluation data.

## Development Inspector

Non-production candidate sessions may expose a hidden engagement inspector from an invisible lower-left development target. The inspector may show:

- tracker enabled/disabled and leader/follower state;
- active/idle state and remaining window time;
- local and server-confirmed engaged time;
- pending slice count and persistence status;
- a bounded in-memory event/window transition log.

The detailed event log is never uploaded and is cleared on reload. The inspector has no AI-context, prompt, transcript, answer, or model-inspection affordance.

The tracker and inspector must remain outside the session workspace's render ownership. Sampled input activity may extend the engagement window, but tracker ticks, debug-log updates, persistence status, and inspector interaction must not rerender or replace the controlled answer composer. Interaction capture must remain constant-time and must not synchronously persist, serialize, or upload answer input.

## Administrator Report

`/admin/reports` is a low-lift internal validation surface protected by the active app session and the `admin` role. It may show candidate label, masked email, role, session status, active-time total, slice count, and first/last receipt times. It must not show candidate answers, transcripts, coaching, assistance, evaluator facts, resume/JD content, provider data, or recruiter-invited practice.

The shared `/admin/*` loading boundary appears before role resolution and therefore remains identity-free and data-free. It may preserve only the neutral employee-shell structure and an accessible busy announcement; it must not project an administrator name, report title, candidate fact, count, status, or inferred placeholder value before access and the reporting read both succeed. Reduced-motion preferences disable decorative shimmer without removing the busy announcement.

The report is a disposable first read model, not a commitment to its final BI information architecture. The append-only engagement ledger is the durable contract.

## Privacy And Release Gate

`CANDIDATE_ENGAGEMENT_REPORTING_ENABLED` controls candidate-led collection. Local development defaults enabled so the tracker and report can be validated. Production defaults disabled and must not be enabled until the protected-route behavioral-monitoring disclosure, retention, access-control, and product/legal review requirements are accepted.

Candidate deletion must cascade through engagement slices. A final retention period and aggregate/anonymization policy remain release decisions.

## Acceptance Evidence

- Tier 2 opens and extends 30-second windows; Tier 3 opens 60-second windows.
- Hidden pages, expired windows, and follower tabs do not accrue.
- Elapsed time is monotonic and background gaps are not counted.
- Exact batch replay does not duplicate totals.
- Foreign-owned sessions accept no slices.
- Malformed, oversized, or unknown reason codes fail closed.
- Transient persistence failure retries the same slice ids.
- Typing remains owned only by the answer composer; tracker and inspector updates do not rerender its session-workspace owner.
- The inspector is absent from production output and exposes no AI context.
- `/admin/reports` redirects missing sessions, denies non-admin roles, and reads only allowlisted engagement fields.
