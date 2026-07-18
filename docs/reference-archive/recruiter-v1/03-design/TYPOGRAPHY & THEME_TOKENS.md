/* ============================================================================
   THEME TOKENS (Semantic Palette) + TYPOGRAPHY
   Goal: design programmatic ~80% of the time
   Notes:
   - Tokens are semantic (meaning-based), not brand swatches.
   - Values are HSL triplets so Tailwind can use: hsl(var(--token))
   - Keep raw hex colors OUT of JSX. If you need a new color, add a token here.
   ============================================================================ */

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* =========================
       Neutral foundation
       ========================= */

    --background: 210 20% 98%;         /* near-white cool neutral; reduces eye strain */
    --foreground: 222 47% 11%;         /* deep slate ink; primary text for readability */

    --card: 0 0% 100%;                 /* pure white surface; keeps content crisp */
    --card-foreground: 222 47% 11%;    /* deep slate ink; text on card surfaces */

    --popover: 0 0% 100%;              /* overlay surface background (popovers, menus) */
    --popover-foreground: 222 47% 11%; /* text on popover surfaces */

    --muted: 210 20% 96%;              /* subtle neutral fill; secondary surfaces */
    --muted-foreground: 215 16% 47%;   /* mid-slate; secondary text (labels, hints) */

    --border: 214 32% 91%;             /* light border; cards/inputs separators */
    --input: 214 32% 91%;              /* input border color; keep consistent with border */

    /* =========================
       Brandless semantic actions
       ========================= */

    --primary: 210 90% 45%;            /* calm authority blue; primary CTAs + focus */
    --primary-foreground: 0 0% 100%;   /* white text on primary */

    --secondary: 210 20% 96%;          /* quiet secondary fill; secondary buttons */
    --secondary-foreground: 222 47% 11%;/* ink text on secondary */

    --accent: 160 60% 36%;             /* growth teal/green; supportive cues + success */
    --accent-foreground: 0 0% 100%;    /* white text on accent */

    --destructive: 0 84% 60%;          /* clear red; irreversible/destructive actions */
    --destructive-foreground: 0 0% 100%;/* white text on destructive */

    --ring: 210 90% 45%;               /* focus ring; match primary for consistency */

    /* =========================
       Optional extension tokens
       (recommended: add now to avoid later churn)
       ========================= */

    --success: 160 60% 36%;            /* same as accent by default; success states */
    --success-foreground: 0 0% 100%;   /* white text on success */

    --warning: 38 92% 50%;             /* warm amber; caution (rare) */
    --warning-foreground: 222 47% 11%; /* ink text on warning (better contrast than white) */

    /* =========================
       Radii + Shadows
       ========================= */

    --radius: 16px;                    /* global rounding; maps to rounded-lg */

    --shadow-sm: 0 2px 10px hsl(222 47% 11% / 0.06); /* gentle lift for cards */
    --shadow-md: 0 8px 24px hsl(222 47% 11% / 0.10); /* modal/sheet emphasis */

    /* =========================
       Typography tokens (optional but useful)
       ========================= */

    --font-sans: ui-sans-serif, system-ui, Inter, sans-serif;
  }

  .dark {
    /* =========================
       Neutral foundation (dark)
       ========================= */

    --background: 222 47% 7%;          /* near-black slate; avoids pure black harshness */
    --foreground: 210 20% 98%;         /* near-white; primary text in dark mode */

    --card: 222 47% 9%;                /* slightly raised surface */
    --card-foreground: 210 20% 98%;    /* text on card */

    --popover: 222 47% 9%;             /* overlays match card surfaces */
    --popover-foreground: 210 20% 98%; /* overlay text */

    --muted: 222 30% 14%;              /* muted surface; subtle contrast */
    --muted-foreground: 215 16% 70%;   /* secondary text */

    --border: 222 30% 18%;             /* borders in dark mode */
    --input: 222 30% 18%;              /* input borders */

    /* =========================
       Actions (dark)
       ========================= */

    --primary: 210 90% 55%;            /* slightly brighter blue for dark backgrounds */
    --primary-foreground: 222 47% 7%;  /* dark text on bright primary */

    --secondary: 222 30% 14%;          /* secondary fill; matches muted surface */
    --secondary-foreground: 210 20% 98%;/* light text */

    --accent: 160 60% 40%;             /* brighter teal for dark mode */
    --accent-foreground: 222 47% 7%;   /* dark text on accent */

    --destructive: 0 84% 60%;          /* same red; strong signal */
    --destructive-foreground: 0 0% 100%;/* white text */

    --ring: 210 90% 55%;               /* focus ring matches primary */

    /* Optional extensions (dark) */
    --success: 160 60% 40%;            /* success = accent */
    --success-foreground: 222 47% 7%;  /* dark text */

    --warning: 38 92% 55%;             /* slightly brighter amber in dark mode */
    --warning-foreground: 222 47% 7%;  /* dark text */

    --shadow-sm: 0 2px 10px hsl(0 0% 0% / 0.25); /* dark-mode lift */
    --shadow-md: 0 10px 30px hsl(0 0% 0% / 0.35);
  }

  /* =========================
     Base element styling
     ========================= */

  html { -webkit-text-size-adjust: 100%; }
  body {
    font-family: var(--font-sans);
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  :focus-visible { outline: none; }
}

