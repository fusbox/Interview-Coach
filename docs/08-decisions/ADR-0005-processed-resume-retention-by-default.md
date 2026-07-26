# ADR-0005: Processed Resume Retention By Default

Date: 2026-07-21
Status: Accepted

## Context

Resume documents, photos, pasted text, and host-resolved resume content are sensitive candidate data. The app needs processed text for personalization, but downstream coaching does not need original documents, photos, or unprocessed text.

## Decision

All resume sources use one server-owned parse, direct-PII-scrub, normalize, candidate-review, and processed-artifact boundary.

Do not retain uploaded documents or captured photos after the processed draft is committed. Dispose of request buffers on every terminal failure as well. If temporary object storage is unavoidable, it must be private, encrypted, opaque, hard-TTL bounded, and deleted before processing is reported successful.

Persist only the versioned candidate-owned processed artifact and safe source metadata needed for candidate use, idempotency, debugging, and support. Pasted and trusted-host text do not bypass the same PII policy merely because no file exists.

## Consequences

- Raw source bytes are processing-only and cannot be a recovery mechanism.
- Failed extraction/OCR requires reselection; safe processed drafts can recover after source disposal.
- Source-disposal failure is an operational failure and cannot be reported as successful processing.
- PII policy and processing policy versions become part of durable processed-artifact provenance.
- Any future raw-file retention should require an explicit product, privacy, and security decision.

