# Candidate Dashboard V2 Figma Brief

Status: Disposable concept brief for Figma exploration.

Goal: create a mobile-first dashboard concept that combines Preparedness Map, Prep Path, and Evidence Drilldown. Treat the current dashboard UI as non-binding. The mockup should explore the strongest visual model for interview preparedness before implementation continues.

## Product Thesis

The dashboard is the candidate's target-interview preparation workspace. It should show what successful preparation looks like, where the candidate currently has evidence, what still needs practice, and the single best next action.

Do not frame the candidate as scored, ranked, or judged. Frame preparedness as evidence building.

## Visual Thesis

A calm coaching workspace with one dominant preparedness visual, clear role anchoring, and tappable evidence layers. The surface should feel structured and encouraging, not like an analytics dashboard.

## Interaction Thesis

1. Tap a preparedness signal to reveal why it matters and what evidence exists.
2. Tap the next step to start or resume a focused practice path.
3. Tap evidence items to see supporting question, answer, resume, or coaching context.

## Candidate Scenario For Mockup

Candidate: Dev Candidate Primary  
Target interview: Customer Success Manager  
Current state:

- One unfinished practice session exists.
- Candidate has provided a JD and resume content.
- The app has generated interview questions.
- The candidate has completed at least one previous session.
- Current coaching signal: make examples more specific and connect tool choices to customer outcomes.

Use realistic sample copy, but avoid long paragraphs.

## Concept Architecture

### 1. Preparedness Map

The Preparedness Map is the primary visual. It represents the major signal lanes that make up interview preparedness for the target interview.

Signal lanes:

- Role Context
- Experience Evidence
- Answer Structure
- Specific Examples
- Outcome Clarity
- Delivery Clarity
- Confidence

Qualitative states:

- Not practiced
- Emerging
- Clear
- Strong

Visual direction:

- Use a compact map, wheel, layered stack, or node cluster.
- Avoid anything that looks like a score, grade, speedometer, or hiring evaluation.
- Show state through calm visual treatment: fill, border, density, check state, or soft emphasis.
- The map should fit in the first mobile viewport with the target role and next action.

Possible visual forms:

- Segmented scaffold: stacked rows or arcs grouped by lane.
- Signal constellation: nodes grouped around the target interview.
- Layered readiness stack: role context at base, experience evidence folded into practice signals, confidence.

Preferred starting point: segmented scaffold or constellation. Avoid a pure radial gauge unless it clearly avoids score-like interpretation.

### 2. Prep Path

The Prep Path is the next-action layer. It explains the recommended route through the candidate's preparation.

It should answer:

- What should I do next?
- Why is this the right next step?
- What will improve if I do it?

Example:

Title: Resume Customer Success Manager practice  
Reason: Your current session is unfinished. Completing it will give the coach enough evidence to update your preparedness map.  
CTA: Resume practice

If no active session exists:

Title: Practice specificity and outcomes  
Reason: Your latest feedback shows clear structure, but your answers need more concrete customer outcomes.  
CTA: Start focused practice

Visual direction:

- One clear action.
- Adjacent to or directly under the map.
- Should feel like a coach recommendation, not a marketing CTA.

### 3. Evidence Drilldown

Evidence Drilldown is the detail layer shown after tapping a signal.

It should answer:

- Why does this signal matter?
- What evidence has the candidate shown?
- What is missing or still emerging?
- What practice action should happen next?

Evidence types:

- JD signal
- Resume content
- Generated question
- Candidate answer
- Coach feedback
- Summary recommendation
- Confidence reflection

Example drilldown for "Specific Examples":

Header: Specific Examples  
State: Emerging  
Why it matters: Interviewers need enough detail to picture what you actually did.  
Evidence:

- Answered a behavioral question about customer escalation.
- Coach noted the example was relevant but needed a measurable outcome.
- Resume content mentions customer health tracking, but the answer did not connect that tool to a result.

Next action: Practice adding one measurable outcome to your customer story.

Visual direction:

- Use a bottom sheet, slide-over, or inline expansion for mobile.
- Keep evidence scannable.
- Use evidence chips or small rows, not long paragraphs.

## Mobile Wireframe

Canvas: iPhone 14 / 390 x 844 or equivalent.

### Frame 1: Dashboard Default

```text
 ------------------------------------------------
| TalentArbor                                    |
|                                                |
| Customer Success Manager                       |
| Target interview                               |
|                                                |
| [Preparedness Map / Signal Scaffold]           |
|  - 7 signals total                             |
|  - 4 have evidence                             |
|  - current focus: Specific Examples            |
|                                                |
| Next Step                                      |
| Resume your practice round                     |
| Completing this session updates your map.      |
| [Resume practice]                              |
|                                                |
| Evidence Preview                               |
| Specific Examples       Emerging              |
| Experience Evidence     Clear                 |
| Outcome Clarity         Emerging              |
| Delivery Clarity        Not practiced         |
|                                                |
| Recent activity                                |
| Customer escalation round                      |
| Summary available                              |
 ------------------------------------------------
```

