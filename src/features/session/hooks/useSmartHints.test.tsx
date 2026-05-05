import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Blueprint, Question } from "@/lib/domain/types";
import { useSmartHints } from "./useSmartHints";

vi.mock("@/lib/logger", () => ({
    Logger: {
        error: vi.fn(),
    },
}));

const question: Question = {
    id: "question-1",
    text: "Tell me about yourself",
    category: "behavioral",
    index: 0,
};

const blueprint: Blueprint = {
    title: "QA Engineer",
    competencies: [],
};

describe("useSmartHints", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        sessionStorage.clear();
    });

    it("shares an in-flight eager hint request across remounts", async () => {
        let resolveFetch: (response: Response) => void = () => undefined;
        const fetchPromise = new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        });
        const fetchMock = vi.fn().mockReturnValue(fetchPromise);
        vi.stubGlobal("fetch", fetchMock);

        const first = renderHook(() =>
            useSmartHints(question, "session-1", "candidate-token", "QA Engineer", blueprint)
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        first.unmount();

        const second = renderHook(() =>
            useSmartHints(question, "session-1", "candidate-token", "QA Engineer", blueprint)
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveFetch(new Response(JSON.stringify({
                doThis: "Anchor your answer",
                avoidThis: "Do not ramble",
            }), { status: 200 }));
            await fetchPromise;
        });

        await waitFor(() => {
            expect(second.result.current.hints).toEqual({
                doThis: "Anchor your answer",
                avoidThis: "Do not ramble",
            });
        });
        expect(sessionStorage.getItem("smart_hints:session-1:question-1")).toContain("Anchor your answer");
    });

    it("uses the session and question as the idempotency key", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            doThis: "Be specific",
            avoidThis: "Avoid vague claims",
        }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        renderHook(() =>
            useSmartHints(question, "session-1", "candidate-token", "QA Engineer", blueprint)
        );

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [, request] = fetchMock.mock.calls[0];

        expect(request.headers).toMatchObject({
            "Idempotency-Key": "smart_hints:session-1:question-1",
            "x-candidate-token": "candidate-token",
        });
    });
});
