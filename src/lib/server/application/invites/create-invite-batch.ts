import { randomBytes } from "crypto";
import { uuidv7 } from "uuidv7";
import { Invite, InviteRepository } from "@/lib/domain/invite";
import {
    CreateInviteBatchInput,
    CreateInviteBatchResult,
    InviteBatchFailure,
    InviteBatchSuccess,
} from "@/lib/server/application/invites/types";
import type { PersistedInviteBatch } from "@/lib/server/application/invites/types";
import { createInviteRepository } from "@/lib/server/infrastructure/invite-repository";

export type CreateInviteBatchDependencies = {
    repository?: InviteRepository & {
        createTrackedBatch(input: CreateInviteBatchInput, invites: Invite[]): Promise<string>;
        markTrackedBatchCompleted(batchId: string, invites: Invite[]): Promise<void>;
        markTrackedBatchFailed(batchId: string, failures: InviteBatchFailure[]): Promise<void>;
        getTrackedBatch(batchId: string, actorId: string): Promise<PersistedInviteBatch | null>;
        markTrackedBatchRetried(batchId: string, childBatchId: string): Promise<void>;
    };
    createSessionId?: () => string;
    createToken?: () => string;
};

function toInvite(params: {
    sessionId: string;
    token: string;
    input: CreateInviteBatchInput;
    candidate: CreateInviteBatchInput["candidates"][number];
}): Invite {
    return {
        id: params.sessionId,
        token: params.token,
        role: params.input.role,
        jobDescription: params.input.jobDescription,
        candidate: params.candidate,
        questions: params.input.questions,
        createdBy: params.input.createdBy,
        createdAt: Date.now(),
    };
}

function toFailure(candidate: CreateInviteBatchInput["candidates"][number], error: unknown): InviteBatchFailure {
    return {
        status: "failed",
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        code: "INVITE_CREATE_FAILED",
        message: error instanceof Error ? error.message : "Failed to create invite.",
        retryable: true,
    };
}

export async function createInviteBatch(
    input: CreateInviteBatchInput,
    dependencies: CreateInviteBatchDependencies = {}
): Promise<CreateInviteBatchResult> {
    const repository = dependencies.repository ?? await createInviteRepository();
    const createSessionId = dependencies.createSessionId ?? (() => uuidv7());
    const createToken = dependencies.createToken ?? (() => randomBytes(16).toString("hex"));
    const invites = input.candidates.map((candidate) => {
        const sessionId = createSessionId();
        const token = createToken();
        return toInvite({
            sessionId,
            token,
            input,
            candidate,
        });
    });
    const batchId = await repository.createTrackedBatch(input, invites);

    try {
        await repository.createBatch(invites);
    } catch (error) {
        const failures = input.candidates.map((candidate) => toFailure(candidate, error));
        await repository.markTrackedBatchFailed(batchId, failures);
        return {
            batchId,
            retriedFromBatchId: input.parentBatchId,
            results: [],
            failures,
            summary: {
                requested: input.candidates.length,
                succeeded: 0,
                failed: failures.length,
                hasFailures: failures.length > 0,
            },
        };
    }

    await repository.markTrackedBatchCompleted(batchId, invites);

    const results: InviteBatchSuccess[] = invites.map((invite) => ({
        status: "created",
        id: invite.id,
        firstName: invite.candidate.firstName,
        lastName: invite.candidate.lastName,
        email: invite.candidate.email,
        link: `${input.appBaseUrl}/s/${invite.token}`,
    }));

    return {
        batchId,
        retriedFromBatchId: input.parentBatchId,
        results,
        failures: [],
        summary: {
            requested: input.candidates.length,
            succeeded: results.length,
            failed: 0,
            hasFailures: false,
        },
    };
}
