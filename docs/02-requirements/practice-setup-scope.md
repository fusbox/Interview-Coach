# Practice Setup Scope

Date: 2026-07-21
Status: Current V2 product contract

## Purpose

`/candidate/setup` creates a new candidate-owned preparation context and its first practice round. It is not the generic entry point for follow-up practice; one-question, fixed-set, and queued follow-up rounds use durable practice intents and the ready landing.

## User Goal

As a candidate, I can describe the interview I am preparing for, optionally include processed resume context, choose the interview stage and first-round size, and start one recoverable coaching journey without managing question generation.

## Inputs

Required:

- target role;
- job description;
- interview stage;
- first-round question count.

Optional resume sources:

- pasted text;
- a PDF or DOCX selected through Upload resume;
- a resume image selected or captured through Take photo;
- trusted host-resolved resume text when the launch context provides it.

The source is never the coaching payload. Every source must become candidate-reviewed processed text through the shared [Storage And Resume Ingestion](../04-architecture/storage-and-resume-ingestion.md) contract.

## Entry Modes

### Identity-Only Host Launch

The candidate enters manual role/JD setup unless an existing prep context should become the dashboard selection. The app does not invent host job provenance.

### Job-Aware Host Launch

The server stages the candidate-owned canonical role/JD and renders them read-only. Browser values cannot override trusted setup context. Optional host resume text still enters the shared resume processing boundary before use.

### Local Development Launch

The fixture identity route exercises the same setup/session ownership path. Browser-local draft persistence is a development bridge, not evidence of production cross-device resume recovery.

## Resume Input Behavior

- Paste text is the default mode.
- Upload resume opens a document-oriented picker restricted by browser hint to PDF/DOCX.
- Take photo is the only mode that requests an image/camera-oriented picker. It also offers an explicit existing-photo fallback when camera capture is unavailable or denied.
- Browser `accept` and `capture` attributes are usability hints; server content validation remains authoritative.
- Pasted, extracted, OCR, and host text use the same parse, direct-PII-scrub, normalize, processed-draft, and candidate-review path.
- Uploaded documents and photos are processing-only and are discarded on every success or failure. Raw sources never become setup drafts or session snapshots.
- The setup/session payload carries only an accepted processed artifact reference/snapshot and safe candidate label. It does not carry source bytes, object paths, parser output, or unreviewed text.
- An authenticated candidate may recover the exact current awaiting-review or accepted artifact for this setup context on refresh, revisit, or another device. Recovery never means selecting the candidate's newest artifact globally.
- Changing source or deliberately clearing resume input invalidates older in-flight processing. A late parser/OCR response cannot become the current selection after that choice.

Pasted text now uses the candidate-owned processing and explicit review/acceptance path; identity-backed setup cannot use raw paste directly. PDF/DOCX upload uses the same review/acceptance path after bounded server-side signature/container validation, extraction, and disposal-before-persistence. Photo capture accepts up to four ordered JPEG, PNG, WebP, HEIC, or HEIF pages, checks actual image bytes, performs one ordered OCR request, disposes app-owned image buffers before artifact persistence, and places only scrubbed normalized text into the existing candidate review. The trusted-host processor is available but host resume lookup is not wired. Production document/photo enablement still requires provider/privacy approval, deployed throttling/resource/disposal evidence, accessibility, and representative desktop/mobile validation.

## Setup And Session Behavior

- The server normalizes and validates setup input before side effects.
- Stage creates the immutable prep-context Coach Plan baseline: 5 for not-sure/general and screening, 7 for first interview, and 10 for follow-up/final.
- Candidate-selected count controls only the first round and may differ from the baseline.
- Setup start is candidate-owned and idempotent. Concurrent/replayed requests do not repeat question generation or create another session.
- Question generation remains hidden from the candidate and fails closed; failed generation preserves the setup draft and does not consume trusted staging.
- Successful setup creates or explicitly separates one opaque prep context, persists its baseline plan/wording, creates the first session, clears the submitted setup draft, and enters the ready landing.
- Successful setup consumes the current resume selection into the immutable prep/session snapshot. The next new-role setup starts without that resume selected.
- Exact role/JD matches with prior practice require the existing-path versus separate-path choice; title text is not prep-context identity.

## Statefulness

- Unsubmitted setup state is preserved until successful session creation or deliberate reset.
- Candidate identity owns server-backed production drafts; browser storage alone is not sufficient for cross-device claims.
- Successful setup starts a new blank setup state on the next visit.
- Active sessions resume at the exact meaningful view/question with their current draft.
- Historical sessions retain their original setup, resume artifact version, plan, wording, answers, and coaching meaning.
- Initial and follow-up ready landings identify the staged accepted resume by its safe candidate label; older truthful snapshots may fall back to `Included`.

## Accessibility

- Required fields and errors are programmatically associated.
- Processing and failure states use announced status without focus theft.
- File, camera, and paste modes remain keyboard operable.
- Camera permission is optional and always has paste/upload fallback.
- Photo order can be changed or corrected without drag-and-drop or a precision pointer.
- Candidate review/edit/accept controls must work without drag, hover, or precision pointer input.

## Explicit Boundaries

Not part of initial setup:

- recruiter invitation creation or recipients;
- candidate-authored question editing;
- reusable resume library;
- automatic resume revision against historical questions;
- mixed-prep-context rounds;
- raw-file retention.

Resume revision and question replacement are a later explicit product/data slice. A revision must not rewrite historical evidence or silently change an active round.
