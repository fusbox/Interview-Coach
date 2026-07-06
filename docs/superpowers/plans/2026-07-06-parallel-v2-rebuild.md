# Parallel V2 Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a parallel V2 candidate experience that proves the clean shared session runtime, answer lifecycle, evidence-first evaluation seam, and design-system-based dashboard without destabilizing existing recruiter-invited production behavior.

**Architecture:** V2 lands on twin routes while old routes remain available. Candidate V2 reuses clean server primitives such as Postgres repositories, candidate ownership, question planning, idempotency, and AI quality capture, but rebuilds candidate-facing UI and session composition from the design-system and refactor contracts. Evidence-first evaluation is introduced behind a flag and adapted only where a temporary bridge is necessary.

**Tech Stack:** Next.js 15 App Router, React 18, TypeScript, Tailwind CSS, Postgres repositories, Vitest, Testing Library, Playwright candidate smoke tests, Framer Motion, Recharts, lucide-react.

---

## File Structure

- Create: `src/features/candidate-v2/`
  - Owns the V2 candidate shell, route adapters, setup/session/dashboard composition, and design-system wrappers.
- Create: `src/features/session-v2/`
  - Owns the shared V2 session runtime, completion behavior, answer submission hook, and feedback shell.
- Create: `src/lib/domain/interview-evaluation/`
  - Owns canonical question categories, universal criteria, evidence schemas, criteria bands, and pattern-gap detection.
- Create: `src/lib/server/services/answer-evaluation/`
  - Owns evaluation orchestration, model extraction, feedback composition, and temporary legacy adapter.
- Modify: `src/app/api/session/[session_id]/route.ts`
  - Moves session GET/PATCH to token-or-candidate-owned authorization so the shared session runtime can be candidate-owned.
- Modify: `src/lib/server/candidate-route-auth.ts`
  - Remains the shared authorization source for token and authenticated candidate ownership checks.
- Create: `src/app/practice2/page.tsx`
  - Candidate V2 setup route.
- Create: `src/app/session2/[sessionId]/page.tsx`
  - Candidate V2 live session route.
- Create: `src/app/dashboard2/page.tsx`
  - Candidate V2 dashboard route.
- Modify: `docs/candidate-app/SPEC.md`
  - Product boundary for V2 candidate behavior and claims.
- Modify: `docs/candidate-app/DATA_CONTRACT.md`
  - Durable V2 state, evidence, and read-model vocabulary.
- Modify: `docs/candidate-app/HANDOFF.md`
  - Current execution state and next slice.

---

### Task 1: Promote V2 Decision And Design Inputs

**Files:**
- Modify: `docs/candidate-app/SPEC.md`
- Modify: `docs/candidate-app/DATA_CONTRACT.md`
- Modify: `docs/candidate-app/HANDOFF.md`
- Modify: `docs/candidate-app/08-decisions/README.md`
- Read: `.untracked/design-system/readme.md`
- Read: `.untracked/design-system/handoff.md`
- Read: `.untracked/interview-coach-refactor-agent-reference-pack/README.md`

- [ ] **Step 1: Confirm the V2 decision docs are discoverable**

Run: `rg -n "Parallel V2|dashboard2|session2|practice2|ADR-0009" docs/candidate-app`

Expected: matches in `SPEC.md`, `HANDOFF.md`, `08-decisions/README.md`, and `08-decisions/ADR-0009-parallel-v2-rebuild.md`.

- [ ] **Step 2: Capture the active design-system dependency**

Add this exact rule to the active V2 handoff section if it is missing:

```markdown
- Candidate V2 may use `.untracked/design-system` as a reference pack during early implementation, but any production dependency on tokens, assets, or component behavior must be promoted into tracked source before V2 routes are release candidates.
```

- [ ] **Step 3: Validate docs-only formatting**

Run: `git diff --check -- docs/candidate-app docs/superpowers/plans`

Expected: no whitespace errors.

- [ ] **Step 4: Commit**

Run:

```bash
git add docs/candidate-app docs/superpowers/plans
git commit -m "docs: accept parallel candidate v2 rebuild"
```

