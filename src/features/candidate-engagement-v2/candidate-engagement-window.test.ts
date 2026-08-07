import { describe, expect, it } from "vitest";

import {
    applyCandidateEngagementEvent,
    closeCandidateEngagementWindow,
    createClosedCandidateEngagementWindow,
    readCandidateEngagementAccrual,
    sustainCandidateEngagementRecording,
} from "./candidate-engagement-window";

describe("candidate engagement window", () => {
    it("lets Tier 2 open and extend a 30-second window", () => {
        const opened = applyCandidateEngagementEvent({
            state: createClosedCandidateEngagementWindow(),
            tier: "tier2",
            activity: "answer_input",
            now: 1_000,
        });
        const extended = applyCandidateEngagementEvent({
            state: opened.state,
            tier: "tier2",
            activity: "question_assistance",
            now: 20_000,
        });

        expect(opened.transition).toBe("open");
        expect(opened.state.expiresAt).toBe(31_000);
        expect(extended.transition).toBe("extend");
        expect(extended.state.expiresAt).toBe(50_000);
    });

    it("lets Tier 3 open a 60-second window", () => {
        const result = applyCandidateEngagementEvent({
            state: createClosedCandidateEngagementWindow(),
            tier: "tier3",
            activity: "answer_submit",
            now: 2_000,
        });

        expect(result.state.expiresAt).toBe(62_000);
        expect(result.state.openedBy).toBe("task_progress");
    });

    it("gates accrual on visibility and single-tab leadership", () => {
        const state = applyCandidateEngagementEvent({
            state: createClosedCandidateEngagementWindow(),
            tier: "tier2",
            activity: "session_view",
            now: 0,
        }).state;

        expect(readCandidateEngagementAccrual({ state, from: 0, to: 1_000, isVisible: true, isLeader: true }))
            .toBe(1_000);
        expect(readCandidateEngagementAccrual({ state, from: 0, to: 1_000, isVisible: false, isLeader: true }))
            .toBe(0);
        expect(readCandidateEngagementAccrual({ state, from: 0, to: 1_000, isVisible: true, isLeader: false }))
            .toBe(0);
    });

    it("sustains only the active recording window and closes explicitly", () => {
        const recording = sustainCandidateEngagementRecording(createClosedCandidateEngagementWindow(), 5_000);
        expect(recording.openedBy).toBe("continuous_activity");
        expect(recording.expiresAt).toBe(35_000);
        expect(closeCandidateEngagementWindow(recording).isOpen).toBe(false);
    });
});
