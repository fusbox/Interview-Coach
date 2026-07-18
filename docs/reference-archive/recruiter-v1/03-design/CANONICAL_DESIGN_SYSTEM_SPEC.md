# Canonical Design System Spec (v1)

Date: 2026-03-04 (refreshed)
Audience: Product Design, Frontend Engineering, QA, PM
Status: Proposed canonical baseline for migration.

## 1) Principles

1. **Semantic over literal** — never style intent with raw hex or arbitrary local values when semantic tokens exist.
2. **Variant-first UI** — reusable components define states/variants once; screens compose them.
3. **Accessible by default** — focus, contrast, and keyboard semantics are non-optional defaults.
4. **Predictable density** — spacing, typography, and table density follow a fixed scale.
5. **Workflow clarity** — recruiter and candidate flows share language but can differ in density and emphasis.

---

## 2) Token model

## 2.1 Existing foundations to keep

- Semantic color tokens in `src/index.css`
- Tailwind theme mapping in `tailwind.config.ts`
- Dark mode class strategy (`.dark`)

## 2.2 Required token expansion

### Color semantics

Add canonical aliases (non-breaking additions):

- `--surface-base`, `--surface-subtle`, `--surface-raised`, `--surface-overlay`
- `--text-primary`, `--text-secondary`, `--text-muted`, `--text-inverse`
- `--state-success`, `--state-warning`, `--state-critical`, `--state-info`
- `--readiness-high`, `--readiness-medium`, `--readiness-low`, `--readiness-unknown`

### Spacing scale

Adopt a strict 4px grid using tailwind spacing tokens only.
Allowed local exceptions must be documented with reason in code comments.

### Radius and elevation

- Radius tiers: `sm`, `md`, `lg`, `xl`, `2xl`
- Elevation tiers: `flat`, `raised-1`, `raised-2`, `floating`
- Glass effects become optional brand variant, not default surface style.

### Motion

- Duration scale: `fast(120ms)`, `base(180ms)`, `slow(260ms)`
- Easing: standard (`ease-out`) + emphasized (`cubic-bezier(0.2, 0.8, 0.2, 1)`)
- Reduced motion fallback for all non-essential animations.

---

## 3) Typography system

## 3.1 Type roles

- Display: hero/empty states only
- Heading: section and page headings
- Body: default content
- Label: controls/form labels
- Meta: timestamps, helper text

## 3.2 Type scale (recommended)

- Display: 36/44, 32/40
- H1: 30/38
- H2: 24/32
- H3: 20/28
- Body-lg: 18/28
- Body: 16/24
- Body-sm: 14/20
- Meta: 12/16

(Format: font-size/line-height)

## 3.3 Weights

- Regular 400
- Medium 500
- Semibold 600
- Bold 700 (restricted to KPI/critical emphasis)

---

## 4) Component architecture

## 4.1 Layering

1. **Primitives** (`src/components/ui/*`)
   Button, Input, Card, Badge, Table, Tooltip, Progress.

2. **Patterns** (new: `src/components/patterns/*`)
   Canonical blocks composed from primitives.

3. **Screens/Features** (`src/features/**`, `src/app/**`)
   Business-specific composition only; no new visual language.

## 4.2 Required pattern components (v1)

- `StatusBadge` (success/warning/critical/info + recruiter readiness states)
- `MetricCard` (title/value/delta/trend)
- `SectionHeader` (title + supporting actions)
- `DataTable` shell (density, row states, sticky headers)
- `StepIndicator` (create flow steps)
- `FeedbackPanel` (candidate review + recruiter review)
- `DebriefPanel` (post-session pulse debrief summary blocks)
- `EmptyState` and `ErrorState` templates
- `PageContainer` / `Stack` layout primitives


### Session flow note (post-refactor)

The candidate experience now relies on an orchestrated screen flow (`SessionOrchestrator`) rather than isolated page-level transitions. Pattern APIs should therefore support orchestration-friendly composition (stateless display primitives + explicit state props) instead of route-coupled assumptions.

## 4.3 State model (all interactive components)

Every component defines and documents:

- default
- hover
- active/pressed
- focus-visible
- disabled
- loading
- error (if applicable)
- read-only (where relevant)

---

## 5) Accessibility requirements

- Minimum contrast: WCAG AA for body text and controls.
- Focus-visible ring required on all keyboard-focusable elements.
- Icon-only controls require accessible labels.
- Tooltip content must not be sole carrier of critical information.
- Table headers and row actions must preserve keyboard navigation order.

---

## 6) Responsive strategy

- Mobile-first breakpoints.
- Use a constrained content width for recruiter data views to preserve scanability.
- Candidate answering flow prioritizes single-task focus and sticky critical actions.
- No breakpoint-specific ad hoc spacing outside scale tokens.

---

## 7) Governance model

## 7.1 Contribution rules

- No raw hex in TSX class strings.
- No arbitrary spacing (`[Npx]`) unless exception tagged: `/* ds-exception: reason */`.
- New UI in feature code must prefer pattern components before primitive composition.

## 7.2 Review gates

PRs touching UI must include:

- before/after screenshots for affected screens
- checklist of component states verified
- accessibility self-check notes
- token/variant additions documented

## 7.3 Ownership

- **Design System DRI**: approves tokens/pattern API changes.
- **Feature team**: consumes system and proposes additions via RFC-lite.

---

## 8) Definition of done for migration-compliant UI

A UI change is "system-compliant" when:

1. it uses canonical tokens and pattern/primitives;
2. all interactive states are covered;
3. no undocumented style exceptions are introduced;
4. mobile + desktop behavior is verified;
5. screenshot evidence and test notes are included in PR.
