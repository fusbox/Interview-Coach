import { useCallback } from "react";
import { ApiClient } from "@/lib/api-client";
import { Logger } from "@/lib/logger";
import { SessionMutationBase } from "./shared";

export function useSessionTelemetryMutations({
    session,
    setSession,
    candidateToken
}: SessionMutationBase) {
    const recordEngagement = useCallback(async (deltaSeconds: number) => {
        if (!session) return;

        setSession((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                engagedTimeSeconds: (prev.engagedTimeSeconds || 0) + deltaSeconds
            };
        });

        try {
            await ApiClient.patch(
                `/api/session/${session.id}`,
                { engagedTimeDelta: deltaSeconds },
                { token: candidateToken }
            );
        } catch (e) {
            Logger.warn("Engagement ping failed", e);
        }
    }, [session, candidateToken, setSession]);

    return {
        recordEngagement
    };
}
