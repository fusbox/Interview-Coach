# Use Case: Recruiter Views a List of Interview Sessions

## Use Case ID
UC-R3

---

## Summary
A recruiter views a list of interview sessions so they can track candidate progress, identify sessions ready for review or follow-up, and navigate efficiently to individual session details.

---

## Primary Actor
Recruiter

---

## Secondary Actors
- System (Query / Projection Layer)

---

## Preconditions
- Recruiter is authenticated.
- Recruiter is authorized to view sessions within their scope (ownership, assignment, or role-based access).
- One or more sessions exist within the recruiter’s accessible scope.

---

## Trigger
Recruiter navigates to the interview sessions list view.

---

## Main Success Scenario
1. Recruiter requests a list of interview sessions.
2. System validates recruiter authorization and access scope.
3. System returns a recruiter-facing list projection containing session metadata, such as:
   - candidate identifier or alias (per privacy policy)
   - target role
   - session status (e.g., not started, in progress, awaiting eval, completed)
   - last activity timestamp
   - readiness band or summary signal (if available and permitted)
4. Recruiter scans, sorts, or filters the list to locate sessions of interest.
5. Recruiter selects a specific session to review in detail (transition to UC-5).

---

## Postconditions
- Recruiter has visibility into relevant sessions without mutating system state.
- Any session selected reflects persisted, up-to-date information.

---

## Alternate / Error Scenarios

### A1 — No Sessions Available
**Scenario:** Recruiter has no sessions within their scope.  
**System behavior:**
- System returns an empty list with a clear, non-alarming message.
- No error state is implied.

---

### A2 — Partial Data Availability
**Scenario:** Some sessions have incomplete data (e.g., eval pending).  
**System behavior:**
- System displays available metadata and clearly indicates incomplete or pending states.
- System does not fabricate summaries.

---

### A3 — Authorization Boundary Change
**Scenario:** Recruiter loses access to a previously visible session.  
**System behavior:**
- System removes the session from the list.
- System avoids leaking historical or cached data beyond authorization.

---

## System Responsibilities
- Enforce recruiter authorization and scope.
- Provide an efficient, read-only projection suitable for list rendering.
- Support sorting and filtering based on allowed metadata.
- Avoid triggering any content regeneration or evaluation.

---

## Non-Responsibilities
- The system does not rank sessions by candidate quality.
- The system does not infer recruiter intent from list interactions.
- The system does not mutate session state during list viewing.

---

## Relevant Architecture Contracts
- `04-architecture/api-surface.md`
- `04-architecture/state-and-streaming-contract.md`
- `04-architecture/stability-and-change-policy.md`

---

## Notes
- List projections should be derived from persisted facts and validated outputs only.
- Performance optimizations (pagination, caching) must not compromise correctness or authorization guarantees.