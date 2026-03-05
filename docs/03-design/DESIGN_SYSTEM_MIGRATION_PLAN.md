# Design System Migration Plan (Canonical v1)

Date: 2026-03-04 (refreshed after recent UI refactors)
Horizon: 8–12 weeks
Goal: migrate all major UI surfaces to the canonical design system with low delivery risk.

## 1) Strategy at a glance

Use a **strangler migration**:

1. Stabilize foundations and governance.
2. Build pattern layer for repeated blocks.
3. Migrate highest-impact surfaces first (candidate core flow + recruiter dashboard/create).
4. Enforce with CI/lint and PR gates.

Avoid big-bang rewrites; each sprint ships user-visible value and reduces style debt.

## 1.1) Conflict Resolutions (Pattern vs Feature, Spacing, Glass)

- **Pattern vs Feature Components**: Business-agnostic structures (`MetricCard`, `SectionHeader`, and potentially `FeedbackPanel` if shared across candidate/recruiter) belong in `src/components/patterns/`. Feature-specific compositions belong in `src/features/*/components/`.
- **Spacing Scale**: We strictly use Tailwind's native 4px multiplier tokens (e.g., `gap-3`, `p-6`) instead of aliasing them to custom semantic tokens (`gap-sm`). The spatial proportion natively communicates the scale without unnecessary abstraction.
- **Glassmorphism**: Glass overlays are a premium brand variant, not the default. In Phase 1, we will encode this as a strict `variant="glass"` on the `Card` primitive instead of leaving `.glass-card` classes locally scattered.

---

## 2) Phased plan

## Phase 0 — Baseline & guardrails (Week 1)

Deliverables:

- Freeze canonical spec (tokens, typography, interaction states).
- Add lint/check scripts:
    - block raw hex in TSX/JSX class strings
    - report arbitrary `[Npx]` utilities
- Add `docs/03-design` contribution checklist.

Exit criteria:

- All new PRs follow guardrails.
- Initial debt metrics captured (hex count, arbitrary value count, exceptions list).

## Phase 1 — Token and primitive hardening (Weeks 2–3)

Deliverables:

- Expand semantic tokens and Tailwind mapping.
- Normalize base primitives (`Button`, `Input`, `Card`, `Badge`, `Table`, `Tooltip`, `Progress`) to canonical state rules.
- Add a simple preview/sandbox route for component QA.

Exit criteria:

- Primitives cover required variants/states.
- No new feature code introduces non-system control styling.

## Phase 2 — Pattern layer implementation (Weeks 3–5)

Deliverables:

- Build `src/components/patterns/*`:
    - `StatusBadge`, `MetricCard`, `SectionHeader`, `DataTable`, `StepIndicator`, `FeedbackPanel`, `EmptyState`, `ErrorState`
- Introduce layout helpers (`PageContainer`, `Stack`, `Inline`, `Cluster` optional).

Exit criteria:

- Top 80% recurring UI motifs are patternized.
- Documented usage examples for candidate and recruiter contexts.

## Phase 3 — Surface migration wave A (Weeks 5–8)

Priority surfaces:

1. Candidate session flow (`SessionOrchestrator`, `Landing`, `ActiveQuestion`, `FeedbackDrawer`, `ReviewFeedback`, `Summary`, `SessionSaved`)
2. Recruiter dashboard (`page.tsx` + dashboard cards/table widgets)
3. Recruiter create flow stepper/screens

Exit criteria:

- Target surfaces remove major hard-coded palette and spacing exceptions.
- Screens pass accessibility and visual QA checklist.

## Phase 4 — Surface migration wave B + debt closure (Weeks 8–12)

Priority surfaces:

- Recruiter templates/settings/dev-eval pages
- Remaining nav/layout inconsistencies
- Brand elements and special effects rationalization (glass variants, gradients)

Exit criteria:

- Raw hex and arbitrary value counts reduced by agreed threshold (e.g., >80%).
- Exception list minimized and explicitly approved.

---


### Refactor-aware workstream (additive)

- Consolidate the new pulse-debrief presentation into a reusable `DebriefPanel` pattern component.
- Resolve partial screen retirement by either fully removing `IntakeScreen` from source or reintroducing it through an explicit feature flag and documented flow contract.
- Add regression snapshots around orchestrated candidate states to prevent flow breakage during token/pattern migration.

---

## 3) Backlog template (for each migrated screen)

1. Inventory current component tree and style exceptions.
2. Map each local style to token/variant target.
3. Replace ad hoc markup with pattern components.
4. Verify states (hover/focus/disabled/loading/error).
5. Run regression checks and capture screenshots.
6. Update migration scorecard.

---

## 4) Roles and operating cadence

- **Design lead (Sr UI/UX)**: owns canonical decisions, accessibility sign-off.
- **Frontend lead**: owns implementation standards and CI checks.
- **Feature engineers**: migrate screens by priority backlog.
- **QA**: validates state matrix and responsive behavior.
- **PM**: tracks migration KPI and release risk.

Cadence:

- Weekly design-system triage (45 min)
- Weekly migration dashboard review (30 min)
- Per-PR checklist enforcement

---

## 5) Risk management

### Risks

- Scope creep due to simultaneous feature delivery.
- Regressions in high-complexity session screens.
- Partial adoption where teams bypass patterns under deadline pressure.

### Mitigations

- Enforce guardrails in CI, not only code review.
- Migrate by module with clear ownership and freeze windows.
- Require exceptions to include owner + expiration date.

---

## 6) Success metrics

Engineering/system metrics:

- Raw hex occurrences (trend down)
- Arbitrary pixel utility occurrences (trend down)
- % UI files consuming pattern components (trend up)
- # undocumented exceptions (trend down)

UX outcome metrics:

- Time-to-complete recruiter create flow (no regression, ideally improved)
- Candidate task completion and error recovery rates
- Accessibility defects per release
- UI bug volume tied to inconsistency/styling

---

## 7) Migration scorecard (starter)

| Surface | Owner | Current maturity (1–5) | Target | Phase | Status |
|---|---|---:|---:|---|---|
| Candidate session core (`src/features/session/components/*`) | FE + Design | 2.5 | 4.5 | 3 | Planned |
| Recruiter dashboard (`/recruiter/page.tsx` + widgets) | FE + Design | 2.5 | 4.5 | 3 | Planned |
| Recruiter create flow (`/recruiter/create/*`) | FE + Design | 2.0 | 4.0 | 3 | Planned |
| Recruiter templates/settings/dev-eval | FE + Design | 2.5 | 4.0 | 4 | Planned |
| Global nav/layout/brand | FE + Design | 3.0 | 4.0 | 4 | Planned |

---

## 8) Immediate next actions (this week)

1. Approve canonical spec and migration KPIs.
2. Implement lint checks for hex + arbitrary spacing.
3. Build first two pattern components (`StatusBadge`, `SectionHeader`).
4. Pilot migration on one recruiter dashboard card and one candidate feedback panel.
5. Capture baseline screenshots for visual regression comparisons.
