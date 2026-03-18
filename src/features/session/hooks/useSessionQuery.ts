import { useState, useEffect, useCallback } from "react";
import { InterviewSession } from "@/lib/domain/types";
import { ApiClient } from "@/lib/api-client";
import { STORAGE_KEYS } from "@/lib/constants";
import { InterviewSessionSchema } from "@/lib/domain/schemas";

export function useSessionQuery(initialSessionId?: string, candidateToken?: string) {
    const [session, setSession] = useState<InterviewSession | null | undefined>(undefined);

    useEffect(() => {
        const storedId = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION_ID);
        const targetId = initialSessionId || storedId;

        if (targetId) {
            if (initialSessionId && initialSessionId !== storedId) {
                localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, initialSessionId);
            }

            if (session && session.id !== targetId) {
                setSession(undefined);
                return;
            }

            if (session === undefined) {
                ApiClient.get<InterviewSession>(`/api/session/${targetId}`, { token: candidateToken, schema: InterviewSessionSchema })
                    .then((data: InterviewSession) => setSession(data))
                    .catch((err: unknown) => {
                        console.warn("Rehydration failed:", err);
                        setSession(null);
                        if (!initialSessionId) {
                            localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION_ID);
                        }
                    });
            }
        }
    }, [initialSessionId, candidateToken, session]);

    const refresh = useCallback(async () => {
        if (!session?.id) return;
        const data = await ApiClient.get<InterviewSession>(`/api/session/${session.id}`, { token: candidateToken, schema: InterviewSessionSchema });
        setSession(data);
    }, [session?.id, candidateToken]);

    return {
        session,
        setSession,
        refresh
    };
}
