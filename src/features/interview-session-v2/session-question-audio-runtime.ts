import { createHash } from "node:crypto";

import {
    GoogleGenAI,
    type GenerateContentParameters,
    type GenerateContentResponse,
} from "@google/genai";

export const SESSION_QUESTION_AUDIO_PROVIDER_ENV = "SESSION_QUESTION_AUDIO_PROVIDER" as const;
export const SESSION_QUESTION_AUDIO_PROFILE_ENV = "SESSION_QUESTION_AUDIO_PROFILE" as const;
export const SESSION_QUESTION_AUDIO_PROVIDER = "google_genai" as const;
export const SESSION_QUESTION_AUDIO_PROFILE_ID = "google_gemini_2_5_flash_tts_v1" as const;
export const SESSION_QUESTION_AUDIO_MODEL = "gemini-2.5-flash-preview-tts" as const;
export const SESSION_QUESTION_AUDIO_VOICE = "Kore" as const;
export const SESSION_QUESTION_AUDIO_PROMPT_VERSION = "question_exact_recitation_v1" as const;
export const SESSION_QUESTION_AUDIO_MAX_TEXT_LENGTH = 500;
export const SESSION_QUESTION_AUDIO_MAX_BYTES = 5 * 1024 * 1024;
export const SESSION_QUESTION_AUDIO_TIMEOUT_MS = 15_000;

const WAV_SAMPLE_RATE = 24_000;
const DEFAULT_CACHE_ENTRIES = 64;

export type SessionQuestionAudioEnvironment = {
    [key: string]: string | undefined;
    GEMINI_API_KEY?: string;
    SESSION_QUESTION_AUDIO_PROVIDER?: string;
    SESSION_QUESTION_AUDIO_PROFILE?: string;
};

export type SessionQuestionAudioTransport = {
    generateContent: (input: GenerateContentParameters) => Promise<GenerateContentResponse>;
};

export type SessionQuestionAudioResult = {
    audioData: Buffer;
    mimeType: "audio/wav" | "audio/mpeg";
    cacheIdentity: string;
    cacheOutcome: "hit" | "joined" | "miss";
    provider: typeof SESSION_QUESTION_AUDIO_PROVIDER;
    profileId: typeof SESSION_QUESTION_AUDIO_PROFILE_ID;
};

type CachedQuestionAudio = Omit<SessionQuestionAudioResult, "cacheOutcome">;

export type SessionQuestionAudioCache = ReturnType<typeof createSessionQuestionAudioCache>;

export class SessionQuestionAudioRuntimeError extends Error {
    readonly failureClass: "misconfigured" | "timeout" | "provider" | "invalid_output";
    readonly safeCode: string;

    constructor(input: {
        failureClass: SessionQuestionAudioRuntimeError["failureClass"];
        safeCode: string;
    }) {
        super(input.safeCode);
        this.name = "SessionQuestionAudioRuntimeError";
        this.failureClass = input.failureClass;
        this.safeCode = input.safeCode;
    }
}

export function isSessionQuestionAudioRuntimeAvailable(env: SessionQuestionAudioEnvironment) {
    return env[SESSION_QUESTION_AUDIO_PROVIDER_ENV]?.trim().toLowerCase() === SESSION_QUESTION_AUDIO_PROVIDER
        && env[SESSION_QUESTION_AUDIO_PROFILE_ENV]?.trim() === SESSION_QUESTION_AUDIO_PROFILE_ID
        && Boolean(env.GEMINI_API_KEY?.trim());
}

export function createSessionQuestionAudioRuntimeFromEnvironment(input: {
    env: SessionQuestionAudioEnvironment;
    transportFactory?: (apiKey: string) => SessionQuestionAudioTransport;
    cache?: SessionQuestionAudioCache;
}) {
    const provider = input.env[SESSION_QUESTION_AUDIO_PROVIDER_ENV]?.trim().toLowerCase();
    if (provider !== SESSION_QUESTION_AUDIO_PROVIDER) return null;
    if (input.env[SESSION_QUESTION_AUDIO_PROFILE_ENV]?.trim() !== SESSION_QUESTION_AUDIO_PROFILE_ID) {
        throw runtimeError("misconfigured", "QUESTION_AUDIO_PROFILE_MISCONFIGURED");
    }
    const apiKey = input.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw runtimeError("misconfigured", "QUESTION_AUDIO_CREDENTIAL_MISSING");

    const transport = (input.transportFactory ?? createGoogleQuestionAudioTransport)(apiKey);
    const cache = input.cache ?? sharedQuestionAudioCache;

    return {
        async generateQuestionAudio(questionText: string): Promise<SessionQuestionAudioResult> {
            const normalizedText = normalizeQuestionText(questionText);
            if (!normalizedText || normalizedText.length > SESSION_QUESTION_AUDIO_MAX_TEXT_LENGTH) {
                throw runtimeError("invalid_output", "QUESTION_AUDIO_TEXT_INVALID");
            }

            const cacheIdentity = createSessionQuestionAudioCacheIdentity(normalizedText);
            const cached = cache.read(cacheIdentity);
            if (cached) return { ...cached, cacheOutcome: "hit" };

            const pending = cache.readPending(cacheIdentity);
            if (pending) return { ...await pending, cacheOutcome: "joined" };

            const generation = generateQuestionAudio({
                questionText: normalizedText,
                cacheIdentity,
                transport,
            });
            cache.writePending(cacheIdentity, generation);
            try {
                const result = await generation;
                cache.write(cacheIdentity, result);
                return { ...result, cacheOutcome: "miss" };
            } finally {
                cache.clearPending(cacheIdentity, generation);
            }
        },
    };
}

