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

## ADR-015: Semantic Color Token Migration

### Context
The codebase contained numerous hard-coded hex values, standard Tailwind color aliases (e.g., `blue-600`), and arbitrary utility values. This led to "magic colors" that were difficult to audit for accessibility and theme consistency.

### Decision
- **Variable Centralization**: Migrated all brand-specific colors (`brand-deep`, `brand-orange`, `brand-glass`) to HSL variables in `src/index.css`.
- **Config Standardization**: Updated `tailwind.config.ts` to map theme extensions directly to CSS variables using `hsl(var(--variable))`.
- **Literal Elimination**: Removed hard-coded `blue` and `green` overrides from the Tailwind config to prevent collision with standard Tailwind palettes and encourage semantic token usage.
- **Component Refactoring**: Systematically replaced color literals in key features (`LandingScreen`, `FeedbackCard`, `AudioVisualizer`) with semantic equivalents like `state-success`, `state-info`, and `brand-deep`.
- **Dynamic Contexts**: Refactored the `AudioVisualizer` Canvas implementation to dynamically retrieve semantic colors via `getComputedStyle`.

### Consequences
- **Themeability**: The core brand identity is now entirely manageable via CSS variables without touching the configuration or component logic.
- **Consistency**: Visual elements like success badges and information cards now share uniform semantic tokens.
- **Maintainability**: Reduced the risk of "token drift" where different components use slightly different shades of the same brand color.

## ADR-016: Recharts Adoption for Admin Dashboard

### Context
The admin feedback portal required dataviews (trendlines, distribution charts) to visualize candidate efficacy, platform trust, and recruiter ROI over time. A charting library was needed to handle responsive SVGs, tooltips, and axes without building complex D3 primitives from scratch.

### Decision
- **Library Selection**: Adopted \echarts\ as the primary charting library for the admin dashboard.
- **Implementation**: Created visualization components (e.g., \CandidateEfficacyChart\) that inherit global CSS variables via standard Tailwind classes where possible, or via direct CSS variable lookups for chart strokes/fills to ensure theme consistency.

### Consequences / Tradeoffs
- Rapid development of complex data visualizations.
- Increases the admin bundle size slightly, but acceptable since these routes are protected and not part of the critical path for candidates or external public flows.

## ADR-017: Deprecation of Recruiter Preparation Lift Prompt

### Context
During the implementation of "Metric 4: Recruiter ROI & Friction" for the Admin Feedback Dashboard, we needed a data source for `recruiter_preparation_lift` ("Do candidates seem more prepared after using this tool?"). However, recruiters do not currently possess sufficient context at the time of session completion to accurately answer this. They only see completion status, engagement time, and transcripts, not subsequent interview outcomes.

### Decision
- **Logic Extraction**: We extracted the Recharts visualization logic for "Candidate Preparation Lift" (`RecruiterPreparationLiftChart.tsx`) and moved it to a `/.deprecated/src/app/(recruiter)/admin/feedback/components` shadow folder.
- **Dictionary Removal**: Removed the `recruiter_preparation_lift` constants from the active `page.tsx` dictionary mappings.
- **Active Metric Adjustment**: Maintained the `recruiter_friction_invite` metric as the sole component of the "Recruiter Metrics" row, scaling its visual presentation to a single column.

### Consequences
- **Data Integrity**: Avoids collecting low-confidence "vibe check" data that misrepresents actual ROI.
- **Future Readiness**: The visualization code is preserved in `/.deprecated/` and can be easily reinstated when an ATS integration (e.g. tracking stage progression from Intake to Shortlist) provides a reliable, high-signal trigger for the prompt.

## ADR-018: Productionization of AI Question Generator

### Context
The AI Question Generator was previously a development-only tool gated by `showDemoTools()`. To scale the platform's value for recruiters, this needs to be a first-class production feature with a refined UI.

### Decision
- **API Promotion**: Moved the endpoint from `/api/dev/generate-questions` to `/api/questions/generate` to reflect its production status.
- **Access Control**: Removed the `showDemoTools()` gate to allow all authenticated recruiters access.
- **UI Refinement**: Upgraded the "AI Generate" button from a "debug-style" success badge look to a premium `brand-deep` primary action button with standard shadow and interaction states.
- **Observability**: Added semantic production logging (`[AI]`) for better tracking of generation success and failure rates.

### Consequences
- Recruiters can now leverage AI to bootstrap their interview process directly from the creation wizard.
- Improves the "vertical rhythm" and professionalism of the recruiter creation flow.
- Required updating API call sites in `CreateInviteWizard`.

## ADR-019: Automated Candidate Email Debriefs

### Context
Candidates often finish practice sessions and don't immediately review their debriefs or forget to bookmark the link. To increase engagement and ensure coaching value is delivered, we need a reliable way to push the debrief summary to the candidate's inbox.

### Decision
- **Email Provider**: Adopted **Resend** as the system-wide email delivery service.
- **Trigger Mechanic**: Triggered the debrief email asynchronously within the session `PATCH` route immediately after successful AI summarization.
- **React-First Templates**: Built the email templates using React components to maintain design consistency with the platform's UI.
- **Access Flow**: Included a secure direct access link containing the invite token to ensure a zero-friction path from email to dashboard.

### Consequences
- Candidates receive immediate positive reinforcement and a record of their practice session.
- Increased return rates to the platform.
- Introduces `RESEND_API_KEY` as a new required production secret.
