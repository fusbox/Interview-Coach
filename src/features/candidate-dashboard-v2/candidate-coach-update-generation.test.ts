import { describe, expect, it, vi } from "vitest";

import type {
    CandidateCoachUpdateArtifactRecord,
    CandidateCoachUpdateSynthesisInput,
} from "./candidate-coach-update-artifact";
import { ensureCandidateCoachUpdateArtifact } from "./candidate-coach-update-generation";
import {
    CandidateCoachUpdateRuntimeError,
    type CandidateCoachUpdateSynthesisRuntime,
} from "./candidate-coach-update-runtime";

describe("candidate Coach Update generation", () => {
    it("replays a completed same-input artifact without calling the synthesizer", async () => {
        const artifact = createArtifact({ lifecycleState: "completed" });
        const runtime = createRuntime(vi.fn());
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput: async () => createInput(),
            repository: createRepository({ outcome: "replayed", artifact }),
            runtime,
        });

        expect(result).toEqual({ status: "coach_update_completed", artifact });
        expect(runtime.synthesize).not.toHaveBeenCalled();
    });

    it("returns the existing pending claim without starting concurrent provider work", async () => {
        const artifact = createArtifact({ lifecycleState: "requested" });
        const runtime = createRuntime(vi.fn());
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput: async () => createInput(),
            repository: createRepository({ outcome: "replayed", artifact }),
            runtime,
        });

        expect(result).toEqual({ status: "coach_update_pending", artifact });
        expect(runtime.synthesize).not.toHaveBeenCalled();
    });

    it("rejects generated content when the durable source fingerprint changes before completion", async () => {
        const failArtifact = vi.fn(async () => createArtifact({ lifecycleState: "rejected" }));
        const completeArtifact = vi.fn();
        const loadInput = vi.fn()
            .mockResolvedValueOnce(createInput())
            .mockResolvedValueOnce(createInput({ synthesisInputFingerprint: "input-changed" }));
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput,
            repository: {
                ...createRepository(),
                failArtifact,
                completeArtifact,
            },
            runtime: createRuntime(),
        });

        expect(result).toEqual({ status: "coach_update_unavailable", reason: "stale_source" });
        expect(failArtifact).toHaveBeenCalledWith(expect.objectContaining({
            lifecycleState: "rejected",
            errorCode: "STALE_COACH_UPDATE_SOURCE",
        }));
        expect(completeArtifact).not.toHaveBeenCalled();
    });

    it("leaves completion callers with an unavailable result when source evidence is incomplete", async () => {
        const repository = createRepository();
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput: async () => null,
            repository,
        });

        expect(result).toEqual({ status: "coach_update_unavailable", reason: "source_not_ready" });
        expect(repository.claimArtifact).not.toHaveBeenCalled();
    });

    it("records a retryable timeout as a failed artifact attempt without weakening session completion", async () => {
        const failArtifact = vi.fn(async () => createArtifact({ lifecycleState: "failed" }));
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput: async () => createInput(),
            repository: {
                ...createRepository(),
                failArtifact,
            },
            runtime: createRuntime(vi.fn(async () => {
                throw new CandidateCoachUpdateRuntimeError("timeout");
            })),
        });

        expect(result).toEqual({ status: "coach_update_unavailable", reason: "generation_failed" });
        expect(failArtifact).toHaveBeenCalledWith(expect.objectContaining({
            lifecycleState: "failed",
            errorCode: "COACH_UPDATE_PROVIDER_TIMEOUT",
            validation: expect.objectContaining({
                disposition: "failed",
                retryable: true,
                transportAttemptCount: 1,
                rawOutputStored: false,
            }),
        }));
    });

    it("records malformed provider output as rejected and allows a later artifact attempt to repair it", async () => {
        const failArtifact = vi.fn(async () => createArtifact({ lifecycleState: "rejected" }));
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput: async () => createInput(),
            repository: {
                ...createRepository(),
                failArtifact,
            },
            runtime: createRuntime(vi.fn(async () => {
                throw new CandidateCoachUpdateRuntimeError("invalid_schema");
            })),
        });

        expect(result).toEqual({ status: "coach_update_unavailable", reason: "invalid_content" });
        expect(failArtifact).toHaveBeenCalledWith(expect.objectContaining({
            lifecycleState: "rejected",
            errorCode: "COACH_UPDATE_PROVIDER_INVALID_SCHEMA",
            validation: expect.objectContaining({ retryable: true }),
        }));
    });

    it("claims and completes the artifact with the exact runtime version metadata", async () => {
        const repository = createRepository();
        const runtime = createRuntime();
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput: async () => createInput(),
            repository,
            runtime,
        });

        expect(result.status).toBe("coach_update_completed");
        expect(repository.claimArtifact).toHaveBeenCalledWith(expect.objectContaining(runtime.metadata));
        expect(repository.completeArtifact).toHaveBeenCalledWith(expect.objectContaining({
            validation: expect.objectContaining({
                disposition: "accepted",
                provider: runtime.metadata.provider,
                providerRequestVersion: "candidate_coach_update_provider_request_v1",
                rawOutputStored: false,
                promptStored: false,
            }),
        }));
    });
});

