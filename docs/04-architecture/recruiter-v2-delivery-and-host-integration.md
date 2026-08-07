# Recruiter V2 Delivery And Host Integration

Status: Ratified delivery direction; recruiter identity, authenticated create, and invited-practice persistence foundations landed
Last updated: 2026-07-19

## Purpose

This contract defines how the recruiter portion of Interview Coach V2 can become independently useful while TalentArbor recruiter-launch and messaging integration remain unresolved. It preserves a clean path to deeper host integration without making that external work a prerequisite for a functional recruiter app.

## Delivery Decision

The immediate recruiter release is a standalone Interview Coach workflow with app-owned recruiter authentication. Recruiters sign in directly, create and manage invited-candidate practice, and can send invitations in bulk through the app-owned email service. Durable invite links plus ready-to-use invitation copy remain available for recruiters who need to include Interview Coach in a broader TalentArbor message or recover from delivery friction.

The desired later integration remains:

1. launch Interview Coach from a recruiter-owned TalentArbor surface;
2. establish recruiter identity through a short-lived host exchange;
3. optionally prefill candidate and job context after proving the recruiter is authorized to use both;
4. create the Interview Coach invitation;
5. return the recruiter to an approved TalentArbor messaging surface with the invitation context, or invoke a host-owned messaging API when one exists.

That later integration improves workflow efficiency. It is not required for the standalone recruiter V2 baseline.

## V1 Disposition

| V1 capability | V2 disposition | Direction |
| --- | --- | --- |
| Postgres `app_users`, credentials, sessions, role grants, audit events, and recruiter profiles | Preserve and harden | Use app-owned identity as the immediate canonical recruiter principal. Rebuild route/runtime code against the current V2 app rather than copying modules blindly. |
| `/recruiter/*` namespace and role guards | Preserve | `/recruiter` remains a routing boundary and resolves to the default authenticated recruiter destination. Candidate, recruiter, admin, QA, and invite-token cookies and guards remain distinct. |
| Recruiter create wizard, candidate batch entry, role/JD context, question configuration, and preview | Preserve and simplify | Keep the linear workflow, but use V2 question planning, wording, session, answer-attempt, evaluation, and completion contracts wherever their product meaning is shared. |
| Recruiter question templates | Retire | Templates introduced a competing question-seeding path whose stage/count applicability was unclear. V2 has one role/JD/stage-driven fixed-slot question flow. |
| Durable invite batch, token, retry, attempt, status, and recruiter dashboard behavior | Preserve and reconcile | Retain factual invitation/session state and attempt lineage. Do not port legacy score-derived or feedback-JSON conclusions as V2 truth. |
| Invited candidate initials check and landing boundary | Preserve | Initials remain a possible-misinvitation signal, not authentication. Invited disclosure and recruiter-visibility copy remain distinct from candidate-led practice. |
| App-owned SMTP/provider bulk send, resend, and delivery outcomes | Preserve and harden | Retain this until TalentArbor demonstrably replaces bulk invite delivery and required delivery evidence. Upgrade the vulnerable Nodemailer version, restore the tested service/configuration boundary, and keep invite persistence separate from delivery attempts. |
| Separate invited and candidate-led session engines | Retire | Both audiences should derive from shared V2 runtime facts and lifecycle services with narrow audience-specific adapters. |
| Admin feedback and QA model-comparison UI | Defer | Preserve route ownership and data seams. Scope these after the recruiter invite/session baseline is demonstrable. |

V1 data does not require V2 compatibility or migration.

## Recruiter Question Seeding

V2 removes count selection and templates from recruiter invite creation. The sequence is:

1. enter target role and job description;
2. select interview stage;
3. render the fixed stage-derived question slots;
4. type questions directly or choose the sparkle-icon **Generate questions** action;
5. accept the complete question set, then add candidates and continue through preview/create.

Stage resolves the count on the server: 5 for not-sure/general or screening, 7 for first interview, and 10 for follow-up/final. Recruiters cannot add, delete, or clear individual slots. Successful generation fills and locks the whole block and disables generation. **Start over** clears the whole generated block, restores editable empty slots, and re-enables generation. Manually entered questions remain editable until the recruiter advances; advancing accepts and locks the complete set. The durable accepted snapshot, not temporary browser field state, is the source for invitation creation and exact replay.

