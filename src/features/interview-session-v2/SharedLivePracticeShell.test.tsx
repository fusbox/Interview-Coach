import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionRuntimeFacts } from "./session-runtime-facts";
import { SharedLivePracticeShell } from "./SharedLivePracticeShell";

describe("SharedLivePracticeShell", () => {
    beforeEach(() => {
        window.scrollTo = vi.fn();
    });

    it("renders the candidate live workspace from shared facts and exits to the dashboard", () => {
        const prefetch = vi.fn();
        const playOnce = vi.fn();
        const stop = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="text"
                draftText="A saved draft"
                questionAudio={{
                    unlock: vi.fn(),
                    prefetch,
                    playOnce,
                    stop,
                }}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByText("Material Handler")).toBeInTheDocument();
        expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Question 2" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute(
            "href",
            "/candidate/dashboard?targetRole=material-handler",
        );
        expect(screen.getByRole("progressbar", { name: "Practice round progress" })).toHaveAttribute(
            "aria-valuetext",
            "Question 2 of 3",
        );
        expect(screen.queryByRole("button", { name: "Type" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Record" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /back to plan/i })).not.toBeInTheDocument();
        expect(prefetch).toHaveBeenCalledTimes(2);
        expect(prefetch).toHaveBeenNthCalledWith(1, expect.objectContaining({ questionKey: "slot-2" }));
        expect(prefetch).toHaveBeenNthCalledWith(2, expect.objectContaining({ questionKey: "slot-3" }));
        expect(playOnce).toHaveBeenCalledWith(expect.objectContaining({ questionKey: "slot-2" }));
    });

    it("does not restart playback when an equivalent facts projection rerenders", () => {
        const prefetch = vi.fn();
        const playOnce = vi.fn();
        const stop = vi.fn();
        const questionAudio = {
            unlock: vi.fn(),
            prefetch,
            playOnce,
            stop,
        };
        const renderShell = () => (
            <SharedLivePracticeShell
                facts={createFacts("invited_candidate")}
                answerMode="text"
                draftText=""
                questionAudio={questionAudio}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />
        );

        const view = render(renderShell());
        view.rerender(renderShell());

        expect(prefetch).toHaveBeenCalledTimes(2);
        expect(playOnce).toHaveBeenCalledOnce();
        expect(stop).not.toHaveBeenCalled();
    });

    it("moves focus to the active question when question navigation changes", async () => {
        const initialFacts = createFacts("candidate_led");
        const view = render(
            <SharedLivePracticeShell
                facts={initialFacts}
                answerMode="text"
                draftText=""
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByRole("heading", { name: "Question 2" })).toHaveFocus());

        view.rerender(
            <SharedLivePracticeShell
                facts={{ ...initialFacts, currentQuestionIndex: 2 }}
                answerMode="text"
                draftText=""
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        await waitFor(() => expect(screen.getByRole("heading", { name: "Question 3" })).toHaveFocus());
    });

    it("supports an explicit adapter-owned link exit", () => {
        render(
            <SharedLivePracticeShell
                facts={createFacts("invited_candidate")}
                answerMode="text"
                draftText=""
                exitHref="/invited/session-1"
                exitLabel="Leave practice"
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole("link", { name: "Leave practice" })).toHaveAttribute(
            "href",
            "/invited/session-1",
        );
    });

    it("lets an invited adapter replace navigation with a pause action", () => {
        const onExit = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("invited_candidate")}
                answerMode="text"
                draftText=""
                exitLabel="Pause session"
                onExit={onExit}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        screen.getByRole("button", { name: "Pause session" }).click();
        expect(onExit).toHaveBeenCalledOnce();
        expect(screen.queryByRole("link", { name: "Pause session" })).not.toBeInTheDocument();
    });

    it("locks an accepted answer and exposes an analysis-only retry", () => {
        const onRetryAnalysis = vi.fn();
        const onContinueWithoutCoaching = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="text"
                draftText="My submitted answer"
                answerMutationPhase="analysis_failed"
                onDraftChange={vi.fn()}
                onRetryAnalysis={onRetryAnalysis}
                onContinueWithoutCoaching={onContinueWithoutCoaching}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.queryByRole("textbox", { name: "Type your answer" })).not.toBeInTheDocument();
        expect(screen.getByLabelText("Submitted answer")).toHaveTextContent("My submitted answer");
        expect(screen.getByRole("alert")).toHaveTextContent(/answer is saved/i);
        screen.getByRole("button", { name: "Try coaching again" }).click();
        expect(onRetryAnalysis).toHaveBeenCalledOnce();
        screen.getByRole("button", { name: "Continue without coaching" }).click();
        expect(onContinueWithoutCoaching).toHaveBeenCalledOnce();
    });

    it("makes continuation primary when coaching is terminally unavailable", () => {
        const onContinueWithoutCoaching = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="text"
                draftText="My submitted answer"
                answerMutationPhase="analysis_unavailable"
                onDraftChange={vi.fn()}
                onContinueWithoutCoaching={onContinueWithoutCoaching}
                continueWithoutCoachingLabel="Finish without coaching"
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.queryByRole("button", { name: "Try coaching again" })).not.toBeInTheDocument();
        screen.getByRole("button", { name: "Finish without coaching" }).click();
        expect(onContinueWithoutCoaching).toHaveBeenCalledOnce();
    });

    it("keeps a draft editable when its autosave needs a retry", () => {
        const onRetryDraftSave = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="text"
                draftText="My local draft"
                answerMutationPhase="draft_save_failed"
                onDraftChange={vi.fn()}
                onRetryDraftSave={onRetryDraftSave}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole("textbox", { name: "Type your answer" })).not.toHaveAttribute("readonly");
        screen.getByRole("button", { name: "Try saving again" }).click();
        expect(onRetryDraftSave).toHaveBeenCalledOnce();
    });

    it("shows mode controls only when an adapter declares more than one usable mode", () => {
        const onAnswerModeChange = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="text"
                availableAnswerModes={["text", "voice"]}
                draftText=""
                onAnswerModeChange={onAnswerModeChange}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole("button", { name: "Type" })).toHaveAttribute("aria-pressed", "true");
        screen.getByRole("button", { name: "Record" }).click();
        expect(onAnswerModeChange).toHaveBeenCalledWith("voice");
    });

    it("locks both answer modes while the active adapter owns unsafe local work", () => {
        const onAnswerModeChange = vi.fn();

        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="voice"
                availableAnswerModes={["text", "voice"]}
                answerModeChangeDisabled
                draftText=""
                voiceAnswerContent={<section aria-label="Voice answer capture">Recording ready</section>}
                onAnswerModeChange={onAnswerModeChange}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole("button", { name: "Type" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Record" })).toBeDisabled();
        screen.getByRole("button", { name: "Type" }).click();
        expect(onAnswerModeChange).not.toHaveBeenCalled();
    });

    it("renders the shared voice editor without typed-answer footer actions", () => {
        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="voice"
                availableAnswerModes={["text", "voice"]}
                draftText=""
                voiceAnswerContent={<section aria-label="Voice answer capture">Capture</section>}
                onAnswerModeChange={vi.fn()}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        expect(screen.getByRole("region", { name: "Voice answer capture" })).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: "Type your answer" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Submit answer" })).not.toBeInTheDocument();
    });

    it("collapses the saved answer after coaching becomes available", () => {
        render(
            <SharedLivePracticeShell
                facts={createFacts("candidate_led")}
                answerMode="text"
                draftText="My submitted answer"
                answerMutationPhase="analysis_ready"
                feedbackContent={<section aria-label="Coach feedback">Feedback</section>}
                onDraftChange={vi.fn()}
                onSubmit={vi.fn()}
            />,
        );

        const disclosure = screen.getByText("Review your saved answer").closest("details");
        expect(disclosure).not.toHaveAttribute("open");
        expect(screen.getByRole("region", { name: "Coach feedback" })).toBeInTheDocument();
    });
});

function createFacts(audience: "candidate_led" | "invited_candidate") {
    return createSessionRuntimeFacts({
        audience,
        sessionId: "session-1",
        targetRole: "Material Handler",
        interviewStage: "first_interview",
        questionCount: 3,
        currentQuestionIndex: 1,
        questions: [0, 1, 2].map((questionIndex) => ({
            questionKey: `slot-${questionIndex + 1}`,
            questionIndex,
            category: "screening" as const,
            questionText: `Question ${questionIndex + 1}`,
        })),
        completionBehavior: audience === "candidate_led"
            ? {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard?targetRole=material-handler",
            }
            : {
                kind: "invited_debrief",
            },
    });
}
