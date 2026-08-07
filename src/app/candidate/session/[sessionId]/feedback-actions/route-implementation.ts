import { after } from "next/server";

import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import { createCandidatePracticeSessionRepository } from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { CandidateAnswerSubmissions } from "@/features/candidate-session-v2/candidate-answer-lifecycle";
import type { CandidateQuestionWordingResult } from "@/features/candidate-session-v2/candidate-question-wording";
import type {
    CandidateFeedbackActionEvent,
    CandidateFeedbackActionKind,
    CandidateFeedbackInteractionStageId,
    CandidateFeedbackTransition,
} from "@/features/candidate-session-v2/candidate-feedback-interaction";
import { resolveCandidateNextUnansweredQuestionIndex } from "@/features/candidate-session-v2/candidate-session-question-resolution";
import type { SessionRuntimeProgress } from "@/features/interview-session-v2/session-runtime-contract";
import {
    createCandidateFeedbackInteraction,
    isCandidateFeedbackActionEventAllowed,
} from "@/features/candidate-session-v2/candidate-feedback-interaction";
import {
    createDefaultCandidateSessionCompleteDependencies,
} from "../complete/route-implementation";
import type { CandidateCoachUpdateGenerationResult } from "@/features/candidate-dashboard-v2/candidate-coach-update-generation";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateFeedbackActionSession = {
    answerAnalysisSnapshots?: Record<string, CandidateAnswerAnalysisProviderResult>;
    answerSubmissions?: CandidateAnswerSubmissions;
    questionWordingSnapshot?: CandidateQuestionWordingResult | null;
    progress?: SessionRuntimeProgress;
};

type CandidateFeedbackActionRepository = {
    findSetupSession: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
    }) => Promise<CandidateFeedbackActionSession | null>;
    saveFeedbackActionEvent: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        feedbackActionEvent: CandidateFeedbackActionEvent;
        nextProgress?: SessionRuntimeProgress;
    }) => Promise<Record<string, CandidateFeedbackActionEvent> | null>;
};

export type CandidateFeedbackActionRouteDependencies = {
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateFeedbackActionRepository;
    ensureCoachUpdateArtifact?: (input: {
        candidateProfileId: string;
        sourceCandidatePracticeSessionId: string;
        sourceQuestionKey: string;
        settledAt: string;
    }) => Promise<CandidateCoachUpdateGenerationResult>;
    scheduleCoachUpdate?: (task: () => Promise<void>) => void;
};

const stageIds = new Set<CandidateFeedbackInteractionStageId>([
    "acknowledgement",
    "content_coaching",
    "delivery_coaching",
    "next_step",
]);

const actionKinds = new Set<CandidateFeedbackActionKind>([
    "explore_feedback",
    "show_next_feedback_stage",
    "skip_to_next_question",
    "skip_to_finish_session",
    "continue_to_next_question",
    "finish_session",
    "retry_answer",
    "pause_session",
]);

const transitions = new Set<CandidateFeedbackTransition>([
    "show_feedback_stage",
    "advance_to_next_question",
    "finish_session",
    "retry_current_question",
    "pause_session",
]);

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    return handleCandidateFeedbackActionRequest({
        request,
        sessionId,
        ...createDefaultCandidateFeedbackActionDependencies(),
    });
}

