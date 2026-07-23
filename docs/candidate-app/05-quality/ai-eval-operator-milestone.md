# AI Eval Operator Milestone Evidence

Date: 2026-07-22
Slices: 179-183
Verdict: `ready`

## Milestone Contract

The milestone establishes an individually granted operator workbench over exact immutable serving artifacts without changing candidate or recruiter serving behavior. It covers candidate-led and invited immediate answer coaching, candidate Coach Update, candidate baseline question wording, recruiter generated question wording, and honest failed-output inspection. The workflow supports metadata-only discovery, audited just-in-time detail reads, revision-fenced review, reusable findings, immutable submission, target-specific remediation, representative regression promotion, and a later exact-output recheck.

Same-input alternate-profile A/B execution, broad export, deployed grant administration, and the synthetic scenario workspace are separate work.

## Findings Closed

1. **Answer coaching detail was not the exact candidate-visible sequence.** It displayed four raw projection fields while omitting the pattern name and steps, delivery note, stage titles, guidance framing, and available actions. The operator view now reconstructs the same staged interaction used by the live session from the accepted evidence-first projection and feedback intervention. Candidate and invited source payloads now include the answer-attempt and question-slot identity needed to preserve retry behavior.
2. **Coach Update question detail collapsed three coaching fields into one.** The first non-empty acknowledgement hid the observation and next-practice focus. All three fields now render independently.
3. **Representative source coverage was implied rather than proved.** Route tests now render all five source kinds plus an exact failed source. A rollback-only populated-database audit promotes, reads, and submits a review for one healthy source of each kind, inspects one failed/rejected source, verifies one metadata-only audit event per detail read, and proves revocation removes access.

## Verification Evidence

- `npm run db:smoke-ai-eval-operator-milestone`: passed. The existing foundation smoke proved individual-grant denial, idempotent source promotion, atomic finding replay, immutable submission, remediation/regression/recheck rules, stale or changed replay rejection, metadata-only audit, and revocation. The representative pass then covered all five source kinds, five submitted reviews, one failed source, exact read auditing, and revocation inside a rolled-back transaction.
- `npm run test:ai-eval-workbench`: 58 tests passed.
- `npm run test:recruiter-auth`: 57 tests passed.
- `npm run test:candidate`: 662 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- Isolated `npm run build` using `NEXT_DIST_DIR=.next-ai-eval-milestone`: passed; generated config references and build output were removed afterward.
- `git diff --check`: passed before documentation closeout and must remain green at commit time.

## Residual Boundaries

- The representative database audit requires a populated disposable local database because its purpose is to prove exact source compatibility, not to manufacture another synthetic source model. Fresh migration and synthetic workflow coverage remain in the foundation smoke from Slice 182.
- Visual browser review of the expanded stage presentation is not a correctness gate for this milestone; route rendering tests prove all candidate-visible text. The scenario-workspace UI will receive its own browser validation as it lands.
- Deployment still requires explicit grant/revoke operations, retention and masking decisions, audit/telemetry evidence, and release-level security review.
- The scenario foundation and gated credentialed executor subsequently landed in Slices 184-185. Complete credentialed corpus calibration remains Slice 186; A/B remains deferred.

## Next Order

1. Slice 184: scenario authoring, immutable staging, durable deterministic runs, baseline corpus, and Scenarios/Runs workspaces.
2. Slice 185: explicitly gated live execution through every candidate-visible projection seam. Completed.
3. Slice 186: credentialed corpus execution, subjective review, calibration, and regression promotion.
