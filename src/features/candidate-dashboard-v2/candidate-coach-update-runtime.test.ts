import { describe, expect, it, vi } from "vitest";

import type { CandidateCoachUpdateSynthesisInput } from "./candidate-coach-update-artifact";
import {
    CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION,
    CandidateCoachUpdateRuntimeError,
    createCandidateCoachUpdateProviderRequest,
    createCandidateCoachUpdateSynthesisRuntime,
    type CandidateCoachUpdateProviderAdapter,
    type CandidateCoachUpdateProviderRequest,
} from "./candidate-coach-update-runtime";
import { createCandidateCoachUpdateRuntimeFromEnvironment } from "./candidate-coach-update-runtime-selection";

describe("candidate Coach Update synthesis runtime", () => {
    it("keeps candidate and database identity outside the provider request and reattaches facts in code", async () => {
        const input = createInput();
        const generate = vi.fn(async (request: CandidateCoachUpdateProviderRequest) => ({
            rawText: JSON.stringify(createValidOutput(request)),
            tokenUsage: { inputTokens: 120, outputTokens: 40 },
        }));
        const runtime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createAdapter(generate),
        });

        const result = await runtime.synthesize(input);
        const providerRequest = generate.mock.calls[0][0];
        const serializedRequest = JSON.stringify(providerRequest);

        expect(serializedRequest).not.toContain(input.candidateProfileId);
        expect(serializedRequest).not.toContain(input.roleProfileId);
        expect(serializedRequest).not.toContain(input.sourceCandidatePracticeSessionId);
        expect(serializedRequest).not.toContain("attempt-current");
        expect(serializedRequest).not.toContain("run-current");
        expect(providerRequest).not.toHaveProperty("questionCount");
        expect(serializedRequest).not.toContain("I organized the urgent shipment");
        expect(providerRequest.questions[0].answer).toEqual({ mode: "text" });
        expect(providerRequest.questions[0].comparison).toMatchObject({
            kind: "repeat_practice",
            priorComparableAttemptCount: 1,
        });
        expect(result.content.questions[0]).toMatchObject({
            answer: { candidateAnswerAttemptId: "attempt-current" },
            source: { candidatePracticeSessionId: "source-session", questionKey: "source-slot" },
            coaching: { observation: "The response connects the action to the role." },
        });
        expect(result.validation).toMatchObject({
            transportAttemptCount: 1,
            tokenUsage: { inputTokens: 120, outputTokens: 40 },
            rawOutputStored: false,
            promptStored: false,
        });
    });

    it("bounds comparable provider context while retaining the total comparable-attempt count", () => {
        const input = createInput({
            questions: [{
                ...createInput().questions[0],
                priorComparableAttempts: Array.from({ length: 5 }, (_, index) => createPriorAttempt(index + 1)),
            }],
        });

        const request = createCandidateCoachUpdateProviderRequest(input);

        expect(request.questions[0].comparison.priorComparableAttemptCount).toBe(5);
        expect(request.questions[0].comparison.recentComparableAttempts).toHaveLength(3);
        expect(request.questions[0].comparison.recentComparableAttempts[0].acceptedCoaching.observation)
            .toBe("Earlier observation 3");
    });

    it.each([
        ["{not-json", "invalid_json"],
        [JSON.stringify({ status: "wrong" }), "invalid_schema"],
    ])("rejects malformed output without emitting raw content to telemetry", async (rawText, expectedKind) => {
        const recordTelemetry = vi.fn();
        const runtime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createAdapter(async () => ({ rawText })),
            recordTelemetry,
        });

        await expect(runtime.synthesize(createInput())).rejects.toMatchObject({
            kind: expectedKind,
            lifecycleState: "rejected",
        });
        expect(recordTelemetry).toHaveBeenCalledWith(expect.objectContaining({
            outcome: "rejected",
            retryable: true,
            transportAttemptCount: 1,
        }));
        expect(JSON.stringify(recordTelemetry.mock.calls)).not.toContain(rawText);
        expect(JSON.stringify(recordTelemetry.mock.calls)).not.toContain("I organized the urgent shipment");
    });

    it("rejects fingerprint, question-order, and score-language drift before candidate-safe hydration", async () => {
        const input = createInput();
        const cases = [
            {
                output: { ...createValidOutput(createCandidateCoachUpdateProviderRequest(input)), synthesisInputFingerprint: "wrong" },
                kind: "fingerprint_mismatch",
            },
            {
                output: {
                    ...createValidOutput(createCandidateCoachUpdateProviderRequest(input)),
                    questionUpdates: [{ questionNumber: 2, comparisonMessage: "Keep the comparison grounded." }],
                },
                kind: "question_mapping_mismatch",
            },
            {
                output: {
                    ...createValidOutput(createCandidateCoachUpdateProviderRequest(input)),
                    summary: "You scored 92% on this practice.",
                },
                kind: "unsafe_candidate_language",
            },
        ];

        for (const testCase of cases) {
            const runtime = createCandidateCoachUpdateSynthesisRuntime({
                adapter: createAdapter(async () => ({ rawText: JSON.stringify(testCase.output) })),
            });
            await expect(runtime.synthesize(input)).rejects.toMatchObject({ kind: testCase.kind });
        }
    });

    it("aborts one transport attempt at the timeout and never performs an internal retry", async () => {
        let aborted = false;
        const generate = vi.fn(async (_request: CandidateCoachUpdateProviderRequest, context: { signal: AbortSignal }) => (
            new Promise<never>((_, reject) => {
                context.signal.addEventListener("abort", () => {
                    aborted = true;
                    reject(new Error("late transport abort"));
                }, { once: true });
            })
        ));
        const recordTelemetry = vi.fn();
        const runtime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createAdapter(generate),
            timeoutMs: 10,
            recordTelemetry,
        });

        await expect(runtime.synthesize(createInput())).rejects.toMatchObject({
            kind: "timeout",
            lifecycleState: "failed",
            retryable: true,
        });
        expect(aborted).toBe(true);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(recordTelemetry).toHaveBeenCalledWith(expect.objectContaining({
            outcome: "failed",
            errorCode: "COACH_UPDATE_PROVIDER_TIMEOUT",
            transportAttemptCount: 1,
        }));
    });

    it("keeps fixture and fault runtimes unavailable outside explicit non-production local development", async () => {
        expect(createCandidateCoachUpdateRuntimeFromEnvironment({
            env: { NODE_ENV: "production", CANDIDATE_COACH_UPDATE_PROVIDER: "fault", CANDIDATE_COACH_UPDATE_FAULT_MODE: "provider_5xx" },
            explicitLocalDev: true,
        })).toBeNull();
        expect(createCandidateCoachUpdateRuntimeFromEnvironment({
            env: { NODE_ENV: "development", CANDIDATE_COACH_UPDATE_PROVIDER: "fault", CANDIDATE_COACH_UPDATE_FAULT_MODE: "provider_5xx" },
            explicitLocalDev: false,
        })).toBeNull();

        const faultRuntime = createCandidateCoachUpdateRuntimeFromEnvironment({
            env: { NODE_ENV: "development", CANDIDATE_COACH_UPDATE_PROVIDER: "fault", CANDIDATE_COACH_UPDATE_FAULT_MODE: "provider_5xx" },
            explicitLocalDev: true,
        });
        await expect(faultRuntime?.synthesize(createInput())).rejects.toMatchObject({
            kind: "provider_5xx",
        });

        for (const answerAnalysisProvider of ["fixture", "google_genai", "fault"]) {
            const fixtureRuntime = createCandidateCoachUpdateRuntimeFromEnvironment({
                env: { NODE_ENV: "development", CANDIDATE_ANSWER_ANALYSIS_PROVIDER: answerAnalysisProvider },
                explicitLocalDev: true,
            });
            await expect(fixtureRuntime?.synthesize(createInput())).resolves.toMatchObject({
                content: { status: "candidate_coach_update_content_v1" },
            });
        }
    });

    it("normalizes unexpected adapter exceptions to a candidate-safe provider-unavailable failure", async () => {
        const runtime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createAdapter(async () => {
                throw new Error("secret provider detail");
            }),
        });

        await expect(runtime.synthesize(createInput())).rejects.toEqual(
            new CandidateCoachUpdateRuntimeError("provider_unavailable"),
        );
    });

    it("does not let a telemetry sink failure alter accepted synthesis", async () => {
        const runtime = createCandidateCoachUpdateSynthesisRuntime({
            adapter: createAdapter(async (request) => ({
                rawText: JSON.stringify(createValidOutput(request)),
            })),
            recordTelemetry: async () => {
                throw new Error("diagnostic sink unavailable");
            },
        });

        await expect(runtime.synthesize(createInput())).resolves.toMatchObject({
            content: { status: "candidate_coach_update_content_v1" },
        });
    });
});

