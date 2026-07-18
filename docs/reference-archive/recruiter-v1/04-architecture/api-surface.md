> **Stability:** Current implementation contract for the live recruiter-led app.
> Update this document when the shipped route surface changes. Do not use it to describe target-state architecture that is not implemented.

# API Surface (Current Implementation)

## Purpose

This document defines the public and semi-public route surface that the current Next.js application actually uses today.

It exists to:
- make current client/server boundaries explicit
- reduce confusion between live implementation and future architecture ideas
- give new development a trustworthy baseline

---

## Design Principles

- Routes reflect current system actions and state transitions
- Candidate-scoped mutations are protected by candidate-token validation
- Recruiter-only actions stay behind authenticated recruiter context
- The server owns authoritative session state
- The client renders from fetched session state and derived selectors

---

## Candidate-Facing Surface

### Entry

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/s/[token]` | Candidate entry route via invite token |

Notes:
- The invite token is used to bootstrap the session experience.
- Screen progression after entry is state-driven, not URL-driven.

### Session bootstrap and lifecycle

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/session/start` | Start a session or create a practice-again clone |
| GET | `/api/session/[session_id]` | Fetch authoritative session state |
| PATCH | `/api/session/[session_id]` | Update session-level state such as completion or metadata |

Notes:
- `POST /api/session/start` returns the session plus the current candidate token header for the active session context.
- `GET /api/session/[session_id]` is the live hydration/resume route.

### Question and answer interaction

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/session/[session_id]/questions/[question_id]/answer` | Persist draft / in-progress answer content |
| POST | `/api/session/[session_id]/questions/[question_id]/submit` | Submit final answer for evaluation |
| POST | `/api/session/[session_id]/questions/[question_id]/analysis` | Generate or retrieve structured feedback analysis |
| POST | `/api/session/[session_id]/questions/[question_id]/retry` | Reset the current question into a retry state |

### Candidate assist routes

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/tips/generate` | Generate hint/help content |
| POST | `/api/response/generate` | Generate strong-response assistance |
| POST | `/api/tts` | Generate text-to-speech assets for the candidate experience |

---

## Recruiter-Facing Surface

### Authenticated recruiter portal

The recruiter portal is primarily implemented through authenticated Next.js routes and server-side actions rather than a fully separate public REST surface.

Primary recruiter routes:
- `/login`
- `/recruiter`
- `/recruiter/create`
- `/recruiter/sessions/[session_id]`

### Recruiter APIs currently used

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/recruiter/invites` | Create invite batches |
| POST | `/api/recruiter/invites/[batch_id]/retry` | Retry failed invite sends for a batch |
| POST | `/api/invite/resend` | Resend an invite |
| GET | `/api/recruiter/ops/metrics` | Retrieve recruiter operations metrics |
| POST | `/api/recruiter/ops/metrics` | Trigger or test metrics/alerts workflow path |

Notes:
- Recruiter list/detail data may also come from server-side page actions instead of public fetch routes.
- Current recruiter scope is operational tracking and evidence review, not recruiter-facing readiness interpretation.

---

## Access and Authorization Rules

- Candidate session routes require a valid candidate token mapped to the requested session
- Recruiter mutation routes require authenticated recruiter context
- No candidate route should be able to cross session boundaries
- No recruiter route should expose candidate-only coaching feedback

---

## Explicit Non-Goals For This Document

This document does not:
- define future event-log or SSE transport ambitions
- promise routes that are not implemented
- describe request/response schemas in detail
- replace route-level tests or domain schemas

Future-state ideas belong in separate target-state docs, not in the live API contract.
