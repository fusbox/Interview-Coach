# Recruiter SMTP Live Validation

Status: Active guarded acceptance gate
Last updated: 2026-07-20

## Purpose

This runbook proves that the standalone recruiter V2 delivery command can send one synthetic invitation through the configured SMTP provider, durably record `provider_accepted`, recover the accepted state through new recruiter handoff and dashboard reads, and suppress a second provider call for the accepted recipient.

This is a provider-acceptance check, not proof of mailbox delivery. Human confirmation that the message reached the intended test inbox is separate evidence. The integrated recruiter browser journey remains a separate fixture-backed check so a transport failure cannot be mistaken for an application-flow failure.

## Safety Boundary

The command sends real email and therefore refuses to run unless all of these conditions hold:

- `NODE_ENV` is not `production`.
- `RECRUITER_INVITATION_DELIVERY_PROVIDER=smtp`.
- `RECRUITER_SMTP_LIVE_VALIDATION=SEND_ONE_REAL_INVITATION` is set exactly.
- `RECRUITER_SMTP_LIVE_RECIPIENT` names the one approved test mailbox explicitly.
- `RECRUITER_SMTP_LIVE_APP_ORIGIN` is an HTTP(S) origin and is not an unspecified bind address such as `0.0.0.0` or `[::]`.
- SMTP host, port, username, password, and from identity are explicit.
- `ENCRYPTION_SECRET` is at least 32 characters.
- The disposable database is migrated and contains the local recruiter seed.

The verifier creates one code-owned synthetic invitation, invokes the same delivery service and SMTP adapter as the app, performs fresh read-model recovery and resend-suppression checks, and deletes the temporary aggregate in `finally`. The resulting email link is intentionally not a durable browser-test fixture after cleanup.

The command never prints the recipient, SMTP identity or secret, bearer link/token, provider reference, candidate content, or database connection string. Its success summary contains booleans, counts, provider name, and a non-identifying validation run id only.

## Configure

Place approved values in `.env.local`; do not commit them.

```dotenv
RECRUITER_INVITATION_DELIVERY_PROVIDER=smtp
SMTP_HOST=approved.smtp.host
SMTP_PORT=587
SMTP_USERNAME=approved-credential
SMTP_PASSWORD=approved-secret
SMTP_FROM_EMAIL=Rangam Interview Coach <interviews@coach.rangam.com>
ENCRYPTION_SECRET=at-least-32-characters

RECRUITER_SMTP_LIVE_VALIDATION=SEND_ONE_REAL_INVITATION
RECRUITER_SMTP_LIVE_RECIPIENT=approved-test-mailbox@example.com
RECRUITER_SMTP_LIVE_APP_ORIGIN=http://localhost:3000
```

The app server does not need to be running because this gate exercises the service, provider, ledger, and read models directly. Use a deployed HTTPS origin only when the validation owner explicitly wants the generated message to carry that origin.

## Execute

Prepare the disposable database first:

```powershell
npm run postgres:smoke:start
npm run db:migrate
npm run db:seed-recruiter-dev
```

Run the guarded verifier:

```powershell
npm run qa:recruiter:smtp-live
```

Expected sanitized result:

```json
{
  "ok": true,
  "provider": "smtp",
  "providerAccepted": true,
  "attemptNumber": 1,
  "handoffRecovered": true,
  "dashboardRecovered": true,
  "acceptedResendSuppressed": true,
  "providerCallCount": 1,
  "temporaryAggregateRemoved": true
}
```

Also confirm the approved mailbox received exactly one message with the expected sender, subject, and synthetic validation wording. Record the timestamp and environment in deployment evidence without copying the personal link or provider message id into tracked documentation.

## Failure Interpretation

- Guard failure: configuration or explicit consent is missing; no provider call occurs.
- `smtp_authentication_failed`: the provider rejected the configured credentials. No acceptance is claimed.
- `smtp_recipient_rejected` or `recipient_not_accepted`: the provider produced a known rejection. The attempt is terminal unless the recipient/configuration is corrected through a new action.
- `smtp_outcome_unknown`: the transport ended without a trustworthy acceptance/rejection result. The attempt is quarantined and must not be retried automatically because the provider may have accepted it.
- Persistence failure after provider acceptance: treat as an operational reconciliation incident; an automatic resend is unsafe.
- Provider accepted but inbox absent: investigate provider/mailbox delivery separately. Do not rewrite the ledger as delivered or silently resend.

## What This Does Not Prove

- Mailbox placement, bounce, complaint, or downstream delivery events.
- 100-recipient runtime and throughput.
- Worker/outbox durability for asynchronous delivery.
- Production network, secret rotation, logging redaction, alerting, or rollback.
- Recruiter host launch, account recovery/MFA, admin/QA, or candidate browser behavior.

Those remain separate release gates.
