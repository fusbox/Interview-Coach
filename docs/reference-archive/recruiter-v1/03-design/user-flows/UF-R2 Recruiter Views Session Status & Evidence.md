# User Flow: UF-R2 — Recruiter Views Session Status and Evidence

---

## Summary

A recruiter views the status and high-level evidence of an interview practice session they created. The view is strictly read-only and surfaces progress, engagement, and coverage signals without exposing coaching feedback, scores, or evaluative judgments.

---

## Primary Actor

* Recruiter

---

## Preconditions

* Recruiter is authenticated.
* One or more interview invites exist.

---

## Main Flow

### **Entry Condition:** Recruiter opens interview coach dashboard

> /recruiter/interview-coach/invites

---

### **Screen:** Invite List

Each invite row displays:

* Candidate display name
* Candidate email
* Req ID
* Job title
* Created date
* Session status:

  * Not Started
  * In Progress
  * Completed
* Initials badge:

  * Candidate-entered initials
  * Green if initials match expected
  * Red if mismatch

---

### **Action:** Recruiter selects an invite

> /recruiter/interview-coach/invites/{invite_id}

---

### **System Action:** Load invite context

* Resolve invite to session (if started)
* Load associated QuestionSetSnapshot
* Load session summary data

---

### **Screen:** Invite Detail

#### Context Header

* Candidate name
* Candidate email
* Req ID
* Job title
* Question set version

---

#### Session Status Panel

* Current status
* Last activity timestamp
* Total verified engagement time (minutes)

---

#### Question Coverage Panel

For each question:

* Label: `Q# — Category`
* Status:

  * Not Answered
  * Answered
  * Evaluated

Optional:

* Time spent per question (aggregate only)

---

#### Evidence Indicators (Aggregate, Non-Interpretive)

* Number of questions attempted
* Number of retries used
* STAR structure coverage counts (e.g., Result present: 3 / 4)

---

## Constraints and Guardrails

Recruiter views must not display:

* Candidate answers verbatim
* Coaching feedback
* Scores, grades, or rankings
* Role readiness or fit conclusions

---

## Postconditions

* No system state is mutated by recruiter viewing.
* Recruiter may return to invite list or navigate back to TA.

---

## Invariants

* Recruiter views are read-only.
* All metrics shown are factual counts or timestamps.
* Interpretive conclusions are never persisted or displayed.
