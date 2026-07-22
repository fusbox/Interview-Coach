# Storage And Resume Ingestion

Date: 2026-07-22
Status: Ratified V2 architecture contract; ingestion, recovery/presentation, integrated milestone audit, and durable operations implemented through Slice 178

## Purpose

This document defines the production boundary that turns optional candidate resume input into candidate-reviewable text without retaining the source document or photo.

## Decision

Every resume source enters one server-owned processing pipeline. Source acquisition may differ, but pasted text, uploaded documents, captured photos, and trusted host-resolved resume text do not get different privacy or normalization rules.

The shared sequence is:

1. authorize the candidate and intended prep context;
2. admit or replay the source-specific operation through the durable candidate/setup-owned lease ledger;
3. acquire bounded source content only after admission;
4. validate the declared type and inspect the actual content;
5. extract or OCR text when the source is binary;
6. parse the text into a safe textual representation;
7. scrub direct PII under a versioned code-owned policy;
8. normalize and enforce the processed-text limit;
9. discard all source bytes and prove disposal before allowing a durable write;
10. persist or idempotently recover a candidate-owned processed draft for review;
11. atomically publish the current lease holder's artifact into the exact pending setup selection;
12. let the candidate review or correct the processed text before it becomes active resume context.

Question generation, hints, coaching, evaluation, and dashboard reads consume only the accepted processed text snapshot. They never consume an uploaded file, captured image, unprocessed paste, temporary object path, or OCR/parser response.

## Implementation Status

Slice 173 implements this lifecycle for `pasted_text` and `trusted_host` sources through `candidate_resume_processed_artifacts` (migration `032`) and processing policy `candidate_resume_text_processing_v1`. The current direct-PII policy is `candidate_resume_direct_pii_v5`. Candidate-owned same-origin routes create or recover an `awaiting_review` artifact and revision-fence explicit acceptance. Setup start then reloads the exact accepted artifact by candidate, artifact id, version, and revision; browser-supplied resume text cannot override it. Raw pasted text is excluded from browser draft persistence, Postgres, logs, and downstream provider work. PII v5 retains exact authenticated-identity alias removal and safely derives first-name/last-initial, first-initial/last-name, and surname-first variants from that trusted full name. Unknown-name inference remains limited to the first eight lines and accepts one strong email, phone, address, profile, or city/state/postal signal as corroboration; likely role, organization, and section titles are excluded. When a first delimited span on the same line as a contact signal is plausibly personal but cannot be classified as a name, it becomes `[Personal detail removed]` and is counted separately from name redactions. Real bullet-delimited and multiline street-address segments are scrubbed, and header postal codes are removed while coarse city/state context remains. Advancing the policy version prevents prior artifacts from being replayed as current processing.

Slice 174 adds `document_upload` through migration `033` and candidate-owned `POST /candidate/setup/resume-document`. The route proves same-origin candidate identity before reading the body, enforces a 5 MiB request-stream ceiling without trusting `Content-Length`, requires declared PDF or DOCX, and checks the actual PDF signature or bounded DOCX ZIP structure. PDF extraction uses `pdf-parse` with a 50-page ceiling and no XFA/eval/font rendering; DOCX extraction uses `mammoth` after rejecting encrypted, ZIP64, multi-disk, traversal, unsupported-compression, excessive-entry, excessive-expansion, and extreme-ratio containers. Both Node parser packages are server-externalized in Next so development and optimized servers load their native module graphs rather than webpack-wrapping `pdfjs-dist`; the production HTTP smoke must load this route and receive its expected JSON fail-closed response. App-owned parser and request buffers are zero-filled. The source-disposal gate runs before processed-artifact persistence, so an idempotently recoverable artifact can exist only after disposal succeeded. The browser stores neither the selected `File` nor its bytes and preserves only explicitly accepted processed text plus an opaque artifact reference.

