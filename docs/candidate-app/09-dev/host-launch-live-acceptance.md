# TalentArbor Host Launch Live Acceptance

Status: Required staging protocol
Last updated: 2026-07-17

## Purpose

This protocol proves the deployed TalentArbor launch boundary with host-minted, single-use credentials. It complements unit, integration, migration, and local dev-launch tests; it does not replace them.

The acceptance probe never mints, decodes, mutates, echoes, logs, or writes a launch token. It reads one complete host-minted launch URL through hidden standard input, keeps it only in process memory, performs bounded manual-redirect requests, and emits allowlisted HTTP outcome metadata.

## Preconditions

- Interview Coach staging has the production host-launch verifier, Postgres launch-session schema, and TA-only MSSQL adapter configured.
- The deployment can reach TalentArbor staging MSSQL with a least-privilege read account.
- Host and Interview Coach deployments share the staging HS256 secret through their secret stores.
- The host confirms the expected issuer, `source_portal`, `product`, two-minute maximum token lifetime, and mint-per-click behavior.
- Host/CDN/proxy logs redact the `token` query value before requests reach application logging.
- The operator can view Interview Coach application diagnostics by request id without viewing raw request URLs.
- Production-style validation uses HTTPS. HTTP is accepted by the probe only for an explicit localhost check and is not release evidence.

## Safety Rules

1. Never place a launch URL or token in command arguments, shell history, tickets, chat, screenshots, committed files, or saved test output.
2. Run the probe with `--case` only. It prompts for the URL with input hidden.
3. Use a newly minted URL for every case. A probe-consumed URL cannot be reused in a browser.
4. Use synthetic staging candidates and jobs approved for validation.
5. Persist only the probe's metadata report and corresponding server request-id diagnostics.
6. Do not capture response bodies, cookie values, token fingerprints, candidate ids, job ids, email, role, JD, or resume content as acceptance evidence.

## Probe Command

```powershell
npm run qa:candidate:host-launch -- --case identity-new
```

Supported cases:

| Case | Host-minted fixture | Expected HTTP result |
| --- | --- | --- |
| `identity-new` | Valid identity-only token for a candidate with no prep contexts | Session cookie; `/candidate/setup` |
| `identity-returning` | Valid identity-only token for a candidate with prep contexts | Session cookie; `/candidate/dashboard` |
| `job-owned` | Valid token with a candidate-owned `job_collection_id` | Session cookie; `/candidate/setup` |
| `replay-setup` | Fresh valid token whose first entry is setup | First exchange accepted; immediate second exchange rejected |
| `replay-dashboard` | Fresh valid token whose first entry is dashboard | First exchange accepted; immediate second exchange rejected |
| `expired` | Correctly signed token whose `exp` is already past | No cookie; generic safe redirect |
| `wrong-product` | Correctly signed token with a non-IC product | No cookie; generic safe redirect |
| `wrong-issuer` | Correctly signed token with a nonallowlisted issuer | No cookie; generic safe redirect |
| `wrong-source-portal` | Correctly signed token with the wrong source portal | No cookie; generic safe redirect |
| `unowned-job` | Valid identity with a real job id not owned by that candidate | No cookie; generic safe redirect |

The probe checks:

- a manual `302` exchange;
- `Cache-Control: no-store` and `Referrer-Policy: no-referrer`;
- a bounded request-id response header for diagnostic correlation;
- no launch token in any redirect location;
- expected canonical setup/dashboard entry;
- `ic_candidate_launch_session` cookie presence only on acceptance;
- `HttpOnly`, `SameSite=Lax`, `Path=/candidate`, `Expires`, and `Secure` under HTTPS;
- destination reachability without reading its body;
- one-time replay rejection when the replay case is selected.

The public response intentionally does not reveal the internal rejection reason. For negative cases, correlate the reported request id with server diagnostics and confirm the expected allowlisted reason. Do not weaken the route to expose verifier detail in the browser.

## Positive Browser Protocol

Use a separate newly minted URL after the HTTP probe for each browser protocol.

### Identity-only new candidate

1. Open the host quick-link.
2. Confirm the token-bearing route is replaced by clean `/candidate/setup` navigation.
3. Confirm role and JD are ordinary editable required fields.
4. Submit a first setup and confirm the resulting session belongs to a new manual prep context with no host job identity.

### Identity-only returning candidate

1. Open the host quick-link for a candidate with at least one active or paused prep context.
2. Confirm clean `/candidate/dashboard` navigation.
3. Confirm the normal candidate-owned context fallback/canonicalization still applies.

### Owned job-aware candidate

1. Open a job-aware host quick-link.
2. Confirm clean `/candidate/setup` navigation.
3. Confirm canonical role and JD are populated and read-only; stage, count, and optional candidate-entered resume remain editable.
4. Refresh and open the clean setup URL in a second tab. Confirm the same staged role/JD remains available while the launch session is active.
5. Submit from one tab. Confirm first-session creation succeeds and returns a session under the host-backed prep context.
6. Submit the stale second tab. Confirm it receives a conflict and creates no second host-backed path or practice session.
7. Revisit setup with the consumed launch session. Confirm the one-time job prefill is no longer available.

If the owned host job already maps to a prep context with activity, confirm the candidate-owned existing-path choice appears. `View in dashboard` must consume staging and open that exact context; creating a separate path must require an explicit candidate decision.

## Negative Case Correlation

For each negative case:

1. Have the host mint the exact fixture. Do not alter a valid JWT client-side.
2. Run the matching probe case.
3. Confirm no app-session cookie is issued and the redirect contains no token.
4. Correlate the probe request id with the server diagnostic.
5. Record only case id, timestamp, request id, observed safe reason, pass/fail, deployment version, and operator initials.

Expected verifier diagnostics are `expired_token`, `invalid_product`, `invalid_issuer`, and `invalid_source_portal`. An unowned job rejects at identity/context resolution and may report the bounded final reason `invalid_identity`; the TA adapter may additionally report an allowlisted ownership lookup reason. Replay reports `replayed_token` and creates no second launch session.

## Database Reconciliation

For positive cases, an authorized operator may confirm aggregate/identifier-free facts directly in staging operations tooling:

- one launch session was created for the accepted exchange;
- only one row exists after a replay attempt;
- identity-only launch has null job context and creates no setup staging;
- job-aware launch creates one setup-staging row linked to the launch session;
- successful setup or existing-path selection sets the launch session consumed state and removes its staging row;
- the resulting host-backed prep profile carries source platform, job collection, optional requirement, and source launch-session lineage.

Do not export row contents as evidence. Do not query or record token fingerprints, cookie/session ids, candidate identifiers, job identifiers, email, role, JD, or resume text in the acceptance report.

## Release Gate

TA host launch is staging-accepted only when:

- all three positive journey cases pass HTTP and browser validation;
- replay, expiration, wrong product, wrong issuer, wrong source portal, and unowned job fail closed with correlated safe diagnostics;
- cookie and clean-redirect checks pass under HTTPS;
- launch/setup persistence reconciles without duplicate rows;
- no raw credential or candidate/job content appears in the retained evidence;
- secret rotation, upstream query redaction, least-privilege MSSQL access, and deployment network ownership have named operators.

RW remains out of scope until its candidate namespace and workspace mapping are ratified.
