export type CandidateSetupStageId = "practice_only" | "screening" | "first_interview" | "follow_up" | "final_interview";
export type CandidateSetupResumeCaptureMode = "none" | "pasted_text" | "document_upload" | "photo_capture" | "trusted_host";
export type CandidateSetupResumeArtifactSource = "pasted_text" | "document_upload" | "photo_capture" | "trusted_host";
export type CandidateSetupResumeArtifactReviewState = "awaiting_review" | "accepted";

export type CandidateSetupResumeArtifactReference = {
    artifactId: string;
    version: number;
    revision: number;
    source: CandidateSetupResumeArtifactSource;
    candidateLabel: string;
    reviewState: CandidateSetupResumeArtifactReviewState;
};

export type CandidateSetupPayload = {
    targetRole: string;
    jobDescription: string;
    resumeText: string | null;
    interviewStage: CandidateSetupStageId;
    questionCount: number;
    resumeCaptureMode: CandidateSetupResumeCaptureMode;
    resumeArtifact?: CandidateSetupResumeArtifactReference | null;
};

export type CandidateSetupTransition = {
    status: "ready_for_session_creation";
    nextRoute: "/candidate/session/[sessionId]";
    payload: CandidateSetupPayload;
};

type CandidateSetupFieldErrors = Partial<Record<"targetRole" | "jobDescription" | "resumeText" | "questionCount", string[]>>;

type CandidateSetupParseError = {
    flatten: () => {
        fieldErrors: CandidateSetupFieldErrors;
    };
};

export type CandidateSetupParseResult =
    | {
        success: true;
        data: CandidateSetupPayload;
    }
    | {
        success: false;
        error: CandidateSetupParseError;
    };

export const CANDIDATE_SETUP_LIMITS = {
    targetRole: 120,
    jobDescription: 12_000,
    resumeText: 24_000,
    questionCountMin: 3,
    questionCountMax: 10,
    questionCountDefault: 7,
} as const;

export const candidateSetupStageOptions: ReadonlyArray<{
    id: CandidateSetupStageId;
    label: string;
    detail: string;
    recommendedCount: number;
    recommendation: string;
}> = [
    {
        id: "practice_only",
        label: "Not sure yet",
        detail: "Use this when you want broad practice before a specific interview is scheduled.",
        recommendedCount: 5,
        recommendation: "I recommend 5 questions so you can get useful coaching without making the first round feel heavy.",
    },
    {
        id: "screening",
        label: "Screening call",
        detail: "Prepare for early interest, background, availability, and fit questions.",
        recommendedCount: 5,
        recommendation: "I recommend 5 questions for a screening call because this stage is usually focused and quick.",
    },
    {
        id: "first_interview",
        label: "First interview",
        detail: "Practice a balanced set across role fit, examples, and work situations.",
        recommendedCount: 7,
        recommendation: "I recommend 7 questions so we can cover the main question types without turning this into a long session.",
    },
    {
        id: "follow_up",
        label: "Follow-up interview",
        detail: "Work on deeper examples, clarifying answers, and role-specific follow-up areas.",
        recommendedCount: 10,
        recommendation: "I recommend 10 questions so you can prepare for deeper follow-up across examples, judgment, and role-specific areas.",
    },
    {
        id: "final_interview",
        label: "Final interview",
        detail: "Prepare for decision-stage questions, judgment, examples, and closing confidence.",
        recommendedCount: 10,
        recommendation: "I recommend 10 questions because final rounds tend to ask for broader evidence and sharper examples.",
    },
];

const candidateSetupStageIds = new Set(candidateSetupStageOptions.map((stage) => stage.id));

export function parseCandidateSetupInput(payload: unknown): CandidateSetupPayload {
    const result = safeParseCandidateSetupInput(payload);
    if (!result.success) {
        throw new Error("Invalid candidate setup input.");
    }
    return result.data;
}

export function safeParseCandidateSetupInput(payload: unknown): CandidateSetupParseResult {
    const record = toRecord(payload);
    const fieldErrors: CandidateSetupFieldErrors = {};
    const targetRole = normalizeRequiredText(record.targetRole, "Target role", CANDIDATE_SETUP_LIMITS.targetRole, fieldErrors, "targetRole");
    const jobDescription = normalizeRequiredText(
        record.jobDescription,
        "Job description",
        CANDIDATE_SETUP_LIMITS.jobDescription,
        fieldErrors,
        "jobDescription",
    );
    const resumeText = normalizeOptionalText(record.resumeText, "Resume content", CANDIDATE_SETUP_LIMITS.resumeText, fieldErrors, "resumeText");
    const resumeArtifact = normalizeResumeArtifact(record.resumeArtifact, fieldErrors);
    const questionCount = normalizeQuestionCount(record.questionCount, fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
        return {
            success: false,
            error: {
                flatten: () => ({ fieldErrors }),
            },
        };
    }

    return {
        success: true,
        data: {
            targetRole,
            jobDescription,
            resumeText,
            interviewStage: normalizeInterviewStage(record.interviewStage),
            questionCount,
            resumeCaptureMode: resumeArtifact?.source ?? (resumeText ? "pasted_text" : "none"),
            ...(resumeArtifact ? { resumeArtifact } : {}),
        },
    };
}