### Authenticated create boundary

The V2 create surface uses one authenticated API boundary with two explicit operations:

1. `prepare_questions` accepts the role, job description, interview stage, one browser action key, and either `generated` or `manual` question input. The server derives the fixed plan and question count from stage. Generated input invokes the shared V2 wording runtime; manual input must fill every stage-derived slot and is normalized against that same plan.
2. `create_invitations` accepts the same browser action key, the owned prepared-question-set id, and bounded recipient details. The server reloads the immutable plan/wording under the authenticated recruiter and atomically creates or replays the invitation aggregate.

The route never accepts recruiter identity from the body. The app session is the principal, and the repository separately scopes every question-set and invitation operation to that recruiter id.

Slice 150 lands this as `POST /api/recruiter/invitations`. It accepts JSON only, enforces the declared and actual three-megabyte request ceiling, bounds a batch to 100 unique recipient emails, and returns sensitive handoff responses with `Cache-Control: private, no-store`. Manual question wording shares the V2 8-500 character contract. The authenticated UI is `/recruiter/create`; it offers the stage-owned fixed slots, generated/manual acceptance, candidate entry, review, and copyable links without claiming email delivery.

Question preparation has a durable lifecycle:

- `preparing`: one request owns the provider invocation; a concurrent exact request receives an in-progress response;
- `ready`: the accepted plan and wording are immutable and exact replay returns them without another provider call;
- `failed`: no question set or invitation may be created from the failed action; **Start over** establishes a new browser action key.

The action key is hashed before persistence and is reused for final aggregate idempotency. Changed content under the same key conflicts. Provider success is followed by bounded completion retries using the already accepted output; the provider is not called again merely because persistence or the HTTP response is retried. A process loss between provider success and durable completion remains fail-closed as `preparing`; the recruiter may start over rather than risk silently creating two model generations.

`recruiter_invitation_question_sets` stores the recruiter-owned preparation claim and accepted snapshots. Every new route-created batch retains `source_recruiter_invitation_question_set_id` through an ownership-preserving foreign key. The atomic database wrapper verifies recruiter, action hash, ready state, expiry, context, plan, and wording before creating or replaying the batch. Existing development batches created before Slice 150 may have a null source id; no new route-created batch may do so.

Successful invitation creation returns recruiter-owned handoff links but does not send email or mark delivery. Raw invite tokens exist only in the authenticated response and clipboard-facing browser state; they are not ordinary logs, analytics, or database plaintext.

## Immediate Recruiter Authentication

The first recruiter implementation uses app-owned Postgres authentication:

- `app_users` is the stable internal principal;
- `app_user_credentials` authenticates the standalone password flow;
- `app_user_roles` authorizes recruiter, admin, and QA capabilities;
- `app_sessions` stores hashed, revocable application sessions;
- `auth_audit_events` records privacy-safe login outcomes;
- `recruiter_profiles` stores recruiter presentation details separately from credentials.

Authentication does not prove permission to every invite or session. Recruiter-owned reads and mutations must also prove ownership or an explicitly authorized administrative role.

The public `Employee login` action should target this recruiter login once the route is restored. No candidate cookie or candidate host-launch session may satisfy recruiter authorization.

Slice 147 landed this boundary with the following operational defaults:

- `ic_app_session` is a separate HttpOnly, `SameSite=Lax` bearer cookie; configuring it to either the reserved candidate launch-cookie name or the invited-practice access-cookie name fails closed;
- the standalone session lifetime defaults to eight hours and is configurable through `APP_SESSION_TTL_SECONDS`;
- raw session tokens never enter Postgres; only SHA-256 hashes are stored, and logout revokes the durable row before clearing the browser cookie;
- the route middleware preserves an exact allowlisted `/recruiter/*` return target, but cookie presence is only a routing hint; the server layout resolves the session and role before rendering protected content;
- recruiter and admin roles may enter the recruiter namespace; QA-only and roleless users receive no recruiter content;
- unknown, bad-password, disabled, and currently locked identities receive the same public login failure while the audit event retains the internal reason;
- ten failed password attempts establish a fifteen-minute lock in the current standalone baseline; final MFA, administrator-unlock, reset, and support policy remain release decisions;
- the deterministic development recruiter and password can be seeded only through a command that always targets the disposable local smoke database and is disabled under `NODE_ENV=production`.

