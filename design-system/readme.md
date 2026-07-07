# Rangam Job Seeker Design System

Design system for the **Rangam job seeker refresh** — the candidate-facing side of **Interview Coach**, an AI-powered interview practice platform built by Rangam and delivered under the **TalentArbor** product brand ("TalentArbor — Powered by Rangam").

## Product context

Interview Coach serves two audiences from one Next.js app:

1. **Candidate app (job seekers)** — the focus of this system. Candidates arrive via a magic link (`/s/[token]`) from a recruiter or the TalentArbor host platform with a specific target role in mind. They review a question plan, run a practice session (voice or text answers with AI coach feedback per question), and land on a **dashboard** — the primary surface for self-regulated learning: preparedness map, coach plan, coach updates, question set, and next recommended practice.
2. **Recruiter app** — recruiters create invites, manage sessions and templates. Out of scope for this refresh; noted here for completeness.

**Stack of record:** Next.js 15, React 18, Tailwind CSS (HSL token bridge), Framer Motion, lucide-react icons, Recharts (dashboard pies), shadcn-style primitives.

## Sources

- Codebase: `Interview-Coach-Recruiter-postgres/` (mounted read-only). Key files: `src/index.css` (all tokens), `tailwind.config.ts`, `src/components/ui`, `src/components/patterns`, `src/components/shell`, `src/features/candidate-*`, `docs/candidate-app/` (UX contract, specs).
- Logos: `public/rangam-logo.png`, `public/TA-logo.png` → copied to `assets/`.

## Two token dialects (important)

The codebase deliberately runs two parallel token languages:

- **Recruiter/shadcn HSL tokens** — `hsl(var(--primary))`, `hsl(var(--border))` etc. Used by the shared primitives (Button, Card, Badge…).
- **Candidate RGB tokens** — `rgb(var(--candidate-primary))` etc., namespaced so the job-seeker surfaces keep "the original prototype language". Candidate pages are wrapped in `.candidate-design-system` and use `SurfaceCard`, `ActionButton`, `PageIntro`, the `.surface-*` classes and `.eyebrow` type patterns.

When designing **job seeker** surfaces, prefer the candidate dialect; the shadcn primitives still appear inside them (buttons, badges, popovers).

## CONTENT FUNDAMENTALS

**Voice: a calm, encouraging coach.** The product speaks as "the coach" in first person to "you", the candidate. Never judgmental, never gamified-cutesy.

- **Direct second person, contractions:** "Let's get you ready for your interview." / "You'll answer a series of interview-style questions tailored to your target role."
- **Coach speaks in first person on the dashboard:** section headed "What I noticed"; CTA "Add this to my next round".
- **Encouraging, low-pressure:** "No Time Limit — Take your time. Thoughtful answers lead to better feedback."
- **Actionable micro-guidance, verb-first:** "Use the next round to add clearer details, rationale, or outcomes." / "Practice one answer with a clear beginning, middle, and ending."
- **Trust and privacy stated plainly, not legalese:** "Your answers are used to provide coaching… They are protected by access controls and are not shared with recruiters or employers for hiring decisions."
- **Casing:** Sentence case for body and most headings ("Preparedness map", "Question plan", "Current read"). Title Case for short feature headings and CTAs ("Create Practice", "Private Coaching Feedback"). Eyebrow labels are ALL-CAPS via CSS (`Coach Plan`, `Coach Update`, `Question set`).
- **Emoji:** used ONLY in the feedback rating scale (🙁 😐 🙂 😊 🤩) — never in copy.
- **Vocabulary of the domain:** practice round, question set, question plan, preparedness, coach plan, coach update, target interview, lanes (Answer skills) × categories (Screening, Behavioral, Culture / Fit, Case / Scenario, Technical / Role-Specific), states: Not practiced → Emerging → Clear → Strong.

## VISUAL FOUNDATIONS