Slice 175 adds `photo_capture` through migration `034` and candidate-owned `POST /candidate/setup/resume-photo`. One bounded multipart request carries up to four pages in explicit reading order. The route proves identity before consuming the body, permits any one image to consume the 12 MiB aggregate ceiling, verifies JPEG/PNG/WebP/HEIC/HEIF container signatures, and invokes one exact-profile OCR adapter. The current Google Developer API profile uses inline ordered image parts with `gemini-2.5-flash`; provider response must contain one non-empty same-order page result per image, and combined extracted text must remain within the shared 64,000-character source ceiling. Missing-page and oversized-output cases fail before artifact persistence. App-owned request and page buffers are zero-filled before processed-artifact persistence, and only the combined OCR text enters the shared direct-PII processor and candidate review. Accepted image containers are passed through without conversion because the selected provider natively accepts them; unsupported or ambiguous containers fail closed instead of being decoded or rewritten by the app. The browser persists neither queued images nor raw OCR output.

Slice 176 adds a separate candidate/setup-context selection record around the immutable artifact. The server derives the selection owner from authenticated candidate identity plus any trusted host setup context; a browser cannot select another candidate's owner key. Every paste/document/photo processing attempt claims a unique operation before expensive work and may finalize only while that operation is still current. Choosing another source or clearing resume input invalidates older operations, so a late OCR/parser response cannot resurrect discarded setup state. Recovery returns only the exact current active selection under current processing/PII policy. Acceptance and setup start both prove that the selected artifact is the same candidate-owned artifact. Successful setup consumes the selection with the created prep context/session, so the next generic setup is blank rather than reusing the prior resume.

Slice 177 closes the integrated local milestone. A seeded browser test now proves PII-safe review, refresh and fresh-browser/mobile recovery, acceptance, initial landing labeling, and clean-slate revisit after consumption. The audit also prevents post-paint browser-draft recovery from overwriting newer user edits, makes the historical answer-attempt backfill monotonic under later voice-source triggers, proves the optimized route-module boundary, and removes manual resume fixtures from the public web root. See [resume ingestion milestone evidence](../05-quality/resume-ingestion-milestone.md).

Slice 178 adds migration `036` and a metadata-only `candidate_resume_ingestion_operations` ledger in front of all three browser acquisition routes. Candidate/setup ownership, per-source global capacity, per-candidate recent-attempt limits, one active setup-owner lease, exact replay, and three-generation stale recovery are serialized in Postgres before request bytes are read. Only an unexpired current generation can atomically publish its artifact into the exact pending selection. Route diagnostics contain only allowlisted outcome, reason, status, claim generation, coarse size/page classes, and latency. Upgrade and fresh-database smokes prove concurrent admission, denial without body consumption, exact replay, cross-owner rejection, rate/capacity limits, stale recovery, and late-generation fencing.

The accepted artifact reference and safe `candidateLabel` are copied into the immutable initial session snapshot. Follow-up intents and follow-up session snapshots carry the same reference and label from their source prep context. Initial and follow-up ready landings show the label, falling back to the legacy truthful `Included` fact only for older V2 snapshots that predate the label. The full processed text remains server-owned session context for generation/coaching and is not exposed by a label/read endpoint.

The shared processor accepts trusted-host text, but host-side resume lookup and staging have not yet been wired. Deployed parser/OCR hard containment, alert delivery, accessibility/disposal evidence, and resume revision/question reconciliation remain later gates or slices.

## Input Modes

### Paste Text

Pasted text is source content, not an already-processed exception. The production browser sends it only to the candidate-owned processing route. The raw paste is normalized and scrubbed before the resulting processed draft is persisted for review; it is not preserved in the setup browser draft. The current candidate/setup-context selection restores awaiting-review or accepted processed text on refresh, revisit, and another authenticated device without restoring the raw paste.

### Upload Resume

The upload control is a document picker, not a media picker. The first supported formats are:

- PDF: `application/pdf`;
- DOCX: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.

The browser `accept` value is only a device hint. The server must enforce a bounded byte size, inspect the actual file signature/container, reject encrypted or unsupported documents safely, and never trust the extension or browser-supplied MIME type. Legacy DOC, TXT, images, archives, and renamed files are outside the first document-upload contract.

