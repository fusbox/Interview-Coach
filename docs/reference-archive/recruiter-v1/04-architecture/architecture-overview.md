# Architecture Overview

## Purpose

This document provides a high-level overview of the system architecture for the
Interview Coach application.

It is intended to:
- Explain how major system components interact
- Clarify responsibility boundaries between client, server, and AI services
- Support architectural decision-making and onboarding
- Complement (not duplicate) detailed contracts and gate decisions

This overview is descriptive, not prescriptive. Detailed rules and invariants
are defined in supporting architecture documents.

---

## Architectural Goals

The system is designed to support:

- A **highly interactive, mobile-first candidate experience**
- **Low perceived latency** during AI-driven workflows
- **Exact session resume** across refreshes and devices
- **Server-owned truth** for security, privacy, and determinism
- **Clear separation** between facts, interpretation, and presentation
- Incremental extensibility toward multimodal and streaming experiences

---

## High-Level System Components

### Client Application (Next.js, React/TypeScript)

The client application is responsible for:
- Rendering the candidate and recruiter user interfaces
- Managing ephemeral UI state (focused panels, playback state, layout)
- Maintaining local drafts for offline tolerance
- Synchronizing drafts and user actions with the server
- Subscribing to server-sent events (SSE) for status and streaming updates

The client **does not**:
- Compute readiness or session outcomes
- Orchestrate AI workflows
- Act as the source of truth for session state

---

### API & Orchestration Layer

The API layer acts as the system conductor. It is responsible for:
- Enforcing authentication and access controls
- Managing the session state machine
- Appending events to the event log
- Invoking AI generation and evaluation services
- Computing derived projections for UI consumption

This layer ensures:
- Idempotent writes
- Deterministic outcomes
- Clear ownership of business logic

---

### Storage Layer (Postgres / Supabase)

Persistent storage supports:
- Canonical entities (sessions, questions, answers)
- An append-only event log (system source of truth)
- Model outputs and metadata
- Derived projections (session “now” view, summaries)

Row Level Security (RLS) is used to enforce:
- Candidate access scoped to a single session
- Recruiter access scoped to owned sessions
- Separation of internal analytics from user-facing views

---

### AI Services

AI services are invoked by the orchestration layer to:
- Generate interview questions
- Produce coaching tips and guidance
- Evaluate responses against competency frameworks

All AI outputs:
- Are schema-validated before persistence
- Are treated as facts (model outputs), not conclusions
- Include metadata sufficient for audit and reproducibility

---

### Streaming Layer (Server-Sent Events)

Server-Sent Events (SSE) provide:
- Real-time status updates (e.g., “generating questions”, “evaluation in progress”)
- Optional progressive delivery of AI-generated content

Streaming is a **transport mechanism only**:
- It does not mutate system state
- All authoritative state changes are persisted as events

---

## Core Data Flow (Narrative)

1. A candidate accesses a session via an invite link.
2. The server resolves the session and returns an initial shell.
3. The client hydrates from a server-provided session projection.
4. User actions (draft updates, submissions) are appended as events.
5. AI workflows are triggered by server-side orchestration.
6. Status and results are streamed to the client via SSE.
7. The client re-renders using server-derived projections.
8. Session completion produces a deterministic summary for recruiter review.

At every step, the server remains the source of truth.

---

## Responsibility Boundaries

| Concern                    | Owner        |
|----------------------------|--------------|
| Session state machine      | Server       |
| Readiness determination    | Server       |
| AI workflow orchestration  | Server       |
| Draft UX and offline cache | Client       |
| UI layout and interaction  | Client       |
| Privacy and access control | Server       |

---

## Related Architecture Documents

This overview is complemented by:
- **State & Streaming Contract** — formal state machine, events, and streaming rules
- **Gate Decisions** — recorded design decisions and trust constraints
- **Dashboard Constitution** — rules governing recruiter-facing interpretation
- **Engagement Tracking Model** — internal analytics semantics and safeguards

---

## Non-Goals

This document intentionally does not:
- Define database schemas in detail
- Specify UI layout or component structure
- Describe infrastructure provisioning or CI/CD
- Lock implementation to specific vendors

Those concerns are addressed elsewhere or intentionally left flexible.
