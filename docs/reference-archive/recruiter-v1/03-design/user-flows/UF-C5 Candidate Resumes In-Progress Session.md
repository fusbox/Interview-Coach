# User Flow: UF-C5 — Candidate Resumes In-Progress Session (Snapshot-Driven)

*(resume is pure rehydration via `/now`)*

---

## Summary

A candidate reopens an invite link or refreshes the page. The system enforces the initials gate if required and resumes the session at the exact prior state using the authoritative `/now` projection.

---

## Primary Actor

* Candidate

---

## Preconditions

* A valid invite token exists.
* The invite references a session bound to a QuestionSetSnapshot.

---

## Main Flow

### **Entry Condition:** Candidate opens invite link or refreshes

> /s/{invite_token}

---

### **System Action:** Resolve invite token

* Resolve `invite_id + session_id`
* Load associated `question_set_id + version`

---

### **Decision:** Has candidate already entered initials?

* If **no**, show Initials Entry
* If **yes**, continue to Resume Logic

---

### **Screen:** Initials Entry (only if missing)

* Same behavior as UF-C1

---

### **Action:** Candidate submits initials

> /api/invites/{invite_id}/initials

---

### **System Action:** Persist initials

* Store `candidate_entered_initials`

---

### **System Action:** Fetch session state

> /api/session/{session_id}/now

---

## Resume Branches (Authoritative)

### **State:** NOT_STARTED

* Show Interview Landing
* Follow UF-C1 session start flow

---

### **State:** IN_SESSION (answer in progress)

* Show current question `Qn — Category`
* Restore draft answer
* Autosave enabled

---

### **State:** AWAITING_EVAL

* Show submitted answer (read-only)
* Indicate evaluation in progress

---

### **State:** FEEDBACK_AVAILABLE

* Render feedback for the specific question
* Offer continue or retry per policy

---

### **State:** COMPLETED

* Show session summary (read-only)

---

## Postconditions

* Session state is unchanged by resume
* No new attempts or questions are created

---

## Invariants

* Resume never triggers question regeneration
* Snapshot order and content remain fixed
* `/now` is the sole authority for UI state
