# Host Launch Local Token Mint

Status: Operational local runbook
Last updated: 2026-07-30

## Purpose

Mint a short-lived TalentArbor-shaped HS256 JWT for local `/candidate/launch` validation without changing TalentArbor.

## Prerequisites

`.env.local` must include:

```text
CANDIDATE_HOST_LAUNCH_SECRET=<at-least-32-bytes>
CANDIDATE_HOST_LAUNCH_EXPECTED_ISSUER=talentarbor
CANDIDATE_HOST_LAUNCH_EXPECTED_WORKSPACE=talentarbor
CANDIDATE_HOST_LAUNCH_MAX_TOKEN_LIFETIME_SECONDS=120
CANDIDATE_HOST_LAUNCH_TA_SQL_SERVER=<server>
CANDIDATE_HOST_LAUNCH_TA_SQL_DATABASE=TalentArbor
CANDIDATE_HOST_LAUNCH_TA_SQL_USER=<reader>
CANDIDATE_HOST_LAUNCH_TA_SQL_PASSWORD=<secret>
CANDIDATE_HOST_LAUNCH_TA_SQL_ENCRYPT=true
CANDIDATE_HOST_LAUNCH_TA_SQL_TRUST_SERVER_CERTIFICATE=true
DATABASE_URL=<local postgres>
HOST_LAUNCH_MINT_CANDIDATE_ID=<explicit local test candidate id>
HOST_LAUNCH_MINT_EMAIL=<canonical email for that candidate>
```

Do not commit `.env.local`. Keep `CANDIDATE_HOST_LAUNCH_DEV_MODE=false` when exercising the production verifier path.

## Mint

```powershell
npm run qa:candidate:mint-host-launch-token
```

Required local identity claims:

- `candidate_id`: `HOST_LAUNCH_MINT_CANDIDATE_ID`
- `email`: `HOST_LAUNCH_MINT_EMAIL`
- `product`: `interview-coach`
- `iss`: configured expected issuer
- numeric `iat` / `exp` / unique `jti`

The script has no default candidate identity. Both identity values must be supplied explicitly in the ignored local environment, and the minted email must match `CandidateMaster.Email` for that candidate id (case-insensitive) or `/candidate/launch` fails closed.

Optional context inputs: `HOST_LAUNCH_MINT_NAME`, `HOST_LAUNCH_MINT_JOB_COLLECTION_ID`, `HOST_LAUNCH_MINT_REQUIREMENT_ID`, `HOST_LAUNCH_MINT_TALENT_CHANNEL_ID`, `HOST_LAUNCH_MINT_CLIENT_ID`.

The script prints only the launch path (token included once). Do not paste tokens into tickets or commit logs.

## Exchange

With the app running (`npm run dev`):

```text
http://localhost:3000/candidate/launch?token=<minted-jwt>
```

Optional flowchart form:

```text
http://localhost:3000/candidate/launch?token=Bearer%20<minted-jwt>
```

Expect:

1. token verified before any product data load;
2. `302` to `/candidate/setup` or `/candidate/dashboard` without the token;
3. `ic_candidate_launch_session` HttpOnly cookie on `/candidate`.
