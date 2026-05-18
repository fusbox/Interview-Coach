import type { SessionRepository } from "@/lib/domain/repository";
import type { InterviewSession, Question } from "@/lib/domain/types";
import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { generateCandidateQuestionSnapshot, type QuestionGenerationInput } from "@/lib/server/services/question-generation-service";
import { uuidv7 } from "uuidv7";

import {
    attachGeneratedSessionToCandidatePracticeDraft,
    findCandidatePracticeDraftById,
    type CandidatePracticeDraft,
    type CandidatePracticeDraftLookup,
} from "./candidate-practice-draft-repository";
import { withCandidateMutationBoundary } from "./candidate-mutation-boundary";

type CandidateSessionCreationDependencies = {
    findDraftById?: (input: CandidatePracticeDraftLookup) => Promise<CandidatePracticeDraft | null>;
    attachGeneratedSession?: (input: {
        candidateProfileId: string;
        practiceDraftId: string;
        sessionId: string;
        questionSetSnapshotId: string;
    }) => Promise<CandidatePracticeDraft | null>;
    sessionRepository?: Pick<SessionRepository, "create" | "delete">;
    generateQuestions?: (input: QuestionGenerationInput) => Promise<Question[]>;
    createSessionId?: () => string;
    createQuestionSetSnapshotId?: () => string;
};

type CandidateSessionCreationInput = CandidatePracticeDraftLookup & {
    generationConfig?: {
        questionCount?: number | null;
    };
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
    input: CandidateSessionCreationInput,
    dependencies: CandidateSessionCreationDependencies = {},
): Promise<CandidateSessionCreationResult> {
    const findDraftById = dependencies.findDraftById ?? findCandidatePracticeDraftById;
    const attachGeneratedSession = dependencies.attachGeneratedSession ?? attachGeneratedSessionToCandidatePracticeDraft;
    const sessionRepository = dependencies.sessionRepository ?? await createSessionRepository();
    const createSessionId = dependencies.createSessionId ?? uuidv7;
    const createQuestionSetSnapshotId = dependencies.createQuestionSetSnapshotId ?? uuidv7;

    const draft = await findDraftById(input);
    if (!draft) {
        return { ok: false, error: "Practice draft was not found." };
    }

    if (draft.status !== "generating") {
        return { ok: false, error: "Practice draft is not ready for session creation." };
    }

    return withCandidateMutationBoundary({
        candidateProfileId: input.candidateProfileId,
        operation: "practice_generation",
        subjectId: input.practiceDraftId,
        mutate: async () => {
            const questionSetSnapshotId = createQuestionSetSnapshotId();
            const questionCount = input.generationConfig?.questionCount ?? 5;
            const questionGenerationInput: QuestionGenerationInput = {
                role: draft.targetRole,
                jobDescription: draft.jobDescription,
                resume: draft.resumeContext.extractedText || draft.resumeContext.pastedText || null,
                interviewType: draft.intakeResponses.interviewType,
                questionCount,
            };
            const questions = dependencies.generateQuestions
                ? await dependencies.generateQuestions(questionGenerationInput)
                : await generateCandidateQuestionSnapshot(
                    questionGenerationInput,
                    {
                        appName: "candidate_app",
                        actorType: "candidate",
                        actorId: draft.candidateProfileId,
                        correlationId: questionSetSnapshotId,
                        sourceRefs: [{ type: "service", name: "candidate_session_generation" }],
                    },
                );
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
                    practiceConfig: {
                        interviewType: draft.intakeResponses.interviewType,
                        questionCount,
                    },
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
        },
    });
}
