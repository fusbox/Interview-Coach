import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionQuery } from "./useSessionQuery";
import { STORAGE_KEYS } from "@/lib/constants";
import { InterviewSession } from "@/lib/domain/types";

const { getMock } = vi.hoisted(() => ({
    getMock: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
    ApiClient: {
        get: getMock
    }
}));

describe("useSessionQuery", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    it("rehydrates a stored session id and preserves it on successful fetch", async () => {
        const session: InterviewSession = {
            id: "session-1",
            status: "IN_SESSION",
            role: "QA Engineer",
            currentQuestionIndex: 0,
            questions: [{ id: "q1", text: "Q1", category: "General", index: 0 }],
            answers: {},
            initialsRequired: false
        };

        localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, "session-1");
        getMock.mockResolvedValue(session);

        const { result } = renderHook(() => useSessionQuery(undefined, "candidate-token"));

        await waitFor(() => expect(result.current.session?.id).toBe("session-1"));

        expect(getMock).toHaveBeenCalledWith("/api/session/session-1", {
            token: "candidate-token",
            schema: expect.anything()
        });
        expect(localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION_ID)).toBe("session-1");
    });

    it("clears stored session id and settles to null when rehydration fails", async () => {
        localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION_ID, "broken-session");
        getMock.mockRejectedValue(new Error("schema parse failed"));

        const { result } = renderHook(() => useSessionQuery());

        await waitFor(() => expect(result.current.session).toBeNull());

        expect(localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION_ID)).toBeNull();
    });
});
