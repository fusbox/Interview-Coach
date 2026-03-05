# Design System Blueprint  

Goal: make design programmatic ~80% of the time


This doc defines how design + styling works so that:

- visual consistency is enforced by code
- most UI is composed, not hand-styled
- deviations are obvious and intentional
- iteration/migration stays safe

---

## Core principle

Design decisions live in tokens and variants, not in JSX.

---

## Folder structure (additive)


tailwind.config.ts  

postcss.config.js  



src/  

index.css              # Theme tokens + base styles + Tailwind layers  

lib/  

cn.ts                # className merge helper  

design/  

tokens.ts          # Optional typed token catalog (doc/guardrails)  

components/  

ui/  

button.tsx  

input.tsx  

textarea.tsx  

card.tsx  

badge.tsx  

dialog.tsx  

popover.tsx  

sheet.tsx  

tabs.tsx (optional)  

session/             # Session-specific composed components (NOT primitives)  

SessionTopBar.tsx  

ConversationStage.tsx  

ConversationFeed.tsx  

QuestionPromptCard.tsx  

ResponseComposer.tsx  

HintDock.tsx  

HintBottomSheet.tsx  

ConfirmSubmitPopover.tsx  

SessionFooter.tsx  

screens/  

session/  

InitialsScreen.tsx  

LandingScreen.tsx  

ActiveQuestionScreen.tsx  

PendingEvaluationScreen.tsx  

ReviewFeedbackScreen.tsx  

SummaryScreen.tsx  

pages/  

InterviewSessionPage.tsx  

---

## Where design is defined (source of truth)

1) src/index.css — semantic theme tokens  

- Define semantic tokens, not raw colors:

    --background, --foreground  

    --card, --card-foreground  

    --primary, --primary-foreground  

    --secondary, --secondary-foreground  

    --muted, --muted-foreground  

    --accent, --accent-foreground  

    --destructive, --destructive-foreground  

    --border, --input, --ring  

    Optional: --success, --warning

- Light/dark themes swap values, not token names.

Rule: No raw hex colors appear outside src/index.css.

2) tailwind.config.ts — tokens → utilities  

- Map Tailwind colors to CSS variables, e.g.:

    bg-background, text-foreground  
    bg-card, text-card-foreground  
    border-border, ring-ring  
    text-muted-foreground  

- Also define:

    borderRadius via --radius  
    shadows via --shadow-sm / --shadow-md  
    fonts  
    content scanning

3) postcss.config.js — build pipeline  
- tailwindcss + autoprefixer only.

---

## “Every state of every component” — where it lives

States belong in component variants, not CSS files.

We do NOT define per-component states in index.css.

Instead:

- use class-variance-authority (CVA) for variants

- use cn() helper (clsx + tailwind-merge)

- encode hover/focus/disabled/invalid once per primitive

---

## Variant-driven components (the 80% solution)

Common variant patterns:

- variant: primary | secondary | outline | ghost | destructive  

- size: sm | md | lg | icon  

- state: handled via Tailwind pseudo-classes:

    hover:, focus-visible:, disabled:, aria-invalid:

Benefits:

- consistent behavior everywhere

- minimal JSX styling noise

- custom styling becomes obvious

---

## Guardrails: make custom styling obvious

Non-negotiable conventions:

1) No raw hex values in JSX  
- BAD: text-[#123456]  
- GOOD: text-muted-foreground

2) No arbitrary values unless truly exceptional  
- BAD: mt-[13px]  
- GOOD: mt-4, mt-6

3) className is a loaded weapon  
- Allowed: layout tweaks only (mt-6, w-full, max-w-md)  
- Not allowed: redefining palette/radius/shadows

Optional enforcement:

- ESLint or PR checklist: “No # in className strings.”

---

## UI primitives (implementation order)

These primitives define nearly all visual language:

1) Button — src/components/ui/button.tsx  

- variants: primary | secondary | outline | ghost | destructive  

- sizes: sm | md | lg | icon  

- states: hover, focus-visible, disabled, loading (optional)  

Acceptance:

- 95% of buttons require no custom styling.

2) Input & Textarea — input.tsx, textarea.tsx  

- sizes: sm | md | lg  

- invalid: aria-invalid styles  

- consistent ring + disabled styles  

Used for initials, responses, recruiter config.

3) Card — card.tsx  

- Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter  

Used for landing sections, prompts, hint surfaces, feedback blocks.

4) Badge — badge.tsx  

Used for category cues, competency labels, hint pills.

5) Dialog — dialog.tsx  

Used for exit confirmation and destructive actions. Must be accessible.

