type AnalysisIdempotencyAnswer = {
    modality?: "text" | "voice";
    retryContext?: {
        trigger: "user" | "coach";
        focus?: string;
    };
    submittedAt?: number;
    transcript?: string;
};

function stableHash(input: string): number {
    let hash = 0;

    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
}

export function buildAnalysisIdempotencyKey(
    sessionId: string,
    questionId: string,
    answer?: AnalysisIdempotencyAnswer | null
): string {
    const retryContext = answer?.retryContext
        ? `${answer.retryContext.trigger}:${answer.retryContext.focus ?? ""}`
        : "";
    const input = [
        sessionId,
        questionId,
        answer?.submittedAt ?? "unsubmitted",
        answer?.modality ?? "text",
        answer?.transcript ?? "",
        retryContext,
    ].join(":");

    return `analysis:${sessionId}:${questionId}:${stableHash(input)}`;
}
