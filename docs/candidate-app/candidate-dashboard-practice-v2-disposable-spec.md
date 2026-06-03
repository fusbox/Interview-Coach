# Candidate Dashboard And Practice V2 Disposable Spec

Date: 2026-05-22
Status: Disposable working draft

> [!NOTE]
> Active product and data anchors now live in [SPEC](SPEC.md), [DATA_CONTRACT](DATA_CONTRACT.md), and [HANDOFF](HANDOFF.md). Keep this file as working/reference material until a release milestone; promote durable decisions into the active stack or ADRs.

## Purpose

This document captures product findings and early specs for the next candidate app design pass. It is intentionally disposable: use it to shape discussion, then promote the stable pieces into the durable docs and backlog.

This draft does not assume the current `/practice` or `/dashboard` UI is fixed. It treats the candidate app as a coach-led practice product whose dashboard should help candidates understand what to do next, why it matters, and how their confidence and interview skill are growing.

Related durable docs:

- [SPEC](SPEC.md)
- [DATA_CONTRACT](DATA_CONTRACT.md)
- [HANDOFF](HANDOFF.md)
- [Working Backlog](00-working-backlog.md)
- [Candidate App Operating Model](01-product/candidate-app-operating-model.md)
- [Practice Setup Scope](02-requirements/practice-setup-scope.md)
- [Interview Preparedness Signal Contract](04-architecture/preparedness-signal-contract.md)
- [Postgres Candidate Data Contract](04-architecture/postgres-candidate-data-contract.md)
- [Privacy, Disclosures, And Consent Requirements](06-security/privacy-disclosures-and-consent-requirements.md)

## Current Naming Decision: prepProfile

Use `prepProfile` as the product/domain name for the candidate-owned interview preparation context.

The current database table is still `candidate_role_preparation_profiles`. Treat that physical table name and fields such as `role_profile_id` / `roleProfileId` as implementation details until a future migration intentionally renames or aliases them.

The product model is:

- one `prepProfile` per candidate and target interview context;
- target role and JD define the interview context;
- resume content, when present, shapes how the app frames the candidate's evidence and gaps;
- practice sessions, answer feedback, summaries, confidence, and recommendations attach to the `prepProfile`;
- dashboard visuals should describe interview preparedness, not hiring readiness or candidate quality.

## Prompt-Aligned Preparedness Taxonomy

The dashboard and practice V2 work should reuse the taxonomy already present in the generation and feedback prompts. The durable lane and signal-state rules now live in the [Interview Preparedness Signal Contract](04-architecture/preparedness-signal-contract.md).

| Lane | Existing Source | Product Use |
| --- | --- | --- |
| Role context | Question generation extracts JD requirements, target-role expectations, interview type, and seniority/readability calibration | Defines what this target interview is likely to test |
| Answer content | Answer analysis emits `contentPulse`, hidden dimensions, and `FeedbackPlan.primaryAnchor` | Drives evidence around relevance, structure, specificity, outcomes, and rationale |
| Delivery and readability | Answer analysis emits `deliveryPulse`; text and voice modes have different critique rules | Separates spoken-delivery coaching from typed-answer clarity |
| Experience evidence | Question generation, hints, strong responses, and answer analysis all receive resume context | Frames direct experience, transferable experience, and gap-bridging guidance without making resume comparison its own preparedness lane |
| Interview behavior | Unified categories render as Behavioral, Culture Fit, and Technical | Provides coverage lanes without exposing legacy STAR/PERMA labels |
| Coaching signal | `feedbackPlan`, `nextAction`, and future `coachSignal` | Chooses the next learning focus without exposing raw score logic |
| Confidence | Future pre/post session capture | Shows self-reported growth, separate from performance evidence |
| Helpfulness | Existing `user_feedback` | Measures coaching/product usefulness, not preparedness |

Important prompt constraints:

- Use the role-sensitive reading level and coaching rigor rules when writing candidate-facing dashboard copy.
- Do not expose hidden scores, hidden readiness levels, or internal next-action literals.
- Let `nextAction` decide flow and `coachSignal` decide learning focus.
- Use `feedbackPlan` as the first-class bridge between AI analysis and `prepProfile` evidence states.
- Treat resume/JD context as source evidence that shapes lane wording and evidence refs. It may support separate callouts later, but it is not a Preparedness Map lane.

## 1. Coach Signal Model

Section status: Decision draft.

