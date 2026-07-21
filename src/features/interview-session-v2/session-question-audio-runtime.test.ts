import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import {
    createSessionQuestionAudioCache,
    createSessionQuestionAudioRuntimeFromEnvironment,
    isSessionQuestionAudioRuntimeAvailable,
    SESSION_QUESTION_AUDIO_MODEL,
    SESSION_QUESTION_AUDIO_PROFILE_ID,
    SESSION_QUESTION_AUDIO_PROVIDER,
    SESSION_QUESTION_AUDIO_VOICE,
    SessionQuestionAudioRuntimeError,
} from "./session-question-audio-runtime";

const configuredEnvironment = {
    GEMINI_API_KEY: "test-key",
    SESSION_QUESTION_AUDIO_PROVIDER,
    SESSION_QUESTION_AUDIO_PROFILE: SESSION_QUESTION_AUDIO_PROFILE_ID,
};

describe("session question audio runtime", () => {
    it("requires an explicit provider, profile, and credential", () => {
        expect(isSessionQuestionAudioRuntimeAvailable(configuredEnvironment)).toBe(true);
        expect(isSessionQuestionAudioRuntimeAvailable({
            ...configuredEnvironment,
            GEMINI_API_KEY: "",
        })).toBe(false);
        expect(createSessionQuestionAudioRuntimeFromEnvironment({
            env: { ...configuredEnvironment, SESSION_QUESTION_AUDIO_PROVIDER: "fixture" },
        })).toBeNull();
    });

    it("requests exact-recitation audio and wraps provider PCM as WAV", async () => {
        const generateContent = vi.fn(async (_request: GenerateContentParameters) => {
            void _request;
            return audioResponse(Buffer.from([1, 2, 3, 4]));
        });
        const runtime = createSessionQuestionAudioRuntimeFromEnvironment({
            env: configuredEnvironment,
            transportFactory: () => ({ generateContent }),
            cache: createSessionQuestionAudioCache(),
        });

        const result = await runtime?.generateQuestionAudio("  Tell me about your work.  ");

        expect(result?.mimeType).toBe("audio/wav");
        expect(result?.audioData.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(result?.audioData.subarray(8, 12).toString("ascii")).toBe("WAVE");
        expect(result?.cacheOutcome).toBe("miss");
        expect(generateContent).toHaveBeenCalledOnce();
        const request = generateContent.mock.calls[0][0];
        expect(request.model).toBe(SESSION_QUESTION_AUDIO_MODEL);
        expect(request.config?.responseModalities).toEqual(["AUDIO"]);
        expect(JSON.stringify(request.config?.speechConfig)).toContain(
            `"voiceName":"${SESSION_QUESTION_AUDIO_VOICE}"`,
        );
        expect(JSON.stringify(request.contents)).toContain("Tell me about your work.");
        expect(JSON.stringify(request.contents)).toContain("exactly as written");
    });

    it("deduplicates concurrent generation and then serves the stable cache", async () => {
        let release!: (response: GenerateContentResponse) => void;
        const pending = new Promise<GenerateContentResponse>((resolve) => {
            release = resolve;
        });
        const generateContent = vi.fn((_request: GenerateContentParameters) => {
            void _request;
            return pending;
        });
        const runtime = createSessionQuestionAudioRuntimeFromEnvironment({
            env: configuredEnvironment,
            transportFactory: () => ({ generateContent }),
            cache: createSessionQuestionAudioCache(),
        });

        const first = runtime!.generateQuestionAudio("What interests you about this role?");
        const joined = runtime!.generateQuestionAudio("What interests you about this role?");
        release(audioResponse(Buffer.from([5, 6, 7, 8])));

        expect((await first).cacheOutcome).toBe("miss");
        expect((await joined).cacheOutcome).toBe("joined");
        expect((await runtime!.generateQuestionAudio("What interests you about this role?")).cacheOutcome).toBe("hit");
        expect(generateContent).toHaveBeenCalledOnce();
    });

    it("fails with a safe typed error when provider audio is missing", async () => {
        const runtime = createSessionQuestionAudioRuntimeFromEnvironment({
            env: configuredEnvironment,
            transportFactory: () => ({
                generateContent: vi.fn(async (_request: GenerateContentParameters) => {
                    void _request;
                    return {} as GenerateContentResponse;
                }),
            }),
            cache: createSessionQuestionAudioCache(),
        });

        await expect(runtime?.generateQuestionAudio("Question text"))
            .rejects.toMatchObject({
                failureClass: "invalid_output",
                safeCode: "QUESTION_AUDIO_OUTPUT_MISSING",
            } satisfies Partial<SessionQuestionAudioRuntimeError>);
    });
});

function audioResponse(pcm: Buffer): GenerateContentResponse {
    return {
        candidates: [{
            content: {
                role: "model",
                parts: [{
                    inlineData: {
                        data: pcm.toString("base64"),
                        mimeType: "audio/L16;codec=pcm;rate=24000",
                    },
                }],
            },
        }],
    } as GenerateContentResponse;
}