/* ============================================================================
   COLOR USAGE RULES (read this before inventing a new class)
   ============================================================================

1) Use semantic tokens only. No hex colors in JSX.
   - BAD: text-[#123456]
   - GOOD: text-muted-foreground

2) Meaning is not conveyed by color alone.
   - Every colored UI element needs a label, icon, or copy cue.

3) Primary (bg-primary / text-primary-foreground)
   - Use for: primary CTAs, key confirmations, focus ring (via ring-ring)
   - Don’t use for: decorative highlights, large backgrounds, passive UI

4) Accent / Success (bg-accent / bg-success)
   - Use for: supportive guidance cues, “hint” affordances, success confirmations,
              non-judgmental positive feedback signals
   - Don’t use for: anything that implies scoring/ranking

5) Warning (bg-warning)
   - Use for: system caution states (network instability, mic permission issues)
   - Don’t use for: coaching critique. Coaching should stay calm, not alarmist.

6) Destructive (bg-destructive)
   - Use for: irreversible actions (discard, exit, delete)
   - Don’t use for: error messages that can be recovered from

7) Muted / Secondary
   - Use for: scaffolding UI surfaces, subtle separators, secondary buttons
   - Avoid “gray soup”: keep contrast adequate for readability.

8) Borders and rings
   - Always use border-border, ring-ring, ring-offset-background for consistency.
   - Inputs use border-input so they can evolve independently later.

============================================================================ */

/* ============================================================================
   TYPOGRAPHY DEFINITIONS (Tailwind-friendly guidance)
   Goal: readable long-form text + clear hierarchy with minimal custom styling
   ============================================================================

Headings:
- Page title:        text-2xl font-semibold tracking-tight
- Section title:     text-lg font-semibold
- Card title:        text-base font-semibold
- Labels:            text-sm font-medium text-muted-foreground

Body:
- Standard body:     text-sm leading-6
- Secondary body:    text-sm text-muted-foreground leading-6
- Microcopy:         text-xs text-muted-foreground leading-5

Transcript + long answers (session center column):
- Transcript:        text-sm leading-6 (default)
- Candidate answer:  text-sm leading-6
- Question prompt:   text-base font-medium leading-7
- System events:     text-xs text-muted-foreground

Form inputs:
- Input text:        text-sm
- Placeholder:       text-muted-foreground
- Helper text:       text-xs text-muted-foreground

Accessibility:
- Maintain comfortable line-height for long reading (leading-6+)
- Avoid all-caps for anything longer than 2–3 words
- Keep contrast adequate (foreground/muted-foreground already selected for this)

============================================================================ */