### Finding

`One Big Upgrade` was useful as an internal working phrase, but it is not a strong user-facing label. It implies a good-to-great refinement, while the actual coaching signal may be more basic, corrective, confidence-building, or reinforcement-oriented.

The underlying product concept should be renamed internally to `coachSignal`. The `oneBigUpgrade` field does not need backward compatibility and should be removed from new schema, prompts, persistence, and UI.

The core question is:

> What is the single highest-leverage thing this candidate should focus on next?

That question exists at two levels:

- Question level: what the candidate should do with this answer right now.
- Session level: what the candidate should practice next across the overall session.

### Decision

Keep `nextAction` and replace `oneBigUpgrade` with `coachSignal`.

The boundary is:

- `nextAction` answers: what should the app do next?
- `coachSignal` answers: what should the candidate learn or focus on next?

This keeps the model response coherent without creating a second API call. It also gives the app a structured coaching primitive that can later support the dashboard, resume builder, job auto-applicant, career navigator, QA review, and cross-module recommendations.

### Internal Objects

The app should model action and learning separately.

```ts
type NextAction = {
    actionType: "retry_answer" | "continue" | "finish_session";
    label: string;
};

type CoachSignal = {
    level: "question" | "session";
    qualityBand: "foundation" | "building" | "solid" | "polish";
    labelKey:
        | "start_here"
        | "biggest_lift"
        | "polish_move"
        | "keep_this_strength"
        | "next_practice_focus";
    focus: string;
    evidence: string;
    whyItMatters: string;
    tryThis?: string;
    relatedDimension?: string;
    targetMoment?: string;
    sourceRefs?: Array<{
        type: "answer" | "resume" | "job_description" | "session_pattern" | "candidate_feedback";
        id?: string;
        label?: string;
    }>;
};
```

The model may generate the structured `coachSignal` values and candidate-facing text fields in the same answer-feedback response, but the UI label should be selected deterministically from `labelKey`.

`recommendation` should not remain an independent model-authored coaching field. If CTA-adjacent explanatory text is needed, the app should derive it from `nextAction` and `coachSignal`.

### Candidate-Facing Label Rules

Use conditional labels instead of one universal label. The model should not write the visible label; it should return `labelKey`, and the UI should map that key to approved copy.

| Signal State | Candidate-Facing Label | Intended Meaning |
| --- | --- | --- |
| Answer lacks a necessary piece | Start here | The next move is foundational |
| Answer is usable but underdeveloped | Biggest lift | One improvement would create noticeable growth |
| Answer is strong but can sharpen | Polish move | Move from solid to stronger |
| Answer shows a repeatable strength | Keep this strength | Reinforce a useful behavior |
| Session-level next step | Next practice focus | The recommended focus for the next round |

`Biggest lift` remains a useful fallback, but it should not carry the whole concept.

### Quality Band Rules

Use `qualityBand` to stabilize the UI and analytics layer.

| Quality Band | Typical Coaching State | Typical Label Key | Common Next Action |
| --- | --- | --- | --- |
| `foundation` | Missing core relevance, structure, or evidence | `start_here` | `retry_answer` |
| `building` | Usable answer with one important missing piece | `biggest_lift` | `retry_answer` or `continue` |
| `solid` | Clear answer with focused improvement available | `polish_move` | `continue` |
| `polish` | Strong answer with repeatable strength or refinement | `keep_this_strength` | `continue` |

The model can recommend the quality band, but validation should ensure the band aligns with `feedbackPlan.signal`, `feedbackPlan.intervention`, and `nextAction`.

### Question-Level Behavior

At the end of each answer feedback flow, the coaching signal should:

- support the existing `nextAction` decision instead of competing with it;
- explain the single most useful focus in candidate language;
- avoid exposing internal action literals such as `stop_for_now`;
- include a candidate-ready phrase only when it is specific and plausible;
- avoid inventing tools, metrics, employers, outcomes, or experiences.

Question-level examples:

- `Start here`: "Add one specific example before you move on."
- `Biggest lift`: "Tie the example back to the Customer Success Manager role."
- `Polish move`: "Name the business reason behind your decision."
- `Keep this strength`: "Keep using a clear before-and-after structure."

### Question-Level Persistence

Persist both structured data and candidate-facing generated text.

The structured fields are needed for:

- UI label selection;
- dashboard rollups;
- QA filtering;
- future cross-module recommendations;
- analytics that do not rely on parsing prose.

