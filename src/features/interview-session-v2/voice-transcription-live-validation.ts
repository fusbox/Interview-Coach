import { createHash } from "node:crypto";

import type { GenerateContentParameters } from "@google/genai";

import {
    GOOGLE_VOICE_TRANSCRIPTION_API_KEY_ENV,
    GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_FINGERPRINT,
    GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS,
    GOOGLE_VOICE_TRANSCRIPTION_MODEL,
    GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
    GOOGLE_VOICE_TRANSCRIPTION_PROVIDER,
    GOOGLE_VOICE_TRANSCRIPTION_RESPONSE_SCHEMA,
    GOOGLE_VOICE_TRANSCRIPTION_SYSTEM_INSTRUCTION,
    createGoogleVoiceTranscriptionTransport,
    type GoogleVoiceTranscriptionTransport,
} from "./google-voice-transcription";
import {
    SESSION_VOICE_TRANSCRIPTION_PROFILE_ENV,
    SESSION_VOICE_TRANSCRIPTION_PROVIDER_ENV,
    createVoiceTranscriptionRuntimeFromEnvironment,
} from "./voice-transcription-runtime";
import { VoiceTranscriptionRuntimeError } from "./voice-transcription-provider";

export const VOICE_TRANSCRIPTION_LIVE_TEST_ENV = "SESSION_VOICE_TRANSCRIPTION_LIVE_TEST" as const;
export const VOICE_TRANSCRIPTION_LIVE_EXPECTED_TEXT = "I checked each label, recorded the issue, and told my supervisor what I found.";
export const VOICE_TRANSCRIPTION_LIVE_MIME_TYPES = Object.freeze([
    "audio/wav",
    "audio/webm",
    "audio/mp4",
] as const);
export type VoiceTranscriptionLiveMimeType = typeof VOICE_TRANSCRIPTION_LIVE_MIME_TYPES[number];

type LiveValidationEnvironment = NodeJS.ProcessEnv & {
    SESSION_VOICE_TRANSCRIPTION_LIVE_TEST?: string;
    SESSION_VOICE_TRANSCRIPTION_PROVIDER?: string;
    SESSION_VOICE_TRANSCRIPTION_PROFILE?: string;
    GEMINI_API_KEY?: string;
};

export type VoiceTranscriptionLiveValidationArtifact = {
    status: "voice_transcription_live_validation_artifact";
    schemaVersion: 2;
    artifactId: string;
    generatedAt: string;
    syntheticCase: {
        id: `warehouse_quality_answer_${"wav" | "webm" | "mp4"}_v1`;
        mimeType: VoiceTranscriptionLiveMimeType;
        expectedText: string;
    };
    profile: {
        provider: string;
        profileId: string;
        model: string;
        configurationFingerprint: string;
    };
    result: {
        outcome: "accepted";
        transcriptText: string;
        latencyMs: number;
    } | {
        outcome: "failed";
        failureClass: string;
    };
    validations: Array<{ id: string; passed: boolean }>;
    summary: {
        transportAttemptCount: number;
        automatedGatePassed: boolean;
        humanTranscriptReview: "required";
    };
    privacy: {
        sourceContent: "synthetic_local_audio";
        candidateIdentity: "not_used";
        candidateDatabase: "not_read_or_written";
        rawAudio: "not_captured";
        providerRequest: "inspected_not_captured";
        rawProviderOutput: "not_captured";
        credentials: "not_captured";
    };
    retention: {
        durableCandidateRows: "not_written";
        reviewArtifact: "local_ignored_json";
    };
};

export class VoiceTranscriptionLiveValidationGuardError extends Error {
    constructor(public readonly safeCode: string) {
        super(safeCode);
        this.name = "VoiceTranscriptionLiveValidationGuardError";
    }
}

