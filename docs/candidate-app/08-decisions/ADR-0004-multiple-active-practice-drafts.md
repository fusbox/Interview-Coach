# ADR-0004: Multiple Active Practice Drafts

Date: 2026-05-07
Status: Accepted

## Context

Candidates may reasonably prepare for multiple roles, interviews, or job descriptions at the same time. They may also start a setup flow, leave it, and return later.

## Decision

Design practice drafts to support multiple active or named drafts per candidate.

The first implementation can start with a simple active-draft UX, but the data model should not require one global active draft forever.

## Consequences

- Draft queries must include candidate ownership and draft identity.
- Dashboard and practice setup should eventually expose active draft selection.
- Resume context snapshots should remain draft-specific.

Current implementation:

- `/practice` restores the latest editable draft by default.
- `/practice?draftId=...` restores a selected owned draft.
- The practice setup page lists editable drafts by role label and last activity date.
