import { describe, expect, it } from "vitest";

import {
    CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY,
    readCandidateProvisionalSession,
    readCandidateProvisionalSessionProgress,
    saveCandidateProvisionalSession,
    saveCandidateProvisionalSessionAnswerDraft,
    saveCandidateProvisionalSessionFeedbackActionEvent,
    saveCandidateProvisionalSessionProgress,
} from "./candidate-provisional-session-store";
import { createCandidateQuestionPlan } from "./candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "./candidate-question-wording";

describe("candidate provisional session store", () => {
    it("stores and restores a setup-created provisional session by id", () => {
        const storage = createMemoryStorage();
        const setupSnapshot = {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-08T18:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 7,
        });

        saveCandidateProvisionalSession(storage, {
            status: "session_created",
            sessionId: "candidate-session-123",
            nextRoute: "/candidate/session/candidate-session-123",
            setupSnapshot,
            questionPlanSnapshot,
            questionWordingSnapshot: createFixtureCandidateQuestionWordingResult({
                setupSnapshot,
                questionPlanSnapshot,
            }),
        });

        expect(readCandidateProvisionalSession(storage, "candidate-session-123")).toMatchObject({
            sessionId: "candidate-session-123",
            progress: {
                status: "planned",
                currentQuestionIndex: 0,
            },
            setupSnapshot: {
                targetRole: "Customer service representative",
                questionCount: 7,
            },
            questionPlanSnapshot: {
                questionCount: 7,
                slots: expect.arrayContaining([
                    expect.objectContaining({ id: "slot-1", category: "screening" }),
                    expect.objectContaining({ id: "slot-2", category: "behavioral" }),
                ]),
            },
            questionWordingSnapshot: {
                status: "questions_worded",
                questions: expect.arrayContaining([
                    expect.objectContaining({
                        slotId: "slot-1",
                        index: 0,
                        category: "screening",
                    }),
                    expect.objectContaining({
                        slotId: "slot-2",
                        index: 1,
                        category: "behavioral",
                    }),
                ]),
            },
        });
        expect(storage.getItem(CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY)).toContain("candidate-session-123");
    });

    it("updates only the browser-bridge progress for an existing provisional session", () => {
        const storage = createMemoryStorage();
        const setupSnapshot = {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-08T18:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 7,
        });
        saveCandidateProvisionalSession(storage, {
            status: "session_created",
            sessionId: "candidate-session-123",
            nextRoute: "/candidate/session/candidate-session-123",
            setupSnapshot,
            questionPlanSnapshot,
            questionWordingSnapshot: createFixtureCandidateQuestionWordingResult({
                setupSnapshot,
                questionPlanSnapshot,
            }),
        });

        saveCandidateProvisionalSessionProgress(storage, "candidate-session-123", {
            status: "question_preview",
            currentQuestionIndex: 2,
        });

        expect(readCandidateProvisionalSessionProgress(storage, "candidate-session-123")).toEqual({
            status: "question_preview",
            currentQuestionIndex: 2,
        });
        expect(readCandidateProvisionalSession(storage, "candidate-session-123")).toMatchObject({
            setupSnapshot: {
                targetRole: "Customer service representative",
            },
            progress: {
                status: "question_preview",
                currentQuestionIndex: 2,
            },
        });
    });

    it("round-trips live question progress for the browser bridge", () => {
        const storage = createMemoryStorage();
        const setupSnapshot = {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-08T18:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 7,
        });
        saveCandidateProvisionalSession(storage, {
            status: "session_created",
            sessionId: "candidate-session-123",
            nextRoute: "/candidate/session/candidate-session-123",
            setupSnapshot,
            questionPlanSnapshot,
            questionWordingSnapshot: createFixtureCandidateQuestionWordingResult({
                setupSnapshot,
                questionPlanSnapshot,
            }),
        });

        saveCandidateProvisionalSessionProgress(storage, "candidate-session-123", {
            status: "live_question",
            currentQuestionIndex: 1,
        });

        expect(readCandidateProvisionalSessionProgress(storage, "candidate-session-123")).toEqual({
            status: "live_question",
            currentQuestionIndex: 1,
        });
    });

    it("keeps browser-bridge answer drafts with their exact question", () => {
        const storage = createMemoryStorage();
        const setupSnapshot = {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-08T18:00:00.000Z",
        };
        const questionPlanSnapshot = createCandidateQuestionPlan({
            interviewStage: "first_interview",
            questionCount: 7,
        });
        saveCandidateProvisionalSession(storage, {
            status: "session_created",
            sessionId: "candidate-session-123",
            nextRoute: "/candidate/session/candidate-session-123",
            setupSnapshot,
            questionPlanSnapshot,
        });

        saveCandidateProvisionalSessionAnswerDraft(storage, "candidate-session-123", {
            slotId: "slot-2",
            questionIndex: 1,
            mode: "text",
            text: "My in-progress answer",
            updatedAt: "2026-07-14T16:00:00.000Z",
        });

        expect(readCandidateProvisionalSession(storage, "candidate-session-123")?.answerDrafts).toEqual({
            "slot-2": expect.objectContaining({
                questionIndex: 1,
                text: "My in-progress answer",
            }),
        });
    });

    it("keeps a browser-bridge feedback transition bound to its exact answer attempt", () => {
        const storage = createMemoryStorage();
        const setupSnapshot = {
            targetRole: "Customer service representative",
            jobDescription: "Help customers resolve service questions.",
            resumeText: null,
            interviewStage: "first_interview" as const,
            questionCount: 7,
            resumeCaptureMode: "none" as const,
            createdAt: "2026-07-08T18:00:00.000Z",
        };
        saveCandidateProvisionalSession(storage, {
            status: "session_created",
            sessionId: "candidate-session-123",
            nextRoute: "/candidate/session/candidate-session-123",
            setupSnapshot,
            questionPlanSnapshot: createCandidateQuestionPlan({
                interviewStage: "first_interview",
                questionCount: 7,
            }),
        });

        saveCandidateProvisionalSessionFeedbackActionEvent(storage, "candidate-session-123", {
            status: "feedback_action_selected",
            answer: {
                slotId: "slot-1",
                questionIndex: 0,
                answerAttemptId: "11111111-1111-4111-8111-111111111111",
                attemptNumber: 1,
                trigger: "initial_submit",
            },
            stageId: "acknowledgement",
            actionKind: "explore_feedback",
            transition: "show_feedback_stage",
            targetStageId: "content_coaching",
            selectedAt: "2026-07-14T20:00:00.000Z",
        });

        expect(readCandidateProvisionalSession(storage, "candidate-session-123")?.feedbackActionEvents)
            .toEqual({
                "slot-1": expect.objectContaining({
                    actionKind: "explore_feedback",
                    answer: expect.objectContaining({
                        answerAttemptId: "11111111-1111-4111-8111-111111111111",
                    }),
                }),
            });
    });

    it("returns null for missing or malformed stored data", () => {
        const storage = createMemoryStorage();
        storage.setItem(CANDIDATE_PROVISIONAL_SESSION_STORAGE_KEY, "{not json");

        expect(readCandidateProvisionalSession(storage, "candidate-session-123")).toBeNull();
        expect(readCandidateProvisionalSessionProgress(storage, "candidate-session-123")).toBeNull();
    });
});

function createMemoryStorage() {
    const values = new Map<string, string>();

    return {
        getItem(key: string) {
            return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
            values.set(key, value);
        },
    };
}
