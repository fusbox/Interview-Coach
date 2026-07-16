import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    CandidateFixedPracticeAction,
    CandidatePlanProgressAction,
} from "./CandidatePlanProgressAction";

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

    it("claims a fixed-set launch before React can render its disabled state", async () => {
        let resolveIntent!: (value: string | null) => void;
        const createPracticeIntent = vi.fn(() => new Promise<string | null>((resolve) => {
            resolveIntent = resolve;
        }));

        render(
            <CandidateFixedPracticeAction
                source="plan_aware_queue"
                label="Finish planned practice"
                items={[{ intent: "coach-update-missing-evidence", fromSession: "session-1", questionKey: "slot-2" }]}
                createPracticeIntent={createPracticeIntent}
                navigate={vi.fn()}
            />,
        );

        const action = screen.getByRole("button", { name: /Finish planned practice/i });
        fireEvent.click(action);
        fireEvent.click(action);

        expect(createPracticeIntent).toHaveBeenCalledOnce();
        resolveIntent("/candidate/practice/ready/intent-1");
        await waitFor(() => expect(screen.getByRole("button", { name: /Preparing practice/i })).toBeDisabled());
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

    it("does not route completed selected-context practice through generic setup", () => {
        render(
            <CandidatePlanProgressAction
                planProgress={{
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "completed_plan",
                    title: "The latest round is complete.",
                    body: "You answered every planned question in this round.",
                    href: null,
                    questionKeys: [],
                }}
                label="Open practice builder"
            />,
        );

        expect(screen.queryByRole("link", { name: "Open practice builder" })).not.toBeInTheDocument();
    });

    it("keeps a fixed coach bundle on the same immutable ready-intent boundary", async () => {
        const createPracticeIntent = vi.fn(async () => "/candidate/practice/ready/bundle-1");
        const navigate = vi.fn();

        render(
            <CandidateFixedPracticeAction
                source="coach_bundle"
                label="Practice this bundle"
                items={[
                    { intent: "coach-update-feedback-focus", fromSession: "session-1", questionKey: "slot-1" },
                    { intent: "coach-update-missing-evidence", fromSession: "session-1", questionKey: "slot-2" },
                ]}
                createPracticeIntent={createPracticeIntent}
                navigate={navigate}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /Practice this bundle/i }));

        await waitFor(() => expect(createPracticeIntent).toHaveBeenCalledWith({
            source: "coach_bundle",
            items: [
                { intent: "coach-update-feedback-focus", fromSession: "session-1", questionKey: "slot-1" },
                { intent: "coach-update-missing-evidence", fromSession: "session-1", questionKey: "slot-2" },
            ],
        }));
        expect(navigate).toHaveBeenCalledWith("/candidate/practice/ready/bundle-1");
    });

    it("offers unanswered-plan coverage as a fixed action with an editable alternative", () => {
        const onCustomize = vi.fn();
        render(
            <CandidatePlanProgressAction
                planProgress={{
                    status: "candidate_dashboard_plan_progress_ready",
                    label: "Plan progress",
                    source: "unanswered_planned_questions",
                    title: "Practice the questions you did not answer",
                    body: "Two planned questions still need practice evidence.",
                    href: null,
                    questionKeys: ["slot-2", "slot-3"],
                    candidatePracticeSessionId: "session-1",
                }}
                label="Finish planned practice"
                onCustomize={onCustomize}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Customize round" }));
        expect(onCustomize).toHaveBeenCalledOnce();
    });
});
