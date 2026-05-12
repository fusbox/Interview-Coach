# Storage And Resume Ingestion

Date: 2026-05-07
Status: Working architecture contract

## Purpose

This document defines how resume inputs should move from candidate input into durable storage and downstream AI/session logic.

## Core Rule

All resume inputs normalize to plain text before reaching question generation or coaching services.

Downstream logic should consume:

```ts
type ResumeContextSnapshot = {
  sourceAssets: ResumeSourceAsset[];
  pastedText: string | null;
  extractedText: string;
  captureMode: "none" | "pasted_text" | "file_upload" | "image_capture" | "mixed";
  processedArtifact: {
    text: string;
    source: "pasted_text" | "file_upload" | "image_capture" | "mixed";
    originalRetained: false;
  } | null;
};

type ResumeSourceAsset = {
  assetId: string;
  kind: "file";
  fileName: string;
  mimeType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  byteSize: number;
  storagePath: string;
  status: "pending_extraction";
  retention: "processing_only";
};
```

## Storage Types

### Postgres

Use Postgres for structured, queryable, relational data:

- candidate profile
- resume asset metadata
- extracted text
- draft/session ownership
- generation state
- dashboard history

### Blob Or Object Storage

Use blob/object storage for large binary files:

- uploaded PDF or DOCX resumes
- resume photos
- future audio or video artifacts
- generated export files

A blob is a named chunk of bytes stored outside the relational database. The database stores the path and metadata, not the large binary itself.

Likely Azure direction:

- Azure Blob Storage for production file objects
- local disk or in-memory adapter for early development tests
- a storage service interface so app code does not know the provider

### Cache Or Queue

Use cache or queue infrastructure later for:

- asynchronous OCR jobs
- retryable extraction workflows
- temporary upload sessions
- rate limiting

Do not introduce this until the first synchronous path proves insufficient.

## Resume Input Modes

### Paste Text

Initial implementation path:

- trim input
- normalize whitespace
- store as extracted text
- create a resume context snapshot for the draft

Current implementation boundary:

- [Resume normalization helper](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/candidate/resume-normalization.ts)
- [Resume normalization tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/candidate/resume-normalization.test.ts)
- [Candidate practice draft repository](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-practice-draft-repository.ts)

Pasted resume text is normalized before it is written to `resume_context_json`. Empty or whitespace-only paste input becomes no resume context; meaningful pasted text becomes `pastedText`, `extractedText`, and `processedArtifact.text` with `captureMode = "pasted_text"` and `processedArtifact.originalRetained = false`.

### File Upload

Later implementation path:

- upload original file to blob storage
- store metadata in Postgres
- extract text server-side
- persist extracted text
- attach asset to draft

Supported formats should begin with PDF and DOCX.

Current implementation boundary:

- [Candidate practice draft repository](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-practice-draft-repository.ts)
- [Candidate practice draft repository tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-practice-draft-repository.test.ts)
- [Candidate resume extraction service](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-resume-extraction-service.ts)
- [Candidate resume extraction service tests](/c:/tmp/Interview-Coach-Recruiter-postgres/src/lib/server/candidate/candidate-resume-extraction-service.test.ts)

The first upload slice does not extract text yet. It can attach pending upload metadata to an editable candidate-owned draft with `captureMode = "file_upload"`, `processedArtifact = null`, and one `sourceAssets` entry. Storage paths must be private relative paths under `candidate-resume-uploads/`; public URLs, protocol-relative paths, query strings, fragments, backslashes, and parent traversal are rejected before any draft metadata is written.

The first extraction slice is parser-agnostic. A PDF/DOCX parser adapter can provide extracted text to `extractResumeUploadForCandidateDraft`; the service normalizes extracted text, writes it back to the candidate-owned draft, creates a `processedArtifact` with `source = "file_upload"`, and marks the source asset `retention = "original_deleted"`. Parser failures are collapsed to safe reason codes such as `EXTRACTION_FAILED`, `EMPTY_EXTRACTION`, or `UNREADABLE_DOCUMENT`; raw parser messages, file paths, and resume content are not persisted in draft metadata.

### Photo Capture

Later implementation path:

- capture one or more images
- upload images to blob storage
- preserve page order
- run OCR
- merge extracted text by page order
- allow candidate review or correction before generation

## Privacy Requirements

- Resume content is sensitive candidate data.
- Raw file paths and storage URLs should not expose candidate identity.
- Temporary access URLs should be short-lived.
- Logs should not include raw resume text by default.
- AI artifact capture should redact or summarize sensitive resume content unless explicitly approved for a protected diagnostic workflow.

## Acceptance Criteria

- question generation receives `resumeText` or equivalent normalized text
- each resume source has metadata sufficient for support and debugging
- original uploaded files are not required by downstream coach logic
- candidate ownership is checked before reading any resume asset
- failed extraction leaves a recoverable draft state with a safe failure code only

## Open Questions

- Which Azure storage account/container naming convention should this project use?
- Should original resume files be retained, deleted after extraction, or retained only with candidate consent?
- What retention period applies to extracted resume text?
- Should candidates be able to maintain a reusable resume library across apps?
