# Invited Practice Access And Entry

Status: Ratified for Slice 152
Last updated: 2026-07-20

## Purpose

This contract defines how a recruiter-issued Interview Coach link becomes an invite-scoped app session without creating an authenticated candidate profile or retaining bearer material in the navigable URL. It also defines the lightweight initials signal and the two-stage invited pre-session experience.

## Prior Behavior Disposition

| Prior behavior | Disposition | V2 direction |
| --- | --- | --- |
| `/s/[token]` opens one recruiter-created practice session | Preserve and harden | Keep the emailed route, but use it only as a server-side bearer exchange into a clean URL and an HttpOnly invite session. |
| The same invitation link resumes the invited session | Preserve | The invitation bearer remains reusable until expiry or revocation. Each successful exchange may mint a new bounded app session for the same invited session. |
| Initials are entered before the landing screen | Preserve | Keep the two-stage experience and persist the first normalized initials submission as recruiter-facing misinvitation evidence. |
| Initials unlock access | Retire | Link possession is the invite-scoped access proof. Initials never authenticate, deny access, or create an account. Match and mismatch both continue. |
| Candidate name appears after matching initials | Reinterpret | Do not serialize the intended first name into the pre-match client payload. Return it only after a server-computed match or on later recovery of an already matched entry. |
| Bearer token remains in candidate routes and API calls | Retire | Redirect immediately to `/candidate/invited`; subsequent reads and mutations use only the invite-session cookie. |
| Landing rating gates practice | Retire | Optional feedback must never gate invited practice. No rating is part of this entry contract. |
| V1 session storage and generic candidate APIs | Retire | Resolve the V2 invite-scoped recipient/session aggregate and keep it isolated from candidate-led and recruiter principals. |
| Landing reassurance and transition | Reinterpret | Use the shared V2 landing composition, invited-specific disclosure, and `Entering practice space` transition. |

## Access Lifecycle

1. The candidate opens `/s/[token]` from the recruiter invitation.
2. The server validates the token's fixed high-entropy shape, hashes it, and looks up only an active, unexpired, unrevoked token whose batch and recipient remain ready.
3. A successful exchange creates a random invite-session bearer. Only its SHA-256 hash is persisted.
4. The invite session expires after at most seven days and never later than the source invitation token.
5. The response sets `ic_invited_access` as `HttpOnly`, `SameSite=Lax`, production `Secure`, and scoped to `/candidate/invited`.
6. The response redirects to `/candidate/invited` with `no-store`, `no-referrer`, and no bearer, recipient, session, or candidate data in the location.
7. Clean invited routes resolve the cookie hash through the active invite session and source invitation. Candidate-launch and employee cookies are ignored.
8. Unknown, malformed, expired, revoked, and inactive links all reach the same clean unavailable surface. Observability may record a request id and coarse outcome, never token material, token hashes, candidate PII, invitation URLs, or session ids.
9. A malformed invite-session cookie is treated as missing access rather than an application error. It cannot satisfy an invited mutation or affect recruiter/candidate identity cookies.

The invitation token is deliberately reusable because it is the candidate's return mechanism. This is distinct from the one-time TalentArbor host-launch credential. A copied or forwarded invite link therefore grants the same scoped access until revocation or expiry; delivery copy must continue to tell recipients not to forward it.

## Initials Signal

- Accept one or two Unicode letters after compatibility normalization and uppercasing.
- Compute expected initials server-side from the immutable recipient first and last names.
- Persist the first entry per invited practice session with the expected initials at that moment and the computed `match` or `mismatch` result.
- Exact or changed submissions after the first entry return the durable result and do not rewrite it.
- Match and mismatch both proceed to the invited landing screen.
- Recruiter-facing presentation of the signal is deferred to the recruiter dashboard slice.
- Initials are not consent, authentication, identity verification, or an account credential.

## Pre-Session Projection

The clean entry page may expose only facts needed for the invited experience:

- target role;
- interview-stage label;
- question count;
- invited session status;
- whether initials have already been recorded;
- candidate first name only after a durable match;
- immutable plan/wording facts needed by the next shared-session slice.

The landing must state that the recruiting team may review answers to support preparation, AI coaching is candidate-visible, the coach does not score the candidate or make hiring decisions, and the original invitation link is the return mechanism. It must not claim mailbox delivery, recruiter visibility beyond the ratified answer boundary, or candidate-led privacy.

## Recovery And Counterfactuals

- Refresh and a second tab on `/candidate/invited` recover through the invite cookie.
- A different browser must use the original invitation link and receives its own invite session.
- Opening the link concurrently may create multiple bounded access sessions, all scoped to the same invited session. This is acceptable; shared durable practice state is authoritative.
- If the source invitation expires or is revoked, existing invite sessions stop resolving even when their own expiry has not arrived.
- If an invite session expires, the clean URL fails closed; the still-valid original link may establish another.
- A first initials write racing from multiple tabs converges to one immutable signal.
- Completed, abandoned, and future practice-again states require explicit product handling; they must not be silently treated as a fresh planned round.

## Slice 152 Boundary

In scope:

- access-session and initials-signal persistence;
- `/s/[token]` exchange and clean invited route;
- cookie/principal isolation;
- initials submission, match/mismatch continuation, and refresh/new-tab recovery;
- invited landing facts/disclosure and the shared transition invocation;
- generic unavailable handling and privacy-safe diagnostics;
- focused migration, repository, route, component, and database smoke evidence.

Out of scope:

- invited answer drafts, submissions, evaluator calls, feedback actions, and completion;
- recruiter engagement/dashboard reads;
- debrief, practice-again, token regeneration, and manual revocation UI;
- bounce/webhook delivery evidence;
- production edge-log redaction proof.

The transition is the handoff to the next runtime slice. Slice 152 must not present a writable live-answer surface until invited persistence and ownership fencing exist.
