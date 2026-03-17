# Code Review Checklist

This document outlines the key dimensions for high-quality code reviews, moving from basic correctness to production-grade architecture and observability.

## 1. Correctness & Edge Cases
*   **Hidden logic bugs**: Identify potential flaws in the implementation logic.
*   **Edge cases**: Account for empty inputs, extremely large inputs, timezone discrepancies, double submissions, and unstable network conditions.
*   **Race conditions**: Especially critical in asynchronous UI flows.

**Output:** A list of high-risk paths and specific hardening strategies.

## 2. Readability & Maintainability
*   **Clear naming**: Ensure variables, functions, and components have descriptive, consistent names.
*   **Single Responsibility**: Components and functions should ideally perform one specific task.
*   **Simplicity**: Prioritize straightforward code over "clever" solutions that are hard to maintain.

**Output:** Refactor suggestions to reduce cognitive load and a PR-style checklist.

## 3. Architecture & Boundaries
*   **Separation of Concerns**: Clearly distinguish between UI, state management, data fetching, and domain logic.
*   **Scalability**: Ensure folder and module boundaries can support growth beyond Phase 1.
*   **Dependency Management**: Maintain clean import structures and avoid "spaghetti" dependencies.

**Output:** A recommended project structure and defined responsibilities for each module.

## 4. Type Safety & Runtime Validation
*   **Strong Typing**: Use TypeScript to define clear contracts for APIs and domain objects.
*   **Runtime Validation**: Validate external data (user inputs, API responses) to ensure system stability.

**Output:** Concrete recommendations for adding validation and refining type definitions.

## 5. Security & Privacy
*   **Injection Risks**: Guard against XSS and unsafe HTML rendering.
*   **Auth & Sessions**: Verify assumptions regarding authentication and session management.
*   **Secrets & PII**: Ensure secrets are managed securely and PII is handled according to privacy standards (storage, logging, transmission).

**Output:** A focused threat model highlighting top risks and mitigations.

## 6. Performance & UX
*   **Optimized Rendering**: Minimize avoidable re-renders and identify heavy components.
*   **Resource Efficiency**: Audit bundle size, dependency bloat, and network call frequency.
*   **Perceived Speed**: Implement effective caching, loading states, and optimistic UI updates.

**Output:** A prioritized list of performance optimizations.

## 7. Testing Strategy
*   **Unit Tests**: Focused on pure business logic.
*   **Component Tests**: Validating key user flows.
*   **E2E Tests**: Covering "happy paths" and critical failure scenarios.
*   **Testability**: Refactor UI code to move logic into testable modules.

**Output:** A minimum viable test suite plan for Phase 1.

## 8. Observability & Operability
*   **Error Handling**: Standardized recovery and reporting patterns.
*   **Structured Logging**: Meaningful logs without exposing PII.
*   **Telemetry**: Track critical events like drop-off points and completion rates.
*   **Reliability**: Define how we detect and respond to production failures.

**Output:** An assessment of system monitoring and incident response readiness.

## 9. Accessibility & Polish
*   **A11y Basics**: Keyboard navigation, proper focus management, and ARIA labels.
*   **Visual Standards**: Ensure adequate color contrast and clear form error messaging.

**Output:** An accessibility punch list for immediate refinement.

## 10. Documentation & Repo Hygiene
*   **Project README**: Clear instructions for setup, scripts, environment variables, and deployment.
*   **Standards Enforcement**: Consistent formatting, linting, and structural rules.
*   **Commit Quality**: Use conventional commits and maintain a meaningful changelog.

**Output:** A "professional repo checklist" to align with industry expectations.
