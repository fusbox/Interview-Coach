Interview Architect v1 — Engineer Handoff Spec
1) Product rules locked (from your decisions)
Personas → allowed tiers

Recruiter: T0 / T1 / T2

Candidate: T0 / T1 (no T2)

Role-first invariant

The flow always starts with roleTitle (required), JD optional.

reqId optional, can be added later (especially structured scenarios).

PERMA

Include exactly 1 explicit PERMA warm-opener question in T0 and T1 by default.

PERMA is REFLECTIVE_NON_SCORED (never enters numeric scoring or aggregation).

The model should also detect PERMA signals throughout the session regardless of question type:

This means PERMA becomes a secondary “signal extraction layer” applied to all answers, separate from scoring.

Question counts

5 / 8 / 12 supported in T0/T1 presets; T2 allows custom count.

Structured interviews

“Structured” is treated as a separate flow stub for now:

When you have client process details, you’ll run a different setup path.

For v1, we still support isStructured as a config flag (gated behavior), but the full structured library flow is deferred.

These choices align with your “log facts; infer meaning; never store conclusions” spec. 

dashboard_constitution

2) Folder & file layout
New directories (additive, not invasive)
src/
  lib/
    domain/
      interview/
        types.ts
        archetypes.ts
        validators.ts
        presets.ts
    server/
      interview-architect/
        BlueprintService.ts
        ArchetypeResolver.ts
        TierRouter.ts
        PresetRegistry.ts
        ConfigValidator.ts
        QuestionPlanService.ts
        QuestionTextService.ts
        PermaSignalService.ts
        SessionAssembler.ts
        index.ts
      services/
        (existing)
  app/
    api/
      session/
        setup/
          role/route.ts
          config/route.ts
          questions/route.ts
  features/
    session/
      context/SessionContext.tsx  (existing)
    setup/
      RoleSetupScreen.tsx
      TierSelectScreen.tsx
      GuidedWizardScreen.tsx
      AdvancedConfigScreen.tsx
      SetupPreviewScreen.tsx
3) Domain contracts (TypeScript)

Create: src/lib/domain/interview/types.ts

export type InvolvementTier = "T0_AUTO" | "T1_GUIDED" | "T2_ADVANCED";

export type ScoringFramework =
  | "BARS"
  | "NUMERIC_WEIGHTED"
  | "LEADERSHIP_MAP"
  | "BAR_RAISER";

export type SequencingPattern =
  | "WARM_OPENER"
  | "COMPETENCY_SWEEP"
  | "PROGRESSIVE_DRILLDOWN"
  | "PAST_PRESENT_FUTURE"
  | "EVIDENCE_ESCALATION";

export type QuestionCategory = "STAR" | "PERMA" | "TECHNICAL_ROLE";

export type EvaluationMode =
  | "COMPETENCY_SCORED"
  | "TECHNICAL_SCORED"
  | "REFLECTIVE_NON_SCORED";

export type RoleArchetype =
  | "ENGINEERING_TECH"
  | "HEALTHCARE_COMPLIANCE"
  | "SALES_REVENUE"
  | "CREATIVE_PORTFOLIO"
  | "LEADERSHIP_MANAGER"
  | "EARLY_CAREER"
  | "OPERATIONS_SUPPORT"
  | "GENERAL_PROFESSIONAL";

export interface RoleInput {
  roleTitle: string;
  jobDescription?: string;
  reqId?: string; // optional v1
}

export interface InterviewConfig {
  tier: InvolvementTier;

  isStructured: boolean;
  adaptiveFollowups: boolean;

  sequencing: SequencingPattern;
  scoringFramework: ScoringFramework;

  modelMix: {
    behavioral: number;
    situational: number;
    technical: number;
  };

  questionCount: 5 | 8 | 12 | number; // number for T2

  difficultyRamp: "flat" | "gentle" | "steep";

  perma: {
    includeExplicitWarmOpener: boolean; // true in v1
    extractionEnabled: boolean;         // true in v1
    mode: "REFLECTIVE_NON_SCORED";      // locked in v1
  };

