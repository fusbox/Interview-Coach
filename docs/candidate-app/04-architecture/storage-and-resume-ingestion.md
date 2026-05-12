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
  sourceAssetIds: string[];
  pastedText: string | null;
  extractedText: string;
  captureMode: "none" | "pasted_text" | "file_upload" | "image_capture" | "mixed";
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

Pasted resume text is normalized before it is written to `resume_context_json`. Empty or whitespace-only paste input becomes no resume context; meaningful pasted text becomes both `pastedText` and `extractedText` with `captureMode = "pasted_text"`.

### File Upload

Later implementation path:

- upload original file to blob storage
- store metadata in Postgres
- extract text server-side
- persist extracted text
- attach asset to draft

Supported formats should begin with PDF and DOCX.

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
- failed extraction leaves a recoverable draft state

## Open Questions

- Which Azure storage account/container naming convention should this project use?
- Should original resume files be retained, deleted after extraction, or retained only with candidate consent?
- What retention period applies to extracted resume text?
- Should candidates be able to maintain a reusable resume library across apps?
