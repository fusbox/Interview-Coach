# QA Checklist

Status: Current UX contract for the live recruiter-led app

This checklist defines the current ship-blocking UX and product-quality expectations for the candidate practice flow and the recruiter-led experience that exists in this repo today.

It is intentionally grounded in the implemented product, not an earlier candidate-led intake concept or future-state coaching model.

---

## Global Principles

### Language and framing

- No scores, ranks, percentages, pass/fail, or comparative language
- No hiring recommendations or screening judgments
- No comparisons to other candidates
- Coaching should feel supportive, observational, and forward-looking
- The app may describe practice, preparation, growth, and confidence
- Candidate self-reported confidence/preparedness inputs are allowed

Fail if the product starts sounding evaluative, comparative, or judgmental.

### Privacy and exposure

- Candidate coaching feedback is candidate-only
- Recruiter-facing views may include raw candidate answers and completion status
- Candidate-facing copy must continue to distinguish practice/coaching from evaluation
- Browser-visible summary content may expire after email delivery without breaking the candidate's ability to keep the emailed debrief

Fail if candidate-only coaching becomes recruiter-visible or if privacy boundaries are contradicted in copy.

### Modality safety

- Voice feedback must not reference accent, voice quality, or filler-word counts as evaluative signals
- Text feedback must not reference typing speed
- Candidate transcript/audio is read-only after submission
- Audio playback is user-triggered only

Fail if modality-specific feedback becomes judgmental or auto-play behavior is introduced.

---

## Candidate Entry and Landing

### Access and framing

- Candidate enters through `/s/[token]`
- No account creation is required
- If initials are required for the session, initials are collected before the landing screen
- Landing copy clearly explains that the experience is practice and skill-building, not evaluation
- Rangam branding remains visible

### Current landing contract

- The landing screen may show:
  - target role context
  - no-time-limit reassurance
  - privacy/coaching boundary explanation
  - resume-later / copy-link guidance
  - pilot notice when rollout config enables it
- The landing screen currently captures a self-reported preparedness baseline before begin
- Begin is disabled until the required baseline interaction is complete

Fail if the landing screen implies assessment, hides the practice framing, or removes the current begin gating without a product decision.

---

## Candidate Session

### Core workspace

- Candidate sees one current question at a time
- Current role context remains visible during the session
- Candidate can see progress through question count / progress UI
- Feedback content is not visible while actively composing an answer

### Input modes

- Candidate can answer by voice or text
- Text mode is first-class, not buried or degraded
- Candidate explicitly submits an answer before analysis
- Microphone failure must leave the candidate with a usable text path

### Active-answer behavior

- Current answer is editable only before submit
- Submitted answers become read-only
- No persistent transcript/history feed should crowd the active-answer view
- Resume behavior should return the candidate to the correct in-progress state from the same invite link

Fail if active-answer UX becomes confusing, hidden behind navigation tricks, or dependent on URL progress state.

---

## Candidate Feedback Step

### Transition and loading

- After submit, the app transitions through pending/evaluation state before showing feedback
- Loading should feel deliberate rather than broken or frozen
- Feedback should not appear as an instant jarring swap with no transition affordance

### Current feedback contract

- The feedback experience is currently organized around:
  - summary / opening recommendation
  - optional delivery pulse
  - optional content pulse
  - next-step action area
- Candidate can inspect their own answer/transcript during feedback
- Voice answers may be played back on demand
- Candidate can either continue or retry from the feedback step
- Retry keeps the candidate on the current question and resets answer capture for a fresh attempt

Fail if the feedback step loses clarity about the candidate's own answer, stops supporting retry/continue, or exposes recruiter-facing interpretation language.

---

## Candidate Summary and Completion

### Completion

- Final question completion transitions to a summary screen
- Summary may show loading/skeleton states while the debrief is still being prepared
- When available, the summary shows narrative coaching content
- If browser-visible summary content has expired, the UI explains that the email copy remains the durable version

### Current post-session UX

- Candidate can start another practice round from summary
- Candidate can provide end-of-session survey feedback from summary
- The current session survey captures:
  - confidence delta
  - psychological safety
  - repeat intent

Fail if the summary loses debrief visibility, the privacy-expiry behavior becomes contradictory, or practice-again breaks.

---

## Recruiter-Led App Scope Checks

- Recruiter dashboard remains focused on invite/session operations for the current scope
- Recruiter-facing readiness interpretation remains out of scope for the live product unless explicitly reintroduced
- Recruiter views may show session status, timestamps, progress, and raw answer evidence
- Recruiter views should not expose candidate-only coaching feedback

Fail if recruiter UI starts surfacing dormant readiness concepts or private coaching content without an explicit scope change.

---

## Regression Cases

- Candidate can enter from invite link, begin, answer, receive feedback, finish, and see summary
- Candidate can resume the same invite link after interruption
- Candidate can retry after feedback without route-based progression hacks
- Voice and text both remain usable on mobile and desktop
- Empty, partial, and failed-response states remain calm and non-scolding
- Browser summary expiry does not erase the email-based debrief path

---

## Final Gate

Before shipping a UX change, ask:

> Would this still feel safe, clear, and useful to a nervous candidate practicing for a real interview?

If the answer is not clearly yes, the change is not ready.