  role: {
    title: string;
    jdHash?: string;
    archetype: RoleArchetype;
    reqId?: string;
  };

  configVersion: "ic-config-v1";
  presetId?: string;
}
4) Supabase migrations (SQL)
Migration 001: session_configs
create table if not exists public.session_configs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  tier text not null,
  config_version text not null,
  preset_id text,
  config_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists session_configs_session_id_idx
  on public.session_configs(session_id);
Migration 002: blueprints
create table if not exists public.blueprints (
  id uuid primary key default gen_random_uuid(),
  role_title text not null,
  jd_hash text,
  blueprint_version text not null,
  blueprint_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists blueprints_lookup_idx
  on public.blueprints(role_title, jd_hash, blueprint_version);
Migration 003: evolve questions
alter table public.questions
  add column if not exists category text,
  add column if not exists evaluation_mode text,
  add column if not exists competency_id text,
  add column if not exists difficulty text,
  add column if not exists sequence_index int;

create index if not exists questions_session_seq_idx
  on public.questions(session_id, sequence_index);

RLS: keep your existing patterns. Candidate token access should only allow reading questions for that session and writing their responses; recruiters can manage their sessions.

5) Server modules (implementation details)
5.1 BlueprintService

src/lib/server/interview-architect/BlueprintService.ts

Responsibilities:

normalize title (trim, collapse spaces)

compute jdHash if JD exists (SHA-256)

check blueprints cache by (role_title, jd_hash, blueprint_version)

if miss → Gemini call to generate blueprint JSON (per your artifact approach) 

competency_driven_interview_coa…

persist cache row

return blueprint

Output must be strict JSON.

5.2 ArchetypeResolver

ArchetypeResolver.ts

Heuristic mapping (v1 deterministic):

Healthcare keywords: RN, LPN, CNA, phlebotomist, clinical, patient, specimen → HEALTHCARE_COMPLIANCE

Engineering keywords: software, engineer, devops, data, backend, frontend, ML → ENGINEERING_TECH

Sales keywords: account exec, SDR, BDR, quota, pipeline → SALES_REVENUE

Designer/portfolio keywords: UI/UX, graphic, portfolio, brand → CREATIVE_PORTFOLIO

Manager keywords: manager, director, lead, stakeholder → LEADERSHIP_MANAGER

Internship/entry keywords: intern, junior, entry → EARLY_CAREER

Ops keywords: coordinator, admin, specialist → OPERATIONS_SUPPORT

default: GENERAL_PROFESSIONAL

5.3 TierRouter

TierRouter.ts

Input: user context

if recruiter authenticated → allow T0/T1/T2

else candidate token session → allow T0/T1 only

Return: { allowedTiers, defaultTier } (default T0)

5.4 PresetRegistry

PresetRegistry.ts

Two layers:

Archetype defaults (T0)

Guided wizard presets (T1)

T0 defaults (questionCount chosen by user later: 5/8/12)

General v1 defaults:

include PERMA explicit opener: true

perma extraction: true

perma mode: reflective non-scored

difficultyRamp: gentle

sequencing: archetype-dependent

scoringFramework: archetype-dependent

adaptiveFollowups: true (unless structured)

Example presets:

ENGINEERING_TECH

sequencing: PROGRESSIVE_DRILLDOWN

scoringFramework: NUMERIC_WEIGHTED (safer v1 than bar-raiser as default)

modelMix: { behavioral: 0.25, situational: 0.10, technical: 0.65 }

HEALTHCARE_COMPLIANCE

sequencing: COMPETENCY_SWEEP

scoringFramework: NUMERIC_WEIGHTED

modelMix: { behavioral: 0.60, situational: 0.35, technical: 0.05 }

SALES_REVENUE

sequencing: PAST_PRESENT_FUTURE

scoringFramework: BARS

modelMix: { behavioral: 0.70, situational: 0.20, technical: 0.10 }

LEADERSHIP_MANAGER

sequencing: PAST_PRESENT_FUTURE

scoringFramework: LEADERSHIP_MAP (optional) or BARS

modelMix: { behavioral: 0.70, situational: 0.25, technical: 0.05 }

…and so on.

T1 Guided Wizard mapping

