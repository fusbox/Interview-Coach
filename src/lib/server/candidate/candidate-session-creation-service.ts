import type { SessionRepository } from "@/lib/domain/repository";
import type { InterviewSession, Question } from "@/lib/domain/types";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { QuestionService } from "@/lib/server/services/question-service";
import { uuidv7 } from "uuidv7";

import {
    attachGeneratedSessionToCandidatePracticeDraft,
    findCandidatePracticeDraftById,
    type CandidatePracticeDraft,
    type CandidatePracticeDraftLookup,
} from "./candidate-practice-draft-repository";

type CandidateSessionCreationDependencies = {
    findDraftById?: (input: CandidatePracticeDraftLookup) => Promise<CandidatePracticeDraft | null>;
    attachGeneratedSession?: (input: {
        candidateProfileId: string;
        practiceDraftId: string;
        sessionId: string;
        questionSetSnapshotId: string;
    }) => Promise<CandidatePracticeDraft | null>;
    sessionRepository?: Pick<SessionRepository, "create" | "delete">;
    generateQuestions?: (role: string) => Promise<Question[]>;
    createSessionId?: () => string;
    createQuestionSetSnapshotId?: () => string;
};

type CandidateSessionCreationResult =
    | {
        ok: true;
        practiceDraftId: string;
        sessionId: string;
        questionSetSnapshotId: string;
        resumeTargetScreen: "session_entry";
    }
    | {
        ok: false;
        error: string;
    };

export async function createCandidateSessionFromDraft(
    input: CandidatePracticeDraftLookup,
    dependencies: CandidateSessionCreationDependencies = {},
): Promise<CandidateSessionCreationResult> {
    const findDraftById = dependencies.findDraftById ?? findCandidatePracticeDraftById;
    const attachGeneratedSession = dependencies.attachGeneratedSession ?? attachGeneratedSessionToCandidatePracticeDraft;
    const sessionRepository = dependencies.sessionRepository ?? await createSessionRepository();
    const generateQuestions = dependencies.generateQuestions ?? QuestionService.generateQuestions;
    const createSessionId = dependencies.createSessionId ?? uuidv7;
    const createQuestionSetSnapshotId = dependencies.createQuestionSetSnapshotId ?? uuidv7;

    const draft = await findDraftById(input);
    if (!draft) {
        return { ok: false, error: "Practice draft was not found." };
    }

    if (draft.status !== "generating") {
        return { ok: false, error: "Practice draft is not ready for session creation." };
    }

    const questionSetSnapshotId = createQuestionSetSnapshotId();
    const questions = await generateQuestions(draft.targetRole);
    if (questions.length === 0) {
        return { ok: false, error: "Question generation returned no questions." };
    }

    const session: InterviewSession = {
        id: createSessionId(),
        status: "NOT_STARTED",
        role: draft.targetRole,
        jobDescription: draft.jobDescription ?? undefined,
        questions,
        currentQuestionIndex: 0,
        answers: {},
        initialsRequired: false,
        intakeData: {
            candidateProfileId: draft.candidateProfileId,
            practiceDraftId: draft.practiceDraftId,
            questionSetSnapshotId,
            resumeContext: {
                captureMode: draft.resumeContext.captureMode,
                extractedText: draft.resumeContext.extractedText,
            },
            intakeResponses: draft.intakeResponses,
            customQuestions: draft.customQuestions,
        },
    };

    await sessionRepository.create(session);

    const attachedDraft = await attachGeneratedSession({
        candidateProfileId: draft.candidateProfileId,
        practiceDraftId: draft.practiceDraftId,
        sessionId: session.id,
        questionSetSnapshotId,
    });

    if (!attachedDraft) {
        await sessionRepository.delete(session.id);
        return { ok: false, error: "Practice draft could not be attached to the generated session." };
    }

    return {
        ok: true,
        practiceDraftId: attachedDraft.practiceDraftId,
        sessionId: session.id,
        questionSetSnapshotId,
        resumeTargetScreen: "session_entry",
    };
}
