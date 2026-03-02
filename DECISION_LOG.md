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

## ADR-009: Dashboard Data Flow — Single Session Fetch + Derived Stats

### Context
The recruiter dashboard `page.tsx` fired two parallel Supabase queries both hitting `sessions`: `listByRecruiter()` for the table and `getDashboardMetrics()` for stat cards. With the upcoming progress widget as a third consumer of the same data, this would become a triple-fetch for the same session list.

### Decision
- **Basic stats** (totalInvites, activeSessions, completedSessions, avgEngagement, readinessDistribution) are now computed client-side via `computeDashboardStats(sessions)` from the already-fetched `SessionSummary[]`.
- **Eval-derived coaching insights** (coachingFocusDistribution, commonObservations) are fetched via a new `getEvalInsights()` repository method that only queries `eval_results`.
- The old `getDashboardMetrics()` is preserved but marked `@deprecated`.

### Alternatives Considered
1. **Server-side SSR cache** (Request Deduplication): Would rely on undocumented Next.js caching behavior and wouldn't reduce actual Supabase calls.
2. **Merge into single mega-query with JOINs**: Would couple the table's full-field needs with the stats' lightweight aggregation.

### Consequences
- **Performance**: 1 Supabase session query instead of 2 (soon 3). Eval insights is a targeted query of only `eval_results`.
- **Consistency**: All consumers (DashboardStats, CurrentBaselineBlock, widget) see the same session snapshot.
- **New files**: `src/lib/services/compute-dashboard-stats.ts` (pure function, easily testable).
- **Revisit when**: Dashboard data needs real-time updates without full page reload (would require SWR or server-sent events).

 # #   A I   I n t r o s p e c t i o n   A r c h i t e c t u r e 
 -   * * C o n t e x t * * :   T h e   u s e r   l a c k s   v i s i b i l i t y   i n t o   w h y   t h e   L L M   m a k e s   s p e c i f i c   c h o i c e s   b e c a u s e   t h e   a s s e m b l e d   p r o m p t   i s   h i d d e n   i n   i s o l a t e d   s e r v e r   c l a s s e s . 
 -   * * D e c i s i o n * * :   E l e v a t e   t h e   f u l l   c o m p o s i t e   L L M   p r o m p t   s t r i n g s   f r o m   ` T i p s S e r v i c e ` ,   ` S t r o n g R e s p o n s e S e r v i c e ` ,   a n d   ` A I S e r v i c e `   d i r e c t l y   t h r o u g h   t h e   A P I   b o u n d a r y   v i a   a n   i n j e c t e d   ` _ _ d e b u g `   p r o p e r t y   o n   t h e   r e s p o n s e   p a y l o a d . 
 -   * * A l t e r n a t i v e s   c o n s i d e r e d * * :   W r i t i n g   p r o m p t s   t o   a   s e r v e r - s i d e   l o g   f i l e   o r   d a t a b a s e .   R e j e c t e d   b e c a u s e   i t   b r e a k s   r e a l - t i m e   U I   c o r r e l a t i o n   f o r   t h e   u s e r   n a v i g a t i n g   t h e   s e s s i o n . 
 -   * * W h y   c h o s e n * * :   I n j e c t i n g   ` _ _ d e b u g `   i n t o   t h e   A P I   r e s p o n s e   a l l o w s   t h e   R e a c t   c l i e n t   t o   i n s t a n t l y   b i n d   t h e   e x a c t   g e n e r a t i o n   s e e d   t o   t h e   U I   s t a t e   r e s p o n s i b l e   f o r   r e n d e r i n g   t h a t   A I   b l o c k ,   e n a b l i n g   r e a l - t i m e   i n s p e c t i o n . 
 -   * * C o n s e q u e n c e s   /   t r a d e o f f s * * :   S l i g h t l y   l a r g e r   n e t w o r k   p a y l o a d .   W i l l   n e e d   t o   b e   o m i t t e d   i n   a   s t r i c t   p u b l i c - f a c i n g   p r o d u c t i o n   r e l e a s e ,   b u t   a c c e p t a b l e   f o r   c u r r e n t   b e t a / c o a c h / r e c r u i t e r   u t i l i t y . 
  
 