Wizard selections:

Intent: screening / technical depth / storytelling / leadership / confidence-building

Structure preference: standardized vs adaptive

Count: 5/8/12

Map to config by applying overrides onto archetype baseline.

5.5 ConfigValidator

ConfigValidator.ts

Return shape:

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface SuggestedFix {
  label: string;
  applyPatch: Partial<InterviewConfig>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  fixes: SuggestedFix[];
}
Validator rules table (v1)

Hard rules (non-negotiable; enforce at save time):

Role-first

role.title must be non-empty

PERMA locked

perma.mode must equal REFLECTIVE_NON_SCORED

perma.includeExplicitWarmOpener must be true (v1)

perma.extractionEnabled must be true (v1)

Structured constraints

if isStructured=true → adaptiveFollowups=false

if isStructured=true → sequencing cannot be EVIDENCE_ESCALATION (since branching implies non-standardized follow-ups)

Evidence escalation implies adaptive

if sequencing=EVIDENCE_ESCALATION → adaptiveFollowups=true AND isStructured=false

Model mix sanity

all mix values ∈ [0,1]

sum within tolerance 1.0 ± 0.02

if scoringFramework=BAR_RAISER → technical >= 0.40

Candidate tier constraint

if persona=candidate → tier cannot be T2_ADVANCED

This directly encodes “silence over confident nonsense” style constraints and keeps interpretive logic from creeping into persistence. 

dashboard_constitution

6) Question planning & generation
6.1 QuestionPlanService

Input: { blueprint, config }
Output: list of plan items:

interface QuestionPlanItem {
  id: string;                // deterministic: Q1..Qn
  category: QuestionCategory; // PERMA/STAR/TECHNICAL_ROLE
  evaluationMode: EvaluationMode;
  competencyId?: string;
  type: "behavioral" | "situational" | "technical" | "reflective";
  difficulty: "low" | "medium" | "high";
  intent: string;
}

Rules:

Q1 is always PERMA (explicit warm opener)

evaluationMode = REFLECTIVE_NON_SCORED

Remaining Q2..Qn distributed to satisfy modelMix + archetype

Competency coverage: all top competencies hit at least once by STAR/TECHNICAL questions (as possible)

Sequencing applied:

COMPETENCY_SWEEP → rotate through competencies evenly

PROGRESSIVE_DRILLDOWN → 2–3 technical items that increase constraints/difficulty

PAST_PRESENT_FUTURE → cluster behavioral prompts accordingly

WARM_OPENER always satisfied by Q1 PERMA

6.2 QuestionTextService

Converts plan → final question strings using blueprint reading level rules 

competency_driven_interview_coa…

.

6.3 SessionAssembler

Writes:

session_configs (config_json)

questions rows with:

session_id

sequence_index

text

category

evaluation_mode

competency_id

difficulty

7) PERMA signal extraction across ALL answers

This is the part you called out, and it’s important: PERMA becomes a second lens, not a question type.

Create: PermaSignalService.ts

What it does

For every answer (regardless of question category), extract non-scored PERMA signals:

Output example:

export interface PermaSignals {
  positiveEmotion?: "low" | "medium" | "high";
  engagement?: "low" | "medium" | "high";
  relationships?: "low" | "medium" | "high";
  meaning?: "low" | "medium" | "high";
  accomplishment?: "low" | "medium" | "high";
  evidence: string[]; // short quotes/snippets
}
Where it runs

After each answer submission, in the server-side evaluation route/orchestrator.

Persist only:

extracted snippets + categorical flags as derived markers (optional)

or recompute at render time if you want strict adherence to “facts only.” 

dashboard_constitution

Recommended v1 compromise:

Store PERMA signals in a derived table or in a JSONB column marked as “recomputable derived output.”

Never store “meaningful person” or any conclusion—only the extracted indicators and snippets.

This preserves the layered architecture discipline. 

dashboard_constitution

8) API routes (implementation-ready)
8.1 POST /api/session/setup/role

Purpose: create/update session role input, generate blueprint, resolve archetype, return tier options.

Input:

