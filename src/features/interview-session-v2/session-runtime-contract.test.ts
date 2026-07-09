import { describe, expect, it } from "vitest";

import {
    createSessionRuntimeProgress,
    isQuestionSurfaceProgress,
    isSessionRuntimeProgressStatus,
    type SessionRuntimeConsumer,
} from "./session-runtime-contract";

describe("session runtime contract", () => {
    it("creates shared progress states for preview and live question surfaces", () => {
        expect(createSessionRuntimeProgress({
            status: "question_preview",
            currentQuestionIndex: 2,
        })).toEqual({
            status: "question_preview",
            currentQuestionIndex: 2,
        });

        expect(createSessionRuntimeProgress({
            status: "live_question",
            currentQuestionIndex: 0,
        })).toEqual({
            status: "live_question",
            currentQuestionIndex: 0,
        });
    });

    it("classifies question surfaces separately from the planned session surface", () => {
        expect(isQuestionSurfaceProgress({
            status: "planned",
            currentQuestionIndex: 0,
        })).toBe(false);
        expect(isQuestionSurfaceProgress({
            status: "question_preview",
            currentQuestionIndex: 0,
        })).toBe(true);
        expect(isQuestionSurfaceProgress({
            status: "live_question",
            currentQuestionIndex: 0,
        })).toBe(true);
    });

    it("recognizes every allowed progress status for route and repository validation", () => {
        expect(isSessionRuntimeProgressStatus("planned")).toBe(true);
        expect(isSessionRuntimeProgressStatus("question_preview")).toBe(true);
        expect(isSessionRuntimeProgressStatus("live_question")).toBe(true);
        expect(isSessionRuntimeProgressStatus("answered")).toBe(false);
        expect(isSessionRuntimeProgressStatus(null)).toBe(false);
    });

    it("models candidate-led and invited consumers without boolean flags", () => {
        const candidateLed: SessionRuntimeConsumer = {
            kind: "candidate_led",
            completionBehavior: {
                kind: "candidate_dashboard",
                dashboardHref: "/candidate/dashboard",
            },
        };
        const invitedCandidate: SessionRuntimeConsumer = {
            kind: "invited_candidate",
            completionBehavior: {
                kind: "invited_debrief",
            },
        };

        expect(candidateLed.kind).toBe("candidate_led");
        expect(candidateLed.completionBehavior.kind).toBe("candidate_dashboard");
        expect(invitedCandidate.kind).toBe("invited_candidate");
        expect(invitedCandidate.completionBehavior.kind).toBe("invited_debrief");
    });
});
