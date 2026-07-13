# HANDOFF — Interview Coach Design System

_Context brief for an agent picking this up cold. Read this, then `readme.md` (full design guide) and `SKILL.md`._

## What this project is

A **design system project** (the kind an automated compiler reads each turn to regenerate `_ds_bundle.js` / `_ds_manifest.json`). It is the design system for the **Rangam job-seeker refresh** — the candidate side of **Interview Coach**, shipped as "TalentArbor — Powered by Rangam". Namespace: `RangamJobSeekerDesignSystem_7ff43f`.

The system was **extracted from a mounted codebase** (`Interview-Coach-Recruiter-postgres/`, read-only) into `tokens/`, `components/`, `guidelines/`, `ui_kits/`. Those extracted values are the _starting point_, not automatically canonical. We are now going foundation-by-foundation, deciding system values in `explorations/` and moving the current source of truth into the living system doc.

## The two work surfaces

- **`explorations/`** — throwaway scratch artifacts where options get compared (e.g. `readiness-intermediates.html`, `choosing-the-blue.html`). Nothing here is canonical.
- **`guidelines/`** — specimen files shown in the **Design System tab**. A file becomes a tab card by having `<!-- @dsCard group="…" viewport="WxH" name="…" subtitle="…" -->` as its **first line**. Tab groups render alphabetically by `group`.

## The living system doc (the important new structure)

