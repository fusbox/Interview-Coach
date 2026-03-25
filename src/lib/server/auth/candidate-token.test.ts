import { beforeEach, describe, expect, it, vi } from "vitest";

const createAdminClientMock = vi.fn();
const recordAuthDenialMock = vi.fn();
const loggerErrorMock = vi.fn();
const hashTokenMock = vi.fn((value: string) => `hash:${value}`);

vi.mock("@/lib/supabase/server", () => ({
    createAdminClient: createAdminClientMock,
}));

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

describe("candidate token auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env = {
            ...process.env,
            NODE_ENV: "test",
        };
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it("uses the admin client to validate candidate tokens", async () => {
        const singleMock = vi.fn().mockResolvedValue({
            data: { session_id: "session-1" },
            error: null,
        });
        const eqMock = vi.fn().mockReturnValue({ single: singleMock });
        const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
        createAdminClientMock.mockReturnValue({
            from: vi.fn().mockReturnValue({ select: selectMock }),
        });

        const { requireCandidateToken } = await import("./candidate-token");
        const request = new Request("http://localhost/api/session/session-1", {
            headers: { "x-candidate-token": "token-1" },
        });

        const result = await requireCandidateToken(request, "session-1");

        expect(result).toEqual({ ok: true, status: 200 });
        expect(createAdminClientMock).toHaveBeenCalledTimes(1);
        expect(hashTokenMock).toHaveBeenCalledWith("token-1");
    });

    it("returns 401 when the candidate token header is missing", async () => {
        const { requireCandidateToken } = await import("./candidate-token");
        const request = new Request("http://localhost/api/session/session-1");

        const result = await requireCandidateToken(request, "session-1");

        expect(result).toEqual({ ok: false, status: 401, error: "Missing candidate token" });
        expect(createAdminClientMock).not.toHaveBeenCalled();
        expect(recordAuthDenialMock).toHaveBeenCalledWith(expect.objectContaining({
            actorType: "candidate",
            reason: "missing_candidate_token",
        }));
    });

    it("returns 403 when the token does not match the session", async () => {
        const singleMock = vi.fn().mockResolvedValue({
            data: { session_id: "different-session" },
            error: null,
        });
        const eqMock = vi.fn().mockReturnValue({ single: singleMock });
        const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
        createAdminClientMock.mockReturnValue({
            from: vi.fn().mockReturnValue({ select: selectMock }),
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

    it("issues candidate tokens with the admin client", async () => {
        const insertMock = vi.fn().mockResolvedValue({ error: null });
        createAdminClientMock.mockReturnValue({
            from: vi.fn().mockReturnValue({ insert: insertMock }),
        });
        const randomUuidSpy = vi.spyOn(crypto, "randomUUID").mockReturnValue("issued-token");

        const { issueCandidateToken } = await import("./candidate-token");
        const token = await issueCandidateToken("session-1");

        expect(token).toBe("issued-token");
        expect(createAdminClientMock).toHaveBeenCalledTimes(1);
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            session_id: "session-1",
            token_hash: "hash:issued-token",
        }));

        randomUuidSpy.mockRestore();
    });
});
