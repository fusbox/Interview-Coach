# User Flow: UF-C1 — Candidate Starts Interview Session

*(snapshot-driven; no question generation; initials gate enforced once per invite)*

---

## Summary

A candidate opens an invite link to begin an interview **practice** session. The system validates the invite, enforces a lightweight initials check, and deterministically starts the session using a pre-configured QuestionSetSnapshot. The candidate is oriented, reassured, and guided into the first question without any runtime content generation.

---

## Primary Actor

* Candidate

---

## Preconditions

* A valid invite token exists.
* The invite references a frozen `question_set_id + version`.
* The session status is `NOT_STARTED`.

---

## Main Flow

### **Entry Condition:** Candidate opens invite link

> /s/{invite_token}

---

### **System Action:** Resolve invite token

* Resolve `invite_token → invite_id + session_id`
* Validate invite is active and within scope
* Load associated `question_set_id + version`

---

### **Decision:** Have candidate initials already been collected?

* If **no**, continue to Initials Entry
* If **yes**, skip to Interview Landing

---

### **Screen:** Initials Entry (required once per invite)

* Brief orientation: interview practice session
* Reassurance that progress saves automatically
* Disclosure that responses may be reviewed; feedback is private
* Initials input (alpha-only, 1–2 characters, auto-uppercase)

---

### **Action:** Candidate submits initials

> /api/invites/{invite_id}/initials

---

### **System Action:** Persist initials

* Store `candidate_entered_initials`
* Do not compute or persist any identity or match judgment

---

### **Screen:** Interview Landing

* Calm orientation copy explaining how the session works
* Reinforcement that there is no time limit
* Primary CTA to begin the first question

---

### **Action:** Candidate starts interview

> /api/session/{session_id}/start

---

### **System Action:** Initialize session

* Bind session to `question_set_id + version`
* Set `/now.status = IN_SESSION`
* Set `/now.currentQuestionIndex = 0`

---

### **Screen:** Interview Question 1

* Question text loaded directly from QuestionSetSnapshot
* Label displayed: `Q1 — Category`
* Answer input shown
* Autosave enabled
* Safe refresh messaging present

---

## Postconditions

* Session status is `IN_SESSION`
* The candidate is positioned at Question 1
* All question content is immutable and snapshot-driven

---

## Invariants

* No AI question generation occurs at runtime
* Initials are requested exactly once per invite
* Refresh or re-entry rehydrates state exclusively via `/now`