function normalizeResumeArtifact(
    value: unknown,
    fieldErrors: CandidateSetupFieldErrors,
): CandidateSetupResumeArtifactReference | null {
    if (value == null) {
        return null;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        fieldErrors.resumeText = ["Resume review details are invalid."];
        return null;
    }

    const record = value as Record<string, unknown>;
    const artifactId = typeof record.artifactId === "string" ? record.artifactId.trim() : "";
    const candidateLabel = typeof record.candidateLabel === "string" ? record.candidateLabel.trim() : "";
    const version = typeof record.version === "number" ? record.version : Number(record.version);
    const revision = typeof record.revision === "number" ? record.revision : Number(record.revision);
    const source = record.source === "pasted_text"
        || record.source === "document_upload"
        || record.source === "photo_capture"
        || record.source === "trusted_host"
        ? record.source
        : null;
    const reviewState = record.reviewState === "awaiting_review" || record.reviewState === "accepted"
        ? record.reviewState
        : null;

    if (
        !artifactId
        || artifactId.length > 128
        || !candidateLabel
        || candidateLabel.length > 80
        || !Number.isInteger(version)
        || version < 1
        || !Number.isInteger(revision)
        || revision < 1
        || !source
        || !reviewState
    ) {
        fieldErrors.resumeText = ["Resume review details are invalid."];
        return null;
    }

    return {
        artifactId,
        version,
        revision,
        source,
        candidateLabel,
        reviewState,
    };
}

export function toCandidateSetupTransition(payload: CandidateSetupPayload): CandidateSetupTransition {
    return {
        status: "ready_for_session_creation",
        nextRoute: "/candidate/session/[sessionId]",
        payload,
    };
}

function toRecord(payload: unknown): Record<string, unknown> {
    return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
}

function normalizeRequiredText(
    value: unknown,
    label: string,
    maxLength: number,
    fieldErrors: CandidateSetupFieldErrors,
    key: keyof CandidateSetupFieldErrors,
) {
    if (typeof value !== "string") {
        fieldErrors[key] = [`${label} is required.`];
        return "";
    }

    const normalized = value.trim();
    if (!normalized) {
        fieldErrors[key] = [`${label} is required.`];
        return "";
    }

    if (normalized.length > maxLength) {
        fieldErrors[key] = [`${label} must be ${maxLength.toLocaleString()} characters or fewer.`];
    }

    return normalized;
}

function normalizeOptionalText(
    value: unknown,
    label: string,
    maxLength: number,
    fieldErrors: CandidateSetupFieldErrors,
    key: keyof CandidateSetupFieldErrors,
) {
    if (value == null) {
        return null;
    }

    if (typeof value !== "string") {
        fieldErrors[key] = [`${label} must be ${maxLength.toLocaleString()} characters or fewer.`];
        return null;
    }

    const normalized = value.trim();
    if (!normalized) {
        return null;
    }

    if (normalized.length > maxLength) {
        fieldErrors[key] = [`${label} must be ${maxLength.toLocaleString()} characters or fewer.`];
    }

    return normalized;
}

function normalizeInterviewStage(value: unknown): CandidateSetupStageId {
    return typeof value === "string" && candidateSetupStageIds.has(value as CandidateSetupStageId)
        ? value as CandidateSetupStageId
        : "first_interview";
}

function normalizeQuestionCount(value: unknown, fieldErrors: CandidateSetupFieldErrors) {
    const rawValue = value == null || value === "" ? CANDIDATE_SETUP_LIMITS.questionCountDefault : value;
    const count = typeof rawValue === "number" ? rawValue : Number(rawValue);

    if (!Number.isInteger(count)) {
        fieldErrors.questionCount = ["Question count must be a whole number."];
        return CANDIDATE_SETUP_LIMITS.questionCountDefault;
    }

    if (count < CANDIDATE_SETUP_LIMITS.questionCountMin) {
        fieldErrors.questionCount = [`Question count must be at least ${CANDIDATE_SETUP_LIMITS.questionCountMin}.`];
        return count;
    }

    if (count > CANDIDATE_SETUP_LIMITS.questionCountMax) {
        fieldErrors.questionCount = [`Question count must be ${CANDIDATE_SETUP_LIMITS.questionCountMax} or fewer.`];
        return count;
    }

    return count;
}
