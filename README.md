# Interview Coach for Recruiters

AI-powered interview practice platform for staffing recruiters and their candidates.

## Status

This repository contains an active Next.js application, not a pre-development placeholder. The quality remediation program through Phase 6 has been executed, with final production sign-off still tracked separately in the quality docs.

Current characteristics:
- Recruiter-authenticated invite creation and email delivery
- Magic-link candidate practice sessions with token-bound API access
- Structured API errors, rate limiting, idempotency, and baseline observability
- CI quality gates for lint, typecheck, coverage, and stability

## Stack

| Layer | Technology |
|---|---|
| App framework | Next.js 15 App Router |
| UI | React 18, TypeScript, Tailwind CSS, Framer Motion |
| Auth + data | Supabase |
| AI | Google Gemini |
| Email | Resend |
| Testing | Vitest, Testing Library |

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env.local` using [Environment Variable Matrix](docs/05-quality/environment_variable_matrix.md).

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:run
npm run test:coverage
npm run test:stability
npm run ci:quality
```

What they do:
- `npm run lint`: ESLint with warnings treated as failures
- `npm run typecheck`: TypeScript no-emit validation
- `npm run test`: default Vitest command
- `npm run test:run`: single-pass Vitest run
- `npm run test:coverage`: coverage-gated Vitest run
- `npm run test:stability`: repeated concurrency/stability suite
- `npm run ci:quality`: local combined quality gate

## Repo Guide

- [Remediation Execution Plan](docs/05-quality/remediation_execution_plan.md)
- [Comprehensive Code Review](docs/05-quality/comprehensive_code_review.md)
- [Security Endpoint Matrix](docs/05-quality/security_endpoint_matrix.md)
- [Environment Variable Matrix](docs/05-quality/environment_variable_matrix.md)
- [QA Checklist](docs/05-quality/QA-checklist.md)
- [Contributing Guide](CONTRIBUTING.md)

## Notes

- Candidate access is through a unique magic link at `/s/[token]`.
- Invite tokens are treated as bearer secrets and are validated server-side against stored hashes.
- Some provider integrations degrade in local/dev environments when optional keys are absent; see the environment matrix for exact behavior.

## License

Proprietary. Internal use only unless explicitly approved.
