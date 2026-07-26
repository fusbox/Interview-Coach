# ADR-0003: Dev Auth And Mock Candidate Mode

Date: 2026-05-07
Status: Superseded by the V2 dev host-launch and app-owned session contract

## Context

The app will eventually support SSO-backed candidate access, but development needs a reliable local path before the final SSO contract exists.

## Decision

The original decision supported both:

- password-backed local dev auth using Postgres sessions
- explicit mock candidate mode for local/test workflows

Both modes were intended to resolve to a stable candidate profile context.
The clean V2 rebuild supersedes this mechanism. Local testing now enters through the explicit dev host-launch fixture and resolves into the same app-owned candidate session shape used after production launch exchange. Password and generic mock candidate auth are not active V2 product contracts. See [Authenticated Candidate Access](../02-requirements/authenticated-candidate-access.md).

## Consequences

- This record remains as decision history and must not be used to reintroduce a parallel auth model.
- The durable consequence still holds: feature code consumes server-resolved candidate ownership rather than provider-specific browser claims.