6) Popover — popover.tsx  

Used for pre-submit confirmation and inline hints (desktop).

7) Sheet — sheet.tsx  

Used for mobile hints and secondary surfaces. side: bottom | right.

8) Tabs (optional)  

De-prioritized given current UX direction; implement only if needed.

---

## Session screen: component tree + responsibilities

Key UX decisions:

- Candidate progresses through questions in sequence (no free navigation list).

- Transcript is in the center column with questions + answers.

- Tips are separated from transcript and accessed on-demand (popover/sheet).

- Recruiters can see candidate responses, not coaching feedback.

### Routing vs Screens

- Pages are route entry points only (router hooks allowed).

- Screens are state-driven (no router hooks).

- Session UI is composed components + primitives.

### Candidate session “ActiveQuestionScreen” tree

ActiveQuestionScreen

- SessionShell (layout wrapper: max width, padding, background)

  - SessionTopBar

    - Brand mark / session title

    - Status indicators (optional): autosave, mic/text mode

    - Exit button -> ExitDialog (Dialog primitive)

  - ConversationStage (main column wrapper)

    - QuestionPromptCard (Card)

      - Question label (Badge): e.g., “Result”, “Engagement”, “Technical”

      - Question text

    - ConversationFeed (scroll area)

      - MessageBubble (Question)

      - MessageBubble (Candidate draft/submitted)

      - MessageBubble (System events): “Saved”, “Submitted”, etc. (optional)

      - MessageBubble (Coach feedback) (candidate only; not shown in recruiter view)

    - ResponseComposer (input zone)

      - ModeToggle (optional): voice/text

      - Textarea (or recording UI)

      - Primary action: “Submit” (Button)

      - Secondary action: “Retry” (per policy; only after feedback) (Button/ghost)

      - ConfirmSubmitPopover (Popover) shown on stop recording or submit click

  - HintDock (footer-adjacent or inline CTA)

    - “Need a hint?” trigger (Button/ghost)

    - Hint pills (Badge outline) (optional)

    - HintBottomSheet (Sheet) on mobile

    - HintPopover (Popover) on desktop (optional)

  - SessionFooter

    - Progress indicator (e.g., “Question 3 of 12”)

    - Next/Continue button (Button)

    - (No question list nav in v1)

### Other screens (high-level)

- InitialsScreen

  - Card + Input + Button (alpha-only, 2 char max)

- LandingScreen

  - Orientation copy + Facts Card + Assurance Card + Start button

- PendingEvaluationScreen

  - Loading/processing state + reassurance (no new actions)

- ReviewFeedbackScreen

  - Transcript + feedback block + Retry (if allowed) + Continue

- SummaryScreen

  - Completion message + next steps + optionally share/return

### Composition rules

- Session-specific composed components live in src/components/session/*

- They should be built from primitives (src/components/ui/*)

- Avoid creating new styled primitives (“SessionButton”, “CoachCard”, etc.)

- If it needs variants/states reused everywhere, it becomes a UI primitive.

---

## Spacing + layout tokens (reference)

Canonical spacing scale:

- xs: 8px

- sm: 12px

- md: 16px

- lg: 24px

- xl: 32px

Landing page mt mapping (example):

- Logo -> Title: 16px

- Title -> Intro: 12px

- Intro -> Facts: 24px

- Facts -> Assurance: 16px

- Assurance -> Visibility: 12px

- Visibility -> Preview: 16px

- Preview -> CTA: 24px

- CTA -> Exit: 12px

- Exit -> Bottom: 24px

---

## Anti-patterns (explicitly avoid)
 
 - “PrimaryButton”, “SessionButton”, “CoachCard” (premature styled duplicates)
 
 - Copy/pasting Tailwind class soup between screens
 
 - Per-page custom palettes, radii, shadows
 
 - Router hooks inside Screens
 
 - Using URL shape to encode session progression
 
 ---
 
 ## Summary
 
 - Tokens define meaning.
 
 - Variants define behavior.
 
 - Primitives define consistency.
 
 - Screens compose; they don’t restyle.
 
-This system is intentionally boring — that’s how you know it will scale.
\ No newline at end of file
+This system is intentionally boring — that’s how you know it will scale.
+
+## Design system modernization artifacts
+
+- [UI Audit — Current State (2026-03-02)](./UI_AUDIT_2026-03.md)
+- [Canonical Design System Spec (v1)](./CANONICAL_DESIGN_SYSTEM_SPEC.md)
+- [Design System Migration Plan (Canonical v1)](./DESIGN_SYSTEM_MIGRATION_PLAN.md)
 
EOF
)