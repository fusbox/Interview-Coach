import { describe, expect, it, vi } from "vitest";

import type {
    CandidateCoachUpdateArtifactRecord,
    CandidateCoachUpdateSynthesisInput,
} from "./candidate-coach-update-artifact";
import { ensureCandidateCoachUpdateArtifact } from "./candidate-coach-update-generation";

describe("candidate Coach Update generation", () => {
    it("replays a completed same-input artifact without calling the synthesizer", async () => {
        const artifact = createArtifact({ lifecycleState: "completed" });
        const requestCoachUpdate = vi.fn();
        const result = await ensureCandidateCoachUpdateArtifact({
            candidateProfileId: "candidate-1",
            sourceCandidatePracticeSessionId: "session-1",
            loadInput: async () => createInput(),
            repository: createRepository({ outcome: "replayed", artifact }),
            requestCoachUpdate,
        });

        expect(result).toEqual({ status: "coach_update_completed", artifact });
        expect(requestCoachUpdate).not.toHaveBeenCalled();
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
            requestCoachUpdate: async () => createValidContent(),
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
