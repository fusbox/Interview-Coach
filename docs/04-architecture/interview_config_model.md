1) Architecture overview (role-first, tiered configurability)
Key objects (domain-level)

A. RoleInput

roleTitle (required)

jobDescription (optional but strongly recommended)

roleArchetype (optional; can be auto-detected)

B. InvolvementTier

T0_AUTO (zero knobs)

T1_GUIDED (wizard with constrained choices)

T2_ADVANCED (expert controls with validator)

C. InterviewConfig
This is the single “execution contract” the rest of the system reads.

models: { behavioral%, situational%, technical% }

isStructured: boolean (process constraint)

scoringFramework: BARS | NUMERIC_WEIGHTED | LEADERSHIP_MAP | BAR_RAISER

sequencingPattern: WARM | SWEEP | DRILLDOWN | PPF | EVIDENCE_ESCALATION

adaptiveFollowups: boolean

questionCount, difficultyRamp, timeboxing

permaMode: OFF | REFLECTIVE_NON_SCORED (never scored)

D. QuestionPlan + QuestionSet
Derived from config + blueprint.

E. EvaluationPipelines

ScoredPipeline (competency + technical)

ReflectivePipeline (PERMA: narrative tags only, no scores)

F. ConfigValidator
A hard gate that enforces the matrix rules (prevents incoherent combos).

2) Role-first user flows (text diagram-level)
UF-Entry (common start)

Role Step

User enters roleTitle

Optional jobDescription

Click “Continue”

System reaction

Generate (or load cached) CompetencyBlueprint from role/JD

Detect roleArchetype (engine heuristics, overrideable only in T2)

Show “Choose setup mode” (tier selection)

UF-T0_AUTO (default path)

User chooses “Quick Setup”

System picks config preset based on archetype + blueprint

User sees a 1-screen preview (not knobs):

“This session will include: X behavioral, Y technical, Z situational”

“Scoring: numeric weighted across 5 dimensions”

“Follow-ups: on when answers are vague” (if allowed)

Start session

Engineer note: this is just AutoConfig(role, blueprint) -> InterviewConfig

UF-T1_GUIDED (wizard path)

User chooses “Guided Setup”

Wizard steps (still role-first; blueprint already exists)

Step G1: Session intent (human-friendly)

“Screen quickly”

“Go deeper technically”

“Practice storytelling”

“Leadership / stakeholder”

“Confidence-building”

Step G2: Structure preference

“Standardized (consistent questions)” → sets isStructured=true, disables adaptive followups

“Adaptive (follow-ups when needed)” → allows adaptiveFollowups=true unless restricted

Step G3: Time / length

5 / 8 / 12 questions

optional timebox

Then system maps selections → config preset → validate → preview → start

Engineer note: Wizard does not expose scoring frameworks directly; it selects from presets.

UF-T2_ADVANCED (expert path)

User chooses “Advanced Setup”

User can edit:

model mix sliders

scoring framework selector

sequencing selector

structured toggle

adaptive followups toggle

question distribution by competency (optional)

But every change runs through ConfigValidator.

If invalid:

inline error “This combination conflicts with structured fairness rules” etc.

offer fix buttons: “Make structured”, “Disable follow-ups”, “Switch scoring to numeric”

Then preview → start.

3) What to build in code (modules + contracts)
Module 1: BlueprintService

Input: RoleInput

Output: CompetencyBlueprint (versioned)

Cache key: (roleTitle normalized, jdHash, blueprintVersion)

This ties directly to your existing blueprint artifact approach 

competency_driven_interview_coa…

.

Module 2: TierRouter

Input: roleTitle, jd, blueprint

Output: UI route to T0/T1/T2

This is a pure UI router decision, not business logic.

Module 3: ConfigPresetRegistry

Contains:

AutoConfigPresets by archetype

GuidedPresets by intent x structure x length

Output: InterviewConfig

This is where your matrix lives, but hidden.

Module 4: ConfigValidator (must be deterministic)

Input: InterviewConfig

Output: { valid: boolean, errors: ValidationError[], suggestedFixes[] }

Hard rules examples:

If isStructured=true → adaptiveFollowups=false

If scoringFramework=BAR_RAISER → require technical% >= someMin

If sequencing=EVIDENCE_ESCALATION → require adaptiveFollowups=true and isStructured=false

PERMA always → permaMode=REFLECTIVE_NON_SCORED (never enters aggregation)

This lines up with your “log facts, infer meaning, never store conclusions” discipline 

dashboard_constitution

.

Module 5: QuestionPlanService

Input: InterviewConfig + CompetencyBlueprint

Output: QuestionPlan (ids, competency mapping, types, difficulty, intent)

Module 6: QuestionTextService

Input: QuestionPlan + Blueprint

Output: QuestionSet

Module 7: Evaluation Orchestrator

Routes answers to the correct pipeline based on question.evaluationMode

scored vs reflective

Stores only Layer 1 facts (your rule) 

dashboard_constitution

Module 8: SessionPreviewBuilder

Input: InterviewConfig + QuestionPlan

Output: a small PreviewCardModel for UI display

4) UI screens (minimal set)

Screen A: Role Setup

role title

JD paste

continue

Screen B: Setup Mode

Quick / Guided / Advanced

small explanation (1 sentence each)

Screen C1: Guided Wizard

3 steps + progress indicator

Screen C2: Advanced Config

controls + validation messages + “Fix it” chips

Screen D: Preview

what will happen + start button

Screen E: Session

question rendering + evaluation + feedback

5) What I need from you (to make this executable)

Per your instruction, I’ll give you Step 1 only, very detailed. Once you give me the outputs, I’ll produce the full engineer-facing spec (interfaces, validation rules, preset tables, and screen contracts).