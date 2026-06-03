import { beforeEach, describe, expect, it, vi } from "vitest";

class MockAudioContext {
    state = "suspended";
    currentTime = 0;
    destination = {};

    async resume() {
        this.state = "running";
    }

    async decodeAudioData(arrayBuffer: ArrayBuffer) {
        return { arrayBuffer };
    }

    createBufferSource() {
        return {
            buffer: null,
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null,
        };
    }
}

describe("audioEngine", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubGlobal("AudioContext", MockAudioContext);
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
            }),
        );
    });

    it("prefetches TTS audio before a user gesture has unlocked playback", async () => {
        const { audioEngine } = await import("./audio-engine");

        audioEngine.prefetch("question-1", "Tell me about a release you improved.", { sessionId: "session-1" });

        await vi.waitFor(() => {
            expect(fetch).toHaveBeenCalledWith("/api/tts", expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                    "x-session-id": "session-1",
                }),
                body: JSON.stringify({ text: "Tell me about a release you improved." }),
            }));
        });
    });
});
