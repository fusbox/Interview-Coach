# Shared Audio And Evaluator Calibration Milestone

Date: 2026-07-20
Status: Accepted for commit; conditional for release
Base: `12920ce`
Scope: Slices 161-164

## Scope

This milestone integrates two bounded capabilities:

- one optional question-audio lifecycle shared by candidate-led setup, follow-up ready, candidate sessions, and invited sessions;
- a twelve-case evidence-first evaluator calibration gate with two independent credentialed runs, offline comparison, and human review.

The audit also covers the invited `Pause session` boundary because it flushes the active draft and stops the shared audio lifecycle before presenting saved-progress guidance.

No database migration, second evaluator profile, cross-device playback history, answer recording, photo capture, technical-reference retrieval, or release-environment claim is part of this milestone.

## V1 Disposition

- **Preserve:** pre-session/current/next audio warming, question playback that never blocks text practice, emailed-link recovery for invited candidates, and inspectable evaluator quality evidence.
- **Reinterpret:** replace audience-specific playback behavior with one shared browser engine and ownership-proving server routes; treat invited exit as an in-place pause; evaluate through evidence markers, category signals, criterion applicability, and candidate-safe projections rather than scores.
- **Retire:** duplicated or unstable audio controllers, scripted window closing, recruiter-style exit behavior in invited practice, grammar/style judgment, and legacy scoring fields.
- **Defer:** cross-device playback memory, voice/photo answers, reviewer workflow, a second comparison profile, and serving-profile promotion operations.

## Audit Findings

### Fix Before Milestone

None remained after the Slice 161 browser-engine stabilization and Slice 163 calibration corrections. The combined diff preserves ownership, immutable wording, answer/evaluator lineage, and audience-specific persistence boundaries.

### Accepted Deferrals

- Playback history is browser-tab convenience state, not candidate progress. Refresh does not replay a question after successful playback in that tab; another device may play it again.
- Gemini TTS uses a preview model. The feature is optional and fails silently to visible text, but organizational approval and deployed-environment evidence remain release gates.
- The evaluator has one approved serving profile. Promotion/rollback operations, reviewer workflow, a second profile, and trusted technical references remain separate work.
- The forbidden-feedback grammar is intentionally conservative. Explicit language-skill coaching would require a trusted question/reference contract rather than weakening the current no-grammar-judgment boundary.

## Verification

All checks passed on 2026-07-20:

- `npm run test:candidate:question-audio`: 9 files, 60 tests;
- `npm run test:recruiter-invites`: 51 files, 182 tests;
- `npm run test:recruiter-auth`: 11 files, 55 tests;
- `npm run test:candidate`: 97 files, 636 tests;
- `npm run test:candidate:evaluator-configuration`: 11 files, 131 tests;
- `npm run typecheck`;
- `npm run lint` with zero warnings or errors;
- `npm run build` optimized production build;
- `git diff --check`.

Credentialed evaluator evidence remains:

- `live_eval_c1da8f7f7104975c`: 12 of 12 accepted and passed;
- `live_eval_16784048b2e5d6ca`: 12 of 12 accepted and passed;
- `live_compare_29f03288ef5a9e51`: 12 of 12 comparable;
- human review: both candidate-safe outputs accepted for every case.

User browser acceptance separately confirmed candidate-led and invited audio progression, invited pause/resume and emailed-link recovery, and removal of the unreliable close-window action.

## Verdict

**Ready for commit. Conditional for release.**

The milestone is internally coherent and locally demonstration-ready. It is not release-ready until the existing host, deployed network/telemetry, accessibility, provider-governance, and organizational approval gates are satisfied.
