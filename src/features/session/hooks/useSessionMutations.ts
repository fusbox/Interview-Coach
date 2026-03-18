import { useCallback, useMemo, useRef } from "react";
import { InterviewSession } from "@/lib/domain/types";
import { selectNow } from "@/lib/state/selectors";
import { Logger } from "@/lib/logger";
import { useSessionAnswerMutations } from "./session-mutations/useSessionAnswerMutations";
import { useSessionLifecycleMutations } from "./session-mutations/useSessionLifecycleMutations";
import { useSessionNavigationMutations } from "./session-mutations/useSessionNavigationMutations";
import { useSessionTelemetryMutations } from "./session-mutations/useSessionTelemetryMutations";
import { CommandState, ExclusiveCommandName, SessionSetter } from "./session-mutations/shared";

export function useSessionMutations(
    session: InterviewSession | null | undefined,
    setSession: SessionSetter,
    candidateToken?: string
) {
    const now = useMemo(() => selectNow(session), [session]);
    const activeCommandRef = useRef<CommandState | null>(null);
    const activeInitPromiseRef = useRef<Promise<{ sessionId: string; candidateToken: string } | undefined> | null>(null);

    const mergeSession = useCallback((updated: InterviewSession) => {
        setSession((prev) => {
            if (!prev) return updated;
            return {
                ...updated,
                engagedTimeSeconds: Math.max(prev.engagedTimeSeconds || 0, updated.engagedTimeSeconds || 0)
            };
        });
    }, [setSession]);

    const tryBeginCommand = useCallback((command: ExclusiveCommandName, sessionId: string) => {
        const active = activeCommandRef.current;
        if (active && active.sessionId === sessionId) {
            Logger.info("Ignored overlapping session command", {
                activeCommand: active.name,
                ignoredCommand: command,
                sessionId
            }, "SessionMutations");
            return false;
        }

        activeCommandRef.current = { name: command, sessionId };
        return true;
    }, []);

    const finishCommand = useCallback((command: ExclusiveCommandName, sessionId: string) => {
        const active = activeCommandRef.current;
        if (active?.name === command && active.sessionId === sessionId) {
            activeCommandRef.current = null;
        }
    }, []);

    const lifecycle = useSessionLifecycleMutations({
        session,
        setSession,
        candidateToken,
        mergeSession,
        commandGate: {
            tryBeginCommand,
            finishCommand
        },
        activeInitPromiseRef
    });

    const answering = useSessionAnswerMutations({
        session,
        setSession,
        candidateToken,
        mergeSession,
        now,
        commandGate: {
            tryBeginCommand,
            finishCommand
        }
    });

    const navigation = useSessionNavigationMutations({
        session,
        setSession,
        candidateToken,
        mergeSession,
        commandGate: {
            tryBeginCommand,
            finishCommand
        }
    });

    const telemetry = useSessionTelemetryMutations({
        session,
        setSession,
        candidateToken,
        mergeSession
    });

    return {
        ...lifecycle,
        ...answering,
        ...navigation,
        ...telemetry
    };
}
