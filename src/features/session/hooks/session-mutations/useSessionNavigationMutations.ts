import { useCallback } from "react";
import { ApiClient } from "@/lib/api-client";
import { InterviewSessionSchema } from "@/lib/domain/schemas";
import { InterviewSession } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";
import { SESSION_STATUS } from "@/lib/constants";
import { CommandGate, SessionMutationBase } from "./shared";

type NavigationArgs = SessionMutationBase & {
    commandGate: CommandGate;
};

export function useSessionNavigationMutations({
    session,
    setSession,
    candidateToken,
    mergeSession,
    commandGate
}: NavigationArgs) {
    const next = useCallback(async () => {
        if (!session) return;
        if (!commandGate.tryBeginCommand("next", session.id)) return;

        const previousSessionSnapshot = session;

        try {
            const nextIdx = session.currentQuestionIndex + 1;
            const isComplete = nextIdx >= session.questions.length;
            const nextStatus = isComplete ? SESSION_STATUS.COMPLETED : SESSION_STATUS.IN_SESSION;

            setSession((prev: InterviewSession | null | undefined) => prev ? {
                ...prev,
                currentQuestionIndex: nextIdx,
                status: nextStatus
            } : undefined);

            const updated = await ApiClient.patch<InterviewSession>(
                `/api/session/${session.id}`,
                {
                    currentQuestionIndex: nextIdx,
                    status: nextStatus
                },
                { token: candidateToken, schema: InterviewSessionSchema }
            );
            mergeSession(updated);
        } catch (e) {
            Logger.error("Next question failed", e);
            setSession(previousSessionSnapshot);
            throw e;
        } finally {
            commandGate.finishCommand("next", session.id);
        }
    }, [session, candidateToken, setSession, mergeSession, commandGate]);

    const goToQuestion = useCallback(async (index: number) => {
        if (!session) return;

        let maxAllowed = 0;
        for (let i = 0; i < session.questions.length; i++) {
            const q = session.questions[i];
            const ans = session.answers[q.id];
            if (ans?.submittedAt) {
                maxAllowed = i + 1;
            } else {
                maxAllowed = i;
                break;
            }
        }

        if (session.answers[session.questions[session.questions.length - 1].id]?.submittedAt) {
            maxAllowed = session.questions.length - 1;
        }

        if (index < 0 || index > maxAllowed) {
            Logger.warn("goToQuestion blocked", {
                requestedIndex: index,
                maxAllowed,
                sessionId: session.id
            }, "SessionNavigation");
            return;
        }

        setSession((prev: InterviewSession | null | undefined) => prev ? {
            ...prev,
            currentQuestionIndex: index,
            status: SESSION_STATUS.IN_SESSION
        } : undefined);

        const updated = await ApiClient.patch<InterviewSession>(
            `/api/session/${session.id}`,
            { currentQuestionIndex: index },
            { token: candidateToken, schema: InterviewSessionSchema }
        );
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    return {
        next,
        goToQuestion
    };
}
