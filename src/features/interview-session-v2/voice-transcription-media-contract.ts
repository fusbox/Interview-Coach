import type { VoiceTranscriptionCommandIntent } from "./voice-answer-transcription";

export const VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES = 4 * 1_024 * 1_024;
export const VOICE_TRANSCRIPTION_MAX_DURATION_MS = 180_000;
const MAX_MULTIPART_ENVELOPE_BYTES = VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES + 16_384;
const MAX_OPERATION_KEY_LENGTH = 128;
const MAX_SLOT_ID_LENGTH = 128;

const ACCEPTED_AUDIO_TYPES = new Set([
    "audio/aac",
    "audio/aiff",
    "audio/flac",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
]);

export type ParsedVoiceTranscriptionMedia = {
    audioData: Uint8Array;
    acceptedMimeType: string;
    audioByteCount: number;
    audioDurationMs: number;
    idempotencyKey: string;
    intent: VoiceTranscriptionCommandIntent;
    questionSlotId: string;
    questionIndex: number;
};

export class VoiceTranscriptionMediaError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly failureClass: string,
    ) {
        super("Invalid voice transcription media request.");
        this.name = "VoiceTranscriptionMediaError";
    }
}

export async function parseVoiceTranscriptionMediaRequest(
    request: Request,
): Promise<ParsedVoiceTranscriptionMedia> {
    const contentType = request.headers.get("content-type")?.trim() ?? "";
    if (contentType.toLowerCase().startsWith("multipart/form-data;")) {
        return parseMultipartRequest(request);
    }
    return parseBinaryRequest(request, contentType);
}

async function parseBinaryRequest(request: Request, contentType: string) {
    const metadata = parseMetadata({
        idempotencyKey: request.headers.get("idempotency-key"),
        intent: request.headers.get("x-ic-voice-intent"),
        questionSlotId: request.headers.get("x-ic-question-slot"),
        questionIndex: request.headers.get("x-ic-question-index"),
        audioDurationMs: request.headers.get("x-ic-audio-duration-ms"),
    });
    const acceptedMimeType = parseAcceptedMimeType(contentType);
    const audioData = await readBoundedBody(request);
    return {
        ...metadata,
        audioData,
        acceptedMimeType,
        audioByteCount: audioData.byteLength,
    };
}

async function parseMultipartRequest(request: Request) {
    const declaredLength = readDeclaredLength(request.headers.get("content-length"));
    if (declaredLength === null) {
        throw new VoiceTranscriptionMediaError(411, "multipart_length_required");
    }
    if (declaredLength > MAX_MULTIPART_ENVELOPE_BYTES) {
        throw new VoiceTranscriptionMediaError(413, "audio_too_large");
    }

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        throw new VoiceTranscriptionMediaError(400, "multipart_invalid");
    }

    const allowedFields = new Set([
        "audio",
        "idempotencyKey",
        "intent",
        "questionSlotId",
        "questionIndex",
        "audioDurationMs",
    ]);
    const counts = new Map<string, number>();
    formData.forEach((_value, name) => {
        if (!allowedFields.has(name)) {
            throw new VoiceTranscriptionMediaError(400, "multipart_field_unknown");
        }
        counts.set(name, (counts.get(name) ?? 0) + 1);
    });
    let hasInvalidCount = false;
    allowedFields.forEach((name) => {
        if (counts.get(name) !== 1) hasInvalidCount = true;
    });
    if (hasInvalidCount) {
        throw new VoiceTranscriptionMediaError(400, "multipart_field_invalid");
    }

    const audio = formData.get("audio");
    if (!isBlobLike(audio) || audio.size <= 0) {
        throw new VoiceTranscriptionMediaError(400, "audio_missing");
    }
    if (audio.size > VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES) {
        throw new VoiceTranscriptionMediaError(413, "audio_too_large");
    }
    const metadata = parseMetadata({
        idempotencyKey: readFormString(formData, "idempotencyKey"),
        intent: readFormString(formData, "intent"),
        questionSlotId: readFormString(formData, "questionSlotId"),
        questionIndex: readFormString(formData, "questionIndex"),
        audioDurationMs: readFormString(formData, "audioDurationMs"),
    });
    const acceptedMimeType = parseAcceptedMimeType(audio.type);
    const audioData = new Uint8Array(await audio.arrayBuffer());
    return {
        ...metadata,
        audioData,
        acceptedMimeType,
        audioByteCount: audioData.byteLength,
    };
}

