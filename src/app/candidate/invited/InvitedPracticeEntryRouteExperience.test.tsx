import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCandidateSetupSessionTransition } from "@/features/candidate-setup-v2/candidate-setup-session-creation";

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
        await waitFor(() => expect(screen.getByRole("heading", { name: "Ready to practice?" })).toBeInTheDocument());
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
});

function session() {
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
