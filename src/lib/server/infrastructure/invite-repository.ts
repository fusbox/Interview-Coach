import { InviteRepository } from "@/lib/domain/invite";
import { getOptionalServerEnv } from "@/lib/server/config/server-env";
import type {
    CreateInviteBatchInput,
    InviteBatchFailure,
    PersistedInviteBatch
} from "@/lib/server/application/invites/types";
import type { Invite } from "@/lib/domain/invite";

export type InviteRepositoryBackend = "postgres";

export type TrackedInviteRepository = InviteRepository & {
    createTrackedBatch(input: CreateInviteBatchInput, invites: Invite[]): Promise<string>;
    markTrackedBatchCompleted(batchId: string, invites: Invite[]): Promise<void>;
    markTrackedBatchFailed(batchId: string, failures: InviteBatchFailure[]): Promise<void>;
    getTrackedBatch(batchId: string, actorId: string): Promise<PersistedInviteBatch | null>;
    markTrackedBatchRetried(batchId: string, childBatchId: string): Promise<void>;
};

export function getInviteRepositoryBackend(): InviteRepositoryBackend {
    const rawBackend = getOptionalServerEnv("INVITE_REPOSITORY_BACKEND") ?? "postgres";
    const backend = rawBackend.toLowerCase();

    if (backend === "postgres") {
        return backend;
    }

    throw new Error("[InviteRepository] INVITE_REPOSITORY_BACKEND must be 'postgres'.");
}

export async function createInviteRepository(): Promise<TrackedInviteRepository> {
    getInviteRepositoryBackend();
    const { PostgresInviteRepository } = await import("@/lib/server/infrastructure/postgres-invite-repository");
    return new PostgresInviteRepository();
}
