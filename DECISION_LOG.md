# Decision Log

## ADR-001: Persistence Strategy for Public Candidates

### Context
Candidates access the application via a public link (Anonymous users).
However, they need to update `sessions`, `answers`, and `eval_results`.
Supabase RLS on `public` table `sessions` usually requires an authenticated user (`auth.uid()`) to match a `recruiter_id` or similar owner.
We attempted to solve this with standard RLS but ran into "New Row Violates Policy" issues because the Candidate is not the Owner.

### Decision
We use a **Repository Pattern** backed by a **Service Role Client (Admin)** for all candidate-driven write operations.
- File: `src/lib/server/infrastructure/supabase-session-repository.ts`
- Client: `createAdminClient()` (uses `SUPABASE_SERVICE_ROLE_KEY`)

### Consequences
- **Security Check**: The Repository MUST validate the Candidate Token (via `InviteRepository` logic or implicit Session ID knowledge) before performing updates. We currently rely on the fact that the Candidate possesses the valid `session_id` (UUIDv7) and `token`, but stricter checks should be implemented in `route.ts`.
- **Environment**: `SUPABASE_SERVICE_ROLE_KEY` is required in `.env.local`.

## ADR-002: Draft Persistence (Auto-Save)

### Context
Users may lose text input if they refresh or navigate away.

### Decision
We implement an **Optimistic UI + Debounced API** pattern for all long-form text inputs.
- **Frontend**: Local state updates immediately. A `useEffect` debounces changes (e.g. 1000ms) and calls `onSaveDraft`.
- **API**: A dedicated (or shared) endpoint updates the specific field (e.g. `transcript`) without requiring a full session submission.
- **Feedback**: UI displays "Saving..." -> "Saved" to build trust.

### [ADR-003: Engagement Tracking Logic Harmonization]
**Context**:
Engagement tracking defines user tiers (1-3) to manage the engagement "window". Previously, Tier 2 was extension-only and Tier 3 was 30s, causing data loss when users were active but the window was closed, and resets when navigating questions.

**Decision**:
Harmonize logic to prioritize user activity:
- **Tier 2 (Interactions)**: Both **Opens and Extends** the window (30s).
- **Tier 3 (Task Events)**: Defaults to **60s** duration.
- **Time Persistence**: `useEngagementTracker` now handles state synchronization and mandatory flushes:
  - **Sync to Prop**: Local `totalEngagedSeconds` synced with `initialSeconds` prop when it increases (re-syncing after server updates/refreshes).
  - **Flush on Transition**: `flushEngagement()` is called before `next()`, `retry()`, and `submit()` to ensure all sub-10s accumulations are persisted before navigating.

**Consequences**:
- More consistent tracking for non-voice (Text) modes.
- Robust time preservation across question transitions and page refreshes.
- Cumulative session time is accurately reflected in the UI and persisted.

### [ADR-004: Aggregate Analytics Logic]
**Context**:
Recruiters need "at-a-glance" insights across many candidates without loading every session's details.

**Decision**:
Implemented a `getDashboardMetrics` method in the repository that computes aggregate analytics (readiness distribution, common struggles, coaching needs) directly from factual evaluation records.

**Consequences**:
- Faster dashboard performance.
- Enables new high-level recruiter widgets (`CoachingFocusCard`, `TopOpportunitiesCard`).
- Decouples display logic from raw persistence schema.

### [ADR-005: Feedback UI Overhaul]
**Context**:
The previous feedback UI was text-heavy and linear, lacking a sense of "reward" or progress for the candidate.

**Decision**:
Transformed the feedback drawer into a landscape-oriented dashboard using visual "Win Cards" that categorize feedback into Delivery (Presence, Confidence) and Content (Logic, Material).

**Consequences**:
- Reduced cognitive load via glanceable status cards.
- Higher visual motivation for candidates.
- Contextual adaptation for text vs. voice input.

## ADR-007: Demo Mode & Feature Flag Architecture

### Context
Developers need to demonstrate "Development-Only" features (AI question generation, randomizers, analytics export) in production/staging environments for stakeholder review. Previously, these were hardcoded to `process.env.NODE_ENV === 'development'`.

### Decision
Implement a centralized `showDemoTools()` utility in `src/lib/feature-flags.ts`.
- **Logic**: Enables features if `process.env.NEXT_PUBLIC_SHOW_DEMO_TOOLS === 'true'` OR `NODE_ENV === 'development'`.
- **UI Tagging**: All demo-only tools in the UI are now marked with a `// DEMO_TOOL` comment for easy identification and future removal.
- **API Protection**: API routes now use the same utility to guard endpoints in production unless the demo flag is explicitly set.

### Consequences
- Stakeholders can test full AI-driven flows in production.
- Easy "Launch Cleanup": Just delete the `/api/dev` folder and remove the `// DEMO_TOOL` marked blocks.
- Safer than removing the environment gate entirely, as it requires an explicit environment variable.

## ADR-008: Behavioral Question Structure (Consolidated Prompts)

### Context
The AI generation logic previously segmented single behavioral questions into 4 STAR components (Situation, Task, Action, Result), which the UI rendered as 4 separate fields. This led to fragmented interview sessions where candidates were prompted for incomplete dialogue segments rather than cohesive scenarios.

### Decision
Merge fragmented components into single, high-fidelity behavioral prompts.
- **AI Prompt**: Updated to generate 4 distinct, cohesive scenarios (e.g., "Tell me about a time...") rather than fragments.
- **Template Labels**: Updated `STAR_TEMPLATE` to represent 4 behavioral pillars (Conflict, Adaptability, Initiative, Role-Specific) instead of structural markers.
- **Handler Logic**: Added defensive slicing in the UI handler to ensure only 4 questions are accepted, preventing fragmentation overflow.

### Consequences
- Recruitment sessions are more realistic and professional.
- Candidates receive holistic prompts that allow for natural storytelling.
- Recruiter settings UI is cleaner and less repetitive.

## ADR-006: Recruiter Profile Professional Title

### Context
Recruiters need to be represented professionally on invitations and profiles. Previously, only names and phone numbers were captured, lacking a "Professional Title" context (e.g., "Senior Recruiter").

### Decision
Add a `title` column to the `recruiter_profiles` table and expose it as a primary input in the account settings.
- **Database**: `alter table recruiter_profiles add column title text;`
- **UI**: Added "Your Job Title" to `/recruiter/settings` at the top of the form.
- **Navigation**: Remapped the home page "Continue as Recruiter" button to `/recruiter/create` to optimize the "intent-to-hire" flow.

### Consequences
- More professional candidate invitations (the title can now be injected into email templates).
- Faster time-to-value for recruiters via direct navigation to the creation wizard.
- Consistent profile data across the application.