async function readBoundedBody(request: Request) {
    const declaredLength = readDeclaredLength(request.headers.get("content-length"));
    if (declaredLength !== null && declaredLength > VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES) {
        throw new VoiceTranscriptionMediaError(413, "audio_too_large");
    }
    if (!request.body) throw new VoiceTranscriptionMediaError(400, "audio_missing");

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES) {
                await reader.cancel();
                throw new VoiceTranscriptionMediaError(413, "audio_too_large");
            }
            chunks.push(value);
        }
    } catch (error) {
        if (error instanceof VoiceTranscriptionMediaError) throw error;
        throw new VoiceTranscriptionMediaError(400, "audio_unreadable");
    }
    if (total <= 0) throw new VoiceTranscriptionMediaError(400, "audio_missing");

    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
}

function parseMetadata(input: Record<string, string | null>) {
    const idempotencyKey = input.idempotencyKey?.trim() ?? "";
    if (
        !idempotencyKey
        || idempotencyKey.length > MAX_OPERATION_KEY_LENGTH
        || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
    ) {
        throw new VoiceTranscriptionMediaError(400, "idempotency_key_invalid");
    }
    const intent: VoiceTranscriptionCommandIntent | null = input.intent === "submit_answer"
        || input.intent === "review_transcript"
        ? input.intent as VoiceTranscriptionCommandIntent
        : null;
    if (!intent) throw new VoiceTranscriptionMediaError(400, "intent_invalid");
    const questionSlotId = input.questionSlotId?.trim() ?? "";
    if (
        !questionSlotId
        || questionSlotId.length > MAX_SLOT_ID_LENGTH
        || /[\u0000-\u001f\u007f]/.test(questionSlotId)
    ) {
        throw new VoiceTranscriptionMediaError(400, "question_slot_invalid");
    }
    const questionIndex = readBoundedInteger(input.questionIndex, 0, 99);
    if (questionIndex === null) {
        throw new VoiceTranscriptionMediaError(400, "question_index_invalid");
    }
    const audioDurationMs = readBoundedInteger(
        input.audioDurationMs,
        1,
        VOICE_TRANSCRIPTION_MAX_DURATION_MS,
    );
    if (audioDurationMs === null) {
        throw new VoiceTranscriptionMediaError(400, "audio_duration_invalid");
    }
    return { idempotencyKey, intent, questionSlotId, questionIndex, audioDurationMs };
}

function parseAcceptedMimeType(value: string) {
    const mimeType = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (!ACCEPTED_AUDIO_TYPES.has(mimeType)) {
        throw new VoiceTranscriptionMediaError(415, "audio_type_unsupported");
    }
    return mimeType;
}

function readDeclaredLength(value: string | null) {
    if (value === null) return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new VoiceTranscriptionMediaError(400, "content_length_invalid");
    }
    return parsed;
}

function readBoundedInteger(value: string | null, minimum: number, maximum: number) {
    if (!value || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function readFormString(formData: FormData, name: string) {
    const value = formData.get(name);
    return typeof value === "string" ? value : null;
}

function isBlobLike(value: FormDataEntryValue | null): value is File {
    return value !== null
        && typeof value === "object"
        && "size" in value
        && typeof value.size === "number"
        && "type" in value
        && typeof value.type === "string"
        && "arrayBuffer" in value
        && typeof value.arrayBuffer === "function";
}
