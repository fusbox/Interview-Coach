import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAuthDenialMock = vi.fn();
const loggerErrorMock = vi.fn();
const hashTokenMock = vi.fn((value: string) => `hash:${value}`);
const postgresQueryMock = vi.fn();

vi.mock("@/lib/server/crypto", () => ({
    hashToken: hashTokenMock,
}));

vi.mock("@/lib/server/metrics", () => ({
    recordAuthDenial: recordAuthDenialMock,
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        error: loggerErrorMock,
    },
}));

vi.mock("@/lib/server/db/postgres", () => ({
    getPostgresPool: () => ({
        query: postgresQueryMock,
    }),
}));

describe("candidate token auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        process.env = {
            ...process.env,
            NODE_ENV: "test",
        };
        delete process.env.CANDIDATE_TOKEN_BACKEND;
    });

    it("uses postgres to validate candidate tokens", async () => {
        postgresQueryMock.mockResolvedValue({
            rows: [{ session_id: "session-1" }],
        });

        const { getCandidateTokenBackendName, requireCandidateToken } = await import("./candidate-token");
        const request = new Request("http://localhost/api/session/session-1", {
            headers: { "x-candidate-token": "token-1" },
        });

        const result = await requireCandidateToken(request, "session-1");

        expect(getCandidateTokenBackendName()).toBe("postgres");
        expect(result).toEqual({ ok: true, status: 200 });
        expect(postgresQueryMock).toHaveBeenCalledWith(
            expect.stringContaining("from public.candidate_tokens"),
            ["hash:token-1"]
        );
    });

    it("returns 401 when the candidate token header is missing", async () => {
        const { requireCandidateToken } = await import("./candidate-token");
        const request = new Request("http://localhost/api/session/session-1");

        const result = await requireCandidateToken(request, "session-1");

        expect(result).toEqual({ ok: false, status: 401, error: "Missing candidate token" });
        expect(recordAuthDenialMock).toHaveBeenCalledWith(expect.objectContaining({
            actorType: "candidate",
            reason: "missing_candidate_token",
        }));
    });

    it("returns 403 when the token does not match the session", async () => {
        postgresQueryMock.mockResolvedValue({
            rows: [{ session_id: "different-session" }],
        });

        const { requireCandidateToken } = await import("./candidate-token");
        const request = new Request("http://localhost/api/session/session-1", {
            headers: { "x-candidate-token": "token-1" },
        });

        const result = await requireCandidateToken(request, "session-1");

        expect(result).toEqual({ ok: false, status: 403, error: "Token does not match session" });
        expect(recordAuthDenialMock).toHaveBeenCalledWith(expect.objectContaining({
            actorType: "candidate",
            reason: "candidate_token_session_mismatch",
        }));
    });

    it("issues candidate tokens with postgres", async () => {
        postgresQueryMock.mockResolvedValue({ rows: [] });
        const randomUuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue("issued-token");

        const { issueCandidateToken } = await import("./candidate-token");
        const token = await issueCandidateToken("session-1");

        expect(token).toBe("issued-token");
        expect(postgresQueryMock).toHaveBeenCalledWith(
            expect.stringContaining("insert into public.candidate_tokens"),
            expect.arrayContaining(["session-1", "hash:issued-token"])
        );

        randomUuidSpy.mockRestore();
    });

    it("rejects unsupported candidate token backends", async () => {
        process.env.CANDIDATE_TOKEN_BACKEND = "file";

        const { getCandidateTokenBackendName } = await import("./candidate-token");

        expect(() => getCandidateTokenBackendName()).toThrow(
            'Unsupported CANDIDATE_TOKEN_BACKEND value "file". Expected "postgres".'
        );
    });
});