function createAdapter(
    generate: CandidateCoachUpdateProviderAdapter["generate"],
): CandidateCoachUpdateProviderAdapter {
    return {
        metadata: {
            provider: "test_provider",
            modelName: "test_model",
            promptVersion: "coach_update_prompt_v1",
            evaluatorVersion: "evidence_first_v1",
            profileId: "test_profile_v1",
            configurationFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        generate,
    };
}

function createValidOutput(request: CandidateCoachUpdateProviderRequest) {
    return {
        status: CANDIDATE_COACH_UPDATE_PROVIDER_OUTPUT_VERSION,
        synthesisInputFingerprint: request.synthesisInputFingerprint,
        title: `${request.targetRole} practice update`,
        summary: "Your latest practice adds a useful example to build on.",
        primaryFocus: "Make the result of your action more explicit.",
        questionUpdates: request.questions.map((question) => ({
            questionNumber: question.questionNumber,
            comparisonMessage: "This response gives a clearer action than your earlier practice.",
        })),
    };
}

function createInput(
    overrides: Partial<CandidateCoachUpdateSynthesisInput> = {},
): CandidateCoachUpdateSynthesisInput {
    return {
        status: "candidate_coach_update_synthesis_input_v1",
        candidateProfileId: "candidate-private-id",
        roleProfileId: "role-profile-private-id",
        sourceCandidatePracticeSessionId: "session-private-id",
        targetRole: "Material Handler",
        completedAt: "2026-07-16T12:05:00.000Z",
        questionCount: 1,
        answeredCount: 1,
        sourceCompletionFingerprint: "completion-fingerprint",
        synthesisInputFingerprint: "synthesis-fingerprint",
        questions: [{
            questionKey: "slot-1",
            questionNumber: 1,
            category: "Behavioral",
            questionText: "Tell me about a time you handled an urgent shipment.",
            answerAttempt: {
                candidateAnswerAttemptId: "attempt-current",
                mode: "text",
                answerText: "I organized the urgent shipment and told the lead when it was ready.",
                submittedAt: "2026-07-16T12:01:00.000Z",
            },
            acceptedEvaluationRun: {
                candidateAnswerEvaluationRunId: "run-current",
            },
            acceptedAnalysis: createAnalysis("The response connects the action to the role."),
            source: { candidatePracticeSessionId: "source-session", questionKey: "source-slot" },
            priorComparableAttempts: [createPriorAttempt(1)],
        } as CandidateCoachUpdateSynthesisInput["questions"][number]],
        ...overrides,
    };
}

function createPriorAttempt(index: number) {
    return {
        answerAttempt: {
            candidateAnswerAttemptId: `attempt-prior-${index}`,
            mode: "text" as const,
            answerText: `Earlier answer ${index}`,
            submittedAt: `2026-07-${String(index).padStart(2, "0")}T12:01:00.000Z`,
        },
        acceptedEvaluationRun: {
            candidateAnswerEvaluationRunId: `run-prior-${index}`,
        },
        acceptedAnalysis: createAnalysis(`Earlier observation ${index}`),
    } as CandidateCoachUpdateSynthesisInput["questions"][number]["priorComparableAttempts"][number];
}

function createAnalysis(observation: string) {
    return {
        status: "answer_analysis_provider_result" as const,
        provider: "candidate_v2_answer_evaluator" as const,
        analyzedAt: "2026-07-16T12:02:00.000Z",
        answer: { slotId: "slot-1", questionIndex: 0 },
        coachFeedback: {
            acknowledgement: "You gave a direct example.",
            observation,
            nextPracticeFocus: "Name the result of the action.",
        },
        evidence: [
            { criterionId: "answer_focus", applicability: "observed" as const, score: 3 },
            { criterionId: "impact", applicability: "not_elicited" as const },
        ],
    };
}