The generated text is needed for:

- replaying the exact feedback the candidate saw;
- auditability;
- avoiding re-generation costs;
- stable summary/dashboard behavior when model prompts evolve.

The answer-level feedback payload should therefore persist:

- `nextAction`;
- `coachSignal`;
- `feedbackPlan`;
- visible pulses;
- hidden scores/readiness metadata as already supported.

### Session-Level Behavior

At the end of a session, the app should synthesize a session-level `coachSignal` from:

- repeated answer-level signals;
- role/JD expectations;
- experience-evidence gaps;
- confidence and user feedback signals;
- whether the candidate retried answers or moved through smoothly.

Session-level examples:

- "Next practice focus: connect your examples more directly to this role."
- "Next practice focus: make your strongest story shorter and easier to remember."
- "Next practice focus: practice one behavioral story with a clearer result."

### Session-Level Generation Decision

Use a hybrid approach:

- Derive candidate patterns from persisted answer-level `coachSignal`, `feedbackPlan`, feedback dimensions, and user feedback.
- Give the summary pass that structured context so it can write one session-level coaching signal in natural coaching language.
- Persist the final session-level `coachSignal` with the summary output.

This avoids a separate model call while keeping the summary grounded in structured answer-level evidence. It also gives the dashboard a stable session-level recommendation without needing to scan raw transcripts at load time.

### Label Selection Decision

Label selection should be deterministic.

The model should return `qualityBand` and `labelKey`, but the UI should map `labelKey` to approved display text. If the model returns an invalid or incoherent label key, the app should fall back from `qualityBand` and `nextAction`.

Fallback mapping:

| Condition | Fallback Label |
| --- | --- |
| `level = session` | Next practice focus |
| `nextAction.actionType = retry_answer` and `qualityBand = foundation` | Start here |
| `nextAction.actionType = retry_answer` | Biggest lift |
| `qualityBand = polish` | Keep this strength |
| Default | Polish move |

### Removal Notes

Because `oneBigUpgrade` does not require backward compatibility:

- remove `oneBigUpgrade` from new generated schema and prompts;
- remove candidate-facing UI labels and copy that say "One Big Upgrade";
- remove dashboard read preference for `oneBigUpgrade`;
- replace persisted answer feedback output with `coachSignal`;
- update tests to assert `coachSignal` exists and `oneBigUpgrade` is not required.

### Closed Product Questions

- Persist structured data and generated text. Structured data powers UI, analytics, QA, and future modules; generated text preserves what the candidate saw and avoids unnecessary re-generation.
- Generate session-level focus with a hybrid summary-pass approach: derive structured context from answer-level signals, then let the summary pass write and persist one session-level `coachSignal`.
- Select labels deterministically from `labelKey` and fallback rules. Do not leave user-facing labels entirely to the model.

## 2. Graphical Progress Without Scoring

Section status: Decision draft.

### Finding

Qualitative feedback should remain the center of the product. However, many users expect some visible evidence of progress. The dashboard should become more graphical without becoming score-heavy or gamified.

Avoid:

- fake precision such as "Interview score: 82";
- pass/fail labels;
- ranking candidates;
- signals that imply hiring decision suitability.

Use:

- confidence trend;
- practice completion;
- focus coverage;
- resume-informed evidence coverage inside preparedness signals;
- repeated coaching themes;
- session momentum.

### Confidence Collection Decision

Collect confidence before and after every practice session.

This gives the app a lightweight, recurring quantitative signal without interrupting the question-by-question coaching flow. It also supports candidate-visible progress over time without implying hiring-decision scoring.

| Moment | Collect? | Purpose |
| --- | --- | --- |
| First-time candidate baseline | Yes | Establish candidate-level starting point |
| Before every practice session | Yes | Capture current self-reported confidence for this target interview, context, and moment |
| After every practice session | Yes | Capture immediate confidence movement |
| After completing a recommended practice path | Later | Measure whether a multi-session path is helping |
| After every question | No | Too interruptive; use helpfulness feedback for question-level feedback instead |
| After resume-informed evidence review | Later | Useful only if the app adds a candidate-facing evidence review surface |

The dashboard can display confidence as:

- latest pre/post session movement;
- trend across recent sessions;
- milestone change from first baseline to current state;
- optional path-level change once recommended practice paths exist.

### Visual Data Decision

