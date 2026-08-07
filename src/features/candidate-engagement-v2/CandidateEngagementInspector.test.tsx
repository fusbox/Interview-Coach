import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CandidateEngagementInspector } from "./CandidateEngagementInspector";
import type { CandidateEngagementTracker } from "./useCandidateEngagementTracker";

const TRACKER: CandidateEngagementTracker = {
    enabled: true,
    isLeader: true,
    isWindowOpen: true,
    windowTimeRemaining: 27,
    localActiveMilliseconds: 8_000,
    serverSummary: {
        activeMilliseconds: 18_000,
        sliceCount: 2,
        firstReceivedAt: "2026-08-05T15:00:00.000Z",
        lastReceivedAt: "2026-08-05T15:00:18.000Z",
    },
    pendingSliceCount: 1,
    persistenceState: "saving",
    debugEvents: [{
        id: "11111111-1111-4111-8111-111111111111",
        timestamp: Date.parse("2026-08-05T15:00:00.000Z"),
        type: "window_open",
        tier: "tier2",
        detail: "answer_input",
    }],
    trackEvent: vi.fn(),
    flush: vi.fn(async () => true),
    clearDebugEvents: vi.fn(),
};

describe("candidate engagement inspector", () => {
    it("stays hidden until its dev trigger opens the event log", () => {
        render(<CandidateEngagementInspector enabled tracker={TRACKER} />);
        expect(screen.queryByRole("complementary", { name: "Engagement inspector" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Open engagement inspector" }));

        expect(screen.getByRole("complementary", { name: "Engagement inspector" })).toBeInTheDocument();
        expect(screen.getByText("answer_input")).toBeInTheDocument();
        expect(screen.getByText("27s")).toBeInTheDocument();
        expect(screen.queryByText(/ai inspection|prompt context/i)).not.toBeInTheDocument();
    });

    it("renders nothing when the dev-only gate is closed", () => {
        const { container } = render(<CandidateEngagementInspector enabled={false} tracker={TRACKER} />);
        expect(container).toBeEmptyDOMElement();
    });
});
