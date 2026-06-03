# Candidate App Handoff

Status: Active execution state
Last updated: 2026-06-02

## Completed

- Candidate implementation now targets the shared Interview Coach app/repo path, currently worked from `feature/candidate-module`.
- Candidate setup, session, summary, and dashboard routes exist in the shared app.
- Candidate `/practice` requires target role and job description; resume content is optional.
- Candidate sessions use the shared question-generation service and candidate-owned session creation.
- Candidate hints and example/strong-response coaching receive resume context when present.
- Candidate feedback and summary use the invite-session style flow closely enough for visible end-to-end testing.
- Candidate summary loads immediately and owns debrief generation/loading.
- `candidate_role_preparation_profiles` is the current persistence anchor for `prepProfile`.
- Dashboard loader reads `prepProfile` context where available and falls back for older rows.
- Dashboard currently renders the Preparedness Map concept with derived `prepProfile` signals, Practice Next, drilldowns, and recent activity.
- Dashboard read behavior now selects one current target interview context and filters stats, Practice Next, and recent activity away from unrelated role sessions.
- Dashboard exposes a first-pass target interview switcher backed by `?targetRole=` so local multi-role testing can switch contexts without mixing role evidence.
- Dashboard Preparedness Map now renders the release-oriented score-driven performance lanes: Answer Substance, Interview Structure, and Communication Delivery.
- Dashboard question coverage now renders separately from performance lanes as category cards for Behavioral, Culture/Fit, Technical/Role-Specific, Case/Scenario, and Screening when category data is available.
- Production `/practice` direction is now host-launched only; manual setup remains normal for local development.
- Platform launch prepProfile migration reference exists for future TalentArbor/RangamWorks job-listing integration.
- Interview preparedness signal contract exists with immutable lane ids and qualitative evidence states.
- Preparedness signal map documents the release pivot: Substance, Structure, and Delivery lanes derive from hidden numeric scores on completed sessions; Role Fit is out of release scope; Interview Range becomes category cards.
- Screening Basics question generation now has an explicit screening-only bucket for interest, background, and availability/logistics questions.
- Dashboard Preparedness Map now aggregates signals across all scoped selected-target-interview items, not only the latest session card.
- Latest clear/strong evidence promotes a signal immediately; repeated weak evidence can pull state down.
- Resume/JD context is treated as source evidence and framing, not as a standalone lane.

## Current State And Context

The current dashboard is useful as a visual shell and read-model proof, but it is not yet the final interview-preparedness product.

Known current behavior:

- Dashboard target-interview scoping is a first pass based on unfinished-session priority, explicit target-role selection, and target role title.
- Preparedness Map UI now consumes the score-driven release read model when answer score payloads are available, while older scoreless rows retain the legacy fallback path.
- Question coverage cards are implemented as a first pass, but the modal/expand behavior and candidate-safe feedback preview are not final.
- Practice Next no longer uses "one focused upgrade" when the legacy `oneBigUpgrade` payload is present; it uses "biggest lift" language.
- Previous sessions are filtered to the selected target interview role, but same-title/different-JD switching still needs a real profile manager later.
- Drilldowns show source refs, but final modal content strategy is not complete.
- Confidence measurement has not landed.
- Runtime PII/sensitive-data scrubbing and QA masking are still open hardening items.
- Host launch token/auth details are not finalized, so platform launch schema changes are documented but not implemented.

Active docs now use this lighter stack:

- [SPEC](./SPEC.md) for product intent and scope.
- [DATA_CONTRACT](./DATA_CONTRACT.md) for system primitives and naming.
- [HANDOFF](./HANDOFF.md) for this active execution snapshot.
- [Decision Records](./08-decisions/README.md) for durable why-decisions.
- [Platform Launch PrepProfile Migration](./04-architecture/platform-launch-prepprofile-migration.md) for future host-platform schema integration.
- [Preparedness Signal Map](./04-architecture/preparedness-signal-map.md) for low-level signal and lane evidence tracing.

Older detailed docs remain available as reference and should not be deleted before a release milestone.

## Immediate Next Step

Harden the score-driven dashboard presentation before adding more visual polish.

Recommended next implementation slice:

1. Browser-validate the new three-lane Preparedness Map and category-card rendering against real Candidate Alt/Primary data.
2. Define and implement the category-card interaction model: tap/click opens practiced questions and candidate-safe feedback preview for that category.
3. Refine lane drilldown copy so it explains hidden score-derived state without exposing numeric scores.
4. Keep `coachSignal` migration queued so legacy `oneBigUpgrade` remains internal-only.

## Current Risks

- Same-title/different-JD prep profiles are not distinguishable in the dashboard until a profile switcher or stricter profile selector lands.
- Overusing latest-session data can hide cross-session patterns the preparedness model is supposed to reveal.
- Category coverage cards currently show first-pass state and count only; richer question-level drilldowns still need product/UI hardening.
- Legacy `oneBigUpgrade` can still exist in persisted payloads until the `coachSignal` schema migration lands.
- Sensitive data can still be too visible in AI-quality/debug surfaces until masking/redaction work lands.

## Refresh Rule

At the end of each meaningful work session, rewrite this file so the next session can resume without reading the full doc set.