Dashboard visuals should display both qualitative and quantitative data.

Quantitative data should describe practice behavior, confidence, and coverage. It should not claim hiring quality.

Useful quantitative signals:

- completed practice rounds;
- active or unfinished practice rounds;
- confidence pre/post values;
- confidence trend;
- practice path progress;
- role signal coverage;
- resume-informed signal coverage;
- repeated coaching focus counts.

Useful qualitative signals:

- next practice focus;
- coach signal labels;
- focus chips;
- resume-informed coaching prompts;
- recent session coaching summaries;
- "try this" phrases;
- confidence reflection copy.

### Recommended Visual Components

| Component | Purpose | Candidate Interpretation |
| --- | --- | --- |
| Confidence trend | Show pre/post or session-over-session confidence | "I am feeling more prepared over time" |
| Practice path progress | Show movement through a recommended path | "I know where I am in the plan" |
| Focus chips | Show coaching themes practiced recently | "These are the skills I am working on" |
| Signal coverage grid | Show role signals practiced vs still unpracticed | "I have not practiced every important area yet" |
| Experience evidence map | Show role needs connected to resume/answer evidence | "Here is how I can talk about my experience" |
| Session timeline | Show recent rounds, unfinished sessions, and outcomes | "I can pick up where I left off" |

### Library-First Component Targeting

The practice and dashboard V2 pass should use a library-first design workflow:

1. Start from the product job of each section.
2. Identify proven component patterns that already solve the interaction well.
3. Adapt the pattern into local `components/patterns` or feature components.
4. Keep design-system tokens, accessibility, testability, and app data contracts under local ownership.

The app should not adopt a large black-box UI framework for these pages. The current stack is already compatible with a component-owned approach:

- Tailwind for styling;
- local shadcn-style UI components;
- Radix primitives for accessible interaction;
- lucide icons;
- Framer Motion for purposeful transitions;
- Recharts for dashboard visualizations.

TripleD is useful as an inspiration catalog and pattern source, not necessarily as a direct dependency. Components should be copied/adapted only when they fit the app's interaction model and can be maintained locally.

Reference catalogs and libraries:

