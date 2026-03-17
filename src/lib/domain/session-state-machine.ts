import { InterviewSession, SessionStatus } from "@/lib/domain/types";

export const ALLOWED_SESSION_STATUS_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
    NOT_STARTED: ["IN_SESSION", "PAUSED", "ERROR"],
    GENERATING_QUESTIONS: ["NOT_STARTED", "IN_SESSION", "ERROR"],
    IN_SESSION: ["AWAITING_EVALUATION", "REVIEWING", "PAUSED", "COMPLETED", "ERROR"],
    AWAITING_EVALUATION: ["REVIEWING", "IN_SESSION", "PAUSED", "ERROR"],
    REVIEWING: ["IN_SESSION", "PAUSED", "COMPLETED", "ERROR"],
    PAUSED: ["IN_SESSION", "COMPLETED", "ERROR"],
    COMPLETED: [],
    ERROR: ["IN_SESSION"],
};

export function canTransitionSessionStatus(from: SessionStatus, to: SessionStatus): boolean {
    if (from === to) {
        return true;
    }

    return ALLOWED_SESSION_STATUS_TRANSITIONS[from].includes(to);
}

export function assertValidSessionStatusTransition(from: SessionStatus, to: SessionStatus): void {
    if (!canTransitionSessionStatus(from, to)) {
        throw new Error(`Invalid session status transition: ${from} -> ${to}`);
    }
}

export function transitionSessionStatus(
    session: InterviewSession,
    to: SessionStatus
): InterviewSession {
    assertValidSessionStatusTransition(session.status, to);
    if (session.status === to) {
        return session;
    }

    return {
        ...session,
        status: to,
    };
}