Recruiter login and logout use one navigation-handoff lifecycle: the initiating control is claimed synchronously, duplicate activation is ignored, and a recoverable request or navigation failure restores the control. After an accepted session mutation hands navigation to the destination, the departing control remains busy and disabled until the route transition unmounts it. Success must not briefly return the login or logout surface to an idle state.

Existing `auth:provision-user` remains the explicit production/staging account provisioning mechanism until an approved administrator or host-identity workflow replaces it. Development seed credentials are not a deployable account posture.

## Invite Handoff Baseline

The durable invited identity/session foundation is governed by [Invited Practice Identity And Session Foundation](./invited-practice-identity-session-foundation.md). Recruiter invitation creation uses invite-scoped recipients and invited V2 session envelopes; it never creates authenticated candidate-led profiles or writes candidate-owned practice tables.

Successful invite creation persists the invitation before any delivery or handoff action. The recruiter surface should provide:

- **Send invitations** for one or many candidates through the configured app-owned provider;
- **Copy invite link** for each candidate;
- **Copy invitation message** containing approved concise guidance and the candidate-specific link;
- clear queued, provider-accepted, failed, copied, stale, revoked, regenerated, and retry states;
- an accessible way to reopen the same handoff information from the recruiter dashboard;
- batch-friendly handling that never puts another candidate's link on the clipboard;
- no candidate answer, coaching, resume, or hidden evaluation data in the copied message.

Invite creation, email delivery attempts, and clipboard actions are separate facts. A lost response or partial bulk failure must not create duplicate invitations or resend successful recipients when the recruiter retries only failures. Clipboard actions are conveniences, not delivery evidence, and V2 must not label an invitation sent merely because content was copied.

An SMTP/provider success proves provider acceptance, not mailbox placement or candidate engagement. Preserve provider message/reference ids and bounded delivery status where available without placing invite tokens or candidate content in ordinary telemetry. A future TalentArbor handback or messaging API may become another delivery channel with its own persisted result; retire the app-owned service only after replacement acceptance explicitly covers bulk operations and required evidence.

Production creation and delivery require one explicit HTTPS `NEXT_PUBLIC_APP_URL`; invitation links must never be derived from an untrusted production request host or emitted over plain HTTP. Local development may derive an HTTP or HTTPS origin from the current request when the variable is absent.

### App-owned delivery-attempt contract

Slice 151 adds delivery as a separate recruiter-owned command over an already-created invitation batch. It does not regenerate questions, sessions, access tokens, or links. The server reloads the owned invitation aggregate and decrypts each link only while constructing that recipient's message.

Each recipient is delivered separately even when the recruiter invokes one bulk action. V1's one-message BCC pattern is retired because candidate-specific bearer links cannot safely share one message. The provider adapter retains the useful V1 SMTP settings and Nodemailer seam, but configuration absence is now an explicit failure rather than a successful no-op. Recruiter CC is also retired from the default path so candidate bearer links are not copied into another mailbox merely to provide delivery evidence.

SMTP connection, greeting, and socket waits are bounded, and the adapter requires TLS 1.2 or newer. A transport failure with no trustworthy provider outcome remains quarantined rather than automatically retried.

`recruiter_invitation_delivery_attempts` provides one durable identity for every provider invocation:

- `queued` means the action has been claimed but no provider call has started;
- `sending` means the provider call may have started and a concurrent action must not send it again;
- `provider_accepted` means the provider returned one accepted recipient and a reference id; this is terminal and never retryable;
- `failed` means the application has a bounded safe failure classification; only explicitly retryable failures may create a later attempt;
- `outcome_unknown` means the provider call began but the application cannot prove whether the provider accepted it. This is terminal for automatic retry because retrying could send a duplicate.

An attempt row is never reused for a later send. Retry creates the next recipient-scoped attempt number and points back to the prior failed attempt. The attempt identity and source lineage are immutable; only the fenced lifecycle transition from `queued` to `sending` and then to one terminal outcome may update the row. An exact action replay returns the same attempt instead of invoking the provider twice. A different action skips recipients with accepted, sending, queued, outcome-unknown, or non-retryable-failed latest attempts.

