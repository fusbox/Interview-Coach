import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeCandidateSessionRequestMock = vi.fn();
const generateSpeechMock = vi.fn();

vi.mock("@/lib/server/candidate-route-auth", () => ({
    authorizeCandidateSessionRequest: authorizeCandidateSessionRequestMock
}));

vi.mock("@/lib/server/services/tts-service", () => ({
    TTSService: {
        generateSpeech: generateSpeechMock
    }
}));

vi.mock("@/lib/logger", () => ({
    Logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe("POST /api/tts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authorizeCandidateSessionRequestMock.mockResolvedValue(null);
        generateSpeechMock.mockResolvedValue({
            audioData: new Uint8Array([1, 2, 3]),
            mimeType: "audio/mpeg"
        });
    });

    it("returns 400 for malformed request payloads", async () => {
        const { POST } = await import("./route");

        const req = new Request("http://localhost/api/tts", {
            method: "POST",
            headers: { "x-session-id": "session-1" },
            body: JSON.stringify({ text: "" })
        });

        const res = await POST(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body).toMatchObject({
            code: "INVALID_REQUEST",
            message: "Invalid request",
            retryable: false
        });
        expect(generateSpeechMock).not.toHaveBeenCalled();
    });
});
