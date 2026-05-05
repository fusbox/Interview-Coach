import { randomBytes } from "crypto";
import { uuidv7 } from "uuidv7";
import type { InviteRepository } from "@/lib/domain/invite";
import { createInviteBatch, type CreateInviteBatchDependencies } from "./create-invite-batch";
import type {
    PersistedInviteBatch,
    RetryInviteBatchResult,
    CreateInviteBatchCandidateInput
} from "./types";
import { createInviteRepository } from "@/lib/server/infrastructure/invite-repository";

export class InviteBatchRetryNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InviteBatchRetryNotFoundError";
    }
}

export class InviteBatchRetryValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InviteBatchRetryValidationError";
    }
}

type RetryInviteBatchRepository = InviteRepository & {
    createTrackedBatch: NonNullable<CreateInviteBatchDependencies["repository"]>["createTrackedBatch"];
    markTrackedBatchCompleted: NonNullable<CreateInviteBatchDependencies["repository"]>["markTrackedBatchCompleted"];
    markTrackedBatchFailed: NonNullable<CreateInviteBatchDependencies["repository"]>["markTrackedBatchFailed"];
    getTrackedBatch(batchId: string, actorId: string): Promise<PersistedInviteBatch | null>;
    markTrackedBatchRetried(batchId: string, childBatchId: string): Promise<void>;
};

export type RetryInviteBatchDependencies = {
    repository?: RetryInviteBatchRepository;
    createSessionId?: () => string;
    createToken?: () => string;
};

function toRetryCandidate(candidate: PersistedInviteBatch["candidates"][number]): CreateInviteBatchCandidateInput {
    return {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        reqId: candidate.reqId,
        resumeText: candidate.resumeText
    };
}

export async function retryInviteBatch(
    batchId: string,
    actorId: string,
    appBaseUrl: string,
    dependencies: RetryInviteBatchDependencies = {}
): Promise<RetryInviteBatchResult> {
    const repository =
        dependencies.repository ??
        await createInviteRepository();
    const createSessionId = dependencies.createSessionId ?? (() => uuidv7());
    const createToken = dependencies.createToken ?? (() => randomBytes(16).toString("hex"));

    const sourceBatch = await repository.getTrackedBatch(batchId, actorId);
    if (!sourceBatch) {
        throw new InviteBatchRetryNotFoundError("Invite batch not found");
    }

    const retryableCandidates = sourceBatch.candidates.filter(
        candidate => candidate.status === "failed" && candidate.retryable
    );

    if (retryableCandidates.length === 0) {
        throw new InviteBatchRetryValidationError("No retryable failed candidates remain for this batch");
    }

    const result = await createInviteBatch(
        {
            role: sourceBatch.role,
            jobDescription: sourceBatch.jobDescription,
            candidates: retryableCandidates.map(toRetryCandidate),
            questions: sourceBatch.questions,
            createdBy: actorId,
            appBaseUrl,
            parentBatchId: batchId
        },
        {
            repository,
            createSessionId,
            createToken
        }
    );

    await repository.markTrackedBatchRetried(batchId, result.batchId);
    return result;
}
