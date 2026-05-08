# ADR-0005: Processed Resume Retention By Default

Date: 2026-05-07
Status: Accepted

## Context

Resume files are sensitive candidate data. The app needs resume content for personalization, but the original uploaded file is not necessarily needed after text extraction and normalization.

## Decision

Do not retain original uploaded resume files by default after normalization and redaction.

Persist the processed resume artifact and source metadata needed for candidate use, debugging, and support.

## Consequences

- File upload workflows should support deletion of original blobs after extraction succeeds.
- Extraction failures need a recoverable state before deletion.
- Any future raw-file retention should require an explicit product, privacy, and security decision.

