import { describe, expect, it } from "vitest";
import {
    ALLOWED_SESSION_STATUS_TRANSITIONS,
    assertValidSessionStatusTransition,
    canTransitionSessionStatus,
    transitionSessionStatus
} from "./session-state-machine";
import { InterviewSession } from "./types";

function makeSession(status: InterviewSession["status"]): InterviewSession {
    return {
        id: "session-1",
        status,
        role: "QA Engineer",
        questions: [],
        currentQuestionIndex: 0,
        answers: {},
        initialsRequired: false,
    };
}

describe("session state machine", () => {
    it("defines an explicit transition table for every status", () => {
        expect(ALLOWED_SESSION_STATUS_TRANSITIONS).toMatchObject({
            NOT_STARTED: expect.any(Array),
            GENERATING_QUESTIONS: expect.any(Array),
            IN_SESSION: expect.any(Array),
            AWAITING_EVALUATION: expect.any(Array),
            REVIEWING: expect.any(Array),
            PAUSED: expect.any(Array),
            COMPLETED: expect.any(Array),
            ERROR: expect.any(Array),
        });
    });

    it("allows the expected lifecycle transitions", () => {
        expect(canTransitionSessionStatus("NOT_STARTED", "IN_SESSION")).toBe(true);
        expect(canTransitionSessionStatus("IN_SESSION", "AWAITING_EVALUATION")).toBe(true);
        expect(canTransitionSessionStatus("AWAITING_EVALUATION", "REVIEWING")).toBe(true);
        expect(canTransitionSessionStatus("REVIEWING", "IN_SESSION")).toBe(true);
        expect(canTransitionSessionStatus("IN_SESSION", "COMPLETED")).toBe(true);
        expect(canTransitionSessionStatus("PAUSED", "IN_SESSION")).toBe(true);
    });

    it("rejects illegal transitions", () => {
        expect(canTransitionSessionStatus("NOT_STARTED", "COMPLETED")).toBe(false);
        expect(canTransitionSessionStatus("COMPLETED", "IN_SESSION")).toBe(false);
        expect(canTransitionSessionStatus("REVIEWING", "NOT_STARTED")).toBe(false);
        expect(() => assertValidSessionStatusTransition("COMPLETED", "IN_SESSION")).toThrow(
            "Invalid session status transition: COMPLETED -> IN_SESSION"
        );
    });

    it("applies a valid transition through the shared helper", () => {
        const session = makeSession("IN_SESSION");
        expect(transitionSessionStatus(session, "PAUSED").status).toBe("PAUSED");
    });
});
