[PRE-FLIGHT SUMMARY]
Purpose:
- Standardize hard-coded color literals into a cohesive semantic token system using CSS variables.

Requirements:
- [EXPLICIT] Migrate brand colors to HSL variables in `index.css`.
- [EXPLICIT] Remove redundant `blue` and `green` palettes from `tailwind.config.ts`.
- [EXPLICIT] Map brand tokens in Tailwind to `hsl(var(--token))`.
- [INFERRED] Standardize glass-card and scrollbar utilities in `index.css` to use semantic tokens. (justification: ensures global consistency across all specialized surfaces)

Constraints:
- Security/Compliance: No direct impact.
- UX/Non-functional:
  - Must maintain exact visual parity for brand colors.
  - Must ensure Tailwind's opacity modifier syntax (e.g., `bg-primary/50`) continues to function.

Current State Snapshot:
- Key files/modules involved:
  - `src/index.css` — Global variable definitions.
  - `tailwind.config.ts` — Theme configuration and object mapping.
- Known risks / unknowns:
  - Potential for slight HSL rounding differences vs hex; verified brand-deep manually.

Plan (smallest-diff-first):
1) Update `src/index.css` with new `--brand-*` HSL variables.
2) Update `tailwind.config.ts` to map brand tokens and remove literal palettes.
3) Refactor `.glass-card` and `.custom-scrollbar` in `index.css` to use semantic variables.
4) (Optional/Next Pass) Replace individual literals in TSX files with tokens.

Validation / Tests:
- `npm run lint`
- `npm run dev` (Visual parity check in browser)

Decision Log Check:
- Structural change required? YES (Token architecture change)
- I will append to DECISION_LOG.md immediately after the change.

Telemetry Check:
- If this fails, I will log intent/state/error_raw/hypothesis/next_check/impact to .ralph/telemetry.jsonl.
[/PRE-FLIGHT SUMMARY]
