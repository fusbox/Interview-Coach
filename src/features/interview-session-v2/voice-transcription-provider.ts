export const SESSION_VOICE_TRANSCRIPTION_MAX_TRANSCRIPT_CHARACTERS = 20_000;

export type VoiceTranscriptionProviderRuntime = {
    provider: string;
    profileId: string;
    modelName: string;
    configurationFingerprint: string;
    supportedMimeTypes: readonly string[];
    transcribe: (input: {
        audioData: Uint8Array;
        mimeType: string;
        languageHint: "en";
    }) => Promise<{ transcriptText: string }>;
};

export class VoiceTranscriptionRuntimeError extends Error {
    constructor(public readonly failureClass: string) {
        super("Voice transcription is unavailable.");
        this.name = "VoiceTranscriptionRuntimeError";
    }
}

export function normalizeProviderTranscript(value: unknown) {
    if (typeof value !== "string") {
        throw new VoiceTranscriptionRuntimeError("provider_output_invalid");
    }
    const transcriptText = value.trim();
    if (
        !transcriptText
        || transcriptText.length > SESSION_VOICE_TRANSCRIPTION_MAX_TRANSCRIPT_CHARACTERS
    ) {
        throw new VoiceTranscriptionRuntimeError("provider_output_invalid");
    }
    return transcriptText;
}
