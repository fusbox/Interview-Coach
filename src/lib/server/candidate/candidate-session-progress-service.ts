import type { SessionStatus } from "@/lib/domain/types";
import { updateSessionCommand } from "@/lib/server/application/session/update-session";

import {
    findCandidatePracticeDraftBySessionId,
    updateCandidatePracticeDraftProgressBySessionId,
    type PracticeResumeTarget,
    type PracticeSessionDraftStatus,
} from "./candidate-practice-draft-repository";

type CandidateSessionProgressInput = {
    candidateProfileId: string;
    sessionId: string;
};

type CandidateSessionAdvanceInput = CandidateSessionProgressInput & {
    currentQuestionIndex: number;
    status: Extract<SessionStatus, "IN_SESSION" | "COMPLETED">;
};

type CandidateSessionProgressResult =
    | {
        ok: true;
        sessionId: string;
        status: SessionStatus;
        currentQuestionIndex: number;
        resumeTargetScreen: PracticeResumeTarget;
    }
    | {
        ok: false;
        error: string;
    };

export async function startCandidateOwnedSession(input: CandidateSessionProgressInput): Promise<CandidateSessionProgressResult> {
    const ownership = await findCandidatePracticeDraftBySessionId(input);
    if (!ownership) {
        return { ok: false, error: "Candidate session was not found." };
    }

    const session = await updateSessionCommand(input.sessionId, { status: "IN_SESSION" });
    const draftProgress = await persistDraftProgressTarget(input, session.status);

    return {
        ok: true,
        sessionId: session.id,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        resumeTargetScreen: draftProgress,
    };
}

export async function advanceCandidateOwnedSession(input: CandidateSessionAdvanceInput): Promise<CandidateSessionProgressResult> {
    const ownership = await findCandidatePracticeDraftBySessionId(input);
    if (!ownership) {
        return { ok: false, error: "Candidate session was not found." };
    }

    const session = await updateSessionCommand(input.sessionId, {
        currentQuestionIndex: input.currentQuestionIndex,
        status: input.status,
    });
    const draftProgress = await persistDraftProgressTarget(input, session.status);

    return {
        ok: true,
        sessionId: session.id,
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        resumeTargetScreen: draftProgress,
    };
}

async function persistDraftProgressTarget(input: CandidateSessionProgressInput, sessionStatus: SessionStatus) {
    const progress = mapSessionStatusToDraftProgress(sessionStatus);
    const draft = await updateCandidatePracticeDraftProgressBySessionId({
        candidateProfileId: input.candidateProfileId,
        sessionId: input.sessionId,
        status: progress.status,
        resumeTargetScreen: progress.resumeTargetScreen,
    });

    if (!draft) {
        throw new Error("Candidate practice draft progress could not be updated.");
    }

    return progress.resumeTargetScreen;
}

function mapSessionStatusToDraftProgress(sessionStatus: SessionStatus): {
    status: Extract<PracticeSessionDraftStatus, "in_session" | "completed">;
    resumeTargetScreen: Extract<PracticeResumeTarget, "session_in_progress" | "session_summary">;
} {
    if (sessionStatus === "COMPLETED") {
        return {
            status: "completed",
            resumeTargetScreen: "session_summary",
        };
    }

    return {
        status: "in_session",
        resumeTargetScreen: "session_in_progress",
    };
}
