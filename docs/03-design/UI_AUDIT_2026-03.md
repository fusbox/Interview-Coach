# UI Audit — Current State (Interview Coach Recruiter)

Date: 2026-03-04 (refreshed after session-flow refactors)
Owner: Product Design / UX Architecture
Scope: Candidate + Recruiter experiences in `src/app`, `src/features`, and shared layout/brand components.

## 1) Executive summary

The product has strong building blocks (Tailwind token scaffold + shadcn-style primitives), but visual and interaction consistency is currently **component-local** rather than **system-driven**. The codebase shows mixed maturity:

- Foundation exists: semantic tokens in `src/index.css`, themed Tailwind mapping in `tailwind.config.ts`, and reusable primitives in `src/components/ui/*`.
- Drift exists: raw color literals, one-off gradients, many arbitrary pixel values, and bespoke glassmorphism classes in feature components.
- IA/flow complexity is high (candidate interview workflow + recruiter dashboard/create/templates/settings/dev-eval); without canonical patterns, UX variance will grow quickly.

**Audit verdict:** design system readiness is medium, but governance and migration discipline are low.

---

## 2) Product surface inventory ("all UI")

### Candidate-facing

- Landing/marketing entry: `src/app/page.tsx`
- Auth entry: `src/app/login/page.tsx`
- Candidate tokenized route:
    - Session shell: `src/app/(candidate)/s/[token]/layout.tsx`
    - Session screen: `src/app/(candidate)/s/[token]/page.tsx`
    - Coaching screen: `src/app/(candidate)/s/[token]/coaching/page.tsx`
- Session module screens/components:
    - `src/features/session/components/*` (e.g., `SessionOrchestrator`, `LandingScreen`, `ActiveQuestionScreen`, `FeedbackDrawer`, `ReviewFeedbackScreen`, `SummaryScreen`, `SessionSavedScreen`, `UnifiedSessionScreen`)

### Recruiter-facing

- Dashboard shell + nav: `src/app/(recruiter)/recruiter/layout.tsx`, `src/components/layout/*`
- Recruiter dashboard: `src/app/(recruiter)/recruiter/page.tsx`
- Session detail: `src/app/(recruiter)/recruiter/sessions/[id]/page.tsx`
- Create flow (multi-step): `src/app/(recruiter)/recruiter/create/page.tsx` + `create/components/*`
- Templates: `src/app/(recruiter)/recruiter/templates/page.tsx`
- Settings: `src/app/(recruiter)/recruiter/settings/page.tsx`
- Dev eval tooling: `src/app/(recruiter)/recruiter/dev-eval/page.tsx`, `dev-eval/[id]/page.tsx`, `dev-eval/components/*`

### Shared / global UI

- App shell + progress indicator: `src/app/layout.tsx`
- Error page: `src/app/error.tsx`
- Brand components: `src/components/brand/*`
- Shared primitives: `src/components/ui/*`

---

## 3) Quantitative design-system health signals

Static scan snapshot:

- TSX files in `src/**`: **74**
- Files with class-driven UI markup: **65**
- Files importing shared UI primitives (`@/components/ui/*`): **40**

Drift indicators:

- Raw hex usages in source: **15 matches across 9 files**
- Arbitrary pixel utilities (`[###px]`): **120 matches across 29 files**
- Inline style usage: **8 matches across 4 files**



## 3.1) Refactor deltas captured in this refresh

- Candidate session flow has shifted further into orchestrated screen state handling through `SessionOrchestrator` and related screen modules.
- `IntakeScreen` remains in the codebase but is currently marked as removed from active flow inside orchestrator comments, indicating partial retirement and potential cleanup opportunity.
- Feedback/debrief UX language has been simplified in summary surfaces; migration planning should now treat debrief as a first-class pattern in canonical components.

Interpretation:

- Primitive adoption is decent in breadth, but **not enough to prevent local styling divergence**.
- Arbitrary value density suggests spacing/layout tokens are not trusted or not expressive enough.
- Raw hex usage indicates token bypass in both brand and feature surfaces.

---

## 4) Severity-ranked findings

## P0 — Must fix to establish canonical system

1. **Token bypass via hard-coded colors**
    - Found in brand/logo, sidebar badges, recruiter tables/legend gradients, session feedback/unified screens.
    - Risk: inaccessible color contrast, dark-mode inconsistency, brand drift.

2. **No single source for component states across product modules**
    - Same interaction intents (status badges, step indicators, info cards, empty states) are implemented ad hoc in route-local components.
    - Risk: inconsistent hover/focus/disabled/error behaviors and uneven accessibility.

3. **High arbitrary spacing/radius density**
    - Widespread `[Npx]` utilities indicate weak spatial scale enforcement.
    - Risk: near-duplicate layouts and visual entropy that slows iteration.

## P1 — Should fix in migration wave 1

4. **Visual language split (glassmorphism vs standard card surfaces)**
    - `.glass-card` / `.glass-overlay` coexist with neutral card surfaces; gradients often vary between modules.
    - Risk: brand ambiguity and reduced information hierarchy clarity.

5. **Iconography and microcopy patterns not systematized**
    - Success/warning/readiness labels and helper copy appear module-specific.
    - Risk: cognitive overhead and inconsistent semantics.

6. **Table and data-density patterns diverge**
    - Recruiter tables, dev-eval table, and session stats widgets likely use mixed row heights/typography emphasis.
    - Risk: scanning inefficiency for recruiter workflows.

## P2 — Governance and scale risks

7. **No documented contribution contract for design tokens/variants**
8. **No visual regression baseline for key screens**
9. **No migration scorecard tied to release cadence**

---

## 5) UX consistency rubric (used for audit)

Every screen/component is graded against:

- **Visual consistency** (tokens only, no ad hoc palette)
- **Interaction consistency** (states, focus ring, motion behavior)
- **Information architecture** (predictable grouping and emphasis)
- **Accessibility readiness** (contrast, focus visibility, semantics)
- **Responsiveness** (tokenized breakpoints and spacing)

Current median maturity: **2.5 / 5**.

---

## 6) Recommended canonical direction

- Keep semantic HSL token architecture already present.
- Expand token set to include:
    - surface tiers (base/subtle/raised/overlay)
    - readability states (excellent/good/risk/critical)
    - recruiter workflow semantics (open/in-progress/completed/blocked)
- Introduce composed pattern components for top recurring UI blocks:
    - `StatusBadge`, `MetricCard`, `SectionHeader`, `DataTable`, `Stepper`, `EmptyState`, `FeedbackPanel`
- Enforce style governance with lint checks and PR checklist gate.

---

## 7) Deliverables created from this audit

1. `docs/03-design/CANONICAL_DESIGN_SYSTEM_SPEC.md` — target system definition.
2. `docs/03-design/DESIGN_SYSTEM_MIGRATION_PLAN.md` — phased migration and execution model.