Recovery is bounded rather than indefinite. An exact replay may safely resume its own queued attempt because no provider call has begun. A different action may retire a queued claim as retryable after five minutes and append a new attempt. A sending attempt still unresolved after ten minutes becomes `outcome_unknown`; it is not automatically retried because the provider may have accepted the message before the process stopped.

The application sends with bounded per-recipient concurrency. It stores only provider name, reference id, attempt timing, retryability, and a code-owned failure classification. Raw provider responses, bearer links, message bodies, candidate resume content, and ordinary candidate/recruiter email values do not enter delivery telemetry.

The approved invitation message is shared by email and **Copy invitation message** so those paths do not drift. It names the candidate and role, provides that candidate's personal link, asks them not to forward it, and states that Interview Coach supports preparation rather than making hiring decisions. It does not make unratified claims about recruiter visibility. Clipboard actions remain browser-local conveniences and do not mutate delivery state.

### Durable recruiter handoff

The create flow's immediate result is not the only recovery boundary. One separately authorized, private, no-store `/recruiter/invitations/[batchId]` detail reconstructs the recipient handoff from the owned aggregate and latest delivery ledger. Dashboard and list reads carry only the opaque batch id; recovered personal links and approved copy messages exist only inside this owner-fenced detail.

The handoff reuses the existing batch delivery command rather than adding a resend endpoint. Never-attempted and retryable-failed recipients are eligible, stale queued claims follow the five-minute recovery rule, and accepted, actively queued/sending, unknown-outcome, non-retryable, revoked, expired, or key-unavailable recipients are suppressed. See [Recruiter Invitation Handoff Read Contract](./recruiter-invitation-handoff-read-contract.md).

Local development may select the deterministic `fixture` adapter explicitly. Production requires `smtp` plus valid SMTP credentials and fails closed for any other configuration. Fixture acceptance proves application lifecycle behavior only; a credentialed SMTP acceptance run remains separate deployment evidence. Use the guarded [Recruiter SMTP Live Validation](../05-quality/recruiter-smtp-live-validation-runbook.md) gate to send one synthetic invitation through the same V2 service, recover the accepted ledger state through fresh recruiter reads, and prove accepted-recipient resend suppression. Provider acceptance must remain distinct from mailbox delivery.

## Future Recruiter Host Launch

Candidate host launch supplies a reusable security pattern, not a recruiter login implementation. A recruiter launch still needs its own contract because the principal, authorization, route, cookie, and optional context differ.

Reusable concepts include:

- short-lived signed, one-time exchange credentials;
- issuer/product/time validation and replay denial;
- clean redirect into an independently governed Interview Coach session;
- server-only MSSQL lookup through bounded least-privilege queries;
- metadata-only diagnostics and upstream token-query redaction.

Recruiter-specific work still required:

- authoritative host recruiter/employee identifier and issuer namespace;
- role/employment status and entitlement rules;
- recruiter-to-candidate/job authorization checks;
- `/recruiter/launch` route and recruiter-scoped cookie;
- a durable external-identity mapping keyed by issuer/source plus external recruiter identifier;
- optional candidate/job prefill and its stale/deleted/unauthorized behavior;
- approved TalentArbor messaging return route or host-owned send API.

Do not bind a host recruiter to an existing `app_user` by email alone. Email is mutable and may be reused. When host launch is implemented, add an explicit external-identity record that binds the host namespace and immutable external subject to one internal `app_users.user_id`. An administrator may explicitly link an existing password account after proving both identities.

Do not generalize `/candidate/launch` into an actor-ambiguous endpoint. Candidate and recruiter exchanges may share low-level verification/session utilities later, but their HTTP routes and authorization policies remain separate.

## TalentArbor Integration Checkpoint

No additional speculative candidate-launch code is required before recruiter work begins. The Interview Coach side already has a candidate-specific verifier, one-time exchange, app session, TA MSSQL adapter, trusted job setup staging, and live acceptance harness.

The remaining candidate staging requirements are external configuration and evidence:

- final host-ratified claim names, issuer/source values, and mint-per-click behavior;
- secret exchange and rotation ownership;
- deployed network path plus least-privilege TA MSSQL credentials;
- ingress/CDN query redaction;
- one real host-minted token and the documented live acceptance matrix.

