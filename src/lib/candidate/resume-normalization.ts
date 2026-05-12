export const MAX_NORMALIZED_RESUME_TEXT_LENGTH = 20_000;

export function normalizeResumeText(input: string | null | undefined): string | null {
    if (input == null) {
        return null;
    }

    const normalized = input
        .replace(/\u00a0/g, " ")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (!normalized) {
        return null;
    }

    if (normalized.length > MAX_NORMALIZED_RESUME_TEXT_LENGTH) {
        throw new Error(`Resume text must be ${MAX_NORMALIZED_RESUME_TEXT_LENGTH.toLocaleString()} characters or fewer.`);
    }

    return normalized;
}
