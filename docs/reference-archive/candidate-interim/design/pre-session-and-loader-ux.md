# Pre-Session Landing Page & Feedback Loader UI: Dynamic UX Brainstorm

Status: Historical reference

> [!WARNING]
> This file is archived historical context and does not govern current V2 implementation.

This document outlines the visual, copy, and structural recommendations for the two primary transition screens in the candidate journey: the **Pre-Session Landing Page** (the gatekeeper before starting a round) and the **Feedback Loader UI** (the screen active while the v2 evaluation engine is processing).

---

## 1. The Pre-Session Landing Page (Gatekeeper Screen)

The landing page sets the candidate's mindset and verifies technical readiness before they launch into an active practice round.

```text
Pre-Session Landing Page Mockup:
--------------------------------------------------------------------------------
[ Eyebrow: Prep Session 3 of 5 ]
"Focusing on: Specific Examples & Outcomes"

  ----------------------------------------------------------------------------
 |  Coach Observation:                                                        |
 |  "In your last round, I noticed you described team outcomes ('we') rather  |
 |   than your personal contribution. Let's work on 'I' actions today."       |
  ----------------------------------------------------------------------------

  [✓] Mic & Audio Check    [✓] 3 Behavioral Questions    [✓] Estimated: 15 mins

                                 [ Launch Round ]
--------------------------------------------------------------------------------
```

### Contextual & Dynamic Content Segments:

#### A. Session Focus Header (Dynamic to Round Type)
Instead of a generic *"Start Practice"* title, the header shifts based on the trigger path:
* **First Baseline Round**:
  * *Title*: *"Setting Your Baseline"*
  * *Subtitle*: *"I've put together a 5-question baseline cover plan for your [Target Role] role at [Company]. This will help me assess your current evidence range."*
* **Feedback-Driven Round**:
  * *Title*: *"Focus: Strengthening [Skill Dimension]"* (e.g. *Evidence Specificity*).
  * *Subtitle*: *"A targeted session designed to practice injecting concrete details and results."*
* **Review/Redo Round**:
  * *Title*: *"Polishing [Question Title]"*
  * *Subtitle*: *"Re-attempting a question to improve on past growth patterns."*

#### B. The Coach's Grounding Brief (Dynamic to History)
Displays a short synthesized text card in the coach's voice.
* **If previous data exists**: Pulls the highest-severity unresolved pattern gap from the read model.
  * *Example*: *"I've noticed your technical explanations are strong, but we are missing tradeoffs. In this session, try to end each answer with one alternative you ruled out."*
* **If first session**:
  * *Example*: *"Don't worry about being perfect. Just answer as you would in a real conversation. I will listen for your structure and examples."*

#### C. Warm-up Prompts & Mental Anchors
Category-specific tips displayed on the side/bottom to shift the candidate's mental gears:
* **Behavioral**: *"Think of 1-2 stories about challenges where you took the lead before you press start."*
* **Case/Scenario**: *"Be ready to clarify the problem first before jumping into solutions."*
* **Technical**: *"Keep your notebook handy—feel free to outline your architecture before answering."*

---

## 2. The Feedback Loader UI (In-Transit Processing Screen)

The loader UI bridges the gap between submitting an answer and displaying the evaluation. Because the v2 engine runs multiple LLM passes (extraction $\rightarrow$ verification $\rightarrow$ composition), execution can take **8 to 15 seconds**. Standard loaders increase candidate anxiety and drive page abandonment.

```text
Feedback Loader UI Mockup:
--------------------------------------------------------------------------------
"Analyzing your response..."

  [✓] Audio transcription completed.
  [/] Extracting structural evidence (STAR patterns)...
  [ ] Reviewing technical terms against JD...
  [ ] Composing coaching tips...

  ----------------------------------------------------------------------------
 |  Reflective Check-in:                                                     |
 |  "How did that response feel to say?"                                      |
 |   [ Felt Smooth ]      [ Felt Too Long ]      [ Struggled with Result ]   |
  ----------------------------------------------------------------------------
--------------------------------------------------------------------------------
```

### Contextual & Dynamic Content Segments:

#### A. The AI Activity Pipeline Log (Real-Time Stages)
Instead of a spinning wheel, the loader displays a **transparent pipeline log** that resolves step-by-step. This reassures the candidate that the engine is performing deep analysis rather than a simple keyword scan:
1. `Transcribing voice signature...` (Instantly checkmarked for text input, updates on voice upload completion).
2. `Mapping narrative structure against [Category] pattern...`
3. `Extracting observable evidence spans...`
4. `Running technical verification checks...` (Displays only for `technical_role_specific` categories).
5. `Composing custom feedback and upgrades...`

#### B. Reflective Decompression (Interactive Engagement)
While the engine processes, capture the candidate's subjective feedback. This keeps the user engaged during the 10-second wait:
* *Prompt*: *"How did that answer feel to deliver?"*
* *Options*:
  * `[ Felt clear and concise ]`
  * `[ Felt like I rambled a bit ]`
  * `[ Struggled to find a concrete example ]`
  * `[ Unsure about technical accuracy ]`
* *UX Value*: This self-reported state is passed to the read model and compared against the AI's objective appraisal in the dashboard.

#### C. Micro-Coaching / Fact Cards
Rotate short, helpful tips related to the question's category or the target role:
* *"In behavioral rounds, recruiters often remember the Result more than the Setup. Make your outcome numbers count!"*
* *"Taking a 5-second pause to organize your thoughts before starting is completely normal—and encouraged by interviewers."*
* *"System Design interviews assess how you handle constraints, not just your ability to name tools."*
