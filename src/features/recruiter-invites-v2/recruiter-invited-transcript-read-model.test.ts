import { describe, expect, it } from "vitest";

import { createCandidateQuestionPlan } from "@/features/candidate-session-v2/candidate-question-plan";
import { createFixtureCandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import {
    createRecruiterInvitedTranscriptReadModel,
    type RecruiterInvitedTranscriptFact,
} from "./recruiter-invited-transcript-read-model";

describe("recruiter invited transcript read model", () => {
    it("orders the immutable question set and maps only current submitted responses", () => {
        const model = createRecruiterInvitedTranscriptReadModel(fact({
            latestAnswers: [
                { questionSlotId: "slot-3", questionIndex: 2, answerText: "My third response." },
                { questionSlotId: "slot-1", questionIndex: 0, answerText: "My revised first response." },
            ],
        }));

        expect(model).toMatchObject({
            candidateName: "Irma Castillo",
            targetRole: "Quality Inspector",
            interviewStageLabel: "Screening call",
            practiceStateLabel: "In practice",
            questionCount: 3,
            answeredQuestionCount: 2,
        });
        expect(model.items.map((item) => ({ number: item.number, answerText: item.answerText }))).toEqual([
            { number: 1, answerText: "My revised first response." },
            { number: 2, answerText: null },
            { number: 3, answerText: "My third response." },
        ]);
    });

    it("fails closed when an answer does not map to the immutable question set", () => {
        expect(() => createRecruiterInvitedTranscriptReadModel(fact({
            latestAnswers: [
                { questionSlotId: "foreign-slot", questionIndex: 0, answerText: "Should not render." },
            ],
        }))).toThrow("outside the immutable question set");
    });

    it("fails closed on duplicate or mismatched answer rows", () => {
        expect(() => createRecruiterInvitedTranscriptReadModel(fact({
            latestAnswers: [
                { questionSlotId: "slot-1", questionIndex: 0, answerText: "First." },
                { questionSlotId: "slot-1", questionIndex: 0, answerText: "Duplicate." },
            ],
        }))).toThrow("outside the immutable question set");

        expect(() => createRecruiterInvitedTranscriptReadModel(fact({
            latestAnswers: [
                { questionSlotId: "slot-1", questionIndex: 2, answerText: "Wrong index." },
            ],
        }))).toThrow("outside the immutable question set");
    });
});

function fact(overrides: Partial<RecruiterInvitedTranscriptFact> = {}): RecruiterInvitedTranscriptFact {
    const questionPlanSnapshot = createCandidateQuestionPlan({ interviewStage: "screening", questionCount: 3 });
    const setupSnapshot = {
        targetRole: "Quality Inspector",
        jobDescription: "Inspect finished products and document quality findings.",
        resumeText: null,
        resumeCaptureMode: "none" as const,
        interviewStage: "screening" as const,
        questionCount: 3,
        createdAt: "2026-07-20T00:00:00.000Z",
    };
    return {
        sessionId: "50000000-0000-4000-8000-000000000001",
        recipientId: "40000000-0000-4000-8000-000000000001",
        batchLifecycleState: "ready",
        recipientLifecycleState: "ready",
        firstName: "Irma",
        lastName: "Castillo",
        email: "irma@example.invalid",
        requisitionReference: "REQ-1",
        targetRole: "Quality Inspector",
        interviewStage: "screening",
        sessionStatus: "in_progress",
        sessionAttemptNumber: 1,
        questionPlanSnapshot,
        questionWordingQuestions: createFixtureCandidateQuestionWordingResult({
            setupSnapshot,
            questionPlanSnapshot,
        }).questions,
        latestAnswers: [],
        ...overrides,
    };
}
