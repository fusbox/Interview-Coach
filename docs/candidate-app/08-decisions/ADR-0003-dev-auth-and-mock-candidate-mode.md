# ADR-0003: Dev Auth And Mock Candidate Mode

Date: 2026-05-07
Status: Accepted

## Context

The app will eventually support SSO-backed candidate access, but development needs a reliable local path before the final SSO contract exists.

## Decision

Support both:

- password-backed local dev auth using Postgres sessions
- explicit mock candidate mode for local/test workflows

Both modes should resolve to a stable candidate profile context.

## Consequences

- Protected routes can be developed before RangamWorks or TalentArbor SSO is finalized.
- Mock mode must fail closed in production.
- Feature code should consume a candidate access context instead of provider-specific auth details.

