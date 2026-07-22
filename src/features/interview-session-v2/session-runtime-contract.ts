export type SessionRuntimeProgressStatus =
    | "planned"
    | "question_preview"
    | "live_question"
    | "completed";

export type SessionRuntimeProgress = {
    status: SessionRuntimeProgressStatus;
    currentQuestionIndex: number;
    answerMode?: SessionAnswerMode;
};

export type SessionAnswerMode = "text" | "voice";

export type SessionCompletionBehavior =
    | {
        kind: "candidate_dashboard";
        dashboardHref: string;
        summaryHref?: string;
    }
    | {
        kind: "invited_debrief";
        closeLabel?: string;
        practiceAgainEnabled?: boolean;
    };

export type SessionRuntimeConsumer =
    | {
        kind: "candidate_led";
        completionBehavior: Extract<SessionCompletionBehavior, { kind: "candidate_dashboard" }>;
    }
    | {
        kind: "invited_candidate";
        completionBehavior: Extract<SessionCompletionBehavior, { kind: "invited_debrief" }>;
    };

export function createSessionRuntimeProgress(input: {
    status: SessionRuntimeProgressStatus;
    currentQuestionIndex: number;
    answerMode?: SessionAnswerMode;
}): SessionRuntimeProgress {
    return {
        status: input.status,
        currentQuestionIndex: normalizeQuestionIndex(input.currentQuestionIndex),
        ...(input.answerMode ? { answerMode: input.answerMode } : {}),
    };
}

export function normalizeSessionRuntimeProgress(value: unknown): SessionRuntimeProgress {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return createSessionRuntimeProgress({
            status: "planned",
            currentQuestionIndex: 0,
        });
    }

    const progress = value as Partial<SessionRuntimeProgress>;
    return createSessionRuntimeProgress({
        status: readProgressStatus(progress.status),
        currentQuestionIndex: progress.currentQuestionIndex ?? 0,
        answerMode: isSessionAnswerMode(progress.answerMode) ? progress.answerMode : undefined,
    });
}

export function isQuestionSurfaceProgress(progress: SessionRuntimeProgress) {
    return progress.status === "question_preview" || progress.status === "live_question";
}

export function isSessionRuntimeProgressStatus(value: unknown): value is SessionRuntimeProgressStatus {
    return value === "planned"
        || value === "question_preview"
        || value === "live_question"
        || value === "completed";
}

export function isSessionAnswerMode(value: unknown): value is SessionAnswerMode {
    return value === "text" || value === "voice";
}

function readProgressStatus(value: unknown): SessionRuntimeProgressStatus {
    if (isSessionRuntimeProgressStatus(value)) {
        return value;
    }

    return "planned";
}

function normalizeQuestionIndex(value: unknown) {
    return typeof value === "number"
        && Number.isInteger(value)
        && value >= 0
        ? value
        : 0;
}
