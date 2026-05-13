import { beforeEach, describe, expect, it, vi } from "vitest";

const { consumeRateLimitMock } = vi.hoisted(() => ({
    consumeRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/server/rate-limit", () => ({
    consumeRateLimit: consumeRateLimitMock,
}));

describe("candidate mutation boundary", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        consumeRateLimitMock.mockResolvedValue({
            allowed: true,
            remaining: 9,
            resetAt: Date.now() + 60_000,
        });
    });

    it("rate-limits candidate mutations through an operation-specific bucket", async () => {
        const { withCandidateMutationBoundary } = await import("./candidate-mutation-boundary");

        await expect(withCandidateMutationBoundary({
            candidateProfileId: "profile-1",
            operation: "session_answer_submit",
            subjectId: "session-1:question-1",
            mutate: async () => ({ ok: true, value: "submitted" }),
        })).resolves.toEqual({ ok: true, value: "submitted" });

        expect(consumeRateLimitMock).toHaveBeenCalledWith(
            "candidate:profile-1:session_answer_submit:session-1:question-1",
            30,
            60_000,
        );
    });

    it("returns a validation-style failure without running the mutation when the limit is exceeded", async () => {
        consumeRateLimitMock.mockResolvedValue({
            allowed: false,
            remaining: 0,
            resetAt: Date.now() + 60_000,
        });
        const mutate = vi.fn();
        const { withCandidateMutationBoundary } = await import("./candidate-mutation-boundary");

        await expect(withCandidateMutationBoundary({
            candidateProfileId: "profile-1",
            operation: "session_progress",
            subjectId: "session-1",
            mutate,
        })).resolves.toEqual({
            ok: false,
            error: "Too many candidate updates. Please wait and try again.",
        });
        expect(mutate).not.toHaveBeenCalled();
    });

    it("documents state-idempotent policies for candidate server-action mutations", async () => {
        const { getCandidateMutationPolicy } = await import("./candidate-mutation-boundary");

        expect(getCandidateMutationPolicy("session_progress")).toMatchObject({
            idempotencyStrategy: "state",
            idempotencyNote: expect.stringContaining("same target session state"),
        });
        expect(getCandidateMutationPolicy("session_answer_submit")).toMatchObject({
            idempotencyStrategy: "state",
            idempotencyNote: expect.stringContaining("submitted answer"),
        });
        expect(getCandidateMutationPolicy("practice_generation")).toMatchObject({
            idempotencyStrategy: "state",
            idempotencyNote: expect.stringContaining("generating draft"),
        });
    });
});
