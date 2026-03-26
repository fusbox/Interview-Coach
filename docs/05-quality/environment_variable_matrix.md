# Environment Variable Matrix

Date: 2026-03-17

This matrix documents the environment variables currently used by the application, their purpose, whether they are required, and the security handling expectations.

## Variables

| Variable | Required | Scope | Used For | Current Behavior / Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + server | Supabase project URL | Required for auth/session bootstrap and browser/server Supabase clients. Public identifier, but must point to the intended project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + server | Browser and SSR Supabase access | Public anon key. Safe for client distribution, but should still be scoped to the correct Supabase project and protected by RLS/policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes in production server deployments | Server only | Admin Supabase access | High-sensitivity secret. Never expose to client code or logs. Required for admin-path server operations. Protected server paths should fail fast in production when it is missing. |
| `GEMINI_API_KEY` | Recommended locally, effectively required for production AI features | Server only | Gemini-backed analysis, tips, strong responses, question generation, TTS | In local/test, AI services may degrade/fallback when absent. In production, missing key should be treated as a deployment error via fail-fast server configuration. Treat as a secret. |
| `RESEND_API_KEY` | Recommended locally, effectively required for production email delivery | Server only | Invite and debrief email delivery | In local/test, email service may skip sends when absent. In production, missing key should be treated as a deployment error via fail-fast server configuration. Treat as a secret. |
| `RESEND_FROM_EMAIL` | Optional | Server only | Outbound sender identity | Falls back to `Rangam Interview Coach <interviews@coach.rangam.com>`. Configure explicitly in production to match a verified sender. |
| `RATE_LIMIT_BACKEND` | Optional locally, strongly recommended for explicit deployment configuration | Server only | Rate-limit backend selection | Supported values: `memory`, `supabase`. Defaults to `memory` in local/test and `supabase` in production. `memory` must not be used in production. |
| `METRICS_BACKEND` | Optional locally, required for production release | Server only | Metrics sink selection | Supported values: `memory`, `supabase`. Current implementation still defaults to `memory` unless explicitly set to `supabase`, which is acceptable for local/test only. Production release contract should require `supabase` after the metrics rollup migration is applied. |
| `NEXT_PUBLIC_BASE_URL` | Valid for production release when explicitly configured | Server-only use in current code path, but public-prefixed | Email logo/debrief link generation and compatible configured public-origin fallback | Production may use this as the configured canonical origin when `NEXT_PUBLIC_APP_URL` is absent. Production URL generation should not rely on request-derived host fallback. |
| `NEXT_PUBLIC_APP_URL` | Recommended for production release | Client + server | Canonical app origin for invite links and trusted public URL generation | This is the preferred explicit production origin. Production may also accept `NEXT_PUBLIC_BASE_URL` as a compatibility fallback, but request-derived host fallback remains disallowed. |
| `ENCRYPTION_SECRET` | Yes for encrypted-at-rest features, effectively required in production server deployments using encrypted data | Server only | AES-256-GCM encryption utility | Must be at least 32 characters. High-sensitivity secret. Production server encryption paths should fail fast when it is missing. Rotation requires migration planning for encrypted historical data. |
| `NEXT_PUBLIC_SHOW_DEMO_TOOLS` | Optional | Client + server | Demo-only recruiter helpers | Enables demo tooling outside local development when set to `true`. Should remain `false` in production unless explicitly approved for staging/demo use. |
| `NODE_ENV` | Framework-managed | Client + server | Standard runtime mode | Influences secure cookie handling and demo-tool defaults. Do not override casually. |

## Security Notes

- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, or `ENCRYPTION_SECRET` in client bundles, browser logs, screenshots, or copied examples.
- Prefer deployment-managed secrets over committed local files.
- Set canonical URL variables explicitly in non-local environments. Do not rely on mutable host headers as the primary trust source.
- Keep `NEXT_PUBLIC_SHOW_DEMO_TOOLS` disabled in production by default.

## Local Development Guidance

Minimum practical local setup:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Feature-complete local setup:
- all of the above
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RATE_LIMIT_BACKEND`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `ENCRYPTION_SECRET`

## Operational Guidance

- Changing canonical URL variables affects generated invite/debrief links and email assets.
- `RATE_LIMIT_BACKEND` should be explicitly pinned in non-local deployments so backend selection is visible in configuration review and rollout checklists.
- `METRICS_BACKEND` should remain `memory` only in local/test. Production release should explicitly pin it to `supabase` after the durable metrics migration is applied.
- Missing provider keys may not always hard-fail locally; they can degrade functionality in dev/test by design. In production they should be treated as deployment contract failures, not soft runtime degradation.
- If `ENCRYPTION_SECRET` changes unexpectedly, decryption of historical encrypted values may fail silently in current utility behavior.
- Protected server auth and encryption flows should not rely on implicit fallback behavior in production. Missing required privileged env should be treated as a deployment error, not a recoverable runtime condition.
