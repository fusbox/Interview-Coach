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
The feedback UX needed a paradigm shift from a simplistic modal stack to a polished, context-aware "coaching space." The old implementation disconnected the raw transcript context from the AI coach's analysis.

**Decision**:
- Migrated feedback presentation to a slide-in `Sheet` (drawer) pattern originating from exactly where the candidate is working (the Answer workspace).
- Implemented a unified split-view architecture: the user's transcript remains visible (for semantic grounding) alongside the contextual AI observations and suggested answers.
- Deprecated generic "strengths/weaknesses" terminology in favor of growth-oriented, actionable coaching terminology: "Coach's Observations" and "Refined Examples."
- Extracted and centralized UI feedback patterns into `FeedbackDrawer.tsx` within the component layer to ensure DRY consumption across the application scale.

**Consequences**:
- Substantial UX improvement via spatial context continuity.
- Candidates can mentally map the AI's suggestions directly back to their original response without losing visual context.
- Required refactoring the active session layout logic to accommodate the sibling drawer component.

### [ADR-006: Component File Extension Convention]
**Context**:
Some components in the codebase use the `.ts` extension (e.g., `EvaluationMatrix.ts`) despite containing JSX, leading to IDE tooling inconsistencies and linting errors.

**Decision**:
- Enforce the `.tsx` extension for *all* files containing React components or JSX syntax, regardless of their complexity or folder location.
- The `.ts` extension is strictly reserved for type definitions, utilities, and non-rendering hooks.

**Consequences**:
- Resolves implicit React `any` type issues and enables proper syntax highlighting.
- Requires a pass to rename mis-typed files (e.g., `EvaluationMatrix.ts` -> `EvaluationMatrix.tsx`) and update corresponding imports.

### [ADR-007: Unification of Mock and Production AI Services]
**Context**:
The system historically relied on separate service implementations (`AIService` and `MockAIService`) injected at runtime. This bifurcation caused configuration drift, duplicated test setup logic, and made it difficult for local developers to test "production-like" flows without incurring expensive LLM calls.

**Decision**:
- Implemented a unified `AIClientFacade` that wraps a core `AIProvider` interface.
- Deployed a robust `MockAIProvider` that adheres strictly to the `AIProvider` contract and includes deterministic, schema-compliant responses for all core features (evaluation, hinting, debriefs).
- The facade intelligently switches underlying providers based on the `USE_MOCK_AI` environment variable, while presenting a single, constant API surface area to the application (the `ai` export).

**Consequences**:
- Eliminated all occurrences of divergent logic. Handlers and controllers now only ever interact with the unified facade.
- Vastly improved local development stability and speed.
- Required updating all imports from deep paths (e.g., `../services/mock-ai-service`) to the centralized facade (`@/lib/server/services/ai-service`).

### [ADR-008: Audio Transcription State Management]
**Context**:
The deepgram live transcription service was firing events rapidly, causing excessive re-rendering and missed state updates in the `AudioWorkspace`. The generic `useAudioTranscription` hook failed to manage the "final" transcript cleanly during the component unmount phase or when processing the final silence block.

**Decision**:
- Refactored the transcription state management to utilize a strict `React.useReducer` pattern for atomic state updates, decoupling the complex state transitions (recording -> processing -> final) from the fast-paced generic React lifecycle.
- Introduced a `flushDebouncedTranscript` method that guarantees the `interim` and `final` buffers are perfectly synced to the `value` prop exactly when the `onStop` event is triggered, preventing race conditions.

**Consequences**:
- Eliminated dropped transcripts during rapid session submissions.
- Significantly increased the robustness of the AudioWorkspace, but at the cost of slightly higher code complexity inside the hook. This tradeoff is acceptable given the mission-critical nature of retaining candidate audio.

### [ADR-009: Separation of Domain Specific Components (Session vs Main)]
**Context**:
Components like `SurveyBlock` and `DebriefCard` were initially dumped into `src/components/ui/`, resulting in high coupling between "dumb" design system primitives and highly specific "smart" domain concepts related to post-session workflows.

**Decision**:
- Enforce a strict boundary between generic primitives and domain-specific feature components.
- Generic design system elements (buttons, inputs, cards) belong in `src/components/ui`.
- Domain concepts tied to a specific workflow (like the end-of-session survey) are moved into `src/features/[feature-name]/components/`. (e.g., `src/features/session/components/SessionSurvey.tsx`).

**Consequences**:
- Cleaner dependency graph.
- Prevents UI primitives from accidentally importing heavy feature logic.
- Makes it significantly easier to refactor or remove entire workflows without leaving orphaned components in the generic UI folder.

### [ADR-010: Introduction of Pattern Components]
### Context
Feature UI components contain widespread visual inconsistency and arbitrary Tailwind spacing utilities (UI Audit 2026-03 flagged over 110 arbitrary [Xpx] utilities and 15 raw hex colors). Primitives exist in src/components/ui/ but do not encode enough domain-specific repetition (e.g. Badge vs StatusBadge representing candidate readiness).

