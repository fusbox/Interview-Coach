# Production Question Wording Integration Contract

Status: Ratified implementation contract
Last updated: 2026-07-18

## Purpose

This contract governs the first production provider that turns a deterministic candidate question plan into immutable interview-question wording. It preserves explainable category planning, grounds questions in the candidate's selected practice context, and prevents provider output from changing session identity or plan meaning.

The first profile is:

- provider: `google_genai`;
- profile: `google_gemini_2_5_flash_question_wording_v1`;
- model: `gemini-2.5-flash`;
- prompt version: `candidate_question_wording_prompt_v1`;
- configuration fingerprint: `300555f7ae43ff7a24cc3c0b89320972a7781d098fb51d5803982cbd662e8404`.

## Lifecycle Ownership

For an initial setup-created round, `/candidate/setup/start` must execute in this order:

1. parse and normalize the typed setup payload;
2. resolve candidate ownership and the candidate-owned prep context;
3. create the deterministic `questionPlanSnapshot`;
4. call the selected question-wording runtime once;
5. validate exact output shape, count, order, slot id, category, length, and distinctness;
6. persist the session, accepted `questionWordingSnapshot`, and immutable generation identity;
7. consume trusted host setup staging only inside the successful session write.

Provider failure creates no session and does not consume trusted setup staging. An empty prep context created before the call may be reused by a later retry; it is not practice evidence and is not shown as a duplicate active practice path.

Follow-up rounds do not call this provider. A one-question action, queue, or fixed bundle snapshots the exact already-worded source questions selected by the candidate. Regenerating those questions would break practice intent and attempt lineage.

## Provider Input

The code-owned request is bounded to:

- normalized target role, at most 120 characters;
- normalized job description, at most 12,000 characters;
- optional normalized resume text, at most 24,000 characters;
- interview stage;
- the exact ordered plan slots, including slot id, index, category, purpose, category definition, answer-shape guidance, and common pitfalls.

Role, JD, resume, stage, and plan values are serialized in an explicitly untrusted user-data envelope. They never enter the system instruction as executable instructions. Candidate identity, email, prep/session ids, host token data, credentials, prior answers, evaluator results, Coach Update content, and dashboard facts are not provider input.

Resume context may invite relevant transferable experience. It must not be quoted unnecessarily, exposed as private candidate detail, or used to invent experience. The job description may ground realistic role demands but must not override the deterministic plan category.

## Output And Validation

Google may author only:

```ts
type ProviderQuestionWordingOutput = {
  questions: Array<{
    slotId: string;
    category:
      | "screening"
      | "behavioral"
      | "culture_fit"
      | "case_scenario"
      | "technical_role_specific";
    questionText: string;
  }>;
};
```

Application code reattaches the provider-output version and request fingerprint. The runtime accepts output only when:

- the structured JSON schema is exact;
- question count equals plan-slot count;
- every question maps to the same ordered slot id and category;
- every question is 8-500 characters;
- normalized question text is distinct within the round;
- response safety and finish status are acceptable.

The runtime does not reorder, trim a larger pool, repair a category, fill a missing question, or substitute fixture wording after production failure.

## Configuration Identity

The immutable configuration fingerprint covers provider, profile, model, prompt version, request/output versions, exact system-instruction fingerprint, exact response-schema fingerprint, timeout, and generation settings. Accepted session wording stores:

- provider, model, profile, prompt version, and configuration fingerprint;
- stable request fingerprint;
- generated timestamp;
- timeout and one-attempt fact;
- latency and token counts;
- explicit `rawOutputStored: false` and `promptStored: false` markers.

Any request-affecting change to model, prompt, schema, timeout, or generation settings requires a new immutable profile/configuration identity and a new live gate. Earlier V2 fixture rows remain readable without invented production metadata. No V1 data accommodation is required.

## Failure And Recovery

Runtime failures are reduced to bounded safe classes: timeout, rate limit, provider 4xx/5xx/unavailable, misconfiguration, safety rejection, empty/malformed/schema-invalid output, fingerprint mismatch, slot mapping mismatch, and duplicate wording.

- Setup returns a generic `503` with a safe code and retryability fact.
- The browser setup draft remains available.
- Candidate input, provider bodies, prompts, credentials, and generated text are not returned in error detail.
- The server makes no hidden automatic retry. A candidate retry creates a new explicit request with the same stable request fingerprint when setup and plan are unchanged.
- Production never falls back to fixture wording.

Fixture and fault-injection profiles are available only in explicit local host-launch development mode and never in production.

## Telemetry And Retention

Ordinary telemetry contains only request/configuration fingerprints, interview stage, question count, provider/profile/model/prompt identity, accepted/failed/rejected outcome, safe error code, retryability, latency, one-attempt count, and token counts.

Telemetry and ordinary persistence do not retain assembled prompts, provider request payloads, raw provider output, credentials, role/JD/resume copies, candidate identity, or provider exception bodies. The accepted question text exists only in the session's immutable wording snapshot and approved synthetic review artifacts.

## Serving Gate

The exact profile must pass:

1. mocked adapter and route conformance, including the full safe failure matrix;
2. an explicit credentialed synthetic gate under the [Live Question Wording Validation Runbook](./live-question-wording-validation-runbook.md);
3. human review for role/JD relevance, category fit, clarity, focus, distinctness, appropriate resume use, and absence of scoring/hiring claims;
4. disposable-DB and browser reconciliation proving accepted configuration identity, session persistence, ready landing, and fail-closed retry behavior before deployment approval.

The credentialed synthetic gate passed on 2026-07-18 in one transport attempt with artifact `live_question_wording_d2e342492a3c518f`. Disposable-DB reconciliation then proved accepted configuration persistence, immutable recovery, trusted failure preservation, and follow-up reuse with zero generation calls. A guarded live browser run proved the same pinned profile through setup, pre-session landing, first-question rendering, and refresh recovery. These are provider and integration conformance evidence, not deployment approval.
