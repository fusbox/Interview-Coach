import { createHash } from "node:crypto";

import {
    GOOGLE_VOICE_TRANSCRIPTION_API_KEY_ENV,
    GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
    GOOGLE_VOICE_TRANSCRIPTION_PROVIDER,
    createGoogleVoiceTranscriptionRuntime,
    createGoogleVoiceTranscriptionTransport,
    type GoogleVoiceTranscriptionTransport,
} from "./google-voice-transcription";
import {
    VoiceTranscriptionRuntimeError,
    type VoiceTranscriptionProviderRuntime,
} from "./voice-transcription-provider";

export {
    normalizeProviderTranscript,
    SESSION_VOICE_TRANSCRIPTION_MAX_TRANSCRIPT_CHARACTERS,
    VoiceTranscriptionRuntimeError,
    type VoiceTranscriptionProviderRuntime,
} from "./voice-transcription-provider";

export const SESSION_VOICE_TRANSCRIPTION_PROVIDER_ENV = "SESSION_VOICE_TRANSCRIPTION_PROVIDER" as const;
export const SESSION_VOICE_TRANSCRIPTION_PROFILE_ENV = "SESSION_VOICE_TRANSCRIPTION_PROFILE" as const;
export const SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED_ENV = "SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED" as const;
export const SESSION_VOICE_TRANSCRIPTION_FIXTURE_PROVIDER = "fixture" as const;
export const SESSION_VOICE_TRANSCRIPTION_FIXTURE_PROFILE_ID = "fixture_voice_transcription_v1" as const;

export function isVoiceTranscriptionRuntimeAvailable(env: NodeJS.ProcessEnv) {
    const provider = env[SESSION_VOICE_TRANSCRIPTION_PROVIDER_ENV]?.trim().toLowerCase();
    const profileId = env[SESSION_VOICE_TRANSCRIPTION_PROFILE_ENV]?.trim();
    if (provider === GOOGLE_VOICE_TRANSCRIPTION_PROVIDER) {
        return profileId === GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID
            && Boolean(env[GOOGLE_VOICE_TRANSCRIPTION_API_KEY_ENV]?.trim());
    }
    return provider === SESSION_VOICE_TRANSCRIPTION_FIXTURE_PROVIDER
        && profileId === SESSION_VOICE_TRANSCRIPTION_FIXTURE_PROFILE_ID
        && env[SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED_ENV]?.trim().toLowerCase() === "true"
        && env.NODE_ENV !== "production"
        && env.VERCEL_ENV !== "production";
}
export function createVoiceTranscriptionRuntimeFromEnvironment(input: {
    env: NodeJS.ProcessEnv;
    googleTransportFactory?: (apiKey: string) => GoogleVoiceTranscriptionTransport;
}): VoiceTranscriptionProviderRuntime {
    const provider = input.env[SESSION_VOICE_TRANSCRIPTION_PROVIDER_ENV]?.trim().toLowerCase();
    const profileId = input.env[SESSION_VOICE_TRANSCRIPTION_PROFILE_ENV]?.trim();
    if (provider === GOOGLE_VOICE_TRANSCRIPTION_PROVIDER) {
        if (profileId !== GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID) {
            throw new VoiceTranscriptionRuntimeError("provider_misconfigured");
        }
        const apiKey = input.env[GOOGLE_VOICE_TRANSCRIPTION_API_KEY_ENV]?.trim();
        if (!apiKey) throw new VoiceTranscriptionRuntimeError("provider_misconfigured");
        return createGoogleVoiceTranscriptionRuntime({
            transport: (input.googleTransportFactory ?? createGoogleVoiceTranscriptionTransport)(apiKey),
        });
    }
    if (
        provider !== SESSION_VOICE_TRANSCRIPTION_FIXTURE_PROVIDER
        || profileId !== SESSION_VOICE_TRANSCRIPTION_FIXTURE_PROFILE_ID
    ) {
        throw new VoiceTranscriptionRuntimeError("provider_not_configured");
    }
    if (
        input.env[SESSION_VOICE_TRANSCRIPTION_FIXTURE_ENABLED_ENV]?.trim().toLowerCase() !== "true"
        || input.env.NODE_ENV === "production"
        || input.env.VERCEL_ENV === "production"
    ) {
        throw new VoiceTranscriptionRuntimeError("fixture_not_allowed");
    }

    const modelName = "deterministic-fixture-transcriber";
    const configurationFingerprint = createHash("sha256").update(JSON.stringify({
        contract: "faithful_transcript_only",
        languageHint: "en",
        modelName,
        profileId,
        provider,
        schemaVersion: 1,
    })).digest("hex");
    return {
        provider,
        profileId,
        modelName,
        configurationFingerprint,
        supportedMimeTypes: [
            "audio/aac",
            "audio/aiff",
            "audio/flac",
            "audio/mpeg",
            "audio/mp4",
            "audio/ogg",
            "audio/wav",
            "audio/webm",
        ],
        async transcribe() {
            return { transcriptText: "Fixture voice transcript." };
        },
    };
}
