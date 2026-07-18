# Use Case: Candidate Updates a Draft Answer

## Use Case ID
UC-C3

---

## Summary
A candidate updates a draft answer so the system can persist progress incrementally, enable exact resume behavior, and protect candidate work across refreshes, reconnects, and devices.

---

## Primary Actor
Candidate

---

## Secondary Actors
- System (Session Orchestrator / Persistence)
- Client Local Storage (IndexedDB or equivalent)

---

## Preconditions
- A valid session exists and is accessible by the candidate.
- Session status is `IN_SESSION`.
- A current question is presented.
- The active attempt for the question has not been finalized.

---

## Trigger
Candidate enters or modifies draft content for the current question.

---

## Main Success Scenario
1. Candidate types or records draft content for the current question.
2. Client captures draft updates locally to protect against immediate loss.
3. Client periodically submits draft updates to the system with a monotonic revision number.
4. System validates candidate access and session/question eligibility.
5. System persists the draft update for the active attempt.
6. System appends a draft-related event (idempotent).
7. System makes updated draft state available via `/now`.
8. Candidate can refresh or reconnect and continue from the same draft state.

---

## Postconditions
- The latest draft content for the active attempt is persisted server-side.
- Draft revision number reflects the most recent accepted update.
- No session state transition occurs as a result of draft updates.

---

## Alternate / Error Scenarios

### A1 — Network Interruption During Draft Update
**Scenario:** Client loses connectivity mid-draft.  
**System behavior:**
- Local draft is preserved client-side.
- Server-side draft sync resumes once connectivity is restored.
- No draft content is lost.

---

### A2 — Out-of-Order Draft Revisions
**Scenario:** A stale draft update arrives after a newer revision.  
**System behavior:**
- System ignores stale updates based on revision number.
- System preserves the most recent draft state.

---

### A3 — Invalid Session or Attempt State
**Scenario:** Draft update is sent after the attempt has been finalized.  
**System behavior:**
- System rejects the update safely.
- Client is prompted to refresh or retry as appropriate.

---

## System Responsibilities
- Persist draft content incrementally and idempotently.
- Enforce monotonic draft revision semantics.
- Support deterministic resume across refresh and reconnect.
- Avoid triggering evaluation or state transitions on draft updates.

---

## Non-Responsibilities
- The system does not evaluate draft content.
- The system does not infer intent from drafts.
- The system does not expose drafts to recruiters unless explicitly designed.

---

## Relevant Architecture Contracts
- `04-architecture/state-and-streaming-contract.md`
- `04-architecture/api-surface.md`

---

## Notes
- Draft persistence is a core reliability feature and should be treated as a first-class use case.
- Client-side storage is a complement, not a substitute, for server-side persistence.