{
  "sessionId": "optional",
  "roleTitle": "required",
  "jobDescription": "optional",
  "reqId": "optional"
}

Output:

{
  "sessionId": "...",
  "blueprintId": "...",
  "blueprintSummary": { "competencies": ["..."], "questionMix": {...} },
  "archetype": "ENGINEERING_TECH",
  "tierOptions": { "allowed": ["T0_AUTO","T1_GUIDED","T2_ADVANCED"], "default": "T0_AUTO" }
}
8.2 POST /api/session/setup/config

Purpose: produce and validate config.

Input (T0/T1):

{
  "sessionId": "...",
  "tier": "T1_GUIDED",
  "guided": { "intent":"technical_depth", "structure":"adaptive", "count": 8 }
}

Input (T2):

{
  "sessionId": "...",
  "tier": "T2_ADVANCED",
  "configEdits": { ...partial InterviewConfig... }
}

Output:

{
  "validation": { "valid": true, "errors": [], "fixes": [] },
  "config": { ...InterviewConfig... },
  "preview": { "mixLabel":"1 reflective, 3 behavioral, 4 technical", "scoringLabel":"Numeric weighted", "sequencingLabel":"Drill-down" }
}
8.3 POST /api/session/setup/questions

Purpose: finalize questions and persist.

Input:

{ "sessionId": "..." }

Output:

{ "questionCount": 8 }
9) UI flows & acceptance criteria
Screen A — Role Setup

Role title required

JD optional

Continue triggers /setup/role

Shows archetype + short competency preview (read-only)

AC:

Cannot proceed without roleTitle

Creates session if none exists

Returns allowed tiers based on persona (recruiter vs candidate)

Screen B — Tier Select

Cards:

Quick (T0)

Guided (T1)

Advanced (T2) — only visible for recruiter

AC:

Candidate never sees T2

Default selection highlights T0

Screen C0 — Quick Setup

Choose question count 5/8/12

Minimal toggles: “Standardized questions” (structured) ON/OFF

If ON → adaptiveFollowups forced OFF (show small note)

Clicking Continue calls /setup/config then shows Preview

AC:

Preview always shows “Includes 1 reflective opener”

PERMA is not described as scored

Screen C1 — Guided Wizard

Steps:

Intent

Structure preference

Count

AC:

Each step updates config + validation

If structure=standardized → adaptiveFollowups disabled automatically

Screen C2 — Advanced Config (Recruiter only)

Full controls + validator messaging + “Fix it” chips

AC:

Invalid configs cannot be saved

Suggested fixes apply patches and revalidate

Screen D — Preview

Shows:

Mix summary

Sequencing summary

Scoring summary

“PERMA signals will be detected across all responses (non-scored).”

Generate questions button

AC:

Generate writes questions with sequence_index

Q1 is PERMA reflective opener

10) Session run-time behavior (v1 hooks)

Even if you don’t finish the whole evaluation refactor immediately, enforce these two invariants:

Aggregation excludes non-scored

Any session score / competency score calculations must filter out REFLECTIVE_NON_SCORED answers. 

dashboard_constitution

PERMA signal extraction runs for every answer

Store as derived output or compute at render time

Never used as hire/no-hire or to alter numeric score in v1

11) Structured flow stub (separate feature flag)

Create placeholders now so the architecture doesn’t paint you into a corner.

Add to Tier Select screen (recruiter only):

“Client Structured Process (Coming Soon)”

On click:

routes to stub screen with copy:

“This mode supports client-specific question libraries and standardized evaluation.”

“For now, use Advanced or Guided.”

In code:

define structuredFlowEnabled=false feature flag

later you’ll connect:

structured templates

client libraries

req pipeline without reqId

12) Delivery checklist for the engineer

Must ship for v1:

session_configs + blueprints tables

questions columns

role → tier → config → questions endpoints

TierRouter persona enforcement

ConfigValidator enforcement

PresetRegistry (T0 + guided mapping)

Q1 PERMA reflective insertion

Preview UI

Candidate allowed tiers only T0/T1

Can defer (but keep stubs):

full evaluation orchestration refactor

structured flow library

per-answer PERMA signal persistence (can compute on read initially)