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
            secondaryAction: "continue_without_coaching",
        });
        expect(getSessionAnswerMutationPresentation("analysis_unavailable")).toMatchObject({
            isAnswerLocked: true,
            primaryAction: "continue_without_coaching",
            secondaryAction: null,
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

    it("distinguishes pending checks from completed-run restoration", () => {
        expect(getSessionAnswerMutationPresentation("analysis_pending")).toMatchObject({
            isAnswerLocked: true,
            primaryAction: "check_analysis",
            secondaryAction: null,
        });
        expect(getSessionAnswerMutationPresentation("analysis_recoverable")).toMatchObject({
            isAnswerLocked: true,
            primaryAction: "restore_analysis",
            secondaryAction: "continue_without_coaching",
        });
    });
});
