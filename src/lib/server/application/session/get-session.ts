import type { InterviewSession } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";
import { SessionUpdateNotFoundError } from "./errors";

type SessionRepository = {
    get(id: string): Promise<InterviewSession | null>;
    markViewed(sessionId: string): Promise<void>;
};

type GetSessionDependencies = {
    repository: SessionRepository;
};

export async function getSessionCommand(
    sessionId: string,
    dependencies?: Partial<GetSessionDependencies>
) {
    const repository =
        dependencies?.repository ??
        new (await import("@/lib/server/infrastructure/supabase-session-repository")).SupabaseSessionRepository();

    const session = await repository.get(sessionId);
    if (!session) {
        throw new SessionUpdateNotFoundError("Session not found");
    }

    repository.markViewed(sessionId).catch(error => {
        Logger.warn("Mark viewed failed", {
            error,
            errorCode: "SESSION_MARK_VIEWED_FAILED",
            sessionId
        }, "SessionGetCommand");
    });

    return session;
}
