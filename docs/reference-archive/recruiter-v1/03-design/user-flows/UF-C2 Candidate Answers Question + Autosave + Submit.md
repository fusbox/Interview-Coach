# User Flow: UF-C2 — Candidate Answers Question, Autosave, and Submit

*(snapshot-driven; autosave-first interaction)*

---

## Summary

A candidate responds to a single interview practice question. The system continuously autosaves progress, allows the candidate to think and revise freely, and submits the final response explicitly when the candidate is ready. No evaluation occurs until submission.

---

## Primary Actor

* Candidate

---

## Preconditions

* Session status is `IN_SESSION`.
* A QuestionSetSnapshot is bound to the session.
* A current question index is active.

---

## Main Flow

### **Entry Condition:** Question screen is loaded

> /api/session/{session_id}/now

---

### **Screen:** Interview Question

* Question text loaded directly from QuestionSetSnapshot
* Label displayed: `Qn — Category`
* Single answer input area (text or voice transcript)
* Autosave indicator visible
* No timer or countdown present

---

### **System Behavior:** Autosave while typing

* Save draft incrementally as candidate types
* Persist draft without locking submission
* Update autosave state silently

---

### **Candidate Behavior:** Thinks, types, revises

* Candidate may pause, edit, or leave the page
* Draft remains available on return

---

### **Screen Feedback:** Autosave status

* Status text reflects:

  * "Saving…" during active persistence
  * "Saved" when draft is safely stored

---

### **Decision:** Is the candidate ready to submit?

* If **no**, remain on question screen
* If **yes**, continue to Submit Action

---

### **Action:** Candidate submits final response

> /api/session/{session_id}/questions/{question_id}/submit

---

### **System Action:** Finalize response

* Mark response as final for this attempt
* Lock further edits for this question
* Record submission timestamp

---

### **System Action:** Transition session state

* Set `/now.status = AWAITING_EVAL`
* Emit evaluation request event

---

### **Screen:** Submission Acknowledged

* Display submitted response (read-only)
* Show calm messaging indicating processing
* No scoring, feedback, or judgment shown

---

## Postconditions

* A final answer exists for the current question
* The response is queued for evaluation
* No additional edits are permitted for this attempt

---

## Invariants

* Question text and order are immutable
* Autosave does not imply submission
* Submission is always an explicit candidate action
* No evaluation or feedback is shown before submission

---

This flow ensures candidates have space to think and revise, while preserving clear intent and control at the moment of submission.
