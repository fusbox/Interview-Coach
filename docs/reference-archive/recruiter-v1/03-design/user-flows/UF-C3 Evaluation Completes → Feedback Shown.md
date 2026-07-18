# User Flow: UF-C3 — Candidate Views Evaluation Status and Feedback

---

## Summary

After submitting a response, the candidate waits briefly while the system evaluates the answer. Once evaluation is complete, the candidate is shown coaching feedback for that specific question and guided forward without scores, judgments, or comparisons.

---

## Primary Actor

* Candidate

---

## Preconditions

* A final response has been submitted for the current question.
* Session state has transitioned to `AWAITING_EVAL`.
* Question content is immutable and snapshot-driven.

---

## Main Flow

### **Entry Condition:** Candidate has submitted a response

> /api/session/{session_id}/questions/{question_id}/submit

---

### **System Action:** Evaluation in progress

* Queue evaluation request for the submitted response
* Associate evaluation with `question_id` and attempt number

---

### **Screen:** Evaluation Pending

* Calm status messaging (e.g., “Reviewing your response…”)
* Submitted response displayed read-only
* No progress bars, timers, or percentages

---

### **System Action:** Evaluation completes

* Evaluation result is returned
* Session state updated

> /api/session/{session_id}/now

---

### **Decision:** Is evaluation available?

* If **no**, remain on Evaluation Pending screen
* If **yes**, continue to Feedback View

---

### **Screen:** Question Feedback

* Question label displayed: `Qn — Category`
* Coaching feedback rendered for this question only
* Feedback focuses on clarity, structure, and completeness
* No scores, grades, or rankings shown

---

### **Feedback Components:**

* **What worked well** — strengths observed in the response
* **What could be clearer** — specific, actionable improvement areas
* **One thing to try next** — a single, focused suggestion

---

### **Decision:** What does the candidate want to do next?

* If **continue**, proceed to next question
* If **retry allowed**, offer retry option per policy

---

### **Action:** Candidate continues

> /api/session/{session_id}/questions/next

---

### **System Action:** Advance session

* Increment `currentQuestionIndex`
* Set `/now.status = IN_SESSION`

---

## Postconditions

* Feedback has been shown for the submitted question
* Candidate has either advanced or retried

---

## Invariants

* Feedback is question-specific only
* No performance scores or readiness labels are displayed
* Feedback is visible only to the candidate
* Recruiter visibility does not include coaching output

---

This flow ensures candidates receive supportive, focused feedback while maintaining psychological safety and clear forward momentum.
