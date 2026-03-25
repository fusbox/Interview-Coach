import { randomBytes } from "crypto";
import { uuidv7 } from "uuidv7";
import { Invite, InviteRepository } from "@/lib/domain/invite";
import {
    CreateInviteBatchInput,
    CreateInviteBatchResult,
    InviteBatchFailure,
    InviteBatchSuccess,
} from "@/lib/server/application/invites/types";

export type CreateInviteBatchDependencies = {
    repository?: InviteRepository;
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
    const repository = dependencies.repository ?? new (await import("@/lib/server/infrastructure/supabase-invite-repository")).SupabaseInviteRepository();
    const createSessionId = dependencies.createSessionId ?? (() => uuidv7());
    const createToken = dependencies.createToken ?? (() => randomBytes(16).toString("hex"));
    const results: InviteBatchSuccess[] = [];
    const failures: InviteBatchFailure[] = [];

    for (const candidate of input.candidates) {
        const sessionId = createSessionId();
        const token = createToken();
        const invite = toInvite({
            sessionId,
            token,
            input,
            candidate,
        });

        try {
            await repository.create(invite);
            results.push({
                status: "created",
                id: sessionId,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                email: candidate.email,
                link: `${input.appBaseUrl}/s/${token}`,
            });
        } catch (error) {
            failures.push(toFailure(candidate, error));
        }
    }

    return {
        results,
        failures,
        summary: {
            requested: input.candidates.length,
            succeeded: results.length,
            failed: failures.length,
            hasFailures: failures.length > 0,
        },
    };
}