export function createSessionQuestionAudioCache(maxEntries = DEFAULT_CACHE_ENTRIES) {
    const resolvedMaxEntries = Math.max(1, Math.floor(maxEntries));
    const values = new Map<string, CachedQuestionAudio>();
    const pending = new Map<string, Promise<CachedQuestionAudio>>();

    return {
        read(key: string) {
            const value = values.get(key);
            if (!value) return null;
            values.delete(key);
            values.set(key, value);
            return value;
        },
        write(key: string, value: CachedQuestionAudio) {
            values.delete(key);
            values.set(key, value);
            while (values.size > resolvedMaxEntries) {
                const oldestKey = values.keys().next().value;
                if (typeof oldestKey !== "string") break;
                values.delete(oldestKey);
            }
        },
        readPending: (key: string) => pending.get(key) ?? null,
        writePending: (key: string, value: Promise<CachedQuestionAudio>) => pending.set(key, value),
        clearPending(key: string, value: Promise<CachedQuestionAudio>) {
            if (pending.get(key) === value) pending.delete(key);
        },
    };
}

export function createSessionQuestionAudioCacheIdentity(questionText: string) {
    return createHash("sha256").update(JSON.stringify({
        provider: SESSION_QUESTION_AUDIO_PROVIDER,
        profileId: SESSION_QUESTION_AUDIO_PROFILE_ID,
        model: SESSION_QUESTION_AUDIO_MODEL,
        voice: SESSION_QUESTION_AUDIO_VOICE,
        promptVersion: SESSION_QUESTION_AUDIO_PROMPT_VERSION,
        questionText: normalizeQuestionText(questionText),
    })).digest("hex");
}

export function createGoogleQuestionAudioTransport(apiKey: string): SessionQuestionAudioTransport {
    const client = new GoogleGenAI({ apiKey });
    return {
        generateContent: (request) => client.models.generateContent(request),
    };
}

async function generateQuestionAudio(input: {
    questionText: string;
    cacheIdentity: string;
    transport: SessionQuestionAudioTransport;
}): Promise<CachedQuestionAudio> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), SESSION_QUESTION_AUDIO_TIMEOUT_MS);
    let response: GenerateContentResponse;
    try {
        response = await input.transport.generateContent({
            model: SESSION_QUESTION_AUDIO_MODEL,
            contents: [{
                role: "user",
                parts: [{ text: renderExactRecitationPrompt(input.questionText) }],
            }],
            config: {
                abortSignal: abortController.signal,
                responseModalities: ["AUDIO"],
                speechConfig: {
                    languageCode: "en-US",
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: SESSION_QUESTION_AUDIO_VOICE },
                    },
                },
            },
        });
    } catch (error) {
        if (abortController.signal.aborted) {
            throw runtimeError("timeout", "QUESTION_AUDIO_PROVIDER_TIMEOUT");
        }
        void error;
        throw runtimeError("provider", "QUESTION_AUDIO_PROVIDER_FAILED");
    } finally {
        clearTimeout(timeout);
    }

    const inlineData = response.candidates
        ?.flatMap((candidate) => candidate.content?.parts ?? [])
        .map((part) => part.inlineData)
        .find((part) => Boolean(part?.data));
    if (!inlineData?.data || !isValidBase64(inlineData.data)) {
        throw runtimeError("invalid_output", "QUESTION_AUDIO_OUTPUT_MISSING");
    }

    const rawAudio = Buffer.from(inlineData.data, "base64");
    if (!rawAudio.length || rawAudio.length > SESSION_QUESTION_AUDIO_MAX_BYTES) {
        throw runtimeError("invalid_output", "QUESTION_AUDIO_OUTPUT_SIZE_INVALID");
    }

    const mimeType = inlineData.mimeType?.toLowerCase() ?? "";
    const output = mimeType.includes("mpeg") || mimeType.includes("mp3")
        ? { audioData: rawAudio, mimeType: "audio/mpeg" as const }
        : mimeType.includes("wav")
            ? { audioData: rawAudio, mimeType: "audio/wav" as const }
            : mimeType.includes("l16") || mimeType.includes("pcm")
                ? { audioData: wrapPcmAsWav(rawAudio), mimeType: "audio/wav" as const }
                : null;
    if (!output || output.audioData.length > SESSION_QUESTION_AUDIO_MAX_BYTES) {
        throw runtimeError("invalid_output", "QUESTION_AUDIO_OUTPUT_FORMAT_INVALID");
    }

    return {
        ...output,
        cacheIdentity: input.cacheIdentity,
        provider: SESSION_QUESTION_AUDIO_PROVIDER,
        profileId: SESSION_QUESTION_AUDIO_PROFILE_ID,
    };
}

function renderExactRecitationPrompt(questionText: string) {
    return [
        "Read the interview question exactly as written.",
        "Use a clear, warm, professional tone and a measured pace.",
        "Do not add an introduction, commentary, labels, or extra words.",
        "",
        questionText,
    ].join("\n");
}

function normalizeQuestionText(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function isValidBase64(value: string) {
    return value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

function wrapPcmAsWav(pcm: Buffer) {
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + pcm.length, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(WAV_SAMPLE_RATE, 24);
    header.writeUInt32LE(WAV_SAMPLE_RATE * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(pcm.length, 40);
    return Buffer.concat([header, pcm]);
}

function runtimeError(
    failureClass: SessionQuestionAudioRuntimeError["failureClass"],
    safeCode: string,
) {
    return new SessionQuestionAudioRuntimeError({ failureClass, safeCode });
}

const sharedQuestionAudioCache = createSessionQuestionAudioCache();
