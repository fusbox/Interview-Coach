# Environment Variable Matrix

Date: 2026-03-17

This matrix documents the environment variables currently used by the application, their purpose, whether they are required, and the security handling expectations.

## Variables

| Variable | Required | Scope | Used For | Current Behavior / Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + server | Supabase project URL | Required for auth/session bootstrap and browser/server Supabase clients. Public identifier, but must point to the intended project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + server | Browser and SSR Supabase access | Public anon key. Safe for client distribution, but should still be scoped to the correct Supabase project and protected by RLS/policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes in production server deployments | Server only | Admin Supabase access | High-sensitivity secret. Never expose to client code or logs. Required for admin-path server operations. |
| `GEMINI_API_KEY` | Recommended locally, effectively required for production AI features | Server only | Gemini-backed analysis, tips, strong responses, question generation, TTS | When absent, AI services log warnings and may degrade/fallback instead of operating fully. Treat as a secret. |
| `RESEND_API_KEY` | Recommended locally, effectively required for production email delivery | Server only | Invite and debrief email delivery | When absent, email service logs warnings and skips sends. Treat as a secret. |
| `RESEND_FROM_EMAIL` | Optional | Server only | Outbound sender identity | Falls back to `Rangam Interview Coach <interviews@coach.rangam.com>`. Configure explicitly in production to match a verified sender. |
| `NEXT_PUBLIC_BASE_URL` | Recommended | Server-only use in current code path, but public-prefixed | Email logo/debrief link generation | Falls back to `https://coach.rangam.com`. Set explicitly per deployment to avoid wrong absolute URLs in email content. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Client + server | Canonical app origin for invite links and some UI origin logic | Used by recruiter invite creation for generated magic links. Set explicitly in deployed environments to avoid relying on request origin. |
| `ENCRYPTION_SECRET` | Yes for encrypted-at-rest features | Server only | AES-256-GCM encryption utility | Must be at least 32 characters. High-sensitivity secret. Rotation requires migration planning for encrypted historical data. |
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
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `ENCRYPTION_SECRET`

## Operational Guidance

- Changing canonical URL variables affects generated invite/debrief links and email assets.
- Missing provider keys may not always hard-fail locally; they can degrade functionality. Validate production environments explicitly before release.
- If `ENCRYPTION_SECRET` changes unexpectedly, decryption of historical encrypted values may fail silently in current utility behavior.