The first server bounds are 5 MiB per source, 50 PDF pages, 512 DOCX ZIP entries, and 32 MiB total declared DOCX expansion. A PDF with no extractable text returns `EMPTY_EXTRACTION` and directs the candidate to paste text or use the separate photo path; document upload does not silently invoke OCR.

### Take Photo

Photo capture is a separate image input with `accept="image/*"` and a rear-camera capture hint where the browser supports it. The hint does not guarantee direct camera launch; desktop and some mobile browsers may offer an image picker. The app must keep paste and document upload available so camera access is never required.

The candidate may capture one page at a time or select existing photos, then inspect, remove, and reorder the queued pages using keyboard-operable controls. OCR starts only after the candidate confirms the ordered queue. Camera denial or an unavailable capture implementation leaves the existing-photo, document-upload, and paste paths available.

Credentialed local-LAN mobile validation accepted a real camera capture after the per-page limit was corrected to permit one image to consume the 12 MiB batch ceiling. The pinned provider returned an accurate transcription, the shared direct-PII processor removed the expected personal details, and only the scrubbed candidate-review text was presented. This clears the local real-device/provider gate; it does not replace deployed throttling, telemetry, subprocessor approval, disposal evidence, or the broader accessibility/device matrix.

The first image contract accepts:

- JPEG: `image/jpeg`;
- PNG: `image/png`;
- WebP: `image/webp`;
- HEIC: `image/heic`;
- HEIF: `image/heif`.

The server checks actual file signatures/container brands rather than trusting MIME or extension. Limits are four pages and 12 MiB aggregate source bytes; any one page may consume the full aggregate allowance so a normal high-resolution phone capture is not rejected by the document-upload ceiling. The current Google Developer API accepts these five image MIME types directly, so V2 does not convert them. This avoids a second decoder dependency and prevents a conversion result from becoming another source artifact. A future provider lacking equivalent native support requires a separately reviewed conversion contract; it cannot silently narrow device support.

Pages are sent to OCR in the candidate-visible order and the adapter must return exactly one bounded text result for each page in that same order. OCR is transcription only: image content is untrusted data, not instructions; the provider must not summarize, repair, evaluate, or invent obscured text. The code combines page text only after the exact-order result validates, then passes it through the same deterministic direct-PII processor and candidate review used by every other source.

### Trusted Host Resume

A trusted host-resolved resume bypasses browser acquisition only. It still enters the same server-owned parse, PII-scrub, normalize, processed-draft, review, and versioning contract. Host provenance does not make raw resume text safe to persist or send downstream.

## Processed Artifact

The durable resume value is a candidate-owned, versioned processed artifact:

```ts
type ResumeInputSource =
    | "pasted_text"
    | "document_upload"
    | "photo_capture"
    | "trusted_host";

type ResumeProcessedArtifact = {
    artifactId: string;
    candidateProfileId: string;
    roleProfileId: string | null;
    version: number;
    revision: number;
    source: ResumeInputSource;
    candidateLabel: string;
    normalizedText: string;
    sourceFingerprint: string;
    normalizedTextFingerprint: string;
    processingPolicyVersion: string;
    piiPolicyVersion: string;
    piiRedactionCounts: Record<string, number>;
    reviewState: "awaiting_review" | "accepted" | "replaced";
    createdAt: string;
    acceptedAt: string | null;
    originalRetained: false;
};
```

`candidateLabel` is display-only metadata such as a sanitized filename, `Pasted resume`, or `Resume photo`. It must not contain a storage path, signed URL, candidate id, or untrusted directory structure. `sourceFingerprint` supports idempotency and diagnostics without retaining source content. `revision` fences candidate review writes within one version; a candidate edit that reintroduces direct PII remains `awaiting_review` with newly scrubbed text until the candidate reviews it again.

The accepted artifact version is copied by reference and immutable snapshot into setup/session context. A later revision must not reinterpret historical questions or coaching.

`candidate_setup_resume_selections` is the mutable recovery pointer, not another copy of resume text. It is keyed by candidate plus the server-derived setup owner key and stores only the current operation id, selected artifact pointer, lifecycle, revision, and eventual prep-context/session consumption pointers. `pending`, `active`, `cleared`, and `consumed` are distinct states. Artifact creation may leave an unselected candidate-owned artifact when a later operation wins; such an artifact is not recoverable as setup state and cannot be submitted by guessing its id.

