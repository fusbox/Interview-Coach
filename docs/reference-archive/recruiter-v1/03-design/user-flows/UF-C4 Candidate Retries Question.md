# User Flow: UF-C4 — Candidate Retries or Revises a Question

---

## Summary

After viewing feedback for a question, the candidate may be given the option to retry or revise their response. This flow defines how retries are offered, constrained, and executed without overwriting prior attempts or altering question intent.

---

## Primary Actor

* Candidate

---

## Preconditions

* Feedback has been displayed for the current question.
* Session state allows retry according to policy.
* Question content and order are immutable.

---

## Main Flow

### **Entry Condition:** Candidate is viewing question feedback

> /api/session/{session_id}/now

---

### **Decision:** Is retry allowed for this question?

* If **no**, show continue-only option
* If **yes**, present retry option

---

### **Screen:** Feedback with Retry Option (if allowed)

* Question label displayed: `Qn — Category`
* Previously submitted response shown read-only
* Coaching feedback remains visible
* Retry option presented with neutral framing

---

### **Retry Framing Copy (Example)**

* “You can revise your answer to try a different approach.”
* “Your earlier response will be saved.”

---

### **Decision:** Candidate chooses next action

* If **continue**, proceed to next question
* If **retry**, start new attempt

---

### **Action:** Candidate initiates retry

> /api/session/{session_id}/questions/{question_id}/retry

---

### **System Action:** Initialize new attempt

* Increment attempt counter for this question
* Preserve all prior attempts as read-only
* Reset answer input for the new attempt

---

### **Screen:** Question Retry

* Same question text and label displayed
* Empty answer input
* Autosave enabled
* Clear indication this is a new attempt

---

### **Candidate Behavior:** Revises response

* Candidate types, edits, and reflects
* Draft autosaved as in UF-C2

---

### **Action:** Candidate submits revised response

> /api/session/{session_id}/questions/{question_id}/submit

---

### **System Action:** Finalize revised attempt

* Lock revised response
* Queue evaluation for the new attempt
* Transition state to `AWAITING_EVAL`

---

## Postconditions

* A new attempt exists for the question
* Prior attempts remain intact and immutable
* Evaluation proceeds for the latest attempt only

---

## Invariants

* Retry never overwrites prior answers
* Question text, order, and category never change
* Feedback is always tied to a specific attempt
* No comparative scoring between attempts is shown

---

This flow allows candidates to practice and improve intentionally, while preserving transparency, history, and evaluative integrity.