- **Color vibe:** cool, airy blue-on-white. Deep slate ink (`#0f2139`-family) on near-white blue-tinted surfaces. Brand blue `rgb(12,97,233)` (candidate) / `hsl(217 90% 48%)` (shadcn) is the single action color. Rangam orange `#F95500` is a *secondary brand accent* used sparingly (soft `surface-orange` tints, logo). Teal `rgb(14,176,153)` is the growth/accent tone. Purple (`--accent-alt`) marks user-feedback/survey moments.
- **Type:** Manrope for display (h1, hero, section titles) and Inter for body/UI. Type is applied through semantic role tokens that include family, size, weight, line-height and letter-spacing. Signature micro-styles: tracked eyebrows (uppercase Inter, 700, positive tracking) and metric values (Manrope 700, tight line-height). Body text is small (13–17px) with generous line-height.
- **Surfaces & cards:** white cards with very soft, large-radius diffuse shadows (`--candidate-shadow-card`: 0 18px 45px rgba(15,33,57,.08)) and hairline borders `rgb(var(--candidate-border)/0.78)`. Candidate cards and widgets use the default 24px card radius; larger panels use 2rem. Gradients are subtle white→off-white 135deg washes, plus three tinted surfaces: `surface-blue` (saturated blue gradient, white text), `surface-orange` (soft peach), `surface-sky` (pale blue).
- **Glass:** `glass-card` (pale blue gradient + blur 24px + white/20 border) for emphasis panels (session prompt shell, active nav); `glass-overlay` and `bg-white/40 backdrop-blur-xl` capsules for fixed headers. Backdrop blur is common on overlays/backdrops (`bg-slate-950/45 backdrop-blur-sm`).
- **Radii system:** 4/8/12/16/24/40px tiers; pills (`rounded-full`) for chips, badges, ActionButton CTAs.
- **Shadows:** four tiers — flat (1px ring), raised-1, raised-2, floating; candidate card/panel/soft variants. Primary CTAs get a blue glow: `0 10px 22px rgba(12,97,233,0.22)`.
- **Motion:** fast/base/slow = 120/180/260ms with standard + emphasized cubic-beziers. Hovers: shadow raises one tier, color darkens ~10% (`hover:bg-primary/90`), CTAs lift `-translate-y-0.5`, nav rows scale 1.02. Press: `active:scale-0.98`. Framer Motion for dock hide-on-scroll and pill pop-ins. No bounces, no long fades.
- **States as tint recipes:** semantic panels are `border-{state}/25 + bg-{state}/5`; chips/badges use 50-tint bg + 200-tint border + 800-shade text (e.g. emerald-50/emerald-400/emerald-800).
- **Layout:** candidate grid maxes at 76rem (`app-grid`), 12-col with 1–1.25rem gap; dashboard is main column + sticky 23rem rail. Sticky sidebar (16rem) on desktop, floating bottom dock capsule on mobile. Fixed page headers with white→transparent protection gradients.
- **Imagery:** none — the product is chart- and card-driven (Recharts pies, SVG progress rings). No photos, no illustrations beyond logos.

## ICONOGRAPHY

- **System:** [lucide](https://lucide.dev) stroke icons exclusively (lucide-react in source). 24×24 grid, stroke 2 (2.5 for small emphasized glyphs like sidebar Plus), round caps/joins, `currentColor`.
- **Delivery here:** `components/icons/Icon.jsx` recreates the exact lucide path data for every glyph the kit uses (no icon font, no PNGs). In plain HTML you may instead load lucide from CDN: `<script src="https://unpkg.com/lucide@latest"></script>` + `lucide.createIcons()`.
- **Icon-in-capsule pattern:** icons rarely float loose — they sit in tinted rounded squares/circles (`IconBadge`: bg tint + border + radius 8–16px) or `bg-primary/10` chips.
- **Emoji:** only as the 5-point feedback scale. Unicode arrows (↑ ↓) appear in metric trends.
- **Logos:** `assets/TA-logo.png|webp` (TalentArbor, primary product mark), `assets/rangam-logo.png|webp` (Rangam corporate, "Empathy Drives Innovation"), `assets/favicon.png`. Never redraw.

## Index

- `styles.css` — global entry; imports everything under `tokens/`.
- `tokens/` — colors, typography, shape, elevation, motion, layout, utilities (brand surface classes), fonts.
- `assets/` — logos + favicon.
- `components/icons/` — `Icon` (lucide path recreations). *Intentional addition: needed because npm lucide-react isn't available to consumers.*
- `components/actions/` — Button (shadcn system: variant/emphasis/density/shape/label), ActionButton (candidate pill CTA).
- `components/forms/` — Input, SearchField, FormField (+ FieldGroup/FieldLabel/FieldHint), FeedbackChoiceButton.
- `components/display/` — Card, SurfaceCard, ContentCard, MetricCard, InsightCard, Badge, StatusBadge, IconBadge, Progress, Skeleton.
- `components/feedback/` — AlertPanel, EmptyState, ErrorState, FeedbackPanel, FeedbackPill, FeedbackCard.
- `components/structure/` — PageIntro, SectionHeader, PageHeaderBlock, SessionPromptShell, DataTable.
- `components/shell/` — CandidateSidebar, CandidateMobileDock, CandidateDisclosureFooter.
- `guidelines/` — specimen cards shown in the Design System tab.
- `ui_kits/candidate/` — job-seeker screens: interactive `index.html` (Dashboard → session entry → practice session → coach feedback), factored into `Dashboard.jsx`, `SessionEntry.jsx`, `PracticeSession.jsx`, `data.js`.
- `SKILL.md` — agent skill entry point.

### Not recreated (and why)

- Recruiter app UI kit — out of scope for the job-seeker refresh (source exists under `src/app/(recruiter)`).
- `tour.tsx`, `popover.tsx`, `tooltip.tsx` (Radix behavioral wrappers), Recharts pie internals — behavior-heavy; kits fake these visually where needed.
