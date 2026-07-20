# Candidate-Led Production Demonstration Milestone

Status: Local milestone pass; deployment acceptance pending
Date: 2026-07-19
Base commit: `bafd1f0`
Scope: Slices 140-145

## Milestone Contract

This milestone closes the first production-shaped candidate-led demonstration path over the durable V2 contracts:

- trusted development launch into candidate setup;
- immutable question planning and wording;
- pre-session landing and transition;
- typed practice with draft preservation, immediate coaching, retry lineage, interruption recovery, and completion;
- role-scoped dashboard return;
- latest Coach Update, Coach Plan, one-question and multi-question follow-up, and durable next-round queue;
- candidate-safe transcript annotations that remain optional and provenance-bound;
- truthful continuation and dashboard fallback when coaching is unavailable.

Production TTS, voice and photo answers, resume ingestion/revision, invited-candidate route wiring, recruiter/admin V2, and real TA/RW deployment acceptance are not part of this milestone.

## Integrated Findings

The milestone pass found and fixed four integration defects:

1. Next-round draft recovery omitted `launch_version`, `consumed_at`, and `expires_at` from its repository projection, so a durable recovery row could be misread as unavailable.
2. The browser-smoke port probe bound only to loopback and could falsely declare port 3000 available while a Next server listened on all interfaces.
3. The seeded browser smoke still exercised the retired V1 `/practice` and summary/TTS contract instead of the candidate-led V2 journey.
4. Isolated Next output made browser validation safer but rewrote tracked TypeScript references; the runner now snapshots and restores those generated configuration files.

No finding required changing evaluator meaning, candidate ownership, immutable attempt lineage, or the production UI contracts landed in Slices 140-144.

## Verification Evidence

### Automated Journey

`npm run test:e2e:candidate-seeded` now runs two Chromium journeys against fixture providers and the disposable local candidate database:

- setup through landing, transition, three coached answers, completion, role-scoped dashboard, Coach Update, and transcript evidence;
- first-question draft save, refresh recovery, and same-session new-tab recovery;
- three saved answers with the analysis endpoint returning `503`, continuation without coaching, completion, and the quiet dashboard retry state.

The runner selects a genuinely free port, uses isolated Next output, restores generated TypeScript references, and never calls a live provider.

The user's accepted browser evidence from the Slices 134-144 runway also covers answer retry, one-question immediate practice, multi-question queue launch and reorder, active-round resume, feedback skip/view, and repeated dashboard recovery. Focused route/component tests preserve those contracts independently of that manual evidence.

### Responsive And Accessibility Smoke

Desktop `1440x900` and mobile `390x844` checks covered setup and the role-scoped dashboard. The checked surfaces had one `main`, one H1, no horizontal overflow, no missing image alternatives, no unnamed actionable controls, and no browser/runtime errors. The wrapped labels for upload and camera inputs resolve through their native accessible names. Existing component tests cover staged-feedback focus and hidden-carousel tab stops.

This is an accessibility baseline, not a WCAG conformance report. Screen-reader review, browser zoom, contrast tooling, and the organizational WCAG target remain release gates.

### Providers

All credentialed gates used synthetic code-owned cases and ignored local artifacts:

- evaluator: `live_eval_9129d8a4780c6b6b`, 7 of 7 cases accepted and passed;
- Coach Update: `live_coach_update_ad67d3eee0958831`, accepted in one transport attempt;
- question wording: `live_question_wording_fc0f14bf9c8afce9`, accepted in one transport attempt.

Human review found the candidate-facing wording suitable for demonstration. One non-blocking QA gap remains: the thin-answer case produced useful coaching but internal criterion bands that appear too generous for the observed markers. The broader evaluator quality set should add assertions for criterion-marker consistency before serving-profile promotion.

### Code And Data Gates

- full candidate suite: 94 files, 619 tests passed;
- specialized host launch, host setup, setup idempotency, intent launch/creation, evaluator, Coach Update, and next-round suites passed;
- `npm run typecheck` passed;
- milestone-scoped lint passed with no warnings;
- long-lived upgrade database readiness passed through migrations 001-022;
- a new empty disposable database passed the same readiness chain and was removed after validation;
- optimized production compilation succeeded.

Full-repository lint and the final Next build type gate are blocked only by the untracked `candidate/dashboard-demo` and `candidate/settings-demo` concept routes. Because files under `src/app` are production routes, they must be relocated outside the route tree or made build-clean before a release candidate can exist. They were deliberately not modified during this milestone.

## Performance Posture

Warm development navigation completed in roughly one to two seconds on the checked dashboard, with no client errors or layout overflow. Cold development compilation took substantially longer and is not a product metric. The optimized application compilation completed in 22.8 seconds, but a production runtime benchmark is deferred until the exploratory route build blocker is removed.

## Slice 146 Hardening Follow-Up

The bounded production-hardening pass resolved the milestone's local route/build condition:

- candidate dashboard, ready, session, and mutation entry modules now expose only App Router-supported exports while adjacent implementation modules retain the existing test seams;
- dashboard, settings, and session concept routes remain available in local development but return 404 in production;
- full-repository lint and TypeScript checks pass;
- the optimized production build/start smoke passes with WCAG 2.2 A/AA axe checks at desktop and mobile, no horizontal overflow, bounded local timing/resource metrics, and production denial of dev/prototype routes;
- the deterministic DB-backed candidate journey also passes axe checks across setup, practice landing, live session, dashboard, Coach Update, and unavailable-coaching fallback;
- WCAG 2.2 Level AA and the metadata-only telemetry, alert, environment, rollback, and post-deploy controls are now ratified working baselines.

The fresh production dependency audit reports one high direct Nodemailer package entry plus two moderate entries for one Next-bundled PostCSS advisory. Nodemailer has no active imports yet, but required recruiter bulk email means it should be upgraded and re-audited in the recruiter-foundation slice before its service is restored. The PostCSS issue has low current reachability because the app does not process user-authored CSS; it remains an upstream-monitoring and explicit risk-acceptance gate. Real TA staging launch, deployed alert delivery, manual accessibility evidence, organizational AI/privacy approval, and the senior release pass remain open.

## Verdict

`local pass`: the candidate-led production-demonstration milestone is safe to commit and demonstrate with the documented local protocol. It is not a release candidate.

The real TA signed-launch/network/least-privilege acceptance matrix remains release-critical but externally gated. Recruiter and invited-candidate V2 may proceed while host details are pending, provided no local simulation is treated as staging acceptance and the resulting shared-host changes retain the documented candidate release gates.
