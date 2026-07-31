import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCandidateSetupSessionTransition } from "@/features/candidate-setup-v2/candidate-setup-session-creation";
import type { CandidateProvisionalSessionRecord } from "@/features/candidate-session-v2/candidate-provisional-session-store";

import { InvitedPracticeEntryRouteExperience } from "./InvitedPracticeEntryRouteExperience";

describe("invited practice route experience", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("persists initials, advances on mismatch, and reaches the shared transition", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ initialsConfirmed: true }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        ));
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => (
            window.setTimeout(() => callback(performance.now()), 0)
        ));
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation((handle) => window.clearTimeout(handle));
        render(
            <StrictMode>
                <InvitedPracticeEntryRouteExperience
                    targetRole="Quality Inspector"
                    stageLabel="Screening call"
                    questionCount={5}
                    initialsConfirmed={false}
                    initialSession={session()}
                />
            </StrictMode>,
        );

        fireEvent.change(screen.getByRole("textbox", { name: "Your initials" }), { target: { value: "XX" } });
        fireEvent.click(screen.getByRole("button", { name: "Review practice" }));
        await waitFor(() => expect(
            screen.getByRole("heading", { level: 1, name: "Quality Inspector" }),
        ).toBeInTheDocument());
        expect(screen.getByText(/Ready to practice\?/i)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith("/candidate/invited/initials", expect.objectContaining({
            method: "POST",
            credentials: "same-origin",
            body: JSON.stringify({ initials: "XX" }),
        }));

        vi.useFakeTimers();
        fireEvent.click(screen.getByRole("button", { name: "Start practice" }));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(2_000);
        });
        expect(screen.queryByRole("heading", { name: "Entering practice space" })).not.toBeInTheDocument();
        expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            "/candidate/invited/session/30000000-0000-4000-8000-000000000001/progress",
            expect.objectContaining({
                method: "PUT",
                body: JSON.stringify({ status: "live_question", currentQuestionIndex: 0 }),
            }),
        );
    });

    it("pauses an active invited round in place and resumes the exact question", async () => {
        vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(
            JSON.stringify({ status: "answer_draft_saved" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        )));
        const initialSession = session();
        initialSession.progress = {
            status: "live_question",
            currentQuestionIndex: 2,
        };

        render(
            <InvitedPracticeEntryRouteExperience
                targetRole="Quality Inspector"
                stageLabel="Screening call"
                questionCount={5}
                initialsConfirmed
                initialSession={initialSession}
            />,
        );

        expect(screen.getByText("Question 3 of 5")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Pause session" }));

        expect(await screen.findByRole("heading", { name: "Your progress is saved." })).toBeInTheDocument();
        expect(screen.getByText(/reopening the personal link in your invitation email/i)).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Resume practice" }));
        expect(screen.getByText("Question 3 of 5")).toBeInTheDocument();
    });

    it("does not claim progress is saved until the active draft flush succeeds", async () => {
        const initialSession = session();
        const activeQuestion = initialSession.questionWordingSnapshot!.questions[0];
        initialSession.progress = {
            status: "live_question",
            currentQuestionIndex: 0,
        };
        initialSession.answerDrafts = {
            [activeQuestion.slotId]: {
                slotId: activeQuestion.slotId,
                questionIndex: 0,
                mode: "text",
                text: "My current draft",
                updatedAt: "2026-07-20T00:01:00.000Z",
            },
        };
        const fetchMock = vi.fn().mockImplementation(async () => new Response(
            JSON.stringify({ status: "answer_draft_saved" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
        ));
        vi.stubGlobal("fetch", fetchMock);

        render(
            <InvitedPracticeEntryRouteExperience
                targetRole="Quality Inspector"
                stageLabel="Screening call"
                questionCount={5}
                initialsConfirmed
                initialSession={initialSession}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Pause session" }));
        expect(screen.queryByRole("heading", { name: "Your progress is saved." })).not.toBeInTheDocument();

        expect(await screen.findByRole("heading", { name: "Your progress is saved." })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            `/candidate/invited/session/${initialSession.sessionId}/answer-drafts`,
            expect.objectContaining({ method: "PUT" }),
        );
    });

    it("keeps the session open when the active draft cannot be saved", async () => {
        const initialSession = session();
        const activeQuestion = initialSession.questionWordingSnapshot!.questions[0];
        initialSession.progress = {
            status: "live_question",
            currentQuestionIndex: 0,
        };
        initialSession.answerDrafts = {
            [activeQuestion.slotId]: {
                slotId: activeQuestion.slotId,
                questionIndex: 0,
                mode: "text",
                text: "My current draft",
                updatedAt: "2026-07-20T00:01:00.000Z",
            },
        };
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ status: "unavailable" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
        )));

        render(
            <InvitedPracticeEntryRouteExperience
                targetRole="Quality Inspector"
                stageLabel="Screening call"
                questionCount={5}
                initialsConfirmed
                initialSession={initialSession}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Pause session" }));

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/aren't saved yet/i));
        expect(screen.getByText("Question 1 of 5")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Your progress is saved." })).not.toBeInTheDocument();
    });
});

function session(): CandidateProvisionalSessionRecord {
    return createCandidateSetupSessionTransition({
        payload: {
            targetRole: "Quality Inspector",
            jobDescription: "Inspect finished goods and document quality findings.",
            resumeText: "",
            interviewStage: "screening",
            questionCount: "5",
        },
        now: new Date("2026-07-20T00:00:00.000Z"),
        createSessionId: () => "30000000-0000-4000-8000-000000000001",
    });
}
