# End-to-End Flow (Recruiter → Candidate Practice)

This document describes, in plain language, how the system flows from recruiter onboarding through candidate practice. It explains the client, server, database interactions, and the routing connections for each step.

## Components at a Glance

**Client (Web App)**
- Next.js App Router UI (recruiter and candidate screens).
- Candidate practice experience is accessed via a tokenized invite URL: `/s/[token]`.

**Server (API Routes)**
- Next.js route handlers under `/api/*`.
- Session and invite orchestration live in server-side routes and repository classes.

**Database (Supabase Postgres)**
- `sessions` table stores session metadata (status, role, job description, intake JSON).
- `questions` table stores interview questions per session.
- `answers` table stores candidate responses per question.
- `eval_results` table stores AI feedback.
- `candidate_tokens` table maps hashed tokens to `session_id` for authless access.

**Security (Authless Candidate Access)**
- Candidate API requests must include `x-candidate-token` (the invite token).
- The server validates that the token hash maps to the requested session.

---

## Recruiter Flow (Create Invite)

1) **Recruiter creates an account**
   - The recruiter signs up through the portal (not implemented in this repo).
   - Account creation and email verification are handled by the auth provider.

2) **Recruiter verifies email**
   - After verification, they can log into the recruiter experience.

3) **Recruiter logs in**
   - The recruiter session is established (typically via Supabase Auth).

4) **Recruiter populates the settings page**
   - They enter job role, job description, and candidate information.

5) **Recruiter configures an interview session**
   - UI calls `POST /api/recruiter/invites`.
   - Server creates:
     - a `sessions` row with status `NOT_STARTED`
     - `questions` rows tied to the session
     - a `candidate_tokens` row keyed by a hashed token
   - Response includes the invite link: `/s/{token}`.

---

## Candidate Flow (Practice Session)

### Step 0: Candidate clicks invite link
- Candidate lands on `/s/[token]`.
- The layout resolves the invite and bootstraps session context.
- The `x-candidate-token` header is included with all candidate API requests.

### Step 1: Candidate enters initials
- UI prompts for initials if required.
- `PATCH /api/session/{session_id}` persists `enteredInitials`.

### Step 2: Candidate clicks Begin
- UI transitions to intake.
- Candidate selects coaching level (tier 0/1/2).
- `PATCH /api/session/{session_id}` persists `coachingPreference`.

### Step 3: Candidate inputs an answer (voice or text)
- **Voice**: Web Speech API captures transcript locally.
- **Text**: Candidate types into a text area.
- Drafts are saved using `PUT /api/session/{session_id}/questions/{question_id}/answer`.

### Step 4: Candidate clicks Submit Answer
- UI calls `POST /api/session/{session_id}/questions/{question_id}/submit`.
- Server:
  - Loads the session and question.
  - Generates AI feedback.
  - Updates `answers` and `eval_results` in the database.
  - Returns the updated session.

### Step 5: Candidate reviews feedback
- UI displays feedback from `eval_results`.

### Step 6: Candidate continues or retries
- **Continue**: `PATCH /api/session/{session_id}` increments `currentQuestionIndex`.
- **Retry**: `POST /api/session/{session_id}/questions/{question_id}/retry` clears analysis and reopens the question.

### Step 7: Repeat steps 3–6 for remaining questions
- The UI iterates through each question until complete.

---

## Routing & Connection Summary

**Invite link**
- `GET /s/[token]` → loads candidate layout and session context

**Session retrieval**
- `GET /api/session/{session_id}` → server validates token → returns session

**Session updates**
- `PATCH /api/session/{session_id}` → server validates token → persists updates

**Draft answers**
- `PUT /api/session/{session_id}/questions/{question_id}/answer` → server validates token → saves draft

**Final submission**
- `POST /api/session/{session_id}/questions/{question_id}/submit` → server validates token → saves final + feedback

**Retry**
- `POST /api/session/{session_id}/questions/{question_id}/retry` → server validates token → clears analysis

---

## Notes / Assumptions

- Candidate access is authless but token-gated.
- The invite token should never be stored in localStorage; it is present in the URL.
- The token is validated on every candidate API request.
