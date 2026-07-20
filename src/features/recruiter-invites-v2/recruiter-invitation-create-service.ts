import { randomUUID } from "node:crypto";

import {
    createCandidateQuestionWordingRequest,
    type CandidateQuestionWordingResult,
} from "@/features/candidate-session-v2/candidate-question-wording";
import {
    CandidateQuestionWordingRuntimeError,
    type CandidateQuestionWordingRuntime,
} from "@/features/candidate-session-v2/candidate-question-wording-runtime";
import {
    hashRecruiterInvitationActionKey,
    prepareRecruiterQuestionSetRequest,
    type RecruiterCreateInvitationsRequest,
    type RecruiterPrepareQuestionsRequest,
} from "./recruiter-invitation-create-contract";
import type {
    RecruiterInvitationQuestionSetRecord,
    RecruiterInvitationQuestionSetRepository,
} from "./recruiter-invitation-question-set-repository";
import {
    createRecruiterInvitationAggregate,
    type RecruiterInvitationConflictError,
} from "./recruiter-invitation-service";
import type { RecruiterInvitationRepository } from "./recruiter-invitation-repository";
import type { InvitedPracticeTokenVault } from "./invited-practice-token-vault";

const QUESTION_SET_TTL_MS = 24 * 60 * 60 * 1_000;
const QUESTION_SET_COMPLETION_ATTEMPTS = 3;

export class RecruiterQuestionSetConflictError extends Error {
    constructor() {
        super("This question action key was already used with different content.");
        this.name = "RecruiterQuestionSetConflictError";
    }
}

export class RecruiterQuestionSetInProgressError extends Error {
    constructor() {
        super("This question set is still being prepared.");
        this.name = "RecruiterQuestionSetInProgressError";
    }
}

export class RecruiterQuestionSetFailedError extends Error {
    constructor() {
        super("This question preparation could not be completed. Start over to try again.");
        this.name = "RecruiterQuestionSetFailedError";
    }
}

export class RecruiterQuestionSetUnavailableError extends Error {
    constructor() {
        super("The prepared question set is unavailable.");
        this.name = "RecruiterQuestionSetUnavailableError";
    }
}

export class RecruiterQuestionSetUnauthorizedError extends Error {
    constructor() {
        super("Active recruiter authorization is required.");
        this.name = "RecruiterQuestionSetUnauthorizedError";
    }
}

export class RecruiterQuestionSetPersistenceError extends Error {
    constructor() {
        super("The accepted question set could not be saved.");
        this.name = "RecruiterQuestionSetPersistenceError";
    }
}

export type PrepareRecruiterInvitationQuestionsResult = {
    outcome: "created" | "replayed";
    questionSet: RecruiterInvitationQuestionSetRecord & {
        lifecycleState: "ready";
        questionWordingSnapshot: CandidateQuestionWordingResult;
    };
};

export async function prepareRecruiterInvitationQuestions(
    recruiterId: string,
    request: RecruiterPrepareQuestionsRequest,
    dependencies: {
        repository: RecruiterInvitationQuestionSetRepository;
        wordingRuntime: CandidateQuestionWordingRuntime | null;
        now?: Date;
        createId?: () => string;
        completionAttempts?: number;
    },
): Promise<PrepareRecruiterInvitationQuestionsResult> {
    const now = dependencies.now ?? new Date();
    const prepared = prepareRecruiterQuestionSetRequest(request);
    const questionSetId = (dependencies.createId ?? randomUUID)();
    const claim = await dependencies.repository.claim({
        questionSetId,
        recruiterId,
        actionKeyHash: prepared.actionKeyHash,
        requestFingerprint: prepared.requestFingerprint,
        source: prepared.source,
        targetRole: prepared.targetRole,
        jobDescription: prepared.jobDescription,
        interviewStage: prepared.interviewStage,
        questionPlanSnapshot: prepared.questionPlanSnapshot,
        expiresAt: new Date(now.getTime() + QUESTION_SET_TTL_MS).toISOString(),
    });

    if (claim.outcome === "unauthorized") throw new RecruiterQuestionSetUnauthorizedError();
    if (claim.outcome === "conflict") throw new RecruiterQuestionSetConflictError();
    if (claim.outcome === "in_progress") throw new RecruiterQuestionSetInProgressError();
    if (claim.outcome === "failed") throw new RecruiterQuestionSetFailedError();
    if (claim.outcome === "replayed") {
        const replayed = requireReadyQuestionSet(claim.questionSet);
        return { outcome: "replayed", questionSet: replayed };
    }

    const claimed = claim.questionSet;
    if (!claimed) throw new RecruiterQuestionSetPersistenceError();

    let questionWordingSnapshot: CandidateQuestionWordingResult;
    if (prepared.source === "manual") {
        questionWordingSnapshot = prepared.manualQuestionWordingSnapshot!;
    } else {
        if (!dependencies.wordingRuntime) {
            await failClaimSafely(dependencies.repository, claimed, now, "PROVIDER_NOT_CONFIGURED");
            throw new RecruiterQuestionSetFailedError();
        }
        try {
            questionWordingSnapshot = await dependencies.wordingRuntime.wordQuestions(
                createCandidateQuestionWordingRequest({
                    setupSnapshot: {
                        targetRole: prepared.targetRole,
                        jobDescription: prepared.jobDescription,
                        resumeText: null,
                        interviewStage: prepared.interviewStage,
                        questionCount: prepared.questionPlanSnapshot.questionCount,
                        resumeCaptureMode: "none",
                        createdAt: now.toISOString(),
                    },
                    questionPlanSnapshot: prepared.questionPlanSnapshot,
                    now,
                }),
            );
        } catch (error) {
            await failClaimSafely(
                dependencies.repository,
                claimed,
                now,
                error instanceof CandidateQuestionWordingRuntimeError
                    ? error.errorCode
                    : "QUESTION_WORDING_FAILED",
            );
            throw error;
        }
    }

    const completed = await completeWithBoundedRetry({
        repository: dependencies.repository,
        claimed,
        questionWordingSnapshot,
        acceptedAt: now.toISOString(),
        attempts: dependencies.completionAttempts ?? QUESTION_SET_COMPLETION_ATTEMPTS,
    });
    return { outcome: "created", questionSet: requireReadyQuestionSet(completed) };
}

