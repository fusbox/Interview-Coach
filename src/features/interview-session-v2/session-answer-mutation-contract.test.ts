import { describe, expect, it } from "vitest";

import { getSessionAnswerMutationPresentation } from "./session-answer-mutation-contract";

describe("session answer mutation presentation", () => {
    it("distinguishes draft, answer-submit, and analysis failures", () => {
        expect(getSessionAnswerMutationPresentation("draft_save_failed")).toMatchObject({
            isAnswerLocked: false,
            primaryAction: "submit",
            canRetryDraftSave: true,
        });
        expect(getSessionAnswerMutationPresentation("submit_failed")).toMatchObject({
            isAnswerLocked: false,
            primaryAction: "retry_submit",
        });
        expect(getSessionAnswerMutationPresentation("analysis_failed")).toMatchObject({
            isAnswerLocked: true,
            primaryAction: "retry_analysis",
        });
    });

    it("locks accepted work while coaching is running or ready", () => {
        expect(getSessionAnswerMutationPresentation("analyzing")).toMatchObject({
            isAnswerLocked: true,
            isBusy: true,
        });
        expect(getSessionAnswerMutationPresentation("analysis_ready")).toMatchObject({
            isAnswerLocked: true,
            isBusy: false,
            primaryAction: null,
        });
    });
});
