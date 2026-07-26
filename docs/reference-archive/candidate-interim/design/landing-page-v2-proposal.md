# Landing Page V2: Design Evaluation & Concept Proposals

Status: Historical reference

> [!WARNING]
> This file is archived historical context and does not govern current V2 implementation.

This document provides a professional design audit of the current root landing page (`src/app/page.tsx`) and outlines three alternative marketing-focused design concepts with adapted copywriting.

---

## 1. Professional Design Audit (Current State)

### Strengths:
* **Anti-Score Positioning**: *"Coaching, not scoring"* is a brilliant differentiator. It directly counters the anxiety candidate-facing platforms create when they try to grade people.
* **Immediate Dual CTA**: Clear pathing for both Seekers and Employers in the hero viewport.
* **Privacy Framing**: Proactively declaring that practice data is private and not shared with hiring managers is a crucial trust-builder.

### Weaknesses:
* **The "AI Template" Layout Pattern**: The current layout follows typical AI-generated landing page cliches—left column copy, right column stacked link boxes, followed by 4 standard icon cards. It lacks premium visual interest.
* **Copy Redundancy**: The phrase stating that practice data is protected and not used for hiring decisions is repeated almost verbatim in the hero body (lines 101–103), the assurance block (lines 174–176), and the footer disclosure (lines 211–212). This repetition reduces the copy's effectiveness.
* **Zero Visual Evidence**: The page tells candidates they will get coached feedback but does not show what that coaching look or feels like.

---

## 2. Concept A: The "Workspace Preview" (Visual-Led)
**Aesthetic Dial Setting:** `DESIGN_VARIANCE: 6` | `MOTION_INTENSITY: 5` | `VISUAL_DENSITY: 3`
**Vibe:** Restrained, premium consumer tech, high materiality.

```text
Concept A Hero Block:
--------------------------------------------------------------------------------
[Logo]                                                            [Login]

Interview coaching,                  [   Workspace Preview SVG Mockup   ]
not a grade.                         [                                  ]
                                     [  "When I led the database..."    ]
Focus on building evidence,          [   =======================        ]
strengthening your structure,        [  [Personal Action]               ]
and preparing for the role in        [  "Good personal action here."    ]
front of you.                        [                                  ]

[For Job Seekers ↗]   [For Employers ↗]
--------------------------------------------------------------------------------
```

### Visual Strategy:
* **Hero Split**: A 50/50 layout at desktop. Left column houses clean, bold display copy. Right column displays an interactive vector mockup of the **Transcript Canvas** showing an answer text block with inline highlighted spans and popover coach comments.
* **Restrained Typography**: Set in a clean, high-end sans-serif (e.g., Geist or Satoshi) with tight tracking and generous line heights.

### Adapted Copywriting:
* **Hero Title**: *"Interview coaching, not a grade."*
* **Hero Lede**: *"Practice with confidence. Use role-specific questions and targeted coach feedback to build interview evidence on your own terms. Your data remains yours—protected and entirely separate from hiring decisions."*

---

## 3. Concept B: The "Asymmetric Split" (Direct Interactive Entry)
**Aesthetic Dial Setting:** `DESIGN_VARIANCE: 9` | `MOTION_INTENSITY: 7` | `VISUAL_DENSITY: 4`
**Vibe:** Bold, modern, high-contrast, editorial.

```text
Concept B Hero Layout (Desktop Split):
 ------------------------------------------.---------------------------------
| [Logo]                                   |                                 |
|                                          |                                 |
| JOB SEEKERS                              | EMPLOYERS                       |
| Build your evidence.                     | Prep your pipeline.             |
| Clear your path.                         | Support your candidates.        |
|                                          |                                 |
| [Enter Job Seeker Workspace ↗]           | [Enter Employer Workspace ↗]    |
| (Dark Theme: zinc-950)                   | (Light Theme: white/stone-50)   |
 ------------------------------------------.---------------------------------
```

### Visual Strategy:
* **Split Viewport**: A split screen layout. The left half is dark mode (Zinc 950) dedicated to Job Seekers. The right half is light mode (Stone 50) dedicated to Employers.
* **Zero Scrolling Required**: The main CTAs are the layout columns themselves, making the choice immediate and engaging.

### Adapted Copywriting:
* **Left Column (Job Seekers)**:
  * *"Practice role-specific scenarios. Receive inline pattern analysis and upgrade hints. Build the evidence you need to stand out."*
* **Right Column (Employers)**:
  * *"Empower your candidates with branded preparation tools. Reduce interview friction, increase conversion, and evaluate candidates based on authentic preparation."*

---

## 4. Concept C: The "Before/After" Narrative
**Aesthetic Dial Setting:** `DESIGN_VARIANCE: 7` | `MOTION_INTENSITY: 4` | `VISUAL_DENSITY: 3`
**Vibe:** Calm, editorial, spacious.

```text
Concept C Comparison Block:
--------------------------------------------------------------------------------
How Coaching Works:

[ Before Coaching ]                      [ After Coaching ]
"We migrated the server database.        "I refactored the database connection
 It took a week and then everything       pool, reducing API response times by
 worked much faster."                     35% within the first week."
                                         [================ outcome =======]

                                         [^ Coach Tip: Concrete outcome added.]
--------------------------------------------------------------------------------
```

### Visual Strategy:
* **Interactive Slider**: A side-by-side or scroll-revealed comparison block showing a raw, unorganized candidate answer on the left, and the same answer on the right showing V2's inline highlights and coach tips.
* **Minimalist Proof**: No grid cards. Simple vertical sections separated by light borders, focusing on typographic size contrast.

### Adapted Copywriting:
* **Section Heading**: *"Learn how to shape stronger answers."*
* **Section Copy**: *"Interview Coach doesn't just tell you what's wrong—it shows you where you missed critical evidence. See how raw responses are polished into structured, high-impact answers."*
