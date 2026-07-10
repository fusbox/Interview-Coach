export type CandidateAnswerMode = "text";

export type CandidateAnswerDraft = {
    slotId: string;
    questionIndex: number;
    mode: CandidateAnswerMode;
    text: string;
    updatedAt: string;
};

export type CandidateAnswerDrafts = Record<string, CandidateAnswerDraft>;

export type CandidateAnswerSubmissionStatus = "pending_analysis";

export type CandidateAnswerSubmission = {
    slotId: string;
    questionIndex: number;
    mode: CandidateAnswerMode;
    text: string;
    submittedAt: string;
    status: CandidateAnswerSubmissionStatus;
};

export type CandidateAnswerSubmissions = Record<string, CandidateAnswerSubmission>;

export type CandidateAnswerDraftChanged = {
    status: "answer_draft_changed";
    draft: CandidateAnswerDraft;
};

export type CandidateAnswerSubmitRequest = {
    status: "answer_submit_requested";
    draft: CandidateAnswerDraft;
    requestedAt: string;
};

export type CandidateAnswerSubmitUnavailable = {
    status: "answer_submit_unavailable";
    reason: "answer_lifecycle_not_connected";
    request: CandidateAnswerSubmitRequest;
};

export type CandidateAnswerAnalysisRequest = {
    status: "answer_analysis_requested";
    answerSubmission: CandidateAnswerSubmission;
    requestedAt: string;
};

export type CandidateAnswerAnalysisUnavailable = {
    status: "answer_analysis_unavailable";
    reason: "provider_not_configured";
    request: CandidateAnswerAnalysisRequest;
};

export function createCandidateAnswerDraftChange({
    slotId,
    questionIndex,
    mode,
    text,
    now,
}: {
    slotId: string;
    questionIndex: number;
    mode: CandidateAnswerMode;
    text: string;
    now: Date;
}): CandidateAnswerDraftChanged {
    return {
        status: "answer_draft_changed",
        draft: {
            slotId,
            questionIndex,
            mode,
            text: text.trim(),
            updatedAt: now.toISOString(),
        },
    };
}

export function createCandidateAnswerSubmitRequest({
    draft,
    requestedAt,
}: {
    draft: CandidateAnswerDraft;
    requestedAt: Date;
}): CandidateAnswerSubmitRequest {
    return {
        status: "answer_submit_requested",
        draft,
        requestedAt: requestedAt.toISOString(),
    };
}

export function createCandidateAnswerSubmitUnavailable({
    request,
}: {
    request: CandidateAnswerSubmitRequest;
}): CandidateAnswerSubmitUnavailable {
    return {
        status: "answer_submit_unavailable",
        reason: "answer_lifecycle_not_connected",
        request,
    };
}

export function createCandidateAnswerAnalysisRequest({
    answerSubmission,
    requestedAt,
}: {
    answerSubmission: CandidateAnswerSubmission;
    requestedAt: Date;
}): CandidateAnswerAnalysisRequest {
    return {
        status: "answer_analysis_requested",
        answerSubmission,
        requestedAt: requestedAt.toISOString(),
    };
}

export function createCandidateAnswerAnalysisUnavailable({
    request,
}: {
    request: CandidateAnswerAnalysisRequest;
}): CandidateAnswerAnalysisUnavailable {
    return {
        status: "answer_analysis_unavailable",
        reason: "provider_not_configured",
        request,
    };
}

export function createCandidateAnswerSubmission({
    request,
}: {
    request: CandidateAnswerSubmitRequest;
}): CandidateAnswerSubmission {
    return {
        slotId: request.draft.slotId,
        questionIndex: request.draft.questionIndex,
        mode: request.draft.mode,
        text: request.draft.text,
        submittedAt: request.requestedAt,
        status: "pending_analysis",
    };
}

export function normalizeCandidateAnswerDrafts(value: unknown): CandidateAnswerDrafts {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([slotId, draft]) => [slotId, normalizeCandidateAnswerDraft(draft)])
            .filter((entry): entry is [string, CandidateAnswerDraft] => Boolean(entry[1])),
    );
}

export function normalizeCandidateAnswerSubmissions(value: unknown): CandidateAnswerSubmissions {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
            .map(([slotId, answerSubmission]) => [slotId, normalizeCandidateAnswerSubmission(answerSubmission)])
            .filter((entry): entry is [string, CandidateAnswerSubmission] => Boolean(entry[1])),
    );
}

function normalizeCandidateAnswerDraft(value: unknown): CandidateAnswerDraft | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const draft = value as Partial<CandidateAnswerDraft>;
    const slotId = readNonEmptyString(draft.slotId);
    const updatedAt = readNonEmptyString(draft.updatedAt);
    if (
        !slotId
        || draft.mode !== "text"
        || typeof draft.text !== "string"
        || !updatedAt
        || typeof draft.questionIndex !== "number"
        || !Number.isInteger(draft.questionIndex)
        || draft.questionIndex < 0
    ) {
        return null;
    }

    return {
        slotId,
        questionIndex: draft.questionIndex,
        mode: "text",
        text: draft.text,
        updatedAt,
    };
}

function normalizeCandidateAnswerSubmission(value: unknown): CandidateAnswerSubmission | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const answerSubmission = value as Partial<CandidateAnswerSubmission>;
    const slotId = readNonEmptyString(answerSubmission.slotId);
    const submittedAt = readNonEmptyString(answerSubmission.submittedAt);
    if (
        !slotId
        || answerSubmission.mode !== "text"
        || typeof answerSubmission.text !== "string"
        || !submittedAt
        || answerSubmission.status !== "pending_analysis"
        || typeof answerSubmission.questionIndex !== "number"
        || !Number.isInteger(answerSubmission.questionIndex)
        || answerSubmission.questionIndex < 0
    ) {
        return null;
    }

    return {
        slotId,
        questionIndex: answerSubmission.questionIndex,
        mode: "text",
        text: answerSubmission.text,
        submittedAt,
        status: "pending_analysis",
    };
}

function readNonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}