function createInput(overrides: Partial<CandidateCoachUpdateSynthesisInput> = {}): CandidateCoachUpdateSynthesisInput {
    return {
        status: "candidate_coach_update_synthesis_input_v1",
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        sourceCandidatePracticeSessionId: "session-1",
        targetRole: "Material Handler",
        completedAt: "2026-07-15T12:05:00.000Z",
        questionCount: 0,
        answeredCount: 0,
        sourceCompletionFingerprint: "completion-1",
        synthesisInputFingerprint: "input-1",
        questions: [{
            questionKey: "slot-1",
            questionNumber: 1,
            category: "Screening",
            questionText: "What interests you about this role?",
            answerAttempt: { candidateAnswerAttemptId: "attempt-1" },
            acceptedEvaluationRun: { candidateAnswerEvaluationRunId: "run-1" },
            acceptedAnalysis: {},
            source: { candidatePracticeSessionId: "session-1", questionKey: "slot-1" },
            priorComparableAttempts: [],
        } as unknown as CandidateCoachUpdateSynthesisInput["questions"][number]],
        ...overrides,
    };
}

function createValidContent() {
    return {
        status: "candidate_coach_update_content_v1" as const,
        targetRole: "Material Handler",
        title: "Material Handler practice update",
        summary: "I reviewed your practiced answer.",
        primaryFocus: "Add one concrete result.",
        questions: [{
            questionKey: "slot-1",
            questionNumber: 1,
            category: "Screening",
            questionText: "What interests you about this role?",
            answer: {
                candidateAnswerAttemptId: "attempt-1",
                mode: "text" as const,
                text: "I like keeping materials organized.",
                submittedAt: "2026-07-15T12:01:00.000Z",
            },
            coaching: {
                acknowledgement: "You gave me a direct starting point.",
                observation: "Your answer connects to the role.",
                nextPracticeFocus: "Add one concrete result.",
                overallBand: "clear" as const,
            },
            comparison: {
                kind: "first_practice" as const,
                priorComparableAttemptCount: 0,
                message: "This is the first accepted practice evidence for this question.",
            },
            source: {
                candidatePracticeSessionId: "session-1",
                questionKey: "slot-1",
            },
        }],
    };
}

function createRuntime(
    synthesize = vi.fn(async () => ({
        content: createValidContent(),
        validation: {
            providerRequestVersion: "candidate_coach_update_provider_request_v1" as const,
            providerOutputVersion: "candidate_coach_update_provider_output_v1" as const,
            timeoutMs: 12_000,
            transportAttemptCount: 1 as const,
            latencyMs: 10,
            tokenUsage: { inputTokens: 20, outputTokens: 10 },
            rawOutputStored: false as const,
            promptStored: false as const,
        },
    })),
): CandidateCoachUpdateSynthesisRuntime {
    return {
        metadata: {
            provider: "test_provider",
            modelName: "test_model",
            promptVersion: "test_prompt_v1",
            evaluatorVersion: "evidence_first_v1",
        },
        timeoutMs: 12_000,
        synthesize,
    };
}

function createArtifact({ lifecycleState = "requested" }: {
    lifecycleState?: CandidateCoachUpdateArtifactRecord["lifecycleState"];
} = {}): CandidateCoachUpdateArtifactRecord {
    const completed = lifecycleState === "completed";
    const terminalFailure = lifecycleState === "failed" || lifecycleState === "rejected";
    return {
        candidateCoachUpdateArtifactId: "artifact-1",
        candidateProfileId: "candidate-1",
        roleProfileId: "10000000-0000-4000-8000-000000000001",
        sourceCandidatePracticeSessionId: "session-1",
        sourceCompletionFingerprint: "completion-1",
        sourceAnswerAttemptIds: [],
        acceptedEvaluationRunIds: [],
        synthesisInputFingerprint: "input-1",
        provider: "candidate_v2_coach_update_synthesizer",
        modelName: "deterministic_local_fixture",
        promptVersion: "coach_update_fixture_v1",
        evaluatorVersion: "evidence_first_v1",
        generationAttempt: 1,
        lifecycleState,
        candidateSafeContent: completed ? {
            status: "candidate_coach_update_content_v1",
            targetRole: "Material Handler",
            title: "Material Handler practice update",
            summary: "I reviewed this round.",
            primaryFocus: "Keep practicing.",
            questions: [],
        } : null,
        validation: completed ? { disposition: "accepted" } : null,
        errorCode: terminalFailure ? "TEST_FAILURE" : null,
        requestedAt: "2026-07-15T12:05:01.000Z",
        completedAt: lifecycleState === "requested" ? null : "2026-07-15T12:05:02.000Z",
        createdAt: "2026-07-15T12:05:01.000Z",
        updatedAt: "2026-07-15T12:05:02.000Z",
    };
}

function createRepository(claim: {
    outcome: "created" | "replayed";
    artifact: CandidateCoachUpdateArtifactRecord;
} = { outcome: "created", artifact: createArtifact() }) {
    return {
        claimArtifact: vi.fn(async () => claim),
        completeArtifact: vi.fn(async () => createArtifact({ lifecycleState: "completed" })),
        failArtifact: vi.fn(async () => createArtifact({ lifecycleState: "failed" })),
    };
}