export async function runVoiceTranscriptionLiveValidation(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
    audioData: Uint8Array;
    mimeType: VoiceTranscriptionLiveMimeType;
    dependencies?: {
        now?: () => Date;
        createTransport?: (apiKey: string) => GoogleVoiceTranscriptionTransport;
    };
}): Promise<VoiceTranscriptionLiveValidationArtifact> {
    assertVoiceTranscriptionLiveValidationEnabled(input);
    if (!input.audioData.byteLength || input.audioData.byteLength > 4 * 1_024 * 1_024) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_AUDIO_INVALID");
    }

    const now = input.dependencies?.now ?? (() => new Date());
    const createTransport = input.dependencies?.createTransport ?? createGoogleVoiceTranscriptionTransport;
    const credential = input.env[GOOGLE_VOICE_TRANSCRIPTION_API_KEY_ENV]!.trim();
    let transportAttemptCount = 0;
    let exactConfigurationValidated = false;
    let privacyEnvelopeValidated = false;
    const runtime = createVoiceTranscriptionRuntimeFromEnvironment({
        env: input.env,
        googleTransportFactory(apiKey) {
            const upstream = createTransport(apiKey);
            return {
                async generateContent(providerRequest) {
                    assertExactProviderRequestConfiguration(providerRequest);
                    assertSyntheticPrivacyEnvelope(providerRequest, input.audioData, input.mimeType, credential);
                    exactConfigurationValidated = true;
                    privacyEnvelopeValidated = true;
                    transportAttemptCount += 1;
                    return upstream.generateContent(providerRequest);
                },
            };
        },
    });

    const generatedAt = now().toISOString();
    const startedAt = Date.now();
    let result: VoiceTranscriptionLiveValidationArtifact["result"];
    try {
        const providerResult = await runtime.transcribe({
            audioData: input.audioData,
            mimeType: input.mimeType,
            languageHint: "en",
        });
        result = {
            outcome: "accepted",
            transcriptText: providerResult.transcriptText,
            latencyMs: Math.max(0, Date.now() - startedAt),
        };
    } catch (error) {
        result = {
            outcome: "failed",
            failureClass: error instanceof VoiceTranscriptionRuntimeError
                ? error.failureClass
                : "provider_unavailable",
        };
    }

    const validations = [
        { id: "exact_profile_configuration", passed: exactConfigurationValidated },
        { id: "single_transport_attempt", passed: transportAttemptCount === 1 },
        { id: "audio_only_privacy_envelope", passed: privacyEnvelopeValidated },
        {
            id: "expected_spoken_words_preserved",
            passed: result.outcome === "accepted"
                && normalizeForComparison(result.transcriptText)
                    === normalizeForComparison(VOICE_TRANSCRIPTION_LIVE_EXPECTED_TEXT),
        },
    ];
    const automatedGatePassed = result.outcome === "accepted"
        && validations.every((validation) => validation.passed);
    const artifactId = `live_voice_transcription_${hashJson({
        generatedAt,
        configurationFingerprint: GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_FINGERPRINT,
        result,
    }).slice(0, 16)}`;
    const artifact: VoiceTranscriptionLiveValidationArtifact = {
        status: "voice_transcription_live_validation_artifact",
        schemaVersion: 2,
        artifactId,
        generatedAt,
        syntheticCase: {
            id: `warehouse_quality_answer_${toMimeTypeSlug(input.mimeType)}_v1`,
            mimeType: input.mimeType,
            expectedText: VOICE_TRANSCRIPTION_LIVE_EXPECTED_TEXT,
        },
        profile: {
            provider: GOOGLE_VOICE_TRANSCRIPTION_PROVIDER,
            profileId: GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID,
            model: GOOGLE_VOICE_TRANSCRIPTION_MODEL,
            configurationFingerprint: GOOGLE_VOICE_TRANSCRIPTION_CONFIGURATION_FINGERPRINT,
        },
        result,
        validations,
        summary: {
            transportAttemptCount,
            automatedGatePassed,
            humanTranscriptReview: "required",
        },
        privacy: {
            sourceContent: "synthetic_local_audio",
            candidateIdentity: "not_used",
            candidateDatabase: "not_read_or_written",
            rawAudio: "not_captured",
            providerRequest: "inspected_not_captured",
            rawProviderOutput: "not_captured",
            credentials: "not_captured",
        },
        retention: {
            durableCandidateRows: "not_written",
            reviewArtifact: "local_ignored_json",
        },
    };

    const serialized = JSON.stringify(artifact);
    if (
        serialized.includes(credential)
        || serialized.includes(Buffer.from(input.audioData).toString("base64"))
        || findProhibitedVoiceTranscriptionArtifactKeys(artifact).length > 0
    ) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_ARTIFACT_PRIVACY_VIOLATION");
    }
    return artifact;
}