export async function handleCandidateFeedbackActionRequest({
    request,
    sessionId,
    resolveCandidateSessionIdentity,
    practiceSessionRepository,
    ensureCoachUpdateArtifact,
    scheduleCoachUpdate,
}: CandidateFeedbackActionRouteDependencies & {
    request: Request;
    sessionId: string;
}) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid feedback action request." }, { status: 400 });
    }

    const feedbackActionEvent = parseFeedbackActionEvent(body);
    if (!feedbackActionEvent) {
        return Response.json({ error: "Invalid feedback action request." }, { status: 400 });
    }

    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !practiceSessionRepository) {
        return Response.json({ error: "Candidate session identity is required." }, { status: 401 });
    }

    const session = await practiceSessionRepository.findSetupSession({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
    });
    if (!session) {
        return Response.json({ error: "Candidate practice session was not found." }, { status: 404 });
    }

    const matchingAnalysis = session.answerAnalysisSnapshots?.[feedbackActionEvent.answer.slotId];
    if (
        !matchingAnalysis
        || matchingAnalysis.answer.slotId !== feedbackActionEvent.answer.slotId
        || matchingAnalysis.answer.questionIndex !== feedbackActionEvent.answer.questionIndex
    ) {
        return Response.json(
            { error: "Feedback action does not match a saved analysis snapshot." },
            { status: 409 },
        );
    }

    const latestSubmission = session.answerSubmissions?.[feedbackActionEvent.answer.slotId];
    if (
        matchingAnalysis.answer.answerAttemptId !== feedbackActionEvent.answer.answerAttemptId
        || matchingAnalysis.answer.attemptNumber !== feedbackActionEvent.answer.attemptNumber
        || matchingAnalysis.answer.trigger !== feedbackActionEvent.answer.trigger
        || (
            feedbackActionEvent.answer.answerAttemptId
            && (
                latestSubmission?.answerAttemptId !== feedbackActionEvent.answer.answerAttemptId
                || latestSubmission.attemptNumber !== feedbackActionEvent.answer.attemptNumber
                || latestSubmission.trigger !== feedbackActionEvent.answer.trigger
            )
        )
    ) {
        return Response.json(
            { error: "Feedback action does not match the latest analyzed answer attempt." },
            { status: 409 },
        );
    }

    if (feedbackActionEvent.actionKind === "retry_answer" && !feedbackActionEvent.answer.answerAttemptId) {
        return Response.json(
            { error: "A feedback retry requires immutable answer-attempt identity." },
            { status: 409 },
        );
    }

    const questionCount = session.questionWordingSnapshot?.questions.length ?? 0;
    const interaction = createCandidateFeedbackInteraction({
        analysisSnapshot: matchingAnalysis,
        isLastQuestion: questionCount > 0
            && feedbackActionEvent.answer.questionIndex === questionCount - 1,
    });
    if (!isCandidateFeedbackActionEventAllowed({ interaction, event: feedbackActionEvent })) {
        return Response.json(
            { error: "Feedback action is not available from this coaching stage." },
            { status: 409 },
        );
    }

    const nextProgress = feedbackActionEvent.transition === "advance_to_next_question"
        && session.questionWordingSnapshot
        ? createSettledQuestionProgress({
            session,
            currentQuestionIndex: feedbackActionEvent.answer.questionIndex,
        })
        : null;
    const feedbackActionEvents = await practiceSessionRepository.saveFeedbackActionEvent({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        feedbackActionEvent,
        ...(nextProgress ? { nextProgress } : {}),
    });

    if (!feedbackActionEvents) {
        return Response.json({ error: "Feedback action could not be saved." }, { status: 404 });
    }

    if (
        ensureCoachUpdateArtifact
        && scheduleCoachUpdate
        && (
            feedbackActionEvent.transition === "advance_to_next_question"
            || feedbackActionEvent.transition === "finish_session"
        )
    ) {
        scheduleCoachUpdate(async () => {
            await ensureCoachUpdateArtifact({
                candidateProfileId: identity.candidateProfileId,
                sourceCandidatePracticeSessionId: sessionId,
                sourceQuestionKey: feedbackActionEvent.answer.slotId,
                settledAt: feedbackActionEvent.selectedAt,
            }).catch(() => undefined);
        });
    }

    return Response.json({
        status: "feedback_action_saved",
        feedbackActionEvents,
    });
}

function createDefaultCandidateFeedbackActionDependencies(): Pick<
    CandidateFeedbackActionRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository" | "ensureCoachUpdateArtifact" | "scheduleCoachUpdate"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    const ensureCoachUpdateArtifact = createDefaultCandidateSessionCompleteDependencies().ensureCoachUpdateArtifact;
    return {
        resolveCandidateSessionIdentity: (request) =>
            resolveCandidateOwnedRequestIdentity(request, queryClient),
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
        ...(ensureCoachUpdateArtifact ? { ensureCoachUpdateArtifact } : {}),
        scheduleCoachUpdate: (task) => after(task),
    };
}