Keep these as release gates. Do not invent their values or hold the recruiter rebuild behind them.

## Delivery Runway

1. **Recruiter foundation (landed):** Nodemailer is on `9.0.3`; app-owned login/logout, hashed revocable sessions, role guards, `/recruiter/*` route ownership, audit events, safe return targets, and a local-only test recruiter are restored.
2. **Invite creation and delivery (landed):** the atomic invite-scoped recipient/session/token persistence foundation, simplified authenticated fixed-slot create UI/API, append-on-retry per-recipient delivery attempts, partial-failure retry, accepted-recipient suppression, and copy-link/copy-message affordances are landed. Credentialed SMTP acceptance and later bounce/webhook reconciliation remain operational evidence, not creation semantics.
3. **Invited candidate convergence (landed):** `/s/[token]`, invite-scoped access, initials signal, invited landing, shared V2 live session, candidate-only debrief, immutable whole-session practice again, and recruiter-visibility boundaries are landed. Broader browser/release evidence remains.
4. **Recruiter operations (core landed):** invite/session status, factual progress and attempt context, employer-safe latest-answer transcript, owner-fenced reopenable handoff/retry controls, and the single-consumer candidate-facing display-name setting are landed without exposing candidate-led private practice. Credentialed SMTP evidence remains.
5. **Host integration:** add recruiter external identity, `/recruiter/launch`, authorized TA prefill, and messaging handback only after the host contracts are known.
6. **Admin and QA:** rebuild privileged surfaces against V2 evidence and comparison contracts after the core recruiter journey is stable.

## Acceptance Boundaries

- App-owned recruiter login fails closed when its database, cookie, credential, session, or role posture is invalid. Local seed credentials are never a production dependency.
- Recruiter role authorization is enforced server-side now; every future recruiter-owned resource route must separately prove ownership or an explicitly authorized administrator role.
- Invite creation is idempotent and a lost response does not create duplicate candidate invitations.
- Every new authenticated create batch has an explicit immutable link to the owned accepted question set that authorized it.
- Bulk delivery records per-recipient outcomes and retries failed recipients without resending successful ones.
- Copied state is never recorded as sent state.
- Candidate-led practice content remains unavailable to recruiter surfaces.
- Invited-candidate disclosure accurately states what the inviting organization can access.
- Candidate-led and invited sessions share durable V2 answer/evaluation facts without sharing identity or visibility rules.
- Future host launch can bind to the same internal recruiter principal without replacing or duplicating its owned records.

## Open Decisions

- Final recruiter account provisioning, password reset, MFA, administrator unlock, and support policy. The current ten-attempt/fifteen-minute lock is a bounded standalone baseline, not the final enterprise identity policy.
- The minimum standalone recruiter V2 surface set for the first demo is now create, dashboard, transcript, invitation handoff, and the single-consumer settings page. Templates are explicitly retired; any additional settings or operational surface requires a defined consumer and separate contract.
- Recruiter visibility into invited answers and factual transcripts, including disclosure and retention.
- Whether TalentArbor can accept a messaging deep link, structured draft handoff, or server-to-server send request.
- Which provider-level status constitutes `sent`, which delivery/bounce events are available, and their retention policy.
- Whether bounded synchronous fan-out can finish a 100-recipient batch within the deployed request limit. Measure the approved SMTP relay and function runtime; move provider execution behind a durable worker/outbox if it cannot. The landed attempt ledger and replay fences remain the source for that worker rather than being replaced.
- Operations policy for `outcome_unknown`, including provider-side lookup by stable message id and who may explicitly authorize a resend. Automatic retry remains prohibited.
- Final provider-generation rate limit and expired/abandoned question-set cleanup policy. The current authenticated boundary prevents duplicate work under one action key but does not cap intentional fresh action keys.
- Recruiter create-draft recovery across refresh or browser restart. Current retry preserves one action key while the mounted flow remains active; persisting candidate recipient PII in browser storage is not approved by this slice.
- Final invitation-token lifetime plus encryption-key rotation and old-key read window. The landed vault records a key id and fails closed on a different key; production rotation needs an explicit bounded key ring before replacing `ENCRYPTION_SECRET`.
- Authoritative TA recruiter identifier, role entitlement, candidate/job authorization relationship, and external identity namespace.
