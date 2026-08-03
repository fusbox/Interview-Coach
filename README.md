# Interview Coach

AI-assisted interview practice for candidate-led preparation and recruiter-invited sessions.

## Repository Status

This repository contains two important product generations:

- the recruiter-led V1 application, including recruiter-created invitations and invited candidate practice; and
- the cleanroom candidate V2 rebuild, developed on bounded work branches and reviewed into company Azure `dev`, with host-authenticated setup, evidence-first coaching, Coach Update, follow-up practice, and a candidate dashboard.

V2 intentionally reuses proven V1 behavior only after review. Current implementation truth lives in [docs/HANDOFF.md](docs/HANDOFF.md).

## Stack

| Layer | Technology |
| --- | --- |
| App framework | Next.js 15 App Router |
| UI | React 18, TypeScript, Tailwind CSS, Framer Motion |
| Primary app data | PostgreSQL |
| Host context | TalentArbor MSSQL adapter for candidate V2 |
| AI | Google Gemini through the Google Gen AI SDK |
| Email | Nodemailer transport boundary |
| Testing | Vitest, Testing Library, Playwright, SQL smoke validation |

## Local Setup

1. Install dependencies:

```powershell
npm install
```

2. Configure `.env.local` and the disposable PostgreSQL database using [Local Dev Bootstrap](docs/09-dev/local-dev-bootstrap.md).

3. Start the app:

```powershell
npm run dev
```

4. For candidate V2 development, launch a local fixture identity:

```text
http://localhost:3000/candidate/dev/launch?candidate=primary&next=/candidate/setup
```

## Candidate V2 Checks

```powershell
npm run db:smoke-candidate-readiness
npm run test:candidate
npm run test:candidate:host-launch
npm run test:candidate:host-setup
npm run test:candidate:evaluator-configuration
npm run test:candidate:coach-update
npm run test:candidate:next-round
npm run typecheck
```

Use focused tests for the touched boundary first. Migration milestones must also pass against both an empty disposable database and the existing upgrade database.

## General Quality Commands

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run test:coverage
npm run test:stability
npm run ci:quality
```

Full-repository checks can include unrelated V1 or local prototype debt. Do not hide those failures; distinguish them from the scoped candidate gate in the handoff.

## Documentation

- [Documentation index and cleanup roadmap](docs/README.md)
- [Candidate V2 handoff](docs/HANDOFF.md)
- [Candidate V2 spec](docs/SPEC.md)
- [Candidate V2 data contract](docs/DATA_CONTRACT.md)
- [Candidate V2 docs by concern](docs/README.md)
- [Contributing guide](CONTRIBUTING.md)

## Product Boundaries

- Candidate-led V2 practice is for preparation and candidate review, not employer hiring decisions.
- Recruiter-invited candidate behavior remains a distinct audience contract even where it shares session runtime code.
- Host launch credentials, candidate answers, resume/JD content, prompts, and generated coaching must not enter ordinary logs.
- V1-created app data requires no V2 compatibility unless explicitly reintroduced.

## License

Proprietary. Internal use only unless explicitly approved.
