import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";

import {
    CandidateEngagementRuntime,
    type CandidateEngagementActions,
} from "./CandidateEngagementRuntime";

describe("candidate engagement runtime", () => {
    it("keeps tracker and inspector updates outside the answer-composer owner", () => {
        let sessionOwnerRenderCount = 0;

        function SessionOwner() {
            sessionOwnerRenderCount += 1;
            const engagementActionsRef = useRef<CandidateEngagementActions | null>(null);

            return (
                <>
                    <textarea aria-label="Type your answer" defaultValue="" />
                    <CandidateEngagementRuntime
                        ref={engagementActionsRef}
                        enabled
                        inspectorEnabled
                        sessionId="session-1"
                        endpoint="/candidate/session/session-1/engagement"
                    />
                </>
            );
        }

        render(<SessionOwner />);
        const answer = screen.getByRole("textbox", { name: "Type your answer" });

        fireEvent.input(answer, { target: { value: "Every typed character remains responsive." } });
        fireEvent.click(screen.getByRole("button", { name: "Open engagement inspector" }));

        expect(answer).toHaveValue("Every typed character remains responsive.");
        expect(screen.getByRole("complementary", { name: "Engagement inspector" })).toBeInTheDocument();
        expect(sessionOwnerRenderCount).toBe(1);
    });
});
