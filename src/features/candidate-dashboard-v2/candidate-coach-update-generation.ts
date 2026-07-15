import {
    candidateCoachUpdateFixtureMetadata,
    createFixtureCandidateCoachUpdateContent,
    validateCandidateCoachUpdateContent,
    type CandidateCoachUpdateArtifactRecord,
    type CandidateCoachUpdateContent,
    type CandidateCoachUpdateSynthesisInput,
} from "./candidate-coach-update-artifact";
import type {
    CandidateCoachUpdateArtifactWriteResult,
    ClaimCandidateCoachUpdateArtifactInput,
} from "./candidate-coach-update-artifact-repository";

type CandidateCoachUpdateGenerationRepository = {
    claimArtifact: (input: ClaimCandidateCoachUpdateArtifactInput) => Promise<CandidateCoachUpdateArtifactWriteResult | null>;
    completeArtifact: (input: {
        candidateCoachUpdateArtifactId: string;
        candidateProfileId: string;
        sourceCandidatePracticeSessionId: string;
        sourceCompletionFingerprint: string;
        synthesisInputFingerprint: string;
        candidateSafeContent: CandidateCoachUpdateContent;
        validation: Record<string, unknown>;
        completedAt: string;
    }) => Promise<CandidateCoachUpdateArtifactRecord | null>;
    failArtifact: (input: {
        candidateCoachUpdateArtifactId: string;
        candidateProfileId: string;
        lifecycleState: "failed" | "rejected";
        errorCode: string;
        validation?: Record<string, unknown> | null;
        completedAt: string;
    }) => Promise<CandidateCoachUpdateArtifactRecord | null>;
};

export type CandidateCoachUpdateGenerationResult =
    | { status: "coach_update_completed"; artifact: CandidateCoachUpdateArtifactRecord }
    | { status: "coach_update_pending"; artifact: CandidateCoachUpdateArtifactRecord }
    | { status: "coach_update_unavailable"; reason: "source_not_ready" | "claim_rejected" | "stale_source" | "invalid_content" | "generation_failed" };

export async function ensureCandidateCoachUpdateArtifact({
    candidateProfileId,
    sourceCandidatePracticeSessionId,
    loadInput,
    repository,
    requestCoachUpdate = async (input) => createFixtureCandidateCoachUpdateContent(input),
    now = new Date(),
}: {
    candidateProfileId: string;
    sourceCandidatePracticeSessionId: string;
    loadInput: () => Promise<CandidateCoachUpdateSynthesisInput | null>;
    repository: CandidateCoachUpdateGenerationRepository;
    requestCoachUpdate?: (input: CandidateCoachUpdateSynthesisInput) => Promise<CandidateCoachUpdateContent>;
    now?: Date;
}): Promise<CandidateCoachUpdateGenerationResult> {
    const input = await loadInput();
    if (
        !input
        || input.candidateProfileId !== candidateProfileId
        || input.sourceCandidatePracticeSessionId !== sourceCandidatePracticeSessionId
    ) {
        return { status: "coach_update_unavailable", reason: "source_not_ready" };
    }

    const claim = await repository.claimArtifact({
        candidateProfileId,
        roleProfileId: input.roleProfileId,
        sourceCandidatePracticeSessionId,
        sourceCompletionFingerprint: input.sourceCompletionFingerprint,
        sourceAnswerAttemptIds: input.questions.map((question) => question.answerAttempt.candidateAnswerAttemptId),
        acceptedEvaluationRunIds: input.questions.map((question) => question.acceptedEvaluationRun.candidateAnswerEvaluationRunId),
        synthesisInputFingerprint: input.synthesisInputFingerprint,
        ...candidateCoachUpdateFixtureMetadata,
        requestedAt: now.toISOString(),
        staleRequestedBefore: new Date(now.getTime() - 120_000).toISOString(),
    });
    if (!claim) {
        return { status: "coach_update_unavailable", reason: "claim_rejected" };
    }
    if (claim.artifact.lifecycleState === "completed") {
        return { status: "coach_update_completed", artifact: claim.artifact };
    }
    if (claim.outcome === "replayed") {
        return { status: "coach_update_pending", artifact: claim.artifact };
    }

    let content: CandidateCoachUpdateContent;
    try {
        content = await requestCoachUpdate(input);
    } catch {
        await repository.failArtifact({
            candidateCoachUpdateArtifactId: claim.artifact.candidateCoachUpdateArtifactId,
            candidateProfileId,
            lifecycleState: "failed",
            errorCode: "COACH_UPDATE_GENERATION_FAILED",
            completedAt: now.toISOString(),
        }).catch(() => undefined);
        return { status: "coach_update_unavailable", reason: "generation_failed" };
    }

    if (!validateCandidateCoachUpdateContent({ input, content })) {
        await repository.failArtifact({
            candidateCoachUpdateArtifactId: claim.artifact.candidateCoachUpdateArtifactId,
            candidateProfileId,
            lifecycleState: "rejected",
            errorCode: "INVALID_COACH_UPDATE_CONTENT",
            validation: { disposition: "rejected", synthesisInputFingerprint: input.synthesisInputFingerprint },
            completedAt: now.toISOString(),
        }).catch(() => undefined);
        return { status: "coach_update_unavailable", reason: "invalid_content" };
    }

    const currentInput = await loadInput();
    if (
        !currentInput
        || currentInput.sourceCompletionFingerprint !== input.sourceCompletionFingerprint
        || currentInput.synthesisInputFingerprint !== input.synthesisInputFingerprint
    ) {
        await repository.failArtifact({
            candidateCoachUpdateArtifactId: claim.artifact.candidateCoachUpdateArtifactId,
            candidateProfileId,
            lifecycleState: "rejected",
            errorCode: "STALE_COACH_UPDATE_SOURCE",
            validation: {
                disposition: "rejected",
                expectedSourceCompletionFingerprint: input.sourceCompletionFingerprint,
                expectedSynthesisInputFingerprint: input.synthesisInputFingerprint,
            },
            completedAt: now.toISOString(),
        }).catch(() => undefined);
        return { status: "coach_update_unavailable", reason: "stale_source" };
    }

    const artifact = await repository.completeArtifact({
        candidateCoachUpdateArtifactId: claim.artifact.candidateCoachUpdateArtifactId,
        candidateProfileId,
        sourceCandidatePracticeSessionId,
        sourceCompletionFingerprint: input.sourceCompletionFingerprint,
        synthesisInputFingerprint: input.synthesisInputFingerprint,
        candidateSafeContent: content,
        validation: {
            disposition: "accepted",
            sourceCompletionFingerprint: input.sourceCompletionFingerprint,
            synthesisInputFingerprint: input.synthesisInputFingerprint,
            practicedQuestionCount: input.questions.length,
            skippedQuestionCount: input.questionCount - input.questions.length,
        },
        completedAt: now.toISOString(),
    });
    return artifact
        ? { status: "coach_update_completed", artifact }
        : { status: "coach_update_unavailable", reason: "claim_rejected" };
}
