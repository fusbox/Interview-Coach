import { createHash } from "node:crypto";

import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { describe, expect, it, vi } from "vitest";

import {
    GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_FINGERPRINT,
    GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_MANIFEST,
    GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS,
    GOOGLE_VOICE_TRANSCRIPTION_MODEL,
    GOOGLE_VOICE_TRANSCRIPTION_RESPONSE_SCHEMA,
    GOOGLE_VOICE_TRANSCRIPTION_SYSTEM_INSTRUCTION,
    createGoogleVoiceTranscriptionRuntime,
    type GoogleVoiceTranscriptionTransport,
} from "./google-voice-transcription";

describe("Google voice transcription provider", () => {
    it("binds the exact prompt, schema, model, and settings into immutable configuration identity", () => {
        expect(GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_MANIFEST.systemInstructionFingerprint).toBe(
            createHash("sha256").update(JSON.stringify(GOOGLE_VOICE_TRANSCRIPTION_SYSTEM_INSTRUCTION)).digest("hex"),
        );
        expect(GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_MANIFEST.responseSchemaFingerprint).toBe(
            createHash("sha256").update(JSON.stringify(GOOGLE_VOICE_TRANSCRIPTION_RESPONSE_SCHEMA)).digest("hex"),
        );
        expect(GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
    });

    it("sends only bounded audio plus transcription instructions and accepts strict structured output", async () => {
        const transport = createTransport([providerResponse({
            transcriptText: "I checked the label, recorded the issue, and told my supervisor.",
        })]);
        const runtime = createGoogleVoiceTranscriptionRuntime({ transport });

        await expect(runtime.transcribe({
            audioData: new Uint8Array([1, 2, 3, 4]),
            mimeType: "audio/wav",
            languageHint: "en",
        })).resolves.toEqual({
            transcriptText: "I checked the label, recorded the issue, and told my supervisor.",
        });

        expect(transport.calls).toHaveLength(1);
        const request = transport.calls[0];
        expect(request).toMatchObject({
            model: GOOGLE_VOICE_TRANSCRIPTION_MODEL,
            config: {
                systemInstruction: GOOGLE_VOICE_TRANSCRIPTION_SYSTEM_INSTRUCTION.join("\n"),
                responseMimeType: "application/json",
                responseJsonSchema: GOOGLE_VOICE_TRANSCRIPTION_RESPONSE_SCHEMA,
                temperature: 0,
                maxOutputTokens: 8_192,
                candidateCount: 1,
                seed: 0,
                thinkingConfig: { thinkingBudget: 0, includeThoughts: false },
                httpOptions: { timeout: GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.timeoutMs },
            },
        });
        const parts = readParts(request);
        expect(JSON.parse(String(parts[0]?.text))).toEqual({
            task: "transcribe_spoken_answer_faithfully",
            languageHint: "en",
        });
        expect(parts[1]?.inlineData).toEqual({
            data: Buffer.from([1, 2, 3, 4]).toString("base64"),
            mimeType: "audio/wav",
        });
        const serialized = JSON.stringify(request);
        expect(serialized).not.toMatch(/candidate(Profile|Id)|sessionId|questionText|jobDescription|resume/i);
    });

    it.each(["audio/webm", "audio/mp4"])(
        "preserves the truthful accepted browser MIME %s",
        async (mimeType) => {
        const transport = createTransport([providerResponse({ transcriptText: "Browser recording." })]);
        const runtime = createGoogleVoiceTranscriptionRuntime({ transport });

        await expect(runtime.transcribe({
            audioData: new Uint8Array([1]),
            mimeType,
            languageHint: "en",
        })).resolves.toEqual({ transcriptText: "Browser recording." });
        expect(readParts(transport.calls[0])[1]?.inlineData?.mimeType).toBe(mimeType);
    });

    it("rejects media outside the accepted profile before calling Google", async () => {
        const transport = createTransport([]);
        const runtime = createGoogleVoiceTranscriptionRuntime({ transport });

        await expect(runtime.transcribe({
            audioData: new Uint8Array([1]),
            mimeType: "audio/x-custom",
            languageHint: "en",
        })).rejects.toMatchObject({ failureClass: "unsupported_media_type" });
        expect(transport.calls).toHaveLength(0);
    });

    it.each([
        [providerResponseText("not json"), "provider_output_invalid"],
        [providerResponse({ transcriptText: "  " }), "provider_output_invalid"],
        [providerResponse({ transcriptText: "valid", extra: true }), "provider_output_invalid"],
        [providerResponse({ transcriptText: "x".repeat(20_001) }), "provider_output_invalid"],
        [{ promptFeedback: { blockReason: "SAFETY" } } as unknown as GenerateContentResponse, "provider_safety_blocked"],
        [{ candidates: [{ finishReason: "MAX_TOKENS" }] } as unknown as GenerateContentResponse, "provider_output_invalid"],
    ])("fails closed for invalid or blocked provider output", async (response, failureClass) => {
        const runtime = createGoogleVoiceTranscriptionRuntime({ transport: createTransport([response]) });
        await expect(runtime.transcribe({
            audioData: new Uint8Array([1]),
            mimeType: "audio/wav",
            languageHint: "en",
        })).rejects.toMatchObject({ failureClass });
    });

    it.each([
        [{ status: 429 }, "provider_rate_limited"],
        [{ status: 503 }, "provider_unavailable"],
        [{ status: 401 }, "provider_misconfigured"],
        [{ status: 400 }, "provider_request_rejected"],
        [new Error("private provider detail"), "provider_unavailable"],
    ])("normalizes provider failures without exposing raw detail", async (error, failureClass) => {
        const runtime = createGoogleVoiceTranscriptionRuntime({ transport: createRejectingTransport(error) });
        await expect(runtime.transcribe({
            audioData: new Uint8Array([1]),
            mimeType: "audio/wav",
            languageHint: "en",
        })).rejects.toMatchObject({
            message: "Voice transcription is unavailable.",
            failureClass,
        });
    });
});

function createTransport(responses: GenerateContentResponse[]) {
    const calls: GenerateContentParameters[] = [];
    return {
        calls,
        async generateContent(input: GenerateContentParameters) {
            calls.push(input);
            const response = responses.shift();
            if (!response) throw new Error("Unexpected mocked provider call.");
            return response;
        },
    } satisfies GoogleVoiceTranscriptionTransport & { calls: GenerateContentParameters[] };
}

function createRejectingTransport(error: unknown): GoogleVoiceTranscriptionTransport {
    return { generateContent: vi.fn(async () => { throw error; }) };
}

function providerResponse(value: unknown) {
    return providerResponseText(JSON.stringify(value));
}

function providerResponseText(text: string) {
    return {
        text,
        candidates: [{ finishReason: "STOP" }],
    } as unknown as GenerateContentResponse;
}

function readParts(request: GenerateContentParameters) {
    const contents = Array.isArray(request.contents) ? request.contents : [];
    const content = contents[0];
    if (!content || typeof content === "string" || !("parts" in content)) return [];
    return content.parts ?? [];
}