`guidelines/interview-coach-design-system.html` is a **single parent document** that is the primary view of the system. It is the only file in group **`0 · Overview`** — the numeric prefix forces it to sort **first** in the Design System tab, above every other card. (To reorder, rename the group; that's the whole mechanism.)

It is the only file in group **`0 · Overview`** — the numeric prefix forces it first in the Design System tab, above every other card. (To reorder, rename the group.)

### Structure (umbrella model)
**Foundations is an umbrella section, not a peer of Color/Type.** Top-level = **01 Foundations · 02 Components · 03 Patterns · 04 Voice & content · 05 Accessibility**. Foundations contains 10 subsections numbered `1.1`–`1.10`: Principles, Brand, Color, Typography, Iconography, Spacing, Layout & grid, Shape, Elevation, Motion. (Accessibility and Voice are deliberately kept top-level, not nested, because they cross-cut everything.) The TOC is two-tier; subsections render inside a left-ruled `.subs` block.

Defined (sub)sections **embed a partial file via `<iframe class="embed" src="…">`**; an inline script auto-fits each iframe to its content height. **This is the growth model:** to define a subsection, build/curate its partial, drop an `<iframe class="embed">` into it, and flip its TOC chip from `off`/Pending to `on`/Defined. Editing a partial updates the parent automatically.

### Partials (NOT standalone cards)
These have their `@dsCard` marker removed and start with a `<!-- Partial — embedded in … -->` note. They render **only inside the parent**. **Convention: reuse the original extracted `guidelines/` file as the partial — do not create parallel `*-colors.html` files.**
- `guidelines/color-brand.html` → **Foundations › Brand (1.2)**. The three brand families as swatch chips + `--token` + hex: primary blue with its full interaction set (soft/base/hover/active/deep), Viridian (base+soft), warm orange (base+soft). _(This is the original extracted brand card, its contents replaced with the current brand families; its old `@dsCard` marker is gone, so it no longer renders as a standalone Colors card.)_
- `guidelines/prep-colors.html` → **Foundations › Color (1.3)**. The preparedness ramp as token + hex + oklch caption, with pills. **Renamed from `color-readiness.html`** (the old emerald/amber/rose recipes are gone).
- _(deleted earlier: `foundations.html` and the temporary `brand-colors.html` — brand content now lives in `color-brand.html`.)_

### Color-format convention (important — keep consistent)
Four representations appear on purpose; don't "fix" them into one:
- **HSL triplet** (`217 90% 48%`, consumed `hsl(var(--x))`) — shadcn/shared primitives; bare triplet enables alpha via `/`.
- **RGB triplet** (`12 97 233`, consumed `rgb(var(--candidate-*))`) — candidate/job-seeker surfaces; same alpha purpose.
- **OKLCH** (full value) — ordered scales only (the prep ramp): L for order, C for family, H for meaning.
- **Hex** — the human-readable **display** value. **Rule: storage follows the surface's dialect; every swatch in the doc displays hex + `--token`; OKLCH is authored then surfaced as hex.** This convention is documented in-doc under Foundations › Color as a formats table.

## Derivation recipe (canonical convention)
How every derived color variant is produced from a base — the method is standardized so variants are minted consistently, on demand. Documented in-doc under Foundations › Color. All deltas are **OKLCH from the base, chroma & hue held**:
- **Hover** = L − 0.05 · **Active** = L − 0.10 · **Deep** = L − 0.14 · **Soft tint** = L 0.955, C 0.035 · **Wash** = L 0.975, C 0.022.
- **Focus ring** = base / 45% alpha, **Disabled** = base / 38% alpha — via `rgb(var(--token) / .xx)`, **no new token**.
- **Provisioning rule:** derive only what a surface consumes. Primary → full interaction set; accents → base + soft; wash → only when a large passive surface or internal layer consumes it; neutral ramp → built out in full up front. Opaque states = named tokens; translucent states = alpha on the base triplet.
- Compute hex/triplets with a real sRGB↔OKLab↔OKLCH conversion (see the eval used this pass), then clamp to sRGB.

## Current canonical foundation

1. **Primary / action blue** — `#0B57CE` (`--candidate-primary: 11 87 206`; shadcn `--primary: 217 90% 43%`). The single action color.
2. **Accent · Viridian** — `#17A079` (`--candidate-accent: 23 160 121`) and **Accent · Warm orange** — `#E8742E` (`--candidate-secondary-brand: 232 116 46`; `--brand-orange: 23 80% 55%`). Two sparing accents. _These three replaced the earlier extracted values (old action blue #0C61E9, Rangam orange #F95500, teal #0EB099) through the `explorations/choosing-the-*` rounds._
   **Derived variants (via the recipe below):** blue ships a full interaction set — `--candidate-primary-hover` (0 71 189 / #0047BD), `--candidate-primary-active` (0 54 172 / #0036AC), `--candidate-primary-deep` (0 40 159 / #00289F), `--candidate-primary-soft` (227 241 255 / #E3F1FF), and `--candidate-primary-wash` (238 247 255 / #EEF7FF). Viridian now ships `--candidate-accent-soft` (#DBF8EB) and `--candidate-accent-wash` (234 252 244 / #EAFCF4); warm orange retains `--candidate-secondary-soft` (#FFEADC). `--brand-deep` was **renamed `--primary-deep`** (hsl, root 225 100% 31%), re-derived from the new blue; its one consumer `components/display/IconBadge.jsx` (the `--brand` variant) was updated to match.
3. **Preparedness ramp** — the newly selected family **"A✷ · Ripening, warm start"** (chosen in `explorations/readiness-intermediates.html`). Ordered, positive-only growth scale; the low state is neutral slate, never a red mark. Now in `tokens/colors.css` as OKLCH tokens (full color values, not the HSL/RGB triplets the rest of the file uses):

   | State | Dot | Tint (chip bg) | Text (label) |
   |---|---|---|---|
   | `--prep-not-practiced` | `oklch(0.72 0.02 240)` slate | `#F1F5F9` | `oklch(0.46 0.03 240)` |
   | `--prep-emerging` | `oklch(0.82 0.09 100)` warm shoot | `oklch(0.96 0.035 100)` | `oklch(0.44 0.07 100)` |
   | `--prep-clear` | `oklch(0.62 0.15 143)` green | `oklch(0.94 0.07 143)` | `oklch(0.42 0.10 143)` |
   | `--prep-strong` | `oklch(0.50 0.12 160)` deep brand green | `oklch(0.93 0.05 160)` | `oklch(0.36 0.10 160)` |

   Design rationale worth preserving: lightness carries the order; hue drifts slate → warm → green. Emerging was deliberately pulled **off green** (H100, low chroma) so it doesn't read as "beginner green" (patronizing) and stays clear of warning-amber.

## OKLCH note (why the ramp uses it)
`oklch(L C H)`: **L** = lightness 0–1 (perceptually uniform). **C** = chroma / colorfulness, an independent axis (~0–0.37; its usable max depends on L and H). **H** = hue 0–360°. Build scales by moving **L for order**, holding **C for family consistency**, drifting **H for meaning**.

## Explicitly NOT done yet (next-pass backlog)
- **Only the preparedness ramp, blue, and orange are defined in this note.** Every other section in the parent is a Pending stub. Do not promote more content unless asked.
- `tokens/colors.css` still carries the **old semantic `--readiness-high/medium/low/unknown`** (green/amber/red) from the extracted app — a _different_ model than the new `--prep-*` ramp. Needs reconciling (likely retire or remap them).
- The `--prep-*` ramp is **light-mode only**; dark-mode values (there is a `.dark` scope in `tokens/colors.css`) are not defined.
- The other original `guidelines/` cards (Brand, Type ×3, Shape, Elevation, Motion, Layout, Spacing, Iconography, Accessibility, Voice, and the remaining Colors cards: neutral / semantic / surfaces / brand) are **untouched** and still show as their own tab cards below the parent. They'll get folded into the parent section-by-section as each is defined.

## Conventions / gotchas
- Two token dialects on purpose: candidate `rgb(var(--candidate-*))` for job-seeker surfaces; shadcn `hsl(var(--*))` for shared primitives. Prefer candidate dialect for job-seeker work.
- Token annotations: `/* @kind color */` must be its own comment with **only** the bare label (color|spacing|radius|shadow|font|other) — extra text in the same comment silently fails to attach. Put descriptions in a _separate_ trailing comment.
- After editing sources, run `check_design_system` until clean. A "MANIFEST STALE" line clears itself at end of turn — don't chase it.
- Voice is a calm, encouraging coach in first person to "you"; sentence case; emoji only in the 5-point feedback scale. See `readme.md` → CONTENT FUNDAMENTALS.