### Decision
Establish a src/components/patterns/ layer. Patterns are canonical blocks composed from primitives that represent recurring application domain concepts.
- **Primitives (ui/)**: Purely visual, dumb, state-agnostic (e.g. Card).
- **Patterns (patterns/)**: Semantically aware of application states (e.g. StatusBadge knows about readinessHigh vs success), but NOT bound to API data.
- **Features (features/*/components/)**: Wire patterns to data and business logic.

### Alternatives considered
- Adding variants directly to Shadcn primitives (e.g. Badge variant=readinessHigh). Rejected as it clutters primitive APIs with domain concepts.

### Consequences
- The patterns/ folder becomes the default toolset for building new features.


## ADR-011: Removal of Coach Feedback UI for Internal Users

### Context
To mitigate compliance and risk exposure, internal users (recruiters and admins) should only see session progress and engagement metrics, but not qualitative or AI-generated coach feedback (e.g., readiness bands, AI feedback summaries, qualitative observations)

### Decision
- **UI Architecture**: Stripped all feedback-related widgets and table columns (`ReadinessBadge`, `TopOpportunitiesCard`, `CurrentBaselineBlock`) from `/recruiter` and its sub-components.
- **Data Fetching Layer**: Removed references to `readinessBand` and `summaryNarrative` from recruiter metrics API.
- **Data Persistence**: Did *not* remove raw feedback/AI columns from the database or domain types, because feedback data is still required in the candidate-facing post-session `SummaryScreen.tsx`.
- **Session Details**: Restructured `/recruiter/sessions/[id]/page.tsx` to display only candidate metadata and factual answer transcripts.

### Consequences / Tradeoffs
- Drastic reduction in internal privacy and compliance exposure.
- Safe decoupling of what candidates see (full debrief) vs. what recruiters see (engagement, transcripts merely for record-keeping).
- AI summaries/feedback remain generated at session conclusion but are walled-off from internal UI.

## ADR-012: Session Summary Generation and Polling Fix

### Context
The post-session summary screen was hanging because `summaryNarrative` was not being triggered on session completion. Additionally, the client-side `SummaryScreen.tsx` lacked a mechanism to poll for the asynchronous AI generation result.

### Decision
1. **API Trigger**: Modified `src/app/api/session/[session_id]/route.ts` to detect `status === 'COMPLETED'` during a `PATCH` request and synchronously trigger `AIService.summarizeSession`. The result is then persisted to the database.
2. **Repository Update**: Updated `SupabaseSessionRepository.updatePartial` to explicitly support the `summary_narrative` field.
3. **Client Polling**: Introduced a `useEffect` polling loop in `SummaryScreen.tsx` that calls a newly exposed `refresh` function from `SessionContext` every 3 seconds until a valid `summaryNarrative` is received.

### Consequences
- **User Experience**: Candidates no longer face a permanent loader; the debrief appears once the AI finishes processing (usually 5-10 seconds).
- **Latency**: The initial `PATCH` call that completes the session will be slower (as it waits for the AI summary), but the client polling ensures that even if the connection drops or the browser refreshes, the summary will eventually load.
- **Data Integrity**: Ensures that every completed session has a corresponding summary narrative in the database.

## ADR-013: Structural Skeleton Loader for Session Summary

### Context
The `SummaryScreen.tsx` previously used a generic `<Loader2 />` spinner while waiting for the AI debrief. This was functional but lacked a "premium" feel and caused a jarring visual jump when the 4-card debrief narrative was injected.

### Decision
- **New Primitive**: Created `src/components/ui/skeleton.tsx` using Tailwind's `animate-pulse`. This avoids reliance on legacy global CSS loaders.
- **Structural Layout**: Implemented a purposeful skeleton layout in `SummaryScreen.tsx` that mirrors the exact 4-card structure (Executive Summary, Core Strengths, Primary Growth Area, Readiness) expected from the AI narrative.
- **Accessibility**: Added `aria-busy="true"` and `aria-live="polite"` to the loading container.

### Consequences
- **User Experience**: Drastic reduction in Layout Shift (CLS). The page "vertical rhythm" is established immediately upon landing.
- **Consistency**: The loading state now matches the design language of the rest of the application.
- **Modularization**: The logic for skeletons is now encapsulated in a reusable primitive.

## ADR-014: Summary Screen Modularization

### Context
The `SummaryScreen.tsx` component had become a "mega-component" (~390 lines), handling UI rendering, markdown parsing, polling lifecycle logic, and complex survey state submissions (with optimistic updates and error handling). This violated the single-responsibility principle and created a high risk of regression when modifying any single piece of the post-session flow.

### Decision
Executed a phased modularization of the Summary Screen:
1. **Data Fetching Layer**: Extracted network interval logic into `useSummaryPolling.ts`, utilizing strict unmount safeguards (`AbortController` pattern concepts conceptually mapped to React `refs`) to prevent memory leaks and zombie API requests after component unmounts.
2. **Domain UI Extraction**: Extracted the localized state (`survey`, `isSubmitting`, `submitError`) and the feedback action invocation into a dedicated `<SessionSurvey />` component. This prevents survey interaction renders from causing the entire narrative screen to re-render.
3. **Utility Layer**: Migrated pure functions (`parseDebrief`, `getIconForTitle`) into a decoupled `SummaryUtilities.ts` file.

### Consequences
- **Maintainability**: `SummaryScreen.tsx` is reduced to roughly half its original size and now focuses purely on composing high-level layout elements.
- **Error Boundaries**: The survey component now manages its own explicit error states and prevents "fire-and-forget" failures.
- **Testability**: Pure utility functions can now be unit tested independently of the React DOM environment.