Expected: commit succeeds with only documentation files staged.

---

### Task 2: Establish V2 Route Shells Without Business Logic

**Files:**
- Create: `src/app/practice2/page.tsx`
- Create: `src/app/session2/[sessionId]/page.tsx`
- Create: `src/app/dashboard2/page.tsx`
- Create: `src/features/candidate-v2/V2Placeholder.tsx`
- Create: `src/app/practice2/page.test.tsx`
- Create: `src/app/session2/[sessionId]/page.test.tsx`
- Create: `src/app/dashboard2/page.test.tsx`

- [ ] **Step 1: Write the shared placeholder component**

Create `src/features/candidate-v2/V2Placeholder.tsx`:

```tsx
type V2PlaceholderProps = {
    title: string;
    description: string;
};

export function V2Placeholder({ title, description }: V2PlaceholderProps) {
    return (
        <main className="candidate-design-system min-h-screen bg-[rgb(var(--candidate-background))] px-6 py-10 text-[rgb(var(--candidate-foreground))]">
            <section className="mx-auto max-w-3xl rounded-[2rem] border border-[rgb(var(--candidate-border)/0.75)] bg-white p-8 shadow-[0_18px_45px_rgba(15,33,57,0.08)]">
                <p className="eyebrow mb-3">Candidate V2</p>
                <h1 className="font-display text-3xl font-bold">{title}</h1>
                <p className="mt-4 text-sm leading-6 text-[rgb(var(--candidate-muted))]">{description}</p>
            </section>
        </main>
    );
}
```

- [ ] **Step 2: Create route pages**

Create `src/app/practice2/page.tsx`:

```tsx
import { V2Placeholder } from "@/features/candidate-v2/V2Placeholder";

export default function Practice2Page() {
    return (
        <V2Placeholder
            title="Practice setup V2"
            description="This route will host the rebuilt candidate-owned practice setup flow."
        />
    );
}
```

Create `src/app/session2/[sessionId]/page.tsx`:

```tsx
import { V2Placeholder } from "@/features/candidate-v2/V2Placeholder";

export default async function Session2Page({ params }: { params: Promise<{ sessionId: string }> }) {
    const { sessionId } = await params;

    return (
        <V2Placeholder
            title="Practice session V2"
            description={`This route will host the rebuilt shared session runtime for session ${sessionId}.`}
        />
    );
}
```

Create `src/app/dashboard2/page.tsx`:

```tsx
import { V2Placeholder } from "@/features/candidate-v2/V2Placeholder";

export default function Dashboard2Page() {
    return (
        <V2Placeholder
            title="Dashboard V2"
            description="This route will host the rebuilt Coach Plan dashboard."
        />
    );
}
```

- [ ] **Step 3: Write route tests**

Create `src/app/practice2/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import Practice2Page from "./page";

it("renders the candidate V2 practice setup shell", () => {
    render(<Practice2Page />);

    expect(screen.getByRole("heading", { name: "Practice setup V2" })).toBeInTheDocument();
    expect(screen.getByText(/rebuilt candidate-owned practice setup flow/i)).toBeInTheDocument();
});
```

Create `src/app/session2/[sessionId]/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import Session2Page from "./page";

it("renders the candidate V2 session shell for the requested session", async () => {
    const ui = await Session2Page({ params: Promise.resolve({ sessionId: "session-v2-1" }) });

    render(ui);

    expect(screen.getByRole("heading", { name: "Practice session V2" })).toBeInTheDocument();
    expect(screen.getByText(/session-v2-1/i)).toBeInTheDocument();
});
```

Create `src/app/dashboard2/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import Dashboard2Page from "./page";

it("renders the candidate V2 dashboard shell", () => {
    render(<Dashboard2Page />);

    expect(screen.getByRole("heading", { name: "Dashboard V2" })).toBeInTheDocument();
    expect(screen.getByText(/rebuilt Coach Plan dashboard/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
cmd /c npx vitest run src/app/practice2/page.test.tsx src/app/session2/[sessionId]/page.test.tsx src/app/dashboard2/page.test.tsx
```

