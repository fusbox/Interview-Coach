# Candidate Dashboard V2 Chart & Visual Concepts Proposal

This document consolidates the architectural design concepts for the **Candidate Dashboard V2** visualization system, specifically detailing how the **v2 Evidence-First Evaluation Engine's** data structures directly drive the candidate-facing UI.

---

## 1. Core Data Structures: The V2 Evaluation Schema

The visualizations proposed below are directly powered by the deterministic outputs of the v2 evaluator contract:

### A. The 5 Universal Criteria (`UNIVERSAL_CRITERION_IDS`)
Every answer is appraised against these universal dimensions:
* `answer_focus` — Direct alignment with the prompt.
* `organization` — Narrative structural clarity.
* `evidence_specificity` — Detail and concrete reasoning.
* `role_skill_signal` — Demonstration of target role skills.
* `impact_judgment_takeaway` — Outlining tradeoffs, outcomes, and lessons.

Each criterion is mapped to a `Band`: `"emerging"` (1) | `"clear"` (2) | `"strong"` (3).

### B. Observable Evidence Spans (`evidenceSpans`)
Granular text coordinates extracted from the candidate's exact answer text:
```typescript
evidenceSpans: Array<{
    id: string;             // Unique identifier for the span
    marker: EvidenceMarker;  // One of 23 types (e.g., "personal_action", "outcome")
    quote: string;          // Exact substring matched
    start: number;          // Zero-based character start index in the transcript
    end: number;            // Zero-based character end index in the transcript
}>;
```

---

## 2. Visual Option 1: The Interactive Transcript Canvas

Rather than displaying feedback in a separate box below the transcript, **the transcript itself becomes the visual canvas**. Using the `start` and `end` character coordinates, the UI renders the transcript as an interactive, highlighted document.

```text
Transcript Canvas Mockup:
--------------------------------------------------------------------------------
"When I led the database migration, I set up a replication lag monitor.
 [========== personal_action (double-underline) ===============]

 We migrated 4TB of data. This reduced API response latency by 35%."
                         [========= outcome (soft green highlight) ===]
--------------------------------------------------------------------------------
```

### Visual Treatments & Interactions:
1. **Interactive Highlight Overlays**:
   * **`personal_action`**: Underlined with a double-border teal line.
   * **`outcome` / `takeaway`**: Highlighted with a soft, semi-transparent success green (`hsla(var(--success), 0.1)`).
   * **`role_skill_signal`**: Styled with a clean purple left-border bracket.
   * *Hover/Click Action*: Displays an inline coaching popover:
     > **[Personal Action]**
     > *"You clearly articulated your own actions rather than generalizing as 'we'."*
     > *Contributes to:* **Substance Lane** (Specific Examples).
2. **The Concision / Focus Fader**:
   * If `answer_focus` is appraised as `emerging` and `isOverlyLong: true` is set, text segments that do *not* contain an active evidence span have their opacity reduced to `40%`.
   * This visually de-emphasizes filler words and off-topic tangents, showing the candidate how to tighten their responses.
3. **Inline Gap Carets**:
   * If a critical structural step is missing (e.g., `missing_tradeoff`), the canvas inserts a warning caret directly in the text flow:
     > `"...migrated the database replication stream. [^ Add Tradeoff: What was the cost or limitation of this stream method?] This resulted in..."`

---

## 3. Visual Option 2: The Category Pattern Pipeline

This option visualizes the candidate's narrative organization by comparing their answer directly to the category's expected **best-practice pattern** (e.g., Behavioral expects `Context → Challenge → Action → Result`).

```text
Narrative Pipeline Visualizer:
[✓ Context] =====> [! Personal Action (GAP)] =====> [✓ Result]
  "When I..."               "Specify your action"     "This saved..."
```

### Visual Treatments & Interactions:
1. **Linear Tracker Track**:
   * **Observed nodes** (derived from `categorySignals` that are `observed`): Rendered as solid, green icons with checkboxes.
   * **Gap nodes** (derived from `patternGap.id`): Rendered with a dashed warning border, an exclamation mark, and an option to click to review the upgrade tip.
2. **Actionable Upgrades**:
   * Hovering over a gap node displays the corresponding `upgrade` advice (e.g., *"Make your personal action clearer before describing what the team did."*) and the specific `redoPattern` sequence.

---

## 4. Visual Option 3: The Signal Balance Radar

To represent the overall capability distribution of the candidate's answers, this chart provides a 5-point radar map using Recharts.

```text
Radar Visualizer:
         Answer Focus (3/3)
               /\
  Role Skill  /  \  Organization (2/3)
    (2/3)    /____\
            \      /
             \    /
              \  /
               \/
          Specificity (1/3)
```

### Visual & Interactive Rules:
1. **Quantitative Mapping**:
   * Maps `emerging` to 1, `clear` to 2, and `strong` to 3.
2. **Asymmetry Scanning**:
   * Helps candidates instantly spot performance shapes (e.g., high *Specificity* but low *Organization*), showing them exactly which communication skills need practice without using demotivating letter grades or scores.

---

## 5. Visual Option 4: Evidence Density Heatmap

An overview visual designed to track the density and presence of different evidence markers over the candidate's entire practice history.

```text
Practice Density Grid:
+-------------------+-------------------+-------------------+
| Personal Action   | Specific Detail   | Technical Term    |
| [■■■■■] (High)    | [■■■■ ] (High)    | [■■■  ] (Med)     |
+-------------------+-------------------+-------------------+
| Outcome           | Tradeoff          | Learnt Lesson     |
| [■■   ] (Low)     | [■    ] (Low)     | [     ] (None)    |
+-------------------+-------------------+-------------------+
```

### Visual & Interactive Rules:
* **Bento Grid Layout**: Each block represents one of the 23 `EVIDENCE_MARKERS`.
* **Density Fill**: Fill intensity represents the frequency of occurrences across practice sessions.
* **Mastery Focus**: Visually alerts the candidate if they consistently fail to supply critical evidence markers (e.g., leaving out `tradeoff` or `learning`) across all questions.
