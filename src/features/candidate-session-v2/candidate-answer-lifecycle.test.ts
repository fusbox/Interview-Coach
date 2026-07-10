import { describe, expect, it } from "vitest";

import {
    createCandidateAnswerAnalysisRequest,
    createCandidateAnswerAnalysisUnavailable,
    createCandidateAnswerDraftChange,
    createCandidateAnswerSubmission,
    createCandidateAnswerSubmitRequest,
    createCandidateAnswerSubmitUnavailable,
} from "./candidate-answer-lifecycle";

describe("candidate answer lifecycle", () => {
    it("creates a normalized text draft change event", () => {
        expect(createCandidateAnswerDraftChange({
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            text: "  I would ask a clarifying question first.  ",
            now: new Date("2026-07-09T20:00:00.000Z"),
        })).toEqual({
            status: "answer_draft_changed",
            draft: {
                slotId: "slot-1",
                questionIndex: 0,
                mode: "text",
                text: "I would ask a clarifying question first.",
                updatedAt: "2026-07-09T20:00:00.000Z",
            },
        });
    });

    it("fails answer submission closed until the lifecycle is wired", () => {
        const draftChange = createCandidateAnswerDraftChange({
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            text: "I would ask a clarifying question first.",
            now: new Date("2026-07-09T20:00:00.000Z"),
        });
        const submitRequest = createCandidateAnswerSubmitRequest({
            draft: draftChange.draft,
            requestedAt: new Date("2026-07-09T20:01:00.000Z"),
        });

        expect(submitRequest).toEqual({
            status: "answer_submit_requested",
            draft: draftChange.draft,
            requestedAt: "2026-07-09T20:01:00.000Z",
        });
        expect(createCandidateAnswerSubmitUnavailable({
            request: submitRequest,
        })).toEqual({
            status: "answer_submit_unavailable",
            reason: "answer_lifecycle_not_connected",
            request: submitRequest,
        });
    });

    it("creates a pending-analysis answer submission from a submit request", () => {
        const draftChange = createCandidateAnswerDraftChange({
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            text: "I would ask a clarifying question first.",
            now: new Date("2026-07-09T20:00:00.000Z"),
        });
        const submitRequest = createCandidateAnswerSubmitRequest({
            draft: draftChange.draft,
            requestedAt: new Date("2026-07-09T20:01:00.000Z"),
        });

        expect(createCandidateAnswerSubmission({
            request: submitRequest,
        })).toEqual({
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text",
            text: "I would ask a clarifying question first.",
            submittedAt: "2026-07-09T20:01:00.000Z",
            status: "pending_analysis",
        });
    });

    it("creates an analysis request from a saved pending answer and fails closed when no provider is configured", () => {
        const answerSubmission = {
            slotId: "slot-1",
            questionIndex: 0,
            mode: "text" as const,
            text: "I would ask a clarifying question first.",
            submittedAt: "2026-07-09T20:01:00.000Z",
            status: "pending_analysis" as const,
        };

        const request = createCandidateAnswerAnalysisRequest({
            answerSubmission,
            requestedAt: new Date("2026-07-09T20:02:00.000Z"),
        });

        expect(request).toEqual({
            status: "answer_analysis_requested",
            answerSubmission,
            requestedAt: "2026-07-09T20:02:00.000Z",
        });
        expect(createCandidateAnswerAnalysisUnavailable({
            request,
        })).toEqual({
            status: "answer_analysis_unavailable",
            reason: "provider_not_configured",
            request,
        });
    });
});
