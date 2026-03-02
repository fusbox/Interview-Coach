# Canonical Feedback UI Design Specification (v1.0)

---

## 0. Purpose of This Document

This document defines the canonical design system and layout architecture for the Interview Coach feedback modal. It is both:

- A reference implementation guide
- A design philosophy alignment artifact

This spec encodes the following principles:

- Interpretation > metrics
- Coaching > scoring
- Shape > color aggression
- Evidence > abstraction
- One focus > many suggestions

All future UI changes to the feedback experience should reconcile against this document.

---

# 1. Experience Architecture (Cognitive Flow)

The feedback experience unfolds in three intentional stages inside a single parent modal.

### Stage 1 – Coach Reaction (Elevated Mode)

Purpose: Immediate orientation without cognitive overload.

### Stage 2 – Detailed Feedback (Analysis Mode)

Purpose: Structured reflection across evaluated dimensions.

### Stage 3 – Next Step (Behavioral Mode)

Purpose: Single actionable improvement lever.

These are not separate screens. They are state transitions within the same modal container.

---

# 2. Parent Modal Container

## 2.1 Container Specs

- Max Width: 960px
- Min Width: 720px
- Border Radius: 20px
- Shadow: Soft elevation (Y: 24px, Blur: 60px, 8–12% black)
- Background: Surface / Neutral-0
- Padding: 48px top/bottom, 56px left/right

## 2.2 Modal States

The modal has two styling states only:

### Elevated Mode (Coach Reaction + Next Step)

- Slightly stronger shadow
- Increased top padding (56px)
- Minimal internal dividers

### Feedback Mode (Detailed Dimensions)

- Reduced shadow
- Standard padding (48px)
- Subtle section separators (hairline divider, 6% opacity)

The modal container itself does NOT change color.
Only density and spacing change.

---

# 3. Typography System

## 3.1 Type Scale

| Token         | Size | Weight | Usage              |
| ------------- | ---- | ------ | ------------------ |
| Display       | 40px | 700    | Next Step Headline |
| H1            | 32px | 700    | Coach Reaction     |
| H2            | 22px | 600    | Dimension Title    |
| Body          | 16px | 400    | Feedback Paragraph |
| Body-Emphasis | 16px | 500    | Key Statements     |
| Micro         | 13px | 500    | Labels / Buttons   |

Line Height: 1.45–1.6 for body text
Max line width: 70 characters

No all-caps section labels except micro category identifiers.

---

# 4. Stage 1 – Coach Reaction (Elevated Mode)

### Coach Reaction Constraints (Authoritative Rules)

The Coach Reaction is intentionally brief and specific.

- Default length: EXACTLY 1 sentence.
- Must feel warm, direct, and conversational.
- Must not include tier language (Strong / Polish / Focus).
- Must not include improvement suggestions.
- Must not reference scoring, signal detection, or evaluation mechanics.

Purpose: Personalization and psychological safety are achieved through a brief, acknowledging headline. The user knows they've been heard without needing a full evaluative paragraph before they even see the metrics.

## 4.1 Layout

[1-sentence Headline / Ack]

Primary Button: Explore Feedback
Secondary Button: Continue to Next Question

Buttons are horizontally aligned.
Primary is solid.
Secondary is ghost.

## 4.2 Tone Guidance

- Reaction is holistic, not dimensional
- No numeric scores displayed here
- No “Strong/Developing” language at top level

This prevents immediate evaluative framing.

---

# 5. Stage 2 – Detailed Feedback (Feedback Mode)

### Rendering Discipline (Authoritative Rules)

- Show all Strong-tier dimensions.
- Show all Polish-tier dimensions.
- Show up to TWO Focus-tier dimensions specifically: ONE from Delivery dimensions, and ONE from Content dimensions.

If multiple Focus-tier dimensions exist within either category (Delivery or Content):

- Select the dimension with the highest leverage.
- Highest leverage is defined as either:
  - The most foundational skill for this role, OR
  - The dimension with the lowest signal strength.

This enforces strict coaching focus discipline and protects cognitive load while still addressing both what they said (Content) and how they said it (Delivery).

The user should never be presented with multiple simultaneous Focus directives from the same dimension category.

## 5.1 Layout Structure

Stacked vertical dimension blocks.

Each block contains:

- Dimension Title
- Status Tier (Strong / Polish / Focus)
- Narrative feedback
- Inline evidence reference

Spacing between blocks: 40px

---

# 6. Canonical Dimension Block

## 6.1 Structure

[Dimension Title]                        [Tier Indicator]

Narrative feedback paragraph.

> Quoted phrase from user answer

Follow-up clarifying sentence.

---

## 6.2 Tier Indicator Styling

Tier is communicated using shape and weight, not aggressive color.

### Strong

- Subtle rounded pill
- Background tint: 4% neutral-blue
- Text weight: 600
- Border: none

### Polish

- Subtle rounded pill
- Background tint: 4% neutral-slate
- Text weight: 600

### Focus

- Subtle rounded pill
- Background tint: 6% neutral-amber
- Slightly thicker border (1px, 10% opacity)

NO red.
NO green.
NO icons.

---

## 6.3 Narrative Structure Rules

This section formalizes the opener concept as an expectation-setting device. The opener defines what strong answers in this dimension do before referencing the user’s response.

