# Design Spec: Contextual Reference Library Integration

Status: Historical reference

> [!WARNING]
> This file is archived historical context and does not govern current V2 implementation.

This spec outlines the content architecture and contextual integration flows for the Reference Library on the candidate-led side of the app.

---

## 1. Content Architecture

The Reference Library is divided into three key pillars, designed to educate candidates on the evaluation criteria and response formatting patterns:

```
+-----------------------------------------------------------------------+
|                       REFERENCE LIBRARY SCHEMA                        |
+-----------------------------------------------------------------------+
|  1. EVALUATION CRITERIA                                               |
|     - universal_criteria: Answer Focus, Organization, Specificity     |
|     - category_criteria: Impact, Technical Signal                     |
|                                                                       |
|  2. STRUCTURAL FRAMEWORKS                                             |
|     - STAR: Context -> Action -> Tradeoff -> Outcome                  |
|     - CAR: Context -> Action -> Result                                |
|                                                                       |
|  3. DOMAIN GLOSSARY                                                   |
|     - Active context indicators (e.g. CS acronyms: SLA, Churn, ARR)    |
+-----------------------------------------------------------------------+
```

### A. Evaluation Criteria Entries
Each criterion is modeled as a structured card:
* **Definition**: Concise explanation of what the marker represents (e.g., *“Tradeoff Analysis measures your ability to communicate compromises and alternatives.”*).
* **Positive Evidence Example**: High-scoring quote (e.g., *“We deferred our platform migration for 2 weeks to dedicate engineering bandwidth to the customer war room.”*).
* **Negative Evidence Example**: Low-scoring quote (e.g., *“We set up a war room and fixed the bug immediately.”* [Missing trade-off context]).

### B. Structural Frameworks
Contains interactive timelines displaying standard response patterns (STAR, CAR, STAR+L) with guidance tips for each phase.

---

## 2. Contextual Integration Touchpoints (User Flows)

To shape active prep behaviors, references are woven directly into the core workflows rather than isolated on a separate static page.

### Flow A: Pre-Practice Hint Card (The Feedforward)
* **Goal**: Provide a quick study target immediately before starting an audio recording.
* **UI Pattern**:
  * Before launching the recording viewport, display a highlight card indicating what the evaluation engine is focusing on for the active question:
    > 💡 **Coach Focus Target**: This scenario checks for **Role Skill Signal**. Ensure you name specific tools (like Salesforce or Jira) you used to coordinate engineering actions. [View Glossary Guide ↗]
  * Clicking the link slides out the contextual drawer with glossary examples pre-filtered for the active role.

### Flow B: Active Workspace Checklist (The Guiding Rail)
* **Goal**: Support stream-of-consciousness formatting while recording.
* **UI Pattern**:
  * Render a collapsible, non-blocking sidebar inside the recording view.
  * Displays the active framework (e.g. STAR) as checkable bullet segments:
    * `[x] Context (Set the background)`
    * `[x] Action (Detail what you did)`
    * `[ ] Tradeoff (compromises made)`
    * `[x] Outcome (metrics retention)`
  * Candidates use this as a mental guide during recording.

### Flow C: Post-Practice Gap Hyperlinks (The Feedback Loop)
* **Goal**: Bridge the gap between correction and explanation.
* **UI Pattern**:
  * Inside the feedback canvas, all highlighted gaps (e.g. `Missing Tradeoff / Constraint marker`) are styled as active links.
  * Clicking a gap warning opens the reference overlay directly to the **Tradeoff Analysis** entry, offering immediate, actionable examples of how to rewrite the section to secure a passing benchmark score.
