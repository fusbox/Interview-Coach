import { createHash } from "node:crypto";

export function createVoiceOperationKeyHash(value: string) {
    const normalized = value.trim();
    if (!normalized) throw new Error("A voice operation key is required.");
    return createHash("sha256").update(normalized).digest("hex");
}

export function createVoiceTranscriptFingerprint(transcriptText: string) {
    const normalized = transcriptText.trim();
    if (!normalized) throw new Error("A nonblank voice transcript is required.");
    return createHash("sha256").update(normalized).digest("hex");
}
