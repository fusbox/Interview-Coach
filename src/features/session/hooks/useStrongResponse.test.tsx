import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useStrongResponse } from "./useStrongResponse";

vi.mock("@/lib/logger", () => ({
    Logger: {
        error: vi.fn(),
    },
}));

describe("useStrongResponse", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        sessionStorage.clear();
    });

    it("supports authenticated candidate sessions without an invite token", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            strongResponse: "A strong candidate answer",
            whyThisWorks: "It is role-specific",
        }), { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);

        const { result } = renderHook(() =>
            useStrongResponse(
                "question-1",
                "Tell me about a time you adapted quickly.",
                "session-1",
                undefined,
                "Manufacturing Technician",
            )
        );

        await act(async () => {
            await result.current.fetchStrongResponse();
        });

        await waitFor(() => {
            expect(result.current.data?.strongResponse).toBe("A strong candidate answer");
        });
        const [, request] = fetchMock.mock.calls[0];

        expect(request.headers).toMatchObject({
            "Content-Type": "application/json",
        });
        expect(request.headers).not.toHaveProperty("x-candidate-token");
    });
});
