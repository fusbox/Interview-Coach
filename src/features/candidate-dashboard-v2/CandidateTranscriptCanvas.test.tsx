import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CandidateTranscriptCanvas } from "./CandidateTranscriptCanvas";
import type { CandidateTranscriptCanvasProjection } from "./candidate-transcript-canvas";

describe("CandidateTranscriptCanvas", () => {
    it("keeps the transcript selectable and exposes accepted evidence on click", () => {
        const { container } = render(
            <CandidateTranscriptCanvas
                answerText="I checked the shipment records and corrected the count."
                projection={createProjection()}
                isCurrent
            />,
        );

        const trigger = screen.getByRole("button", { name: "checked the shipment records" });
        expect(trigger).toHaveAttribute("tabindex", "0");
        expect(container.querySelector("blockquote")?.textContent).toBe(
            "I checked the shipment records and corrected the count.",
        );

        fireEvent.click(trigger);

        expect(screen.getByText("Evidence in your answer")).toBeInTheDocument();
        expect(screen.getByText("Specific detail")).toBeInTheDocument();
        expect(screen.getByText("You used a concrete work detail.")).toBeInTheDocument();
    });

    it("removes annotation triggers from the tab order on a noncurrent slide", () => {
        render(
            <CandidateTranscriptCanvas
                answerText="I checked the shipment records and corrected the count."
                projection={createProjection()}
                isCurrent={false}
            />,
        );

        expect(screen.getByRole("button", { name: "checked the shipment records" })).toHaveAttribute("tabindex", "-1");
    });

    it("falls back to a plain continuous transcript without inventing annotations", () => {
        const { container } = render(
            <CandidateTranscriptCanvas
                answerText="A legacy accepted answer remains readable."
                projection={null}
                isCurrent
            />,
        );

        expect(container.querySelector("blockquote")?.textContent).toBe("A legacy accepted answer remains readable.");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByText("Evidence in your answer")).not.toBeInTheDocument();
    });

    it("places whole-answer and missing-signal notes beside the transcript", () => {
        const projection = createProjection();
        projection.annotations = [];
        projection.wholeAnswerIndicators = [{
            id: "whole-answer-very-short",
            basis: { kind: "whole_answer", signalId: "very_short" },
            label: "Add support",
            message: "This response needs more support before a useful answer pattern is clear.",
        }];
        projection.primaryGap = {
            id: "gap-missing-result",
            basis: { kind: "missing_expected_signal", signalId: "missing_result" },
            label: "Try next",
            message: "Add what happened because of your action.",
            suggestedShape: ["brief situation", "personal action", "result or learning"],
        };

        render(
            <CandidateTranscriptCanvas answerText="I helped." projection={projection} isCurrent />,
        );

        expect(screen.getByRole("region", { name: "Answer-level coach notes" })).toHaveTextContent("Add support");
        expect(screen.getByRole("complementary", { name: "A useful signal to add" })).toHaveTextContent(
            "brief situation / personal action / result or learning",
        );
        expect(screen.queryByRole("button", { name: "I helped." })).not.toBeInTheDocument();
    });
});

function createProjection(): CandidateTranscriptCanvasProjection {
    return {
        status: "candidate_transcript_canvas_v1",
        answerAttemptId: "attempt-1",
        evaluationRunId: "run-1",
        inputFingerprint: "a".repeat(64),
        transcriptFingerprint: "b".repeat(64),
        annotations: [{
            id: "annotation-2-30",
            quote: "checked the shipment records",
            start: 2,
            end: 30,
            basis: { kind: "span", spanIds: ["span-1"] },
            markerIds: ["specific_detail"],
            indicators: [{
                kind: "acknowledgement",
                label: "Coach noticed",
                message: "You used a concrete work detail.",
            }],
        }],
        wholeAnswerIndicators: [],
        primaryGap: null,
    };
}