### Strong Tier Structure

1. Anchor statement (what strong answers in this dimension do)
2. Quoted evidence from the user’s answer
3. Why it works (impact or credibility signal)

Template Pattern:

- Anchor: "Strong answers clearly…"
- Evidence: > "Quoted phrase from answer"
- Impact: "That works because…"

### Polish Tier Structure

1. Anchor statement (what strong answers do)
2. Quoted evidence from the user’s answer
3. Refinement suggestion (micro-upgrade)

Template Pattern:

- Anchor: "Clear answers typically…"
- Evidence: > "Quoted phrase from answer"
- Refinement: "To make this even stronger…"

### Focus Tier Structure

1. Anchor statement (what interviewers look for)
2. Narrative description of the gap (non-accusatory)
3. Try-this-instead sentence + why it works

Template Pattern:

- Anchor: "Interviewers look for…"
- Gap description: "In this response…"
- Action: "Try adding…"
- Rationale: "This helps because…"

Lack of signal automatically routes to Focus tier and follows the Focus structure above.

Strong:

- Affirm what worked
- Name the competency implicitly
- Optional micro-suggestion

Polish:

- Affirm structure
- Identify improvement lever
- Provide refinement suggestion

Focus:

- Neutral tone
- Describe gap without labeling as weak
- Provide specific behavioral improvement

Lack of signal automatically routes to Focus tier.

Example (Focus):

Relevance                        Focus

Your answer did not clearly tie your example back to the question asked. Adding one sentence that explicitly connects your action to the workplace context would strengthen clarity.

---

# 7. Evidence Referencing

Evidence is contextual, not highlighted in transcript by default.

When used:

> “Safety is always my top concern.”

The quote is:

- 14px left border accent (2px width)
- Slight surface tint (3%)
- Rounded corners (8px)

No color-coding by signal.

Transcript highlighting occurs only when transcript drawer is opened.

---

# 8. Transcript Drawer

### Placement & Visibility Rules

- The “Compare to your answer” link appears ONLY in Feedback Mode.
- It is positioned at the top-right of the FIRST dimension block.
- It remains sticky while the user scrolls through dimension blocks.
- It does NOT appear in Elevated Mode (Coach Reaction) to preserve orientation hierarchy.

This prevents the transcript from competing with the initial framing and keeps analysis secondary to interpretation.

### Default State

Hidden by default.

Triggered by: “Compare to your answer”

## Drawer Specs

- Slides from right
- Width: 40% of modal
- Surface tint: Neutral-50
- Padding: 32px

Highlighted evidence phrases receive subtle purple 6% tint.

No badges. No legend.

---

# 9. Stage 3 – Next Step (Behavioral Mode)

## 9.1 Layout

Large headline (Display size)

2–3 paragraph coaching narrative.

Primary Button: Retry My Answer (if Focus exists)
Secondary Button: Continue to Next Question

If no Focus tier exists:

Primary Button: Continue to Next Question
Secondary Button: Retry My Answer

---

## 9.2 Visual Treatment

Next Step section has:

- Increased vertical spacing (56px top)
- Optional faint background tint (2%)
- Headline uses Display token

This creates a “chapter break” feel.

---

# 10. Motion & Transitions

All transitions: 280ms ease-out

Stage transitions:

Coach Reaction → Feedback

- Content fade (0 → 1 opacity)
- Upward translate (8px)
- Shadow reduction

Feedback → Next Step

- Content fade
- Slight scale (0.98 → 1)

### Dimension Snap Constraint (Authoritative Rule)

- Each dimension block snap must use a subtle 120–180ms easing.
- No bounce, overshoot, or spring effects.
- The snap should feel like pagination, not carousel behavior.
- Avoid horizontal movement entirely.
- Use vertical scroll anchoring only.

Snapping should feel intentional and controlled — never playful or kinetic.

Motion must feel calm, not theatrical.

---

# 11. Signal Strength Logic Rendering

### Authoritative Rules

- Lack of signal always routes to Focus tier at question level.
- UI must never use language such as "not detected" or reference detection mechanics.
- Instead phrase guidance as: "To make this stronger, include…"
- Preserve dignity by framing gaps as additions rather than omissions.

At question level:

Strong = Clear signal + strong competency demonstration
Polish = Adequate signal but refinement possible
Focus = Weak signal OR no signal detected

If no dimension produces meaningful evidence:

- Entire feedback routes to Focus
- Next Step becomes foundational skill guidance

No empty praise.
No filler.

---

# 12. Color System Philosophy

No saturated green/red semantics.

Emphasis created through:

- Spacing
- Weight
- Subtle tint
- Elevation

Color saturation should never exceed 12% background tint.

---

# 13. Mobile Adaptation

- Modal becomes full screen
- Transcript drawer becomes bottom sheet
- Dimension blocks stack with 28px spacing
- Buttons become full width

---

# 14. What This UI Avoids

- No numeric score displayed at dimension level
- No percent bars
- No radar charts
- No ranking language
- No gamified badges

This protects interpretive humility.

---

# 15. Canonical Hierarchy Summary

Stage 1: Orientation
Stage 2: Reflection
Stage 3: Action

The UI should feel like:

A thinking coach writing notes in the margins of your answer.

Not a grading dashboard.

---

End of Specification

