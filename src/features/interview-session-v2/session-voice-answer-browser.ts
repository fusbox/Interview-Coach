import {
    normalizeVoiceTranscriptDraft,
    type VoiceTranscriptDraft,
    type VoiceTranscriptionCommandIntent,
} from "./voice-answer-transcription";
import {
    VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES,
    VOICE_TRANSCRIPTION_MAX_DURATION_MS,
} from "./voice-transcription-media-contract";

export const SESSION_VOICE_CAPTURE_MIME_PREFERENCES = Object.freeze([
    "audio/webm;codecs=opus",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/webm",
    "audio/mp4",
] as const);

export type SessionVoiceCaptureBaseMimeType = "audio/webm" | "audio/mp4";

export type SessionVoiceRecording = {
    blob: Blob;
    durationMs: number;
    mimeType: SessionVoiceCaptureBaseMimeType;
    playbackUrl: string;
    operationKeys: Record<VoiceTranscriptionCommandIntent, string>;
};

export class SessionVoiceAnswerBrowserError extends Error {
    constructor(
        public readonly code: string,
        public readonly publicMessage: string,
        public readonly retryable: boolean,
    ) {
        super(publicMessage);
        this.name = "SessionVoiceAnswerBrowserError";
    }
}

export function selectSessionVoiceCaptureMimeType(
    isTypeSupported: (mimeType: string) => boolean,
): typeof SESSION_VOICE_CAPTURE_MIME_PREFERENCES[number] | null {
    return SESSION_VOICE_CAPTURE_MIME_PREFERENCES.find(isTypeSupported) ?? null;
}

export function normalizeSessionVoiceCaptureMimeType(value: string): SessionVoiceCaptureBaseMimeType | null {
    const baseMimeType = value.split(";", 1)[0]?.trim().toLowerCase();
    return baseMimeType === "audio/webm" || baseMimeType === "audio/mp4" ? baseMimeType : null;
}

export function assertSessionVoiceRecordingBounds(recording: Pick<SessionVoiceRecording, "blob" | "durationMs">) {
    if (!recording.blob.size) {
        throw new SessionVoiceAnswerBrowserError(
            "recording_empty",
            "I couldn't hear a recording. Try again or type your answer.",
            true,
        );
    }
    if (recording.blob.size > VOICE_TRANSCRIPTION_MAX_AUDIO_BYTES) {
        throw new SessionVoiceAnswerBrowserError(
            "recording_too_large",
            "That recording is too large to process. Try a shorter answer or type it instead.",
            true,
        );
    }
    if (recording.durationMs < 1 || recording.durationMs > VOICE_TRANSCRIPTION_MAX_DURATION_MS) {
        throw new SessionVoiceAnswerBrowserError(
            "recording_duration_invalid",
            "That recording is too long to process. Try a shorter answer or type it instead.",
            true,
        );
    }
}

export async function requestSessionVoiceTranscript(input: {
    mutationBasePath: string;
    questionSlotId: string;
    questionIndex: number;
    recording: Pick<SessionVoiceRecording, "blob" | "durationMs" | "operationKeys">;
    intent: VoiceTranscriptionCommandIntent;
    fetcher?: typeof fetch;
    wait?: (milliseconds: number) => Promise<void>;
    maxPendingPolls?: number;
}): Promise<VoiceTranscriptDraft> {
    assertSessionVoiceRecordingBounds(input.recording);
    const fetcher = input.fetcher ?? fetch;
    const wait = input.wait ?? ((milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds)));
    const maxPendingPolls = input.maxPendingPolls ?? 12;

    for (let poll = 0; poll <= maxPendingPolls; poll += 1) {
        let response: Response;
        try {
            response = await fetcher(`${input.mutationBasePath}/voice-transcription`, {
                method: "POST",
                headers: {
                    "Content-Type": input.recording.blob.type,
                    "Idempotency-Key": input.recording.operationKeys[input.intent],
                    "X-IC-Voice-Intent": input.intent,
                    "X-IC-Question-Slot": input.questionSlotId,
                    "X-IC-Question-Index": String(input.questionIndex),
                    "X-IC-Audio-Duration-Ms": String(Math.max(1, Math.round(input.recording.durationMs))),
                },
                body: input.recording.blob,
                credentials: "same-origin",
                cache: "no-store",
            });
        } catch {
            throw new SessionVoiceAnswerBrowserError(
                "transcription_network_failed",
                "I couldn't prepare the transcript. Your recording is still here, so you can try again.",
                true,
            );
        }

        const body = await response.json().catch(() => null) as {
            status?: string;
            transcriptDraft?: unknown;
            error?: string;
        } | null;
        const draft = normalizeVoiceTranscriptDraft(body?.transcriptDraft);
        if (response.ok && body?.status === "transcript_ready" && draft) return draft;
        if (response.status === 202 && body?.status === "transcription_pending") {
            if (poll < maxPendingPolls) {
                await wait(750);
                continue;
            }
            break;
        }

        throw toTranscriptionError(response.status, body?.error);
    }

    throw new SessionVoiceAnswerBrowserError(
        "transcription_pending_timeout",
        "The transcript is taking longer than expected. Your recording is still here, so you can try again.",
        true,
    );
}

export function createSessionVoiceOperationKeys(randomUuid: () => string = () => crypto.randomUUID()) {
    return {
        submit_answer: `voice-submit:${randomUuid()}`,
        review_transcript: `voice-review:${randomUuid()}`,
    } satisfies Record<VoiceTranscriptionCommandIntent, string>;
}

function toTranscriptionError(statusCode: number, serverMessage?: string) {
    if (statusCode === 401 || statusCode === 403) {
        return new SessionVoiceAnswerBrowserError(
            "transcription_access_required",
            "Your practice access needs to be refreshed before I can process this recording.",
            false,
        );
    }
    if (statusCode === 409) {
        return new SessionVoiceAnswerBrowserError(
            "transcription_conflict",
            "This recording can no longer be used. Record your answer again or type it instead.",
            false,
        );
    }
    if (statusCode === 413) {
        return new SessionVoiceAnswerBrowserError(
            "transcription_too_large",
            "That recording is too large to process. Try a shorter answer or type it instead.",
            false,
        );
    }
    if (statusCode === 415) {
        return new SessionVoiceAnswerBrowserError(
            "transcription_format_unsupported",
            "This browser's recording format isn't supported here. You can still type your answer.",
            false,
        );
    }
    return new SessionVoiceAnswerBrowserError(
        "transcription_unavailable",
        serverMessage?.trim() || "I couldn't prepare the transcript. Your recording is still here, so you can try again.",
        statusCode >= 500,
    );
}