export async function createRecruiterInvitationsFromQuestionSet(
    recruiterId: string,
    request: RecruiterCreateInvitationsRequest,
    dependencies: {
        questionSetRepository: RecruiterInvitationQuestionSetRepository;
        invitationRepository: RecruiterInvitationRepository;
        tokenVault: InvitedPracticeTokenVault;
        tokenTtlSeconds: number;
        now?: Date;
        createId?: () => string;
    },
) {
    const questionSet = await dependencies.questionSetRepository.findOwnedReady({
        questionSetId: request.questionSetId,
        recruiterId,
        actionKeyHash: hashRecruiterInvitationActionKey(request.actionKey),
    });
    const readyQuestionSet = requireReadyQuestionSet(questionSet);

    return createRecruiterInvitationAggregate({
        recruiterId,
        idempotencyKey: request.actionKey,
        targetRole: readyQuestionSet.targetRole,
        jobDescription: readyQuestionSet.jobDescription,
        interviewStage: readyQuestionSet.interviewStage,
        questionPlanSnapshot: readyQuestionSet.questionPlanSnapshot,
        questionWordingSnapshot: readyQuestionSet.questionWordingSnapshot,
        recipients: request.recipients,
        tokenTtlSeconds: dependencies.tokenTtlSeconds,
    }, {
        repository: dependencies.invitationRepository,
        tokenVault: dependencies.tokenVault,
        sourceQuestionSetId: readyQuestionSet.questionSetId,
        now: dependencies.now,
        createId: dependencies.createId,
    });
}

async function completeWithBoundedRetry(input: {
    repository: RecruiterInvitationQuestionSetRepository;
    claimed: RecruiterInvitationQuestionSetRecord;
    questionWordingSnapshot: CandidateQuestionWordingResult;
    acceptedAt: string;
    attempts: number;
}) {
    let lastError: unknown;
    const attempts = Math.max(1, Math.min(input.attempts, 5));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
            const completed = await input.repository.complete({
                questionSetId: input.claimed.questionSetId,
                recruiterId: input.claimed.recruiterId,
                actionKeyHash: input.claimed.actionKeyHash,
                requestFingerprint: input.claimed.requestFingerprint,
                questionWordingSnapshot: input.questionWordingSnapshot,
                acceptedAt: input.acceptedAt,
            });
            if (completed) return completed;
        } catch (error) {
            lastError = error;
        }
    }
    if (lastError) {
        throw new RecruiterQuestionSetPersistenceError();
    }
    throw new RecruiterQuestionSetPersistenceError();
}

async function failClaimSafely(
    repository: RecruiterInvitationQuestionSetRepository,
    claim: RecruiterInvitationQuestionSetRecord,
    now: Date,
    failureCode: string,
) {
    try {
        await repository.fail({
            questionSetId: claim.questionSetId,
            recruiterId: claim.recruiterId,
            actionKeyHash: claim.actionKeyHash,
            requestFingerprint: claim.requestFingerprint,
            failedAt: now.toISOString(),
            failureCode,
        });
    } catch {
        // A failed provider result remains non-usable even if failure telemetry cannot be persisted.
    }
}

function requireReadyQuestionSet(
    questionSet: RecruiterInvitationQuestionSetRecord | null,
): PrepareRecruiterInvitationQuestionsResult["questionSet"] {
    if (
        !questionSet
        || questionSet.lifecycleState !== "ready"
        || !questionSet.questionWordingSnapshot
    ) {
        throw new RecruiterQuestionSetUnavailableError();
    }
    return {
        ...questionSet,
        lifecycleState: "ready",
        questionWordingSnapshot: questionSet.questionWordingSnapshot,
    };
}

export type RecruiterInvitationCreateServiceError =
    | RecruiterQuestionSetConflictError
    | RecruiterQuestionSetInProgressError
    | RecruiterQuestionSetFailedError
    | RecruiterQuestionSetUnavailableError
    | RecruiterQuestionSetUnauthorizedError
    | RecruiterQuestionSetPersistenceError
    | RecruiterInvitationConflictError;
