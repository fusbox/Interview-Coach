import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CandidatePlanProgressAction } from "./CandidatePlanProgressAction";

describe("CandidatePlanProgressAction", () => {
    it("posts every missing question to the plan-aware queue boundary", async () => {
        const fetch = vi.fn(async () => new Response(JSON.stringify({
            redirectTo: "/candidate/practice/ready/intent-1",
        }), { status: 201 }));
        const navigate = vi.fn();
        vi.stubGlobal("fetch", fetch);

        render(
            <CandidatePlanProgressAction
                planProgress={{
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "unanswered_planned_questions",
                    title: "Practice the questions you did not answer",
                    body: "Two planned questions still need practice evidence.",
                    href: "/candidate/setup",
                    questionKeys: ["slot-2", "slot-3"],
                    candidatePracticeSessionId: "session-1",
                }}
                label="Finish planned practice"
                navigate={navigate}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /Finish planned practice/i }));

        await waitFor(() => expect(fetch).toHaveBeenCalledWith(
            "/candidate/practice/ready/intents",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    source: "plan_aware_queue",
                    items: [
                        {
                            intent: "coach-update-missing-evidence",
                            fromSession: "session-1",
                            questionKey: "slot-2",
                        },
                        {
                            intent: "coach-update-missing-evidence",
                            fromSession: "session-1",
                            questionKey: "slot-3",
                        },
                    ],
                }),
            }),
        ));
        expect(navigate).toHaveBeenCalledWith("/candidate/practice/ready/intent-1");
    });

    it("creates one plan-aware practice intent from all unanswered question pointers", async () => {
        const createPracticeIntent = vi.fn(async () => "/candidate/practice/ready/intent-1");
        const navigate = vi.fn();

        render(
            <CandidatePlanProgressAction
                planProgress={{
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "unanswered_planned_questions",
                    title: "Practice the questions you did not answer",
                    body: "Two planned questions still need practice evidence.",
                    href: "/candidate/setup",
                    questionKeys: ["slot-2", "slot-3"],
                    candidatePracticeSessionId: "session-1",
                }}
                label="Finish planned practice"
                createPracticeIntent={createPracticeIntent}
                navigate={navigate}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /Finish planned practice/i }));

        expect(screen.getByRole("button", { name: /Preparing practice/i })).toBeDisabled();
        await waitFor(() => expect(createPracticeIntent).toHaveBeenCalledWith({
            candidatePracticeSessionId: "session-1",
            questionKeys: ["slot-2", "slot-3"],
        }));
        expect(navigate).toHaveBeenCalledWith("/candidate/practice/ready/intent-1");
    });

    it("keeps ordinary plan actions as links", () => {
        render(
            <CandidatePlanProgressAction
                planProgress={{
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "active_round",
                    title: "Resume your current practice round.",
                    body: "This round is already part of your Coach Plan.",
                    href: "/candidate/session/session-1",
                    questionKeys: [],
                }}
                label="Resume round"
            />,
        );

        expect(screen.getByRole("link", { name: /Resume round/i })).toHaveAttribute(
            "href",
            "/candidate/session/session-1",
        );
    });
});
