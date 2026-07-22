# Resume Ingestion Milestone

Date: 2026-07-22
Scope: Slices 172-178
Verdict: Accepted for local demonstration; not release-approved

## Milestone Contract

Paste, trusted-host text, PDF/DOCX upload, and ordered photo capture converge on one candidate-owned processing boundary. The server proves identity before reading source content, bounds and validates acquisition, extracts or transcribes only when needed, applies one versioned deterministic direct-PII policy, disposes app-owned source bytes before persistence, and presents only processed text for candidate review. An exact accepted artifact is selected by a server-derived setup owner, recovered across browsers, consumed atomically with setup, and propagated by immutable reference and safe label into initial and follow-up practice. A later generic setup starts blank.

V1's useful optional resume context and downstream personalization are preserved. Raw browser persistence, durable original files, normalized-paste-as-privacy-complete, and generic Boolean-only landing context are retired or reinterpreted. Trusted-host lookup plus later resume revision/question replacement remain separate work.

## Senior Milestone Findings

The integrated pass found and fixed four issues that isolated slice tests did not fully expose:

1. Browser draft hydration could overwrite a field edited immediately after first paint. Per-field edit fences now allow recovery to populate untouched setup state without winning over newer user input.
2. Replaying migration `009` on a database containing source-linked voice attempts fired the later voice trigger before `ON CONFLICT DO NOTHING`. The backfill now excludes an already-normalized attempt before insert, preserving strict source lineage and monotonic migration replay.
3. The invited voice route exported a test helper that development accepted but optimized App Router validation rejected. The adapter now lives in an adjacent implementation module and the route exports only supported route members.
4. Manual PDF/photo fixtures were present under `public/`. They were moved to ignored `.untracked/resume-fixtures` so local validation material is neither web-addressable nor packageable by accident.

No milestone-blocking ownership, data-lineage, stale-operation, exact-consumption, or privacy defect remains known.

Slice 178 subsequently closed the first code-owned operations gap without changing candidate UX. Durable source-specific admission now happens before source-body consumption, exact operation replay returns the selected artifact, only the current unexpired generation may publish, and stale/foreign/superseded work fails closed. The database lease bounds admitted logical work across app instances; deployed process isolation remains necessary to forcibly terminate a parser that outlives its lease.

## Verification Evidence

- The 21-file resume suite passes: 148 tests covering policies, artifacts, parsers, OCR, route ownership, durable admission, denial-before-body-read, stale operations, late-generation selection fencing, review fencing, setup resolution, browser-draft minimization, and landing propagation.
- The full candidate suite passes: 97 files and 662 tests.
- The long-lived database readiness chain and a fresh temporary database pass through migrations `001-036`, including candidate setup, concurrency, voice-source lineage, processed-resume lifecycle, selection consumption, durable resume-operation replay/limits/ownership/stale recovery, and development seed smokes.
- The optimized production build/start smoke passes three checks: desktop/mobile WCAG 2.2 A/AA public shell, development-route denial, and the real Node PDF parser route boundary.
- A seeded browser contract proves direct-PII removal, review, refresh recovery, a fresh mobile browser-context recovery, explicit acceptance, ready-landing label, and clean-slate setup after consumption. The provider-unavailable candidate journey was rerun after the hydration correction.
- A database privacy query over artifacts created by the browser test found zero raw name, email, phone, and street-address rows while confirming scrubbed output.
- Typecheck, zero-warning lint, and `git diff --check` pass.
- Manual evidence already accepted PDF and DOCX extraction, image-PDF safe fallback, desktop/mobile pickers, and a credentialed real-device photo capture with accurate ordered OCR and direct-PII scrubbing.

## Dependency Posture

`npm audit --omit=dev` reports four vulnerable package entries representing three concerns: high `brace-expansion` through the Google SDK cleanup chain, moderate Next-bundled PostCSS, and high Sharp/libvips through Next. No finding is attributed to `busboy`, `mammoth`, or `pdf-parse`. Current app reachability is bounded as documented in the production-hardening controls, but each concern still requires a tested compatible upgrade or explicit time-bounded risk acceptance before pilot.

## Bounded Deferrals And Release Gates

- Trusted-host resume lookup and staging through the shared processor.
- Resume revision, question reconciliation, and historical version UX.
- A deployed metrics/alert sink and tuned staging thresholds for the landed metadata-only ingestion diagnostics.
- Deployed parser/OCR timeout, memory, disposal, and subprocessor evidence.
- Broader device and assistive-technology coverage beyond the automated Chromium matrix and accepted local mobile capture.
- Organizational privacy/AI approval and dependency disposition.

These are release or later-product gates; they do not invalidate the local milestone contract.
