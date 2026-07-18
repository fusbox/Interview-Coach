> **Stability:** Locked for V1. Changes that alter system meaning, authority boundaries,
> privacy posture, or resume guarantees require a Gate Decision update.

# State & Streaming Contract (Architecture)

## Purpose
Define the system contract that ensures:
- Server is the source of truth for session state and outcomes
- Client delivers a fast, mobile-first experience with offline tolerance
- Streaming feedback and background AI work are consistent and resumable
- Derived outputs (readiness, summaries, dashboards) are reproducible from stored facts

This contract is stack-agnostic but intended for a React/TS client with a server-orchestrated backend.

---

## Core Principles
- **Facts > Conclusions:** Persist user actions and model outputs as events. Compute summaries as projections.
- **Server Truth:** Anything that affects cross-device continuity, security, or interpretation is server-owned.
- **Client UX State:** Presentation state may be client-owned unless explicitly required cross-device.
- **Idempotency:** All writes must be safe to retry.
- **Streaming is a Transport, not Logic:** Streaming delivers progress/results; it does not define state.

---

## Actors & Roles
- Candidate (unauthenticated or magic-link access)
- Recruiter (authenticated)
- System services:
  - Session Orchestrator
  - AI Generation/Evaluation Service
  - Storage (Postgres/Supabase)
  - Streaming Channel (SSE initially)

---

## Entities (Canonical Data Objects)

### Session
- session_id
- candidate_access_token_id (if magic-link model)
- recruiter_id (owner)
- role_context (target role, optional job description)
- intake_context (stage, confidence, goals, struggles, etc.)
- created_at, updated_at
- status (see State Machine)
- current_question_index
- last_checkpoint_event_id

### Question
- question_id
- session_id
- question_index
- question_text
- competencies[] (ids/names)
- scoring_dimensions[] (ids/names)
- tts_asset_ref (optional)
- created_at

### Answer
- answer_id
- session_id
- question_id
- modality (text|voice)
- transcript_text
- audio_ref (optional; prefer ephemeral)
- draft_state (server-side draft snapshot, optional)
- submitted_at

### EvaluationResult (Model Output)
- eval_id
- session_id
- question_id
- rubric_scores (if stored, keep internal; never exposed as “score”)
- feedback_json (schema-validated)
- model_metadata (model name/version, run_id, timing)
- created_at

### SessionSummary (Derived Projection)
- session_id
- readiness_level (RL1–RL4)
- label (Ready | Strong Potential | More Practice Recommended | Incomplete)
- descriptors[] (2–3 short)
- narrative_summary (optional)
- generated_at
- source_event_range (from_event_id..to_event_id)

---

## Event Log (Source of Truth)

### Event Envelope (minimum fields)
- event_id
- session_id
- actor_type (candidate|recruiter|system)
- event_type
- event_version
- payload (json)
- occurred_at
- idempotency_key
- correlation_id (ties streaming + async jobs)
- schema_hash (optional)

### Event Types (initial set)
#### Session lifecycle
- SESSION_CREATED
- SESSION_STARTED
- SESSION_RESUMED
- SESSION_COMPLETED

#### Question lifecycle
- QUESTIONS_REQUESTED
- QUESTIONS_GENERATED
- QUESTION_PRESENTED

#### Answer lifecycle
- ANSWER_DRAFT_UPDATED
- ANSWER_SUBMITTED
- ANSWER_RETRY_REQUESTED

#### Evaluation lifecycle
- EVAL_REQUESTED
- EVAL_IN_PROGRESS
- EVAL_COMPLETED
- EVAL_FAILED

#### Coaching/UX lifecycle (optional)
- TIPS_REQUESTED
- TIPS_READY
- UI_STATE_UPDATED (only if cross-device UX persistence is required)

---

## State Machine (Server-Owned)

