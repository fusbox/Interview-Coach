import { z } from "zod";
import { UpdateSessionSchema } from "@/lib/domain/schemas";
import { canTransitionSessionStatus } from "@/lib/domain/session-state-machine";
import type { InterviewSession } from "@/lib/domain/types";
import { incrementMetric } from "@/lib/server/metrics";
import { Logger } from "@/lib/logger";
import { SessionUpdateNotFoundError, SessionUpdateValidationError } from "./errors";

const SUMMARY_RETENTION_MS = 6 * 60 * 60 * 1000;

type UpdateSessionInput = z.input<typeof UpdateSessionSchema>;

type SessionRepository = {
    get(id: string): Promise<InterviewSession | null>;
    updatePartial(id: string, updates: Partial<InterviewSession>): Promise<void>;
    setSummaryExpiry(sessionId: string, expiresAt: number): Promise<void>;
};

type UpdateSessionDependencies = {
    repository: SessionRepository;
    summarizeSession: (session: InterviewSession) => Promise<string>;
    sendDebriefEmail: (session: InterviewSession) => Promise<unknown>;
    incrementMetric: typeof incrementMetric;
    now: () => number;
};

function normalizeRepositoryUpdates(updates: UpdateSessionInput): Partial<InterviewSession> {
    return {
        ...updates,
        parentSessionId: updates.parentSessionId ?? undefined,
        attemptNumber: updates.attemptNumber ?? undefined,
        clientName: updates.clientName ?? undefined
    };
}

export async function updateSessionCommand(
    sessionId: string,
    updates: UpdateSessionInput,
    dependencies?: Partial<UpdateSessionDependencies>
) {
    const repository =
        dependencies?.repository ??
        new (await import("@/lib/server/infrastructure/supabase-session-repository")).SupabaseSessionRepository();
    const summarizeSession =
        dependencies?.summarizeSession ??
        (async (session: InterviewSession) => (await import("@/lib/server/services/ai-service")).AIService.summarizeSession(session));
    const sendDebriefEmail =
        dependencies?.sendDebriefEmail ??
        (async (session: InterviewSession) => (await import("@/lib/server/services/email-service")).EmailService.sendDebriefEmail(session));
    const incrementCompletionMetric = dependencies?.incrementMetric ?? incrementMetric;
    const now = dependencies?.now ?? Date.now;

    const currentSession = await repository.get(sessionId);
    if (!currentSession) {
        throw new SessionUpdateNotFoundError("Session not found");
    }

    if (updates.status && !canTransitionSessionStatus(currentSession.status, updates.status)) {
        throw new SessionUpdateValidationError(
            `Invalid session status transition: ${currentSession.status} -> ${updates.status}`
        );
    }

    const normalizedUpdates = normalizeRepositoryUpdates(updates);
    await repository.updatePartial(sessionId, normalizedUpdates);

    const session = await repository.get(sessionId);
    if (!session) {
        throw new SessionUpdateNotFoundError("Session not found");
    }

    if (updates.status === "COMPLETED" && !session.summaryNarrative) {
        incrementCompletionMetric("session_completion_total", {
            outcome: "success"
        });

        try {
            const narrative = await summarizeSession(session);
            await repository.updatePartial(sessionId, { summaryNarrative: narrative });
            session.summaryNarrative = narrative;

            if (session.candidate?.email) {
                const emailResult = await sendDebriefEmail(session).catch(error => {
                    Logger.error("Debrief email send failed", {
                        error,
                        errorCode: "SESSION_DEBRIEF_EMAIL_FAILED",
                        sessionId
                    }, "SessionUpdateCommand");
                    return null;
                });

                if (emailResult) {
                    await repository.setSummaryExpiry(sessionId, now() + SUMMARY_RETENTION_MS);
                }
            }
        } catch (error) {
            Logger.error("Summarization failed", {
                error,
                errorCode: "SESSION_SUMMARIZATION_FAILED",
                sessionId
            }, "SessionUpdateCommand");
        }
    }

    return session;
}