- [TripleD Components](https://ui.tripled.work/components)
- [shadcn/ui Docs](https://ui.shadcn.com/docs)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
- [Recharts Guide](https://recharts.github.io/en-US/guide/)
- [Motion For React](https://motion.dev/docs/react)

### Components Worth Considering

These components are candidates for `/practice`, `/dashboard`, or later candidate app enhancements. Inclusion here does not mean all will be implemented.

| Component / Pattern | Candidate Surface | Potential Use |
| --- | --- | --- |
| Dashboard / Stats Dashboard | Dashboard | Overall dashboard layout inspiration |
| Glassmorphism Statistics Card | Dashboard | Confidence, completed rounds, path progress cards |
| Glassmorphism Minimal Metrics | Dashboard | Compact mobile metric strip |
| Stats Counter Block / Animated Counter | Dashboard | Practice rounds, confidence movement, path counts |
| Accessible Cash Flow Chart | Dashboard | Adapt pattern for confidence trend |
| Interactive Timeline / Timeline Block | Dashboard | Recent sessions and practice path progress |
| Animated List | Dashboard | Recent sessions, recommended actions, unfinished sessions |
| Hover Expand Card | Dashboard | Next practice focus or resume-informed evidence preview |
| Detail Task Card | Dashboard | Recommended practice path cards |
| Preview Details Card | Dashboard | Completed session preview with coach signal |
| Dynamic Tag Cloud | Dashboard | Coaching focus chips and practiced skill themes |
| Bento Grid Block | Dashboard | Desktop dashboard layout inspiration |
| Feature Comparison Table | Dashboard | Experience evidence map |
| Notification Center | Dashboard | Future nudges, reminders, and return prompts |
| Command Palette | Practice / Dashboard | Quick practice-goal selector or jump-to-action control |
| Bottom Modal | Practice | Mobile advanced setup for stage, count, mode, confidence |
| Animated Dialog | Practice | Context explanations, disclosure/consent, coaching guidance |
| AI Glow Input | Practice | Target role, JD, or resume input treatment |
| Expanding Search Dock | Practice | Future target-role search or role lookup |
| AI Loading Skeleton | Practice / Summary | Generation, analysis, and summary load states |
| Morphing Action Button | Practice | Start practice CTA, used subtly |
| Tabs | Practice / Dashboard | Practice mode/path sections |
| Animated Card Stack | Dashboard | Recent sessions, later if it improves exploration |
| AI Response Typing Stream | Later | Future coach explanation/chat experience |
| AI Chat Interface | Later | Future coach chat, not MVP dashboard |

### Components To Avoid For Now

Avoid patterns that would make the candidate app feel like a marketing page, game, or decorative demo:

- heavy hero/landing blocks inside app surfaces;
- decorative-only cursor/liquid effects;
- e-commerce, weather, credit-card, or unrelated data cards;
- kanban/task-board patterns unless the dashboard intentionally becomes a task manager;
- dark/futuristic/glassy surfaces that conflict with the TalentArbor visual direction;
- components whose interaction cannot be tested or maintained locally.

### Dashboard V2 Component Map

Recommended dashboard components:

| Dashboard Section | Product Job | Component Direction |
| --- | --- | --- |
| Next action card | Tell the candidate what to do next | Hover/detail card adapted into a tappable mobile card |
| Recommended practice path | Give the candidate a coach-led route | Detail task card plus timeline/progress treatment |
| Confidence trend | Show visible progress without scoring | Recharts line or area chart with pre/post markers |
| Focus chips | Show repeated coaching themes | Dynamic tag cloud or chip grid |
| Experience evidence preview | Connect JD needs to candidate evidence | Comparison table/card hybrid |
| Recent sessions | Make history explorable | Animated list or timeline |
| Progress metrics | Show lightweight quantitative momentum | Minimal metric cards/counters |

### Practice V2 Component Map

Recommended practice components:

| Practice Section | Product Job | Component Direction |
| --- | --- | --- |
| Target role input | Start setup quickly | Polished input surface, future searchable role picker |
| JD/resume context | Add context without making setup heavy | Calm large input/card surface |
| Practice goal selector | Convert intent into session configuration | Card/chip selector or command-palette style picker |
| Advanced setup | Keep optional controls available but out of the way | In-flow accordion |
| Confidence check | Capture pre-session confidence | Purpose-built confidence selector |
| Start generation | Make the transition feel intentional | Morphing action button plus multistep loader |
| Generation/loading | Communicate AI work clearly | AI loading skeleton/multistep loader |

### Component Build Execution Log

Use this log as the component-level execution trail for the practice/dashboard V2 buildout.

1. Done - `ConfidenceCheck`
   - Reusable before/after session confidence component.
   - Supports quantitative trend data and candidate reflection.
   - Current state: component and focused tests landed; persistence/wiring to practice setup remains upcoming.

2. Done - `NextPracticeFocusCard`
   - Replaces the current "One Big Upgrade" mental model with `coachSignal`.
   - Shows label, focus, why it matters, and primary action.
   - Current state: dashboard surface landed; feedback/summary variants remain upcoming.

3. Done - `PracticePathCard`
   - Displays recommended path, progress, and CTA.
   - Current state: first dashboard version landed; richer path rules remain upcoming.

4. Done - `ConfidenceTrendCard`
   - Uses Recharts.
   - Converts pre/post session confidence into a simple visual.
   - Current state: empty and populated visual states landed; real confidence data source remains upcoming.

5. Done - `RecentPracticeList`
   - Uses animated-list/timeline inspiration.
   - Makes unfinished and completed sessions easy to revisit.
   - Current state: active and completed dashboard lists now use the shared component.

6. Superseded - standalone experience-evidence preview
   - Earlier shell showed role requirements next to candidate evidence.
   - Current direction: resume/JD evidence is folded into Preparedness Map signal evidence refs, not rendered as a standalone lane. A separate experience-evidence callout may return later if it supports candidate understanding without competing with the scaffold.

7. Done - `FocusChipCloud`
   - Lets candidates explore coach-signal themes and practice-goal filters.
   - Current state: dashboard shell landed with selected-state semantics; interactive filtering and practice setup reuse remain upcoming.

8. Done - `AdvancedSetupAccordion`
   - Keeps optional setup controls discoverable without lengthening the default setup flow.
   - Current state: `/practice` now keeps Practice focus and Question count behind an in-flow Advanced setup accordion; the expanded surface pushes following content down, renders option-button groups, preserves hidden current values when closed, and restores selected values when reopened.

9. Done - `DashboardProgressMetrics`
   - Refines the current metric cards into more intentional quantitative momentum visuals.
   - Current state: dashboard metric row is now a purpose-built practice momentum component with completion momentum plus the first visible interview-preparedness signal rail. The rail uses qualitative `prepProfile` signal counts and primary-signal state instead of hard-coded focus-path progress or numeric scoring; real confidence data remains in `ConfidenceTrendCard`.

10. Done - `PracticePathRules`
   - Replaces the static first-pass practice path with recommendation logic.
   - Inputs should include unfinished work, latest coach signal, confidence movement, resume/JD context, and completed-session history.
   - Current state: dashboard recommendation rules now prioritize active unfinished work first, then latest persisted coaching signal, then completed-session fallback, then first-practice onboarding. The first pass uses existing dashboard read-model data only; confidence movement and real resume/JD gap extraction remain upcoming inputs.

11. Done - `PracticeSetupFocusSelector`
   - Converts the current select-based Practice focus control into a more coach-like selector.
   - Should clarify what each focus changes in the generated session without making setup feel like intake.
   - Current state: Practice focus is an option-button group inside Advanced setup, with option-level descriptions explaining how Balanced, Behavioral, Technical, Case/Scenario, and Screening choices affect generated questions.

### Dashboard V2 Candidate Experience

The dashboard should answer four questions quickly on mobile:

1. What should I do next?
2. Why is that the right next step?
3. What progress have I made?
4. What can I explore if I want more detail?

Recommended mobile hierarchy:

1. Next action card
2. Recommended practice path
3. Confidence/progress visual
4. Experience evidence callouts inside Preparedness Map drilldowns
5. Recent sessions
6. Deeper details behind taps, drawers, or expandable cards

#### Dashboard Component Build Execution Log

Use this log to track dashboard-specific application of the reusable component set.

1. Done - `NextPracticeFocusCard`
   - Answers "what should I do next?" with the current `nextBestAction`.
   - Current state: replaces the prior inline dashboard action card.

2. Done - `PracticePathCard`
   - Answers "why is that the right next step?" with a focused practice path shell.
   - Current state: static first-pass path card is present; recommendation rules remain upcoming.

3. Done - `ConfidenceTrendCard`
   - Answers "what progress have I made?" with an empty state ready for before/after confidence data.
   - Current state: visual shell is present; real confidence capture/persistence remains upcoming.

4. Done - `RecentPracticeList`
   - Answers "what can I revisit?" for active and completed practice rounds.
   - Current state: dashboard lists now share one reusable recent-practice component.

5. Superseded - standalone experience-evidence preview
   - Earlier shell added a first resume/JD gap preview.
   - Current direction: Preparedness Map drilldowns show source evidence from resume/JD context, questions, answers, and coach feedback. Separate resume/JD callouts remain possible but are not part of the core lane model.

6. Done - `FocusChipCloud`
   - Gives candidates a low-friction way to explore recommended focus areas.
   - Current state: visible focus chips and selected-state semantics are present; filtering behavior remains upcoming.

7. Done - `DashboardProgressMetrics`
   - Refines the current metric cards into more intentional quantitative momentum visuals.
   - Current state: top dashboard stats now live inside a practice momentum region with completion momentum and interview-preparedness signal evidence semantics.

8. Done - `PracticePathRules`
   - Replaces the static first-pass path with recommendation logic based on session outcomes, confidence movement, resume/JD context, and unfinished work.
   - Current state: first-pass deterministic rules are live for active session, latest coaching signal, completed-session fallback, and first-practice onboarding states.

9. Done - `RoleProfileDashboardScaffold`
   - Carries persisted prep profile identity into dashboard reads without requiring old rows to be backfilled.
   - Current state: resume-informed evidence remains contextual; the dashboard distinguishes `Role context saved` from older `Role context from practice history` rows while avoiding unsupported preparedness claims.

10. Done - `PrepProfileSignalRail`
   - Makes the first visible interview-preparedness scaffold claim.
   - Current state: Practice Momentum shows signals with evidence, the current primary signal, qualitative state, and a non-score progress bar derived from `prepProfile.signalCounts`.

11. Done - `PrepProfileEvidenceStates`
   - Defines how `prepProfile` read-model signals, resume/JD context, answer feedback, and coach signals become visible Preparedness Map evidence states.
   - Current state: dashboard mapping consumes `prepProfile.signals` directly, preserves weaker and stronger observations as evidence refs, and avoids a standalone resume/JD lane.

12. Done - `PreparednessLaneFillAndDrilldown`
   - Uses `prepProfile.evidenceCounts` as a quiet visual fill cue for each Preparedness Map lane without displaying percentages, ratios, or score-like values.
   - Current state: lane fill reflects qualitative progress toward the next evidence state, and drilldowns explain why the lane matters, what source evidence exists, and how to use that evidence. Drilldowns no longer launch targeted practice directly; the Practice Next card remains the only dashboard CTA surface for now.

13. Upcoming - `ExperienceEvidenceCallouts`
   - Defines whether resume/JD evidence deserves a separate supporting callout after the Preparedness Map lane model is validated.

14. Upcoming - `FocusChipInteractions`
   - Defines whether focus chips filter history, start targeted practice, open detail drawers, or all three.

15. Upcoming - `ConfidenceTrendData`
   - Wires before/after confidence capture into dashboard trend points without treating confidence as a performance score.

### Copy Direction

Use coaching language, not analytics language.

Prefer:

- "You practiced explaining your customer success experience."
- "Your next focus is making examples more specific."
- "Your confidence has improved over your last two rounds."

Avoid:

- "Score increased by 13%."
- "Candidate quality improved."
- "Low competency detected."

### Closed Product Questions

- Collect confidence before and after every practice session. Also collect first-time baseline. Add practice-path milestone collection later.
- Dashboard visuals should display both quantitative and qualitative data, with quantitative data limited to practice behavior, confidence, coverage, and progress.
- Target all listed visual categories for inclusion across the V2 dashboard/practice direction, but implement them in passes rather than all at once.

## 3. Experience Evidence And Recommended Practice Paths

### Finding

Experience-aware preparation is a strong candidate-app differentiator. It turns the dashboard into a job-seeking coach rather than a session history page.

The app can compare three sources:

- JD signals: what the role appears to require.
- Resume signals: what the candidate appears to bring.
- Answer signals: what the candidate actually demonstrated in practice.

The product should frame this as bridge-building, not deficiency labeling.

### Experience Evidence Model

```ts
type ExperienceEvidenceSignal = {
    roleSignal: string;
    resumeEvidence?: string;
    answerEvidence?: string;
    bridgeStatus: "not_practiced" | "emerging" | "clear" | "strong";
    candidatePrompt: string;
};
```

Example:

| Role Signal | Resume Evidence | Answer Evidence | Status | Candidate Prompt |
| --- | --- | --- | --- | --- |
| Customer health management | Mentions onboarding and renewals | Answer mentioned proactive check-ins | Emerging | Practice connecting onboarding work to retention impact |
| Data reporting | Resume lists Salesforce reports | Not yet used in answers | Not practiced | Try one answer that explains how you used reports to make a decision |

Implementation note: these rows should feed or annotate existing preparedness signals. They should not create a separate resume/JD lane unless a later design pass proves a distinct callout helps candidates understand the scaffold.

### Recommended Practice Paths

Practice paths should turn coach findings into action. They are not just categories; they are guided next steps.

| Path | When To Recommend | Session Behavior |
| --- | --- | --- |
| Role Fit Builder | Candidate needs to connect background to the JD | More role-relevance questions; feedback emphasizes fit and evidence |
| Experience Connector | Resume content has useful evidence not showing up in answers | Questions invite resume-based examples; hints point to likely experience areas |
| Story Builder | Candidate answers are vague or unstructured | Behavioral prompts; feedback emphasizes context/action/result |
| Confidence Round | Candidate is anxious or low confidence | Lower-pressure questions; warmer feedback tone; shorter session |
| Hiring Manager Prep | Candidate is preparing for deeper role conversation | Judgment, ownership, decision-making, and scenario questions |
| Polish Round | Candidate answers are already solid | Stronger role calibration; focus on concision, impact, and specificity |

### Intake Implications

Progressive intake should make these paths possible without making setup feel long.

Required:

- Target role
- Job description
- Optional resume content

Quick personalization:

- "What do you want help with today?"

Suggested choices:

| Candidate Choice | Internal Practice Path Bias |
| --- | --- |
| Help me answer common interview questions | Balanced practice |
| Help me explain my experience clearly | Story Builder |
| Help me connect myself to this job | Role Fit Builder |
| Help me use my resume better | Experience Connector |
| Help me prepare for a first screening | Confidence Round / Screening Prep |
| Help me prepare for a hiring manager interview | Hiring Manager Prep |
| I am not sure. Choose for me. | Balanced practice with adaptive recommendation |

Advanced optional setup:

- interview stage;
- question count or session length;
- answer mode preference;
- confidence level;
- biggest concern.

### Open Product Questions

- Should the app create resume-informed evidence rows at setup time, after the first session, or only after enough practice history exists?
- Should practice paths be explicitly user-selected, model-recommended, or both?
- Should dashboard path recommendations create a new practice session with prefilled setup?

## 4. Admin And QA Segregation Findings

### Finding

Candidate-led sessions can likely feed the existing `/admin` and `/qa/ai-quality` routes, but the current implementation needs hardening before that is treated as an intentional product capability.

The desired policy posture remains:

- Recruiters and hiring-decision users should not see candidate-led practice data.
- Admin users may see operational aggregates and support/debug information.
- QA users may inspect AI quality artifacts, preferably redacted by default.
- Candidate users see only their own profile, drafts, sessions, summaries, and dashboard.

### Current Code Findings

The current AI-quality schema is close to supporting clean segregation.

`public.ai_generations` includes:

- `app_name`
- `surface`
- `session_id`
- `invite_batch_id`
- `candidate_id`
- `created_by`
- `privacy_flags`
- `redaction_status`
- `retention_class`

The QA read repository selects these fields and supports filtering by:

- `surface`
- `status`
- free-text search

Search currently includes `app_name`, `session_id`, `invite_batch_id`, and `candidate_id`, but `/qa/ai-quality` does not yet expose a first-class app/source filter.

The admin feedback route reads `public.user_feedback` and joins `public.sessions`. It can show candidate and recruiter feedback, but it does not yet clearly distinguish recruiter-invited candidate feedback from candidate-led feedback in a first-class way.

### Recommended Segregation Requirements

QA route requirements:

- Add first-class `app_name` filter: `recruiter_app`, `candidate_app`, and all.
- Add grouping by app/source in addition to surface/session/correlation.
- Default QA view may show all app sources for QA users, but the distinction must be visible.
- Candidate-led raw artifacts should remain redacted or restricted according to retention class.
- Export should include app/source filters so QA exports do not accidentally mix flows.

Admin feedback requirements:

- Add source classification for feedback records: recruiter-invited, candidate-led, recruiter-user, unknown.
- Show aggregate candidate-led feedback separately from recruiter-invited candidate feedback.
- Avoid exposing candidate-led free-text practice content in admin feedback unless explicitly approved.
- Keep support/debug access distinct from hiring-decision visibility.

Data requirements:

- Candidate-led sessions should be traceable through `candidate_practice_drafts.session_id`.
- AI artifacts should carry `app_name = "candidate_app"` and `candidate_id` for candidate-owned sessions.
- Recruiter-invited sessions should keep invite/batch context and should not be confused with candidate-led sessions.
- If needed, add a durable session source field rather than inferring source only from associated tables.

### Suggested Implementation Slices

1. QA app/source filtering:
   - Add repository filter by `app_name`.
   - Add route query param and UI select.
   - Add export filter support.
   - Add tests for candidate/recruiter segregation.

2. Admin feedback source classification:
   - Extend admin feedback repository result with source classification.
   - Add UI grouping/counts for candidate-led vs recruiter-invited vs recruiter-user.
   - Add tests covering mixed feedback sets.

3. Data contract review:
   - Decide whether `sessions` needs an explicit source/app field.
   - Confirm candidate-led data never appears in recruiter dashboard queries.
   - Add smoke query validating candidate-led/recruiter-invited separation.

### Open Product And Policy Questions

- Should QA be allowed to view raw candidate-led prompts/outputs, or only redacted artifacts?
- Should admin users see individual candidate-led feedback rows, or only aggregate metrics?
- Should support/debug workflows ever allow lookup by candidate email, and under what audit controls?
- Does company policy require additional disclosures if QA/admin can view AI artifacts from candidate-led sessions?

## Suggested Next Spec Pass

The next durable spec should turn this draft into four linked artifacts:

1. Coach Signal Model and Labels
2. Dashboard V2 Information Architecture
3. Practice Intake V2 Requirements
4. Candidate-Led Admin/QA Segregation Requirements

Each artifact should include acceptance criteria and test implications before implementation starts.