Expected: all three tests pass.

- [ ] **Step 5: Run typecheck**

Run: `cmd /c npm run typecheck`

Expected: TypeScript succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/practice2 src/app/session2 src/app/dashboard2 src/features/candidate-v2
git commit -m "feat: add candidate v2 route shells"
```

Expected: commit succeeds with V2 shells and tests.

---

### Task 3: Make Session GET/PATCH Candidate-Owned Capable

**Files:**
- Modify: `src/app/api/session/[session_id]/route.ts`
- Modify: `src/app/api/session/[session_id]/route.test.ts`
- Read: `src/lib/server/candidate-route-auth.ts`
- Read: `src/lib/server/api-handler-utils.ts`

- [ ] **Step 1: Write candidate-owned auth tests**

Add tests to `src/app/api/session/[session_id]/route.test.ts` proving that GET and PATCH allow authenticated candidate-owned access without a candidate token by mocking `authorizeCandidateSessionRequest` to return `null`.

Use this expected behavior:

```ts
expect(response.status).toBe(200);
expect(requireCandidateToken).not.toHaveBeenCalled();
expect(authorizeCandidateSessionRequest).toHaveBeenCalledWith(
    expect.any(Request),
    "session-1",
    expect.any(String),
);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cmd /c npx vitest run src/app/api/session/[session_id]/route.test.ts
```

Expected: failures show `authorizeCandidateSessionRequest` is not used by GET/PATCH.

- [ ] **Step 3: Replace direct token auth with shared auth**

Modify `src/app/api/session/[session_id]/route.ts`:

```ts
import { authorizeCandidateSessionRequest } from "@/lib/server/candidate-route-auth";
```

Replace each direct `requireCandidateToken` auth block with:

```ts
const authResponse = await authorizeCandidateSessionRequest(request, session_id, correlationId);
if (authResponse) {
    return authResponse;
}
```

Remove the now-unused direct `requireCandidateToken`, `forbiddenResponse`, and `unauthorizedResponse` imports from this route.

- [ ] **Step 4: Run targeted route tests**

Run:

```bash
cmd /c npx vitest run src/app/api/session/[session_id]/route.test.ts
```

Expected: route tests pass for token access, candidate-owned access, validation, not-found, and denied access.

- [ ] **Step 5: Run candidate tests**

Run: `cmd /c npm run test:candidate`

Expected: candidate test suite passes.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/api/session/[session_id]/route.ts src/app/api/session/[session_id]/route.test.ts
git commit -m "fix: allow candidate-owned session api access"
```

Expected: commit succeeds with route and test changes.

---

### Task 4: Add Shared Session V2 Completion Contract

**Files:**
- Create: `src/features/session-v2/session-completion.ts`
- Create: `src/features/session-v2/SharedSessionExperience.tsx`
- Create: `src/features/session-v2/SharedSessionExperience.test.tsx`

- [ ] **Step 1: Define completion behavior**

Create `src/features/session-v2/session-completion.ts`:

```ts
export type SessionCompletionBehavior =
    | {
          kind: "invited_debrief";
          closeLabel?: string;
          practiceAgainEnabled?: boolean;
      }
    | {
          kind: "candidate_dashboard";
          dashboardHref: string;
          summaryHref?: string;
      };

export function getCompletionDestination(behavior: SessionCompletionBehavior) {
    if (behavior.kind === "candidate_dashboard") {
        return behavior.summaryHref ?? behavior.dashboardHref;
    }

    return null;
}
```

- [ ] **Step 2: Add minimal shared experience boundary**

Create `src/features/session-v2/SharedSessionExperience.tsx`:

```tsx
import type { SessionCompletionBehavior } from "./session-completion";
import { getCompletionDestination } from "./session-completion";

type SharedSessionExperienceProps = {
    sessionId: string;
    completionBehavior: SessionCompletionBehavior;
};

export function SharedSessionExperience({ sessionId, completionBehavior }: SharedSessionExperienceProps) {
    const completionDestination = getCompletionDestination(completionBehavior);

    return (
        <section aria-label="Practice session" data-session-id={sessionId}>
            <p>Session {sessionId}</p>
            {completionDestination ? (
                <a href={completionDestination}>Continue</a>
            ) : (
                <p>Recruiter debrief completion</p>
            )}
        </section>
    );
}
```