## PII-Scrub Policy

The first policy is deterministic and data-minimizing. It removes or replaces direct identifiers that are not needed for interview coaching:

- known candidate name and exact known identity aliases when available;
- email addresses;
- phone numbers;
- street/postal addresses while allowing coarse city/state context when useful;
- dates of birth;
- government or account identifiers;
- personal profile URLs and handles.

It preserves the work evidence the coach needs, including employers, job titles, dates of employment, education, certifications, tools, responsibilities, and accomplishments. Generic named-entity recognition must not remove people, employers, schools, or places speculatively. A model may later flag possible residual PII for review, but it cannot be the sole enforcement boundary.

The processing result should store policy versions and bounded category counts, not the removed values. PII-scrubbed text remains sensitive candidate data; scrubbing does not make it anonymous or suitable for logs.

## Source Disposal

Raw documents, photos, and acquisition buffers are processing-only data.

- Prefer bounded in-memory processing for the first synchronous implementation.
- Do not write source bytes to Postgres, browser storage, logs, analytics, AI artifacts, or durable app-owned object storage.
- If a provider or asynchronous path requires temporary object storage, use a private encrypted object with an opaque key, no candidate identity in its path, no browser-visible URL, and a short hard TTL.
- After extraction, dispose of app-owned source/parser bytes before creating or recovering the candidate-owned processed draft. This ordering prevents a failed disposal from leaving a recoverable artifact.
- On validation, extraction, OCR, scrub, normalization, persistence, timeout, or cancellation failure, dispose of source bytes before returning the safe failure.
- A failed disposal is an operational failure. Quarantine the inaccessible temporary object, retry deletion, emit metadata-only telemetry, and do not claim that processing completed.

The app does not retain originals for retry, support, or candidate convenience. A failed extraction requires the candidate to reselect the source or use paste text.

## Failure And Recovery

Candidate-visible failures use bounded reason codes such as:

- `UNSUPPORTED_RESUME_TYPE`;
- `RESUME_TOO_LARGE`;
- `UNREADABLE_DOCUMENT`;
- `EXTRACTION_FAILED`;
- `OCR_FAILED`;
- `EMPTY_EXTRACTION`;
- `PII_PROCESSING_FAILED`;
- `RESUME_PERSISTENCE_FAILED`;
- `SOURCE_DISPOSAL_FAILED`.

Raw parser/OCR/provider errors, extracted text, removed identifiers, file paths, URLs, and source fingerprints do not enter browser errors or logs. A retry is a new acquisition unless an idempotent request can recover an already-saved processed draft whose source disposal succeeded.

## Durable Admission And Operations

Resume ingestion uses a separate metadata-only operation ledger before source content is read. The browser operation UUID is an idempotency command key, not identity or authorization. Candidate identity and the server-derived setup owner are proven first; the database then atomically admits, replays, defers, or denies the operation under one cross-instance lock.

The first code-owned policy is intentionally conservative:

| Source | Global active leases | Per-owner attempts / 10 minutes | Lease |
| --- | ---: | ---: | ---: |
| Pasted text | 32 | 20 | 30 seconds |
| PDF/DOCX document | 4 | 8 | 120 seconds |
| Photo OCR | 2 | 6 | 60 seconds |

One candidate/setup owner may hold only one active resume-ingestion lease across all sources. A completed operation UUID replays the exact candidate-owned artifact without rereading the request body. An unexpired duplicate reports in progress. An expired matching operation may advance to the next claim generation, up to three generations. Cross-candidate, cross-owner, or cross-source reuse of an operation UUID fails closed. Recent-attempt and global-capacity denials do not consume the request body.

Only the current unexpired generation may atomically mark an operation completed and publish its artifact into the exact pending setup selection. Clearing or replacing the selection makes the result `superseded`; lease expiry or a newer generation makes it `stale`. Either case can leave only an unselected candidate-owned processed artifact after source disposal. It cannot restore discarded UI state or become setup/session input. Photo provider work retains its 45-second transport timeout inside the 60-second lease. In-process document parsing is admitted under the longer lease and three-generation ceiling; deployed parser process isolation and hard resource enforcement remain release gates.

