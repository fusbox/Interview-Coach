export const RECRUITER_DISPLAY_NAME_MAX_CODE_POINTS = 80;

export type RecruiterSettings = {
    senderDisplayName: string;
    email: string;
    revision: string;
};

export type RecruiterSettingsUpdate = {
    senderDisplayName: string;
    revision: string;
};

export class RecruiterSettingsValidationError extends Error {
    constructor() {
        super("Review the name shown to candidates and try again.");
        this.name = "RecruiterSettingsValidationError";
    }
}

export function parseRecruiterSettingsUpdate(value: unknown): RecruiterSettingsUpdate {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new RecruiterSettingsValidationError();
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (keys.length !== 2 || keys[0] !== "revision" || keys[1] !== "senderDisplayName") {
        throw new RecruiterSettingsValidationError();
    }

    const senderDisplayName = normalizeRecruiterDisplayName(record.senderDisplayName);
    if (!senderDisplayName || typeof record.revision !== "string" || !isTimestamp(record.revision)) {
        throw new RecruiterSettingsValidationError();
    }
    return { senderDisplayName, revision: record.revision };
}

export function normalizeRecruiterDisplayName(value: unknown) {
    if (typeof value !== "string") return "";
    const normalized = value.normalize("NFKC");
    if (containsUnsafeCodePoint(normalized)) return "";
    const collapsed = normalized.replace(/\s+/g, " ").trim();
    return Array.from(collapsed).length <= RECRUITER_DISPLAY_NAME_MAX_CODE_POINTS
        ? collapsed
        : "";
}

function isTimestamp(value: string) {
    if (value.length > 64 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value)) {
        return false;
    }
    const javascriptTimestamp = value.replace(/\.(\d{3})\d+Z$/, ".$1Z");
    return Number.isFinite(Date.parse(javascriptTimestamp));
}

function containsUnsafeCodePoint(value: string) {
    for (let index = 0; index < value.length; index += 1) {
        const codePoint = value.codePointAt(index);
        if (codePoint === undefined) return true;
        if (codePoint > 0xffff) index += 1;
        if (
            codePoint <= 0x1f
            || (codePoint >= 0x7f && codePoint <= 0x9f)
            || (codePoint >= 0x200b && codePoint <= 0x200f)
            || (codePoint >= 0x202a && codePoint <= 0x202e)
            || (codePoint >= 0x2060 && codePoint <= 0x206f)
            || (codePoint >= 0xd800 && codePoint <= 0xdfff)
            || codePoint === 0xfeff
            || (codePoint >= 0xe000 && codePoint <= 0xf8ff)
            || (codePoint >= 0xf0000 && codePoint <= 0xffffd)
            || (codePoint >= 0x100000 && codePoint <= 0x10fffd)
        ) return true;
    }
    return false;
}