- [ ] **Step 3: Write completion tests**

Create `src/features/session-v2/SharedSessionExperience.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { SharedSessionExperience } from "./SharedSessionExperience";
import { getCompletionDestination } from "./session-completion";

it("routes candidate-led completion to summary when provided", () => {
    expect(getCompletionDestination({
        kind: "candidate_dashboard",
        dashboardHref: "/dashboard2",
        summaryHref: "/summary2/session-1",
    })).toBe("/summary2/session-1");
});

it("routes candidate-led completion to dashboard when no summary is provided", () => {
    expect(getCompletionDestination({
        kind: "candidate_dashboard",
        dashboardHref: "/dashboard2",
    })).toBe("/dashboard2");
});

it("keeps invited completion internal to the recruiter debrief flow", () => {
    expect(getCompletionDestination({ kind: "invited_debrief" })).toBeNull();
});

it("renders the candidate completion destination", () => {
    render(
        <SharedSessionExperience
            sessionId="session-1"
            completionBehavior={{ kind: "candidate_dashboard", dashboardHref: "/dashboard2" }}
        />,
    );

    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute("href", "/dashboard2");
});
```

- [ ] **Step 4: Run tests**

Run:

```bash
cmd /c npx vitest run src/features/session-v2/SharedSessionExperience.test.tsx
```

Expected: tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/features/session-v2
git commit -m "feat: add shared session v2 completion contract"
```

Expected: commit succeeds.

---

### Task 5: Route Candidate Session V2 Through Shared Session Boundary

**Files:**
- Modify: `src/app/session2/[sessionId]/page.tsx`
- Create: `src/app/session2/[sessionId]/page.integration.test.tsx`
- Read: `src/app/session/[sessionId]/page.tsx`
- Read: `src/lib/server/candidate`

- [ ] **Step 1: Write loader integration test**

Create `src/app/session2/[sessionId]/page.integration.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const {
    loadCandidateSessionForCurrentCandidateMock,
    notFoundMock,
    sharedSessionExperienceMock,
} = vi.hoisted(() => ({
    loadCandidateSessionForCurrentCandidateMock: vi.fn(),
    notFoundMock: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
    sharedSessionExperienceMock: vi.fn(({ sessionId, completionBehavior }) => (
        <section aria-label="Practice session V2">
            <p>{sessionId}</p>
            <p>{completionBehavior.kind}</p>
            <p>{completionBehavior.dashboardHref}</p>
            <p>{completionBehavior.summaryHref}</p>
        </section>
    )),
}));

vi.mock("next/navigation", () => ({
    notFound: notFoundMock,
}));

vi.mock("@/lib/server/candidate", () => ({
    loadCandidateSessionForCurrentCandidate: loadCandidateSessionForCurrentCandidateMock,
}));

vi.mock("@/features/session-v2/SharedSessionExperience", () => ({
    SharedSessionExperience: sharedSessionExperienceMock,
}));

beforeEach(() => {
    vi.clearAllMocks();
});

it("loads the candidate-owned session and renders the shared V2 session boundary", async () => {
    loadCandidateSessionForCurrentCandidateMock.mockResolvedValue({
        session: {
            id: "session-1",
        },
    });

    const { default: Session2Page } = await import("./page");
    render(await Session2Page({ params: Promise.resolve({ sessionId: "session-1" }) }));

    expect(loadCandidateSessionForCurrentCandidateMock).toHaveBeenCalledWith("session-1");
    expect(sharedSessionExperienceMock).toHaveBeenCalledWith(
        {
            sessionId: "session-1",
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/dashboard2",
                summaryHref: "/summary2/session-1",
            },
        },
        undefined,
    );
    expect(screen.getByRole("region", { name: "Practice session V2" })).toBeInTheDocument();
});