function createSettledQuestionProgress({
    session,
    currentQuestionIndex,
}: {
    session: CandidateFeedbackActionSession;
    currentQuestionIndex: number;
}): SessionRuntimeProgress | null {
    if (!session.questionWordingSnapshot) return null;
    const nextQuestionIndex = resolveCandidateNextUnansweredQuestionIndex({
        questions: session.questionWordingSnapshot.questions,
        answerSubmissions: session.answerSubmissions ?? {},
        afterQuestionIndex: currentQuestionIndex,
    });
    if (nextQuestionIndex === null) return null;
    return {
        status: "live_question",
        currentQuestionIndex: nextQuestionIndex,
        ...(session.progress?.answerMode ? { answerMode: session.progress.answerMode } : {}),
    };
}

type CandidateFeedbackActionQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateFeedbackActionQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-feedback-action",
            });
            return pool.query(sql, values);
        },
    };
}

function parseFeedbackActionEvent(value: unknown): CandidateFeedbackActionEvent | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const body = value as Record<string, unknown>;
    if (body.status !== "feedback_action_selected") {
        return null;
    }

    const answer = parseAnswerReference(body.answer);
    const stageId = readStageId(body.stageId);
    const actionKind = readActionKind(body.actionKind);
    const transition = readTransition(body.transition);
    const targetStageId = typeof body.targetStageId === "undefined"
        ? undefined
        : readStageId(body.targetStageId) ?? undefined;
    const selectedAt = readString(body.selectedAt);

    if (!answer || !stageId || !actionKind || !transition || !selectedAt) {
        return null;
    }
    if (typeof body.targetStageId !== "undefined" && !targetStageId) {
        return null;
    }

    return {
        status: "feedback_action_selected",
        answer,
        stageId,
        actionKind,
        transition,
        targetStageId,
        selectedAt,
    };
}

function parseAnswerReference(value: unknown): CandidateFeedbackActionEvent["answer"] | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const answer = value as Record<string, unknown>;
    const slotId = readString(answer.slotId);
    if (
        !slotId
        || typeof answer.questionIndex !== "number"
        || !Number.isInteger(answer.questionIndex)
        || answer.questionIndex < 0
    ) {
        return null;
    }

    const answerAttemptId = readString(answer.answerAttemptId);
    const attemptNumber = readPositiveInteger(answer.attemptNumber);
    const trigger = answer.trigger === "initial_submit" || answer.trigger === "feedback_retry"
        ? answer.trigger
        : null;
    const hasAttemptMetadata = Boolean(answerAttemptId || attemptNumber || trigger);
    if (hasAttemptMetadata && (!answerAttemptId || !attemptNumber || !trigger)) {
        return null;
    }

    return {
        slotId,
        questionIndex: answer.questionIndex,
        ...(hasAttemptMetadata ? {
            answerAttemptId: answerAttemptId!,
            attemptNumber: attemptNumber!,
            trigger: trigger!,
        } : {}),
    };
}

function readStageId(value: unknown): CandidateFeedbackInteractionStageId | null {
    return typeof value === "string" && stageIds.has(value as CandidateFeedbackInteractionStageId)
        ? value as CandidateFeedbackInteractionStageId
        : null;
}

function readActionKind(value: unknown): CandidateFeedbackActionKind | null {
    return typeof value === "string" && actionKinds.has(value as CandidateFeedbackActionKind)
        ? value as CandidateFeedbackActionKind
        : null;
}

function readTransition(value: unknown): CandidateFeedbackTransition | null {
    return typeof value === "string" && transitions.has(value as CandidateFeedbackTransition)
        ? value as CandidateFeedbackTransition
        : null;
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function readPositiveInteger(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function getRuntimeSslConfig(databaseUrl: string) {
    const sslMode = readUrlSslMode(databaseUrl);
    if (sslMode === "disable") {
        return false;
    }
    if (sslMode) {
        return {
            rejectUnauthorized: sslMode === "verify-ca" || sslMode === "verify-full",
        };
    }
    return undefined;
}

function readUrlSslMode(databaseUrl: string) {
    try {
        return new URL(databaseUrl).searchParams.get("sslmode")?.toLowerCase() ?? null;
    } catch {
        return null;
    }
}
