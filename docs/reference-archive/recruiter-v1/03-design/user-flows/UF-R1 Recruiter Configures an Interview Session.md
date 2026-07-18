# User Flow: UF-R1 — Recruiter Configures Interview Session

---

## Summary

A recruiter creates an interview practice session by configuring candidate details and defining a structured set of interview questions derived from TA. The system cleans and normalizes the input, presents a preview for confirmation, and creates an immutable QuestionSetSnapshot that will drive the candidate experience.

---

## Primary Actor

* Recruiter

---

## Preconditions

* Recruiter is authenticated.
* Recruiter has access to a job requirement in TA.
* Candidate name and email are available.

---

## Main Flow

### **Entry Condition:** Recruiter starts invite creation

> /recruiter/interview-coach/create

---

### **Screen:** Configure Interview — Candidate & Role Details

* Candidate display name
* Candidate email
* Req ID
* Job title
* Optional job description (context only)

---

### **Screen:** Configure Interview — Question Entry

Recruiter completes structured question fields:

* **STAR (required, one each):**

  * Situation
  * Task
  * Action
  * Result
* **PERMA (required, one each):**

  * Positive Emotion
  * Engagement
  * Relationships
  * Meaning
  * Accomplishment
* **Technical (required, one minimum):**

  * Ability to add additional Technical questions
* **Other (optional):**

  * Ability to add additional questions

Each field is plain text. Recruiter is guided not to include numbering or category names in the question text.

---

### **Action:** Recruiter requests preview

> /api/interview/preview

---

### **System Action:** Clean and normalize questions

* Trim whitespace
* Strip bullets, numbering, and category prefixes
* Reject empty or invalid questions
* Flag duplicates (non-blocking)
* Assign deterministic order and labels

---

### **Screen:** Preview Questions

For each question:

* Label displayed: `Q# — Category`
* Cleaned question text (read-only by default)
* Per-question **Edit** option (inline, nav-free)

---

### **Action:** Recruiter edits questions (optional)

* Unlock single question text field
* Save re-applies cleaning rules
* Cancel restores prior value

---

### **Action:** Recruiter confirms and creates invite

> /api/interview/invite/create

---

### **System Action:** Create QuestionSetSnapshot

* Generate `question_set_id` and `version`
* Persist ordered, cleaned questions
* Mark snapshot immutable

---

### **System Action:** Create invite

* Bind invite to candidate and QuestionSetSnapshot
* Generate invite token and link

---

### **Screen:** Invite Created

* Display invite link with copy action
* Show summary:

  * Candidate name
  * Candidate email
  * Req ID
  * Job title

---

## Postconditions

* An immutable QuestionSetSnapshot exists.
* An invite link is available for the recruiter to send externally.

---

## Invariants

* Question content is immutable after confirmation.
* TA is not queried during candidate runtime.
* Recruiter does not see or influence candidate coaching feedback.
