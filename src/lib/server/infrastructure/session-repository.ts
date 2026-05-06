import { getOptionalServerEnv } from "@/lib/server/config/server-env";
import type { SessionRepository } from "@/lib/domain/repository";

export type SessionRepositoryBackend = "postgres";

export type TrackedSessionRepository = SessionRepository & {
    markViewed(sessionId: string): Promise<void>;
    setSummaryExpiry(sessionId: string, expiresAt: number): Promise<void>;
    markInvitationSent(sessionId: string): Promise<void>;
};

export function getSessionRepositoryBackend(): SessionRepositoryBackend {
    const configured = getOptionalServerEnv("SESSION_REPOSITORY_BACKEND")?.toLowerCase();
    if (!configured) {
        return "postgres";
    }

    if (configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported SESSION_REPOSITORY_BACKEND value "${configured}". Expected "postgres".`);
}

export async function createSessionRepository(): Promise<TrackedSessionRepository> {
    getSessionRepositoryBackend();
    const { PostgresSessionRepository } = await import("@/lib/server/infrastructure/postgres-session-repository");
    return new PostgresSessionRepository();
}
