import { describe, expect, it, vi } from "vitest";

import {
    SessionQuestionAudioBrowserEngine,
} from "./session-question-audio-browser";

const target = {
    sessionId: "session-1",
    questionKey: "slot-1",
    questionText: "Browser-visible wording must not be trusted by the server.",
};

describe("session question audio browser engine", () => {
    it("prefetches only the stable question key and deduplicates the request", async () => {
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
            void _input;
            void _init;
            return new Response(new Uint8Array([1, 2, 3]));
        });
        const engine = new SessionQuestionAudioBrowserEngine({ fetch: fetchMock });

        engine.prefetch("/candidate/session/session-1/question-audio", target);
        engine.prefetch("/candidate/session/session-1/question-audio", target);

        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
        const init = fetchMock.mock.calls[0][1];
        expect(init?.body).toBe(JSON.stringify({ questionKey: "slot-1" }));
        expect(String(init?.body)).not.toContain(target.questionText);
    });

    it("plays after an explicit unlock and reports the active state", async () => {
        const source = createSource();
        const context = createAudioContext({ source });
        const engine = new SessionQuestionAudioBrowserEngine({
            fetch: vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
                void _input;
                void _init;
                return new Response(new Uint8Array([1, 2, 3]));
            }),
            createAudioContext: () => context as unknown as AudioContext,
        });

        expect(await engine.unlock()).toBe(true);
        await expect(engine.play("/question-audio", target)).resolves.toBe("started");
        expect(source.start).toHaveBeenCalledOnce();
        expect(engine.getSnapshot()).toMatchObject({ phase: "playing" });
    });

    it("fences stale decode completion after navigation stops playback", async () => {
        let releaseDecode!: (buffer: AudioBuffer) => void;
        const decoded = new Promise<AudioBuffer>((resolve) => {
            releaseDecode = resolve;
        });
        const source = createSource();
        const context = createAudioContext({ source, decoded });
        const engine = new SessionQuestionAudioBrowserEngine({
            fetch: vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
                void _input;
                void _init;
                return new Response(new Uint8Array([1, 2, 3]));
            }),
            createAudioContext: () => context as unknown as AudioContext,
        });

        await engine.unlock();
        const playback = engine.play("/question-audio", target);
        await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
        engine.stop();
        releaseDecode({} as AudioBuffer);

        await expect(playback).resolves.toBe("cancelled");
        expect(context.createBufferSource).not.toHaveBeenCalled();
        expect(engine.getSnapshot()).toEqual({ phase: "idle", key: null });
    });
});

function createSource() {
    return {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
    };
}

function createAudioContext(input: {
    source: ReturnType<typeof createSource>;
    decoded?: Promise<AudioBuffer>;
}) {
    return {
        state: "running",
        currentTime: 0,
        destination: {},
        resume: vi.fn(async () => undefined),
        decodeAudioData: vi.fn(async () => input.decoded ? input.decoded : ({} as AudioBuffer)),
        createBufferSource: vi.fn(() => input.source),
    };
}
