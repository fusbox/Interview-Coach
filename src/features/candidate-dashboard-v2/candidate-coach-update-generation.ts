import {
    validateCandidateCoachUpdateContent,
    type CandidateCoachUpdateArtifactRecord,
    type CandidateCoachUpdateContent,
    type CandidateCoachUpdateSynthesisInput,
} from "./candidate-coach-update-artifact";
import type {
    CandidateCoachUpdateArtifactWriteResult,
    ClaimCandidateCoachUpdateArtifactInput,
} from "./candidate-coach-update-artifact-repository";
import { CANDIDATE_COACH_UPDATE_CLAIM_LEASE_MS } from "./candidate-coach-update-lifecycle";
import {
    CandidateCoachUpdateRuntimeError,
    createFixtureCandidateCoachUpdateRuntime,
    type CandidateCoachUpdateSynthesisRuntime,
} from "./candidate-coach-update-runtime";

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
    runtime = createFixtureCandidateCoachUpdateRuntime(),
    now = new Date(),
}: {
    candidateProfileId: string;
    sourceCandidatePracticeSessionId: string;
    loadInput: () => Promise<CandidateCoachUpdateSynthesisInput | null>;
    repository: CandidateCoachUpdateGenerationRepository;
    runtime?: CandidateCoachUpdateSynthesisRuntime;
    now?: Date;
}): Promise<CandidateCoachUpdateGenerationResult> {
    const input = await loadInput();
    if (
        !input
        || input.candidateProfileId !== candidateProfileId
        || input.sourceCandidatePracticeSessionId !== sourceCandidatePracticeSessionId
        || input.questions.length !== 1
    ) {
        return { status: "coach_update_unavailable", reason: "source_not_ready" };
    }

    const claim = await repository.claimArtifact({
        candidateProfileId,
        roleProfileId: input.roleProfileId,
        sourceCandidatePracticeSessionId,
        sourceQuestionKey: input.questions[0].questionKey,
        sourceAnswerAttemptId: input.questions[0].answerAttempt.candidateAnswerAttemptId,
        sourceAcceptedEvaluationRunId: input.questions[0].acceptedEvaluationRun.candidateAnswerEvaluationRunId,
        sourceCompletionFingerprint: input.sourceCompletionFingerprint,
        sourceAnswerAttemptIds: input.questions.map((question) => question.answerAttempt.candidateAnswerAttemptId),
        acceptedEvaluationRunIds: input.questions.map((question) => question.acceptedEvaluationRun.candidateAnswerEvaluationRunId),
        synthesisInputFingerprint: input.synthesisInputFingerprint,
        ...runtime.metadata,
        requestedAt: now.toISOString(),
        staleRequestedBefore: new Date(now.getTime() - CANDIDATE_COACH_UPDATE_CLAIM_LEASE_MS).toISOString(),
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

    let synthesis: Awaited<ReturnType<CandidateCoachUpdateSynthesisRuntime["synthesize"]>>;
    try {
        synthesis = await runtime.synthesize(input);
    } catch (error) {
        const runtimeError = error instanceof CandidateCoachUpdateRuntimeError ? error : null;
        const lifecycleState = runtimeError?.lifecycleState ?? "failed";
        const errorCode = runtimeError?.errorCode ?? "COACH_UPDATE_GENERATION_FAILED";
        await repository.failArtifact({
            candidateCoachUpdateArtifactId: claim.artifact.candidateCoachUpdateArtifactId,
            candidateProfileId,
            lifecycleState,
            errorCode,
            validation: {
                disposition: lifecycleState,
                retryable: runtimeError?.retryable ?? true,
                synthesisInputFingerprint: input.synthesisInputFingerprint,
                provider: runtime.metadata.provider,
                modelName: runtime.metadata.modelName,
                promptVersion: runtime.metadata.promptVersion,
                evaluatorVersion: runtime.metadata.evaluatorVersion,
                profileId: runtime.metadata.profileId,
                configurationFingerprint: runtime.metadata.configurationFingerprint,
                timeoutMs: runtime.timeoutMs,
                transportAttemptCount: 1,
                rawOutputStored: false,
                promptStored: false,
            },
            completedAt: now.toISOString(),
        }).catch(() => undefined);
        return {
            status: "coach_update_unavailable",
            reason: lifecycleState === "rejected" ? "invalid_content" : "generation_failed",
        };
    }

    if (!validateCandidateCoachUpdateContent({ input, content: synthesis.content })) {
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
        candidateSafeContent: synthesis.content,
        validation: {
            disposition: "accepted",
            sourceCompletionFingerprint: input.sourceCompletionFingerprint,
            synthesisInputFingerprint: input.synthesisInputFingerprint,
            practicedQuestionCount: input.questions.length,
            skippedQuestionCount: input.questionCount - input.questions.length,
            provider: runtime.metadata.provider,
            modelName: runtime.metadata.modelName,
            promptVersion: runtime.metadata.promptVersion,
            evaluatorVersion: runtime.metadata.evaluatorVersion,
            profileId: runtime.metadata.profileId,
            configurationFingerprint: runtime.metadata.configurationFingerprint,
            ...synthesis.validation,
        },
        completedAt: now.toISOString(),
    });
    return artifact
        ? { status: "coach_update_completed", artifact }
        : { status: "coach_update_unavailable", reason: "claim_rejected" };
}
