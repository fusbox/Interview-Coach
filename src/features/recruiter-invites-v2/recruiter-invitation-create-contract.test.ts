import { describe, expect, it } from "vitest";

import {
    parseRecruiterInvitationCreateRequest,
    prepareRecruiterQuestionSetRequest,
    RecruiterInvitationCreateValidationError,
} from "./recruiter-invitation-create-contract";

describe("recruiter invitation create contract", () => {
    it.each([
        ["practice_only", 5],
        ["screening", 5],
        ["first_interview", 7],
        ["follow_up", 10],
        ["final_interview", 10],
    ] as const)("derives %s as a fixed %i-slot plan", (interviewStage, questionCount) => {
        const parsed = parseRecruiterInvitationCreateRequest({
            operation: "prepare_questions",
            actionKey: "browser-action-key-0001",
            source: "manual",
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage,
            questions: Array.from({ length: questionCount }, (_, index) => `Question ${index + 1}?`),
        });
        expect(parsed.operation).toBe("prepare_questions");
        if (parsed.operation !== "prepare_questions") return;
        expect(prepareRecruiterQuestionSetRequest(parsed).questionPlanSnapshot.questionCount).toBe(questionCount);
    });

    it("maps manual wording exactly to the stage-owned category slots", () => {
        const parsed = parseRecruiterInvitationCreateRequest({
            operation: "prepare_questions",
            actionKey: "browser-action-key-0001",
            source: "manual",
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage: "screening",
            questions: ["Question one?", "Question two?", "Question three?", "Question four?", "Question five?"],
        });
        if (parsed.operation !== "prepare_questions") throw new Error("Unexpected operation.");
        const prepared = prepareRecruiterQuestionSetRequest(parsed);
        expect(prepared.manualQuestionWordingSnapshot?.questions).toMatchObject([
            { slotId: "slot-1", questionText: "Question one?" },
            { slotId: "slot-2", questionText: "Question two?" },
            { slotId: "slot-3", questionText: "Question three?" },
            { slotId: "slot-4", questionText: "Question four?" },
            { slotId: "slot-5", questionText: "Question five?" },
        ]);
        for (const question of prepared.manualQuestionWordingSnapshot?.questions ?? []) {
            expect(question).not.toHaveProperty("assistance");
            expect(question).not.toHaveProperty("contentFingerprint");
        }
    });

    it("rejects mutable count, incomplete slots, duplicate recipients, and body-supplied recruiter identity", () => {
        const base = {
            operation: "prepare_questions",
            actionKey: "browser-action-key-0001",
            source: "manual",
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods.",
            interviewStage: "screening",
            questions: ["Question one?", "Question two?", "Question three?", "Question four?", "Question five?"],
        };
        expect(() => parseRecruiterInvitationCreateRequest({ ...base, questionCount: 3 }))
            .toThrow(RecruiterInvitationCreateValidationError);
        expect(() => parseRecruiterInvitationCreateRequest({ ...base, questions: ["One?"] }))
            .toThrow(RecruiterInvitationCreateValidationError);
        expect(() => parseRecruiterInvitationCreateRequest({ ...base, recruiterId: crypto.randomUUID() }))
            .toThrow(RecruiterInvitationCreateValidationError);
        expect(() => parseRecruiterInvitationCreateRequest({
            operation: "create_invitations",
            actionKey: "browser-action-key-0001",
            questionSetId: crypto.randomUUID(),
            recipients: [
                { firstName: "Irma", lastName: "Castillo", email: "IRMA@example.com" },
                { firstName: "Irma", lastName: "Two", email: "irma@example.com" },
            ],
        })).toThrow(/unique/);
    });
});
