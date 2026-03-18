import { useCallback } from "react";
import { ApiClient } from "@/lib/api-client";
import { InterviewSessionSchema } from "@/lib/domain/schemas";
import { InterviewSession } from "@/lib/domain/types";
import { STORAGE_KEYS, SESSION_STATUS } from "@/lib/constants";
import { Logger } from "@/lib/logger";
import { CommandGate, InitPromiseRef, SessionMutationBase } from "./shared";

type LifecycleArgs = SessionMutationBase & {
    commandGate: CommandGate;
    activeInitPromiseRef: InitPromiseRef;
};

export function useSessionLifecycleMutations({
    session,
    setSession,
    candidateToken,
    mergeSession,
    commandGate,
    activeInitPromiseRef
}: LifecycleArgs) {
    const init = useCallback(async (role: string, parentId?: string) => {
        if (activeInitPromiseRef.current) return activeInitPromiseRef.current;

        const promise = (async () => {
            try {
                const { data: newSession, headers } = await ApiClient.postWithHeaders<InterviewSession>(
                    "/api/session/start",
                    { role, parentId },
                    { token: candidateToken, schema: InterviewSessionSchema }
                );
                setSession(newSession);
                localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, newSession.id);

                const newToken = headers.get("x-candidate-token");
                return { sessionId: newSession.id, candidateToken: newToken ? newToken : "" };
            } catch (e) {
                Logger.error("Session Init Failed", e);
                throw e;
            } finally {
                activeInitPromiseRef.current = null;
            }
        })();

        activeInitPromiseRef.current = promise;
        return promise;
    }, [activeInitPromiseRef, candidateToken, setSession]);

    const start = useCallback(async () => {
        if (!session) return;
        if (!commandGate.tryBeginCommand("start", session.id)) return;

        const previousSessionSnapshot = session;

        try {
            setSession((prev: InterviewSession | null | undefined) => prev ? { ...prev, status: SESSION_STATUS.IN_SESSION } : undefined);

            const updated = await ApiClient.patch<InterviewSession>(
                `/api/session/${session.id}`,
                { status: SESSION_STATUS.IN_SESSION },
                { token: candidateToken, schema: InterviewSessionSchema }
            );
            mergeSession(updated);
        } catch (e) {
            Logger.error("Session start failed", e);
            setSession(previousSessionSnapshot);
            throw e;
        } finally {
            commandGate.finishCommand("start", session.id);
        }
    }, [session, commandGate, setSession, candidateToken, mergeSession]);

    const submitInitials = useCallback(async (initials: string) => {
        if (!session) return;

        setSession((prev: InterviewSession | null | undefined) => prev ? {
            ...prev,
            enteredInitials: initials,
            initialsRequired: false
        } : undefined);

        const updated = await ApiClient.patch<InterviewSession>(
            `/api/session/${session.id}`,
            { enteredInitials: initials, initialsRequired: false },
            { token: candidateToken, schema: InterviewSessionSchema }
        );
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    const updateSession = useCallback(async (updates: Partial<InterviewSession>) => {
        if (!session) return;

        setSession((prev: InterviewSession | null | undefined) => prev ? { ...prev, ...updates } : undefined);

        const updated = await ApiClient.patch<InterviewSession>(
            `/api/session/${session.id}`,
            updates,
            { token: candidateToken, schema: InterviewSessionSchema }
        );
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    const reset = useCallback(async () => {
        if (!session) return;

        setSession((prev: InterviewSession | null | undefined) => prev ? {
            ...prev,
            status: SESSION_STATUS.IN_SESSION,
            currentQuestionIndex: 0,
            answers: {}
        } : undefined);

        const updated = await ApiClient.post<InterviewSession>(
            `/api/session/${session.id}/reset`,
            {},
            { token: candidateToken, schema: InterviewSessionSchema }
        );
        mergeSession(updated);
    }, [session, candidateToken, setSession, mergeSession]);

    return {
        init,
        start,
        submitInitials,
        updateSession,
        reset
    };
}