export function assertVoiceTranscriptionLiveValidationEnabled(input: {
    env: LiveValidationEnvironment;
    confirmedLiveProvider: boolean;
}) {
    if (!input.confirmedLiveProvider) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_CLI_CONFIRMATION_REQUIRED");
    }
    if (input.env[VOICE_TRANSCRIPTION_LIVE_TEST_ENV] !== "true") {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_FLAG_REQUIRED");
    }
    if (input.env[SESSION_VOICE_TRANSCRIPTION_PROVIDER_ENV] !== GOOGLE_VOICE_TRANSCRIPTION_PROVIDER) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_PROVIDER_MISMATCH");
    }
    if (input.env[SESSION_VOICE_TRANSCRIPTION_PROFILE_ENV] !== GOOGLE_VOICE_TRANSCRIPTION_PROFILE_ID) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_PROFILE_MISMATCH");
    }
    if (!input.env[GOOGLE_VOICE_TRANSCRIPTION_API_KEY_ENV]?.trim()) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_CREDENTIAL_REQUIRED");
    }
}

export function findProhibitedVoiceTranscriptionArtifactKeys(value: unknown): string[] {
    const prohibited = new Set([
        "audiodata",
        "audiobase64",
        "candidateprofileid",
        "recruiterinvitationrecipientid",
        "practicesessionid",
        "questionslotid",
        "providerrequestpayload",
        "rawproviderresponse",
        "credentialvalue",
        "apikey",
    ]);
    const matches = new Set<string>();
    visit(value, "artifact", (key, path) => {
        if (prohibited.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase())) matches.add(path);
    });
    return Array.from(matches).sort();
}

function assertExactProviderRequestConfiguration(providerRequest: GenerateContentParameters) {
    const config = providerRequest.config;
    const exact = providerRequest.model === GOOGLE_VOICE_TRANSCRIPTION_MODEL
        && config?.responseMimeType === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.responseMimeType
        && JSON.stringify(config.responseJsonSchema) === JSON.stringify(GOOGLE_VOICE_TRANSCRIPTION_RESPONSE_SCHEMA)
        && config.temperature === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.temperature
        && config.maxOutputTokens === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.maxOutputTokens
        && config.candidateCount === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.candidateCount
        && config.seed === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.seed
        && config.thinkingConfig?.thinkingBudget === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.thinkingBudget
        && config.thinkingConfig?.includeThoughts === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.includeThoughts
        && config.httpOptions?.timeout === GOOGLE_VOICE_TRANSCRIPTION_GENERATION_SETTINGS.timeoutMs
        && config.systemInstruction === GOOGLE_VOICE_TRANSCRIPTION_SYSTEM_INSTRUCTION.join("\n");
    if (!exact) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_CONFIGURATION_DRIFT");
    }
}

function assertSyntheticPrivacyEnvelope(
    providerRequest: GenerateContentParameters,
    audioData: Uint8Array,
    mimeType: string,
    credential: string,
) {
    const parts = readParts(providerRequest);
    const instruction = parts[0] && "text" in parts[0] ? parts[0].text : null;
    const inlineData = parts[1] && "inlineData" in parts[1] ? parts[1].inlineData : null;
    const serialized = JSON.stringify(providerRequest);
    if (
        parts.length !== 2
        || typeof instruction !== "string"
        || JSON.stringify(JSON.parse(instruction)) !== JSON.stringify({
            task: "transcribe_spoken_answer_faithfully",
            languageHint: "en",
        })
        || inlineData?.mimeType !== mimeType
        || inlineData.data !== Buffer.from(audioData).toString("base64")
        || serialized.includes(credential)
        || /candidate(Profile|Id)|sessionId|questionText|jobDescription|resume/i.test(serialized)
    ) {
        throw new VoiceTranscriptionLiveValidationGuardError("LIVE_VOICE_TRANSCRIPTION_REQUEST_BOUNDARY_VIOLATION");
    }
}

function readParts(input: GenerateContentParameters) {
    const contents = Array.isArray(input.contents) ? input.contents : [];
    const content = contents[0];
    if (!content || typeof content === "string" || !("parts" in content)) return [];
    return content.parts ?? [];
}

function normalizeForComparison(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function toMimeTypeSlug(value: VoiceTranscriptionLiveMimeType): "wav" | "webm" | "mp4" {
    return value.slice("audio/".length) as "wav" | "webm" | "mp4";
}

function visit(value: unknown, path: string, callback: (key: string, path: string) => void) {
    if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, `${path}[${index}]`, callback));
        return;
    }
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, nested]) => {
        const nestedPath = `${path}.${key}`;
        callback(key, nestedPath);
        visit(nested, nestedPath, callback);
    });
}

function hashJson(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