Primary jobs:

- Show target role.
- Show preparedness visually.
- Show one next action.
- Invite tapping into signals.

### Frame 2: Signal Tapped

```text
 ------------------------------------------------
| Customer Success Manager                       |
| [Preparedness Map with Specific Examples open] |
|                                                |
| Specific Examples                              |
| Emerging                                       |
|                                                |
| Why this matters                               |
| Interviewers need concrete details that show   |
| what you did and what changed.                 |
|                                                |
| Evidence                                       |
| [Question] Tell me about a customer issue...   |
| [Answer] You explained the situation clearly.  |
| [Coach] Add a measurable outcome.              |
| [Resume] Customer health tracking appears...   |
|                                                |
| Next practice                                  |
| Add one result to your customer story.         |
| [Practice this signal]                         |
 ------------------------------------------------
```

Primary jobs:

- Explain the signal.
- Show evidence source traceability.
- Offer a targeted practice action.

### Frame 3: Prep Path Detail

```text
 ------------------------------------------------
| Practice Path                                  |
| Customer Success Manager                       |
|                                                |
| Step 1  Role context saved              Done   |
| Step 2  Experience evidence             Clear  |
| Step 3  Specific examples               Next   |
| Step 4  Outcome clarity                 Later  |
| Step 5  Confidence check-in             Later  |
|                                                |
| Current step                                  |
| Practice specificity and outcomes.             |
|                                                |
| [Start focused practice]                       |
 ------------------------------------------------
```

Primary jobs:

- Show route without gamifying.
- Make progress feel earned and explainable.
- Keep the next action obvious.

### Frame 4: Empty / First-Time State

```text
 ------------------------------------------------
| TalentArbor                                    |
|                                                |
| Start preparing for an interview               |
| Add the role and job description to build your |
| first preparedness map.                        |
|                                                |
| [Empty Preparedness Scaffold]                  |
| Role Context       Not started                 |
| Experience Evidence Optional                  |
| Practice Evidence  Not started                 |
| Confidence         Not started                 |
|                                                |
| [Create practice]                              |
 ------------------------------------------------
```

Primary jobs:

- Explain what will be built.
- Avoid implying missing data is a failure.
- Push to practice setup.

## Desktop Variant

Use the same hierarchy. Do not create a separate dashboard concept.

Suggested layout:

- Left/main: Preparedness Map.
- Right: Prep Path / Next Step.
- Below: Evidence timeline and recent activity.
- Signal drilldown can open as a right-side inspector.

Desktop should feel like a wider version of the mobile concept, not a mosaic of unrelated cards.

## Data Mapping

| UI Element | Current/Future Source |
| --- | --- |
| Target role | `candidate_role_preparation_profiles.target_role` or draft fallback |
| Preparedness signal labels | `prepProfile.signals[].label` |
| Signal state | `prepProfile.signals[].evidenceState` |
| Signals with evidence | Count of signals not `not_practiced` |
| Current focus | `prepProfile.primarySignal` or recommendation source signal |
| Next step title | `prepProfile.recommendation.label` |
| Next step reason | `prepProfile.recommendation.reason` |
| Evidence rows | `PrepEvidenceRef`, `PrepObservation`, answer feedback, resume/JD refs |
| Recent activity | active/completed dashboard items |
| Confidence | future `ConfidenceMeasurement` |

## Copy Direction

Use:

- "Interview preparedness"
- "Signals with evidence"
- "Current focus"
- "Practice this signal"
- "What this shows"
- "What still needs evidence"

Avoid:

- "Score"
- "Rank"
- "Weakness detected"
- "Candidate quality"
- "Hiring readiness"
- "Failure"

## Component And Interaction Notes

Preparedness Map:

- Can be a custom Figma composition rather than a standard chart.
- Should support tap targets large enough for mobile.
- Should visibly distinguish states without relying only on color.

Prep Path:

- Use short step labels and state badges.
- Avoid celebratory gamification unless tied to real evidence.

Evidence Drilldown:

- Should be one tap away, not always visible.
- Use source labels: JD, Resume, Question, Answer, Coach, Summary.
- Candidate should be able to understand why the app made the claim.

## Open Design Questions

1. Is the Preparedness Map better as a segmented scaffold, constellation, or layered stack?
2. Should the default dashboard show the drilldown inline after tapping, or use a bottom sheet?
3. Should Prep Path be visible on the first screen, or revealed after tapping the map's recommended next signal?
4. How much recent history belongs on the default mobile screen before it becomes distracting?
5. Should multiple target roles appear as tabs, cards, or a role switcher at the top?

## Figma Build Checklist

- Create mobile frame first.
- Use realistic data for one active target role.
- Include the four frames above.
- Include one desktop frame only after the mobile concept works.
- Prototype these interactions:
  - tap signal -> signal drilldown;
  - tap next step -> focused practice entry;
  - tap role switcher placeholder -> role list placeholder.
- Keep all text editable.
- Label major layers using product names: Preparedness Map, Prep Path, Evidence Drilldown, Signal Row, Evidence Item.
