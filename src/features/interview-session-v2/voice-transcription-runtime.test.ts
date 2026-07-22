import { describe, expect, it, vi } from "vitest";

import {
    SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED_ENV,
    SESSION_VOICE_TRANSCRIPTION_PROFILE_ENV,
    SESSION_VOICE_TRANSCRIPTION_PROVIDER_ENV,
    createVoiceTranscriptionRuntimeFromEnvironment,
    isVoiceTranscriptionRuntimeAvailable,
    normalizeProviderTranscript,
} from "./voice-transcription-runtime";
import {
    GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_FINGERPRINT,
    GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
} from "./google-voice-transcription";

const fixtureEnv = {
    NODE_ENV: "test",
    [SESSION_VOICE_TRANSCRIPTION_PROVIDER_ENV]: "fixture",
    [SESSION_VOICE_TRANSCRIPTION_PROFILE_ENV]: "fixture_voice_transcription_v1",
    [SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED_ENV]: "true",
} as NodeJS.ProcessEnv;

describe("voice transcription runtime", () => {
    it("requires explicit fixture opt-in and returns deterministic faithful text", async () => {
        const runtime = createVoiceTranscriptionRuntimeFromEnvironment({ env: fixtureEnv });
        await expect(runtime.transcribe({
            audioData: new Uint8Array([1]),
            mimeType: "audio/webm",
            languageHint: "en",
        })).resolves.toEqual({ transcriptText: "Fixture voice transcript." });
        expect(runtime.configurationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    });

    it("blocks fixture use in production", () => {
        expect(() => createVoiceTranscriptionRuntimeFromEnvironment({
            env: { ...fixtureEnv, NODE_ENV: "production" },
        })).toThrowError(expect.objectContaining({ failureClass: "fixture_not_allowed" }));
    });

    it("selects only the exact credentialed Google profile and does not retain its key", () => {
        const transportFactory = vi.fn(() => ({
            generateContent: vi.fn(),
        }));
        const runtime = createVoiceTranscriptionRuntimeFromEnvironment({
            env: {
                NODE_ENV: "test",
                SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai",
                SESSION_VOICE_TRANSCRIPTION_PROFILE: GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
                GEMINI_API_KEY: " server-only-secret ",
            },
            googleTransportFactory: transportFactory,
        });

        expect(transportFactory).toHaveBeenCalledWith("server-only-secret");
        expect(runtime).toMatchObject({
            provider: "google_genai",
            profileId: GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
            modelName: "gemini-2.5-flash",
            configurationFingerprint: GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_FINGERPRINT,
        });
        expect(JSON.stringify(runtime)).not.toContain("server-only-secret");
    });

    it("exposes voice controls only for an exact usable runtime configuration", () => {
        expect(isVoiceTranscriptionRuntimeAvailable({
            NODE_ENV: "test",
            SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai",
            SESSION_VOICE_TRANSCRIPTION_PROFILE: GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
            GEMINI_API_KEY: "secret",
        })).toBe(true);
        expect(isVoiceTranscriptionRuntimeAvailable({
            NODE_ENV: "test",
            SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai",
            SESSION_VOICE_TRANSCRIPTION_PROFILE: GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
        })).toBe(false);
        expect(isVoiceTranscriptionRuntimeAvailable(fixtureEnv)).toBe(true);
        expect(isVoiceTranscriptionRuntimeAvailable({ ...fixtureEnv, NODE_ENV: "production" })).toBe(false);
    });

    it.each([
        [{ NODE_ENV: "test", SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai" }],
        [{
            NODE_ENV: "test",
            SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai",
            SESSION_VOICE_TRANSCRIPTION_PROFILE: "wrong-profile",
            GEMINI_API_KEY: "secret",
        }],
        [{
            NODE_ENV: "test",
            SESSION_VOICE_TRANSCRIPTION_PROVIDER: "google_genai",
            SESSION_VOICE_TRANSCRIPTION_PROFILE: GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
        }],
    ])("fails closed when the selected production profile is incomplete", (env) => {
        expect(() => createVoiceTranscriptionRuntimeFromEnvironment({ env: env as NodeJS.ProcessEnv }))
            .toThrowError(expect.objectContaining({ failureClass: "provider_misconfigured" }));
    });

    it("rejects blank or unbounded provider output", () => {
        expect(() => normalizeProviderTranscript("  ")).toThrow();
        expect(() => normalizeProviderTranscript("x".repeat(20_001))).toThrow();
    });
});