The durable ledger stores the candidate/setup ownership keys needed for enforcement plus source kind, lifecycle, claim generation/lease, safe terminal reason, coarse input-size class, bounded page count, duration, and optional completed artifact pointer. It stores no resume text, filename, source bytes, removed PII, source fingerprint, provider payload, URL, or browser/session credential.

Terminal operation rows currently have no scheduled retention job. Before production volume, define a bounded cleanup policy that preserves active leases and any completed operation still needed for exact current-selection replay; cleanup must not infer lifecycle from age alone.

Each identity-authorized operation that reaches durable admission emits exactly one best-effort `candidate_resume_ingestion` diagnostic. Pre-identity security denials intentionally do not create candidate-operation telemetry. The allowlist is source, outcome, safe reason, HTTP status, claim generation, duration and latency class, input-size class, and page-count class. It excludes candidate/setup/operation/artifact ids, filenames, content, fingerprints, provider exception detail, and request metadata. Diagnostic delivery never changes ingestion correctness.

## Accessibility And Device Behavior

- Every source control has a programmatic label and keyboard path.
- Upload resume opens a document-oriented picker; Take photo is the only image/camera-oriented picker.
- Selection, processing, review-ready, and failure states are announced without moving focus unexpectedly.
- Errors identify the affected control and preserve any already-reviewed processed text.
- Camera permission denial has an immediate paste/upload fallback.
- The review surface supports editing, clear replacement, and explicit acceptance without requiring pointer precision.

## Preserve, Reinterpret, Retire, Defer

- Preserve from V1: processed-text downstream consumption, PDF/DOCX parser seam, safe failure codes, candidate ownership checks, and default original disposal.
- Reinterpret: V1 private-blob metadata becomes request-scoped transient source handling; durable metadata describes the processed artifact, not a retrievable original. V1's Boolean pre-session resume reminder becomes the exact safe accepted-artifact label while preserving a truthful Boolean fallback for older V2 snapshots.
- Retire: pending raw-asset paths on candidate drafts, original retention for extraction retry, parser error persistence, and treating normalized paste as privacy-complete.
- Defer: reusable resume libraries, resume sharing across products, additional OCR providers or conversion paths, and question replacement after an accepted resume revision.

## Implementation Runway

1. Completed in Slice 173: route pasted and trusted-host text through a shared deterministic parse/PII-scrub/normalize service and candidate-reviewable processed draft.
2. Completed in Slice 174: add bounded PDF/DOCX acquisition and extraction using the same service and disposal-before-persistence invariant.
3. Completed in Slice 175: add ordered photo acquisition/OCR using the same service and disposal invariant.
4. Completed in Slice 176: add durable selection/labels, cross-device unfinished-review recovery, accepted artifact propagation, exact setup consumption, and clean-slate generic setup after consumption. Deployed accessibility/browser/provider evidence remains an explicit release gate.
5. Completed in Slice 178: add cross-instance admission leases, replay/recovery fencing, coarse operation metadata, and safe structured diagnostics across paste/document/photo ingestion.
6. Separately design resume revision and question reconciliation; do not couple it to initial ingestion.

## Release Gates

- No resume source can bypass the shared processing policy.
- Ownership is proven before source content is read.
- Browser hints and server type/signature validation agree on supported formats.
- Raw source bytes are absent from Postgres, durable object storage, browser drafts, logs, and AI artifacts after every terminal outcome.
- Disposal success and safe failure behavior have automated and deployed-environment evidence.
- Candidate review occurs before processed text becomes active resume context.
- Privacy/subprocessor review covers any extraction or OCR provider before production enablement.
- Production enables only an exact ratified OCR provider/profile and never permits the fixture runtime.
- Production review approves parser process isolation or an equivalent malicious-document containment boundary and deployed CPU/memory/timeout evidence. Durable app-level admission bounds reduce load and replay risk but are not a malware scanner, process sandbox, ingress body limit, or infrastructure circuit breaker.