it("returns not found when the current candidate does not own the session", async () => {
    loadCandidateSessionForCurrentCandidateMock.mockResolvedValue(null);

    const { default: Session2Page } = await import("./page");

    await expect(Session2Page({ params: Promise.resolve({ sessionId: "other-session" }) }))
        .rejects
        .toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify shell-only page fails**

Run:

```bash
cmd /c npx vitest run src/app/session2/[sessionId]/page.integration.test.tsx
```

Expected: test fails because the V2 route still renders `V2Placeholder`.

- [ ] **Step 3: Replace placeholder with shared session experience**

Modify `src/app/session2/[sessionId]/page.tsx` so it loads the candidate-owned session using the same ownership loader as the current candidate session route, then renders:

```tsx
<SharedSessionExperience
    sessionId={session.id}
    completionBehavior={{
        kind: "candidate_dashboard",
        dashboardHref: "/dashboard2",
        summaryHref: `/summary2/${session.id}`,
    }}
/>
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
cmd /c npx vitest run src/app/session2/[sessionId]/page.integration.test.tsx src/features/session-v2/SharedSessionExperience.test.tsx
```

Expected: tests pass.

- [ ] **Step 5: Run candidate tests**

Run: `cmd /c npm run test:candidate`

Expected: existing candidate routes and V2 session route pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/session2 src/features/session-v2
git commit -m "feat: route candidate session v2 through shared runtime"
```

Expected: commit succeeds.

---

### Task 6: Add Evidence-First Domain Contracts Behind A Flag

**Files:**
- Create: `src/lib/domain/interview-evaluation/question-category.ts`
- Create: `src/lib/domain/interview-evaluation/universal-criteria.ts`
- Create: `src/lib/domain/interview-evaluation/evidence-extraction.schema.ts`
- Create: `src/lib/domain/interview-evaluation/criteria-band.schema.ts`
- Create: `src/lib/domain/interview-evaluation/pattern-gap-detector.ts`
- Create: `src/lib/domain/interview-evaluation/criteria-band-mapper.ts`
- Create: `src/lib/domain/interview-evaluation/index.ts`
- Create: `src/lib/domain/interview-evaluation/*.test.ts`

- [ ] **Step 1: Implement canonical categories**

Create `question-category.ts` with:

```ts
export type CanonicalQuestionCategory =
    | "behavioral"
    | "culture_fit"
    | "technical_role_specific"
    | "case_scenario"
    | "screening"
    | "general";

export function normalizeQuestionCategory(value: unknown): CanonicalQuestionCategory {
    const normalized = String(value ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();

    if (normalized.includes("screening")) return "screening";
    if (normalized.includes("case") || normalized.includes("scenario")) return "case_scenario";
    if (normalized.includes("technical") || normalized.includes("role specific")) return "technical_role_specific";
    if (normalized.includes("culture") || normalized.includes("fit") || normalized.includes("perma")) return "culture_fit";
    if (normalized.includes("behavioral") || normalized.includes("star")) return "behavioral";
    return "general";
}
```

- [ ] **Step 2: Implement universal criteria**

Create `universal-criteria.ts` with the five criterion ids:

```ts
export type Band = "emerging" | "clear" | "strong";

export type UniversalCriterionId =
    | "answer_focus"
    | "organization"
    | "evidence_specificity"
    | "role_skill_signal"
    | "impact_judgment_takeaway";

export type UniversalCriterion = {
    id: UniversalCriterionId;
    label: string;
    userDescription: string;
};

export const UNIVERSAL_CRITERIA: UniversalCriterion[] = [
    { id: "answer_focus", label: "Answer Focus", userDescription: "How directly your answer responds to the question." },
    { id: "organization", label: "Organization", userDescription: "How easy the answer is to follow." },
    { id: "evidence_specificity", label: "Evidence & Specificity", userDescription: "How concrete the details, examples, or reasoning are." },
    { id: "role_skill_signal", label: "Role Skill Signal", userDescription: "How well the answer shows the skill being assessed." },
    { id: "impact_judgment_takeaway", label: "Impact, Judgment, or Takeaway", userDescription: "Whether the answer lands with a result, decision, lesson, tradeoff, or next step." },
];
```

- [ ] **Step 3: Add schemas and deterministic mappers**

Use Zod schemas for evidence extraction and criteria-band payloads. Implement deterministic mapper tests for:

- terse but sufficient screening answers;
- confident but incorrect technical answers;
- non-native grammar with strong content;
- voice filler words not lowering content bands.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
cmd /c npx vitest run src/lib/domain/interview-evaluation
```

Expected: all evaluation-domain tests pass.

- [ ] **Step 5: Run typecheck**

Run: `cmd /c npm run typecheck`

Expected: TypeScript succeeds.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/domain/interview-evaluation
git commit -m "feat: add evidence-first evaluation contracts"
```

Expected: commit succeeds.

---

### Task 7: Build Dashboard2 From The V2 Read Model

**Files:**
- Create: `src/features/candidate-v2/dashboard/`
- Create: `src/app/dashboard2/page.tsx`
- Create: `src/app/dashboard2/page.test.tsx`
- Read: `.untracked/design-system/ui_kits/candidate/Dashboard.jsx`
- Read: `docs/candidate-app/SPEC.md`
- Read: `docs/candidate-app/DATA_CONTRACT.md`

- [ ] **Step 1: Define Dashboard2 view model**

Create a focused read-model type that exposes only:

```ts
type Dashboard2Model = {
    candidateName: string;
    targetRole: string;
    interviewStageLabel: string;
    preparednessTarget: {
        state: "not_practiced" | "emerging" | "clear" | "strong";
        practicedCount: number;
        baselineCount: number;
        coachObservation: string;
    };
    coachPlan: {
        categories: Array<{ id: string; label: string; plannedCount: number; practicedCount: number }>;
        lanes: Array<{ id: string; label: string; state: "not_practiced" | "emerging" | "clear" | "strong" }>;
        questions: Array<{ id: string; label: string; text: string; answered: boolean }>;
    };
};
```

- [ ] **Step 2: Render the first Dashboard2 shell**

The first shell must show:

- compact candidate identity;
- target role;
- preparedness target;
- three face controls: Categories, Skills, Question Set;
- one primary `Next practice round` action;
- no numeric score, pass/fail, ranking, or hidden dimension copy.

- [ ] **Step 3: Add candidate-facing copy tests**

Add tests that reject forbidden copy:

```ts
expect(screen.queryByText(/score|percentile|pass|fail|ranking/i)).not.toBeInTheDocument();
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
cmd /c npx vitest run src/app/dashboard2 src/features/candidate-v2/dashboard
```

Expected: Dashboard2 tests pass.

- [ ] **Step 5: Run browser smoke when UI is interactive**

Run after route has real interactions:

```bash
cmd /c npm run test:e2e:candidate-seeded
```

Expected: existing candidate smoke still passes. Add Dashboard2 smoke coverage in the same slice that makes Dashboard2 navigable from the app shell.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/app/dashboard2 src/features/candidate-v2/dashboard
git commit -m "feat: build candidate dashboard v2 shell"
```

Expected: commit succeeds.

---

## Verification Checklist

Run before declaring the first V2 vertical slice complete:

```bash
cmd /c npm run typecheck
cmd /c npm run test:candidate
cmd /c npm run build
git diff --check
```

Expected:

- TypeScript succeeds.
- Candidate tests pass.
- Build succeeds.
- Diff check has no whitespace errors.
- Old `/practice`, `/session/[sessionId]`, `/dashboard`, `/s/[token]`, and recruiter routes remain available unless a later ADR explicitly switches them.

## Risk Notes

- Route duplication is temporary but real; keep V2 route naming explicit until cutover.
- Candidate-owned session GET/PATCH authorization is the first blocker for shared runtime adoption.
- `.untracked/design-system` is not a production dependency until promoted into tracked source.
- Recruiter V2 should wait until candidate V2 proves the shared session and evaluation seams.
- Legacy score-driven dashboard logic can remain for old routes, but Dashboard2 should not deepen that dependency.