### States
- NOT_STARTED
- GENERATING_QUESTIONS
- IN_SESSION
- AWAITING_EVALUATION
- COMPLETED
- ERROR

### Allowed Transitions (high level)
- NOT_STARTED -> GENERATING_QUESTIONS (on SESSION_STARTED)
- GENERATING_QUESTIONS -> IN_SESSION (on QUESTIONS_GENERATED + QUESTION_PRESENTED)
- IN_SESSION -> AWAITING_EVALUATION (on ANSWER_SUBMITTED when eval required)
- AWAITING_EVALUATION -> IN_SESSION (on EVAL_COMPLETED and next QUESTION_PRESENTED)
- IN_SESSION -> COMPLETED (on SESSION_COMPLETED)
- Any -> ERROR (on unrecoverable failure)
- ERROR -> prior state (only via explicit recovery policy)

### Transition Guards (examples)
- Cannot submit answer for a question not presented
- Cannot overwrite a submitted answer without ANSWER_RETRY_REQUESTED
- Cannot compute session summary unless minimum completion criteria met

---

## Draft Persistence (Progressive Save)

### Local Draft (Client-owned)
- Storage: IndexedDB preferred (localStorage acceptable for small payloads)
- Trigger: every keystroke / audio transcript chunk
- Scope: per-session + per-question

### Server Draft (Server-owned)
- Trigger: debounced sync (e.g., 1–2s) when online
- Write pattern: upsert `ANSWER_DRAFT_UPDATED` with idempotency key
- Read pattern: hydrate draft on load/resume

### Offline Behavior
- Client continues local draft
- On reconnect: replay draft updates or submit final snapshot with a new idempotency key

---

## Streaming Contract (SSE First)

### Channel
- SSE endpoint scoped to session_id and authenticated appropriately:
  - Candidate token for candidate stream
  - Recruiter auth for recruiter stream

### Message Envelope
- type (status|partial|final|error)
- correlation_id
- session_id
- question_id (optional)
- payload (json)
- sent_at

### Message Types (examples)
- STATUS: "generating_questions", "tts_ready", "eval_in_progress"
- PARTIAL: token chunks for narrative feedback (if enabled)
- FINAL: validated evaluation result available
- ERROR: recoverable/unrecoverable signals + next step guidance

### Streaming Rules
- Streaming does not mutate state directly
- State changes are committed via events; streams merely notify

---

## Security & Privacy Constraints
- Candidate access via unguessable token; token maps to one session
- No cross-candidate comparisons in UI or API
- Audio storage policy (prefer discard after transcription; store only if explicitly required)
- PII minimization in logs/events
- RLS enforcement for Supabase tables where applicable
- Recruiter interpretation boundary: system does not rank or recommend hiring decisions

---

## Projections (Derived Views)

### Session “Now” View (for resume)
Computed from events:
- current state
- current question
- draft text (latest)
- submitted answers
- eval status per question
- tips status

### Recruiter Summary View
Computed from stored facts + validated model outputs:
- readiness_level RL1–RL4
- descriptors
- narrative summary (optional)
- completion timestamp + provenance

### Engagement Analytics (internal)
Derived from events, with anti-gaming rules applied server-side.

---

## Idempotency & Retry Policy
- All write endpoints accept idempotency_key
- Event creation is idempotent per (session_id, event_type, idempotency_key)
- Eval requests are idempotent per (session_id, question_id, attempt_number)
- Client may retry safely on network failure

---

## Observability Requirements
Minimum metrics:
- time_to_first_question
- ai_eval_latency
- tts_latency
- draft_sync_failures
- resume_success_rate
- completion_rate
- readiness_distribution (RL1–RL4) over time

Minimum logs:
- correlation_id linking user actions to model calls and SSE messages
- error codes with remediation hints

---

## Non-Goals (V1)
- WebSocket-based collaboration
- Cross-candidate ranking or sorting by readiness
- Export of raw transcripts outside governed views
- On-device-only evaluation
