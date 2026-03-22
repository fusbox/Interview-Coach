# AGENT_CONTEXT

## Purpose
- This file is the primary continuity anchor for future Codex sessions in this repo.
- Read this first when starting work that depends on product intent, design rationale, or active implementation direction.
- Keep this file short, durable, and opinionated. Link outward instead of turning it into a changelog.

## Product Intent
- Interview Coach should feel like a high-attunement, high-signal coach, not a generic AI assistant.
- The product goal is skill lift, not just answer scoring. Candidates should leave each session with a clearer understanding of what interviewers are actually testing, how strong answers work, and how to improve.
- Across repeated practice, the feedback should teach reusable interview patterns, domain-aware best practices, and confidence-building habits.

## Current Priorities
- Redesign the answer-feedback chain so it reads as one coherent coach response from one central read of the answer.
- Preserve mobile polish across recruiter surfaces; avoid desktop layouts merely compressed onto small screens.
- Maintain continuity of product and AI-design decisions through this file rather than relying on session memory.

## Non-Negotiables
- Feedback must teach. It should not stop at praise, critique, or generic encouragement.
- Visible feedback sections must feel like one coach speaking from one central read of the answer.
- Prefer one model call for the answer-feedback routine unless a stronger architectural reason emerges for multiple calls.
- Mobile UX should optimize for clarity, hierarchy, and actionability, not feature parity at any cost.
- Changes should preserve existing core functionality unless the redesign explicitly calls for a behavior change.

## AI Feedback Design
- The main design concern is not just `ack`; the entire feedback chain is under review for coherence.
- `ack` should be the opening coaching move: specific, confidence-building, and tied to interviewer value or what the question is testing.
- `ack` should lead naturally into the rest of the feedback, not feel like a separate flourish.
- The deeper target is a hidden internal structure such as:
  - central read of the answer
  - strongest usable signal
  - interviewer value of that signal
  - highest-value coaching intervention
  - staged delivery across the rendered feedback sections
- The likely implementation direction is one model call with a richer internal schema rather than separate calls for each feedback section.
- Multiple model calls are not currently justified unless a later design requires one step to materially constrain a later generation step.

## Feedback Chain Notes
- Current traced flow for answer submission to rendered feedback:
  - [UnifiedSessionScreen.tsx](src/features/session/components/UnifiedSessionScreen.tsx)
  - [useSessionAnswerMutations.ts](src/features/session/hooks/session-mutations/useSessionAnswerMutations.ts)
  - [submit route](src/app/api/session/[session_id]/questions/[question_id]/submit/route.ts)
  - [orchestrator.ts](src/lib/server/session/orchestrator.ts)
  - [analysis route](src/app/api/session/[session_id]/questions/[question_id]/analysis/route.ts)
  - [prompts.ts](src/lib/ai/prompts.ts)
  - [ai-service.ts](src/lib/server/services/ai-service.ts)
  - [FeedbackDrawer.tsx](src/features/session/components/FeedbackDrawer.tsx)
- When revisiting feedback generation, review the full chain before making isolated prompt edits.

## Active UI And Product Patterns
- Recruiter mobile layouts should use the same shell padding pattern as create, dashboard, and settings unless there is a deliberate exception.
- Dashboard invite-progress widgets and manage-invites views now use mobile-specific layouts rather than relying on dense desktop table behavior.
- Resend invite flow should follow the same email preview and send pattern as initial invite sending, using the existing invite token rather than generating a new one.

## Open Questions
- What hidden schema best captures the "central read" so every feedback section derives from the same logic?
- How should low-signal answers open strongly without faking praise?
- How tightly should `ack`, content feedback, delivery feedback, and next action be coupled in the returned analysis object?
- What is the best evaluation framework for judging whether feedback is truly teaching interview craft?

## Working Norms For Future Sessions
- If the task touches AI feedback quality, start by reviewing this file and then inspect the current implementation in [ai-service.ts](src/lib/server/services/ai-service.ts) and [prompts.ts](src/lib/ai/prompts.ts).
- If the task touches recruiter mobile UX, inspect the current recruiter shell/layout and recent mobile-specific component behavior before proposing broad UI changes.
- Favor explicit design rationale over ad hoc prompt tweaking.
- Treat this file as durable context. Put temporary task state elsewhere.

## Key References
- [src/lib/server/services/ai-service.ts](src/lib/server/services/ai-service.ts)
- [src/lib/ai/prompts.ts](src/lib/ai/prompts.ts)
- [src/features/session/components/FeedbackDrawer.tsx](src/features/session/components/FeedbackDrawer.tsx)
- [docs/05-quality/debug/ai_context.md](docs/05-quality/debug/ai_context.md)
