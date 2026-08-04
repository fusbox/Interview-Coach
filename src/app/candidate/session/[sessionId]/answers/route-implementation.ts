import { resolveCandidateOwnedRequestIdentity } from "@/features/candidate-auth-v2/candidate-route-authorization";
import { CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV } from "@/features/candidate-auth-v2/production-host-launch-runtime";
import {
    completeCandidateAnswerIdempotencyRecord,
    createCandidateAnswerDraftChange,
    createCandidateAnswerIdempotencyPendingRecord,
    createCandidateAnswerSubmission,
    createCandidateAnswerSubmitIdempotencyContract,
    createCandidateAnswerSubmitRequest,
    resolveCandidateAnswerIdempotencyDecision,
    type CandidateAnswerIdempotencyRecord,
    type CandidateAnswerIdempotencyRecords,
    type CandidateAnswerMode,
    type CandidateAnswerSubmission,
    type CandidateAnswerSubmissions,
} from "@/features/candidate-session-v2/candidate-answer-lifecycle";
import {
    createCandidateAnswerAttemptPayloadFingerprint,
    toLatestCandidateAnswerSubmission,
    type CandidateAnswerAttemptWriteResult,
} from "@/features/candidate-session-v2/candidate-answer-history";
import { createCandidateAnswerHistoryRepository } from "@/features/candidate-session-v2/candidate-answer-history-repository";
import {
    createCandidatePracticeSessionRepository,
    type CandidatePracticeSessionRecord,
} from "@/features/candidate-session-v2/candidate-practice-session-repository";
import type { VoiceTranscriptSubmissionPath } from "@/features/interview-session-v2/voice-answer-transcription";
import type { CandidateAnswerAnalysisProviderResult } from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import type { CandidateFeedbackActionEvent } from "@/features/candidate-session-v2/candidate-feedback-interaction";
import { EVIDENCE_FIRST_INPUT_LIMITS } from "@/features/evaluation-v2/evidence-first-evaluator-contract";

type CandidateSessionIdentity = {
    candidateProfileId: string;
};

type CandidateAnswerSubmitSession = {
    status?: CandidatePracticeSessionRecord["status"];
    answerIdempotencyRecords?: CandidateAnswerIdempotencyRecords;
    answerSubmissions?: CandidateAnswerSubmissions;
    answerAnalysisSnapshots?: Record<string, CandidateAnswerAnalysisProviderResult>;
    feedbackActionEvents?: Record<string, CandidateFeedbackActionEvent>;
};

type CandidateAnswerSubmitRepository = {
    findSetupSession: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
    }) => Promise<CandidateAnswerSubmitSession | null>;
    saveAnswerSubmission: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        answerSubmission: CandidateAnswerSubmission;
    }) => Promise<CandidateAnswerSubmissions | null>;
    saveAnswerIdempotencyRecord?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        record: CandidateAnswerIdempotencyRecord;
    }) => Promise<CandidateAnswerIdempotencyRecords | null>;
    clearAnswerIdempotencyRecord?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        recordKey: string;
    }) => Promise<CandidateAnswerIdempotencyRecords | null>;
};

type CandidateAnswerAttemptRepository = {
    appendAnswerAttempt: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        questionSlotId: string;
        questionIndex: number;
        mode: "text" | "voice";
        answerText: string;
        submittedAt: string;
        trigger: "initial_submit" | "feedback_retry";
        supersedesCandidateAnswerAttemptId?: string | null;
        idempotencyKey: string;
        payloadFingerprint: string;
        sourceVoiceTranscriptionRunId?: string | null;
        voiceSubmissionPath?: VoiceTranscriptSubmissionPath | null;
        voiceTranscriptEdited?: boolean | null;
    }) => Promise<CandidateAnswerAttemptWriteResult | null>;
    authorizeVoiceAnswerTranscript?: (input: {
        candidatePracticeSessionId: string;
        candidateProfileId: string;
        questionSlotId: string;
        questionIndex: number;
        sourceVoiceTranscriptionRunId: string;
        voiceSubmissionPath: VoiceTranscriptSubmissionPath;
        transcriptText: string;
        updatedAt: string;
    }) => Promise<{ voiceTranscriptEdited: boolean } | null>;
};

export type CandidateAnswerSubmitRouteDependencies = {
    now: Date;
    resolveCandidateSessionIdentity?: (request: Request) => Promise<CandidateSessionIdentity | null>;
    practiceSessionRepository?: CandidateAnswerSubmitRepository;
    answerAttemptRepository?: CandidateAnswerAttemptRepository;
    recordDiagnostic?: (event: CandidateAnswerSubmitDiagnostic) => void;
};

export type CandidateAnswerSubmitDiagnostic = {
    event: "candidate_answer_submit";
    outcome: "failed";
    statusCode: 503;
    answerMode: CandidateAnswerMode;
    persistenceStage: "save_idempotency"
        | "authorize_voice_transcript"
        | "append_answer_attempt"
        | "save_answer_projection"
        | "complete_idempotency";
    failureClass: "database_error";
    databaseCode?: string;
};

export async function POST(
    request: Request,
    context: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await context.params;
    return handleCandidateAnswerSubmitRequest({
        request,
        sessionId,
        now: new Date(),
        ...createDefaultCandidateAnswerSubmitDependencies(),
    });
}

export async function handleCandidateAnswerSubmitRequest({
    request,
    sessionId,
    now,
    resolveCandidateSessionIdentity,
    practiceSessionRepository,
    answerAttemptRepository,
    recordDiagnostic = recordDefaultCandidateAnswerSubmitDiagnostic,
}: CandidateAnswerSubmitRouteDependencies & {
    request: Request;
    sessionId: string;
}) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid answer submit request." }, { status: 400 });
    }

    const parsedBody = parseAnswerSubmitBody(body);
    if (!parsedBody) {
        return Response.json({ error: "Invalid answer submit request." }, { status: 400 });
    }

    const identity = resolveCandidateSessionIdentity
        ? await resolveCandidateSessionIdentity(request)
        : null;
    if (!identity || !practiceSessionRepository) {
        return Response.json({ error: "Candidate session identity is required." }, { status: 401 });
    }

    const practiceSession = await practiceSessionRepository.findSetupSession({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
    });
    if (!practiceSession) {
        return Response.json({ error: "Candidate practice session was not found." }, { status: 404 });
    }

    if (practiceSession.status === "completed" || practiceSession.status === "abandoned") {
        return Response.json({
            code: "SESSION_NOT_ACCEPTING_ANSWERS",
            error: "This practice session is no longer accepting answers.",
            retryable: false,
        }, { status: 409 });
    }

    if (
        parsedBody.trigger === "feedback_retry"
        && !isAuthorizedFeedbackRetry(practiceSession, parsedBody)
    ) {
        return Response.json({
            code: "FEEDBACK_RETRY_NOT_AUTHORIZED",
            error: "This retry no longer matches the latest coached answer.",
            retryable: false,
        }, { status: 409 });
    }

    const draftChange = createCandidateAnswerDraftChange({
        ...parsedBody,
        now,
    });
    const submitRequest = createCandidateAnswerSubmitRequest({
        draft: draftChange.draft,
        requestedAt: now,
        trigger: parsedBody.trigger,
        supersedesAnswerAttemptId: parsedBody.supersedesAnswerAttemptId,
        sourceVoiceTranscriptionRunId: parsedBody.sourceVoiceTranscriptionRunId,
        voiceSubmissionPath: parsedBody.voiceSubmissionPath,
    });
    const idempotencyContract = createCandidateAnswerSubmitIdempotencyContract({
        candidatePracticeSessionId: sessionId,
        candidateProfileId: identity.candidateProfileId,
        request: submitRequest,
        idempotencyKey: request.headers.get("Idempotency-Key"),
    });
    const idempotencyDecision = resolveCandidateAnswerIdempotencyDecision({
        contract: idempotencyContract,
        records: practiceSession.answerIdempotencyRecords ?? {},
        requestedAt: now,
    });

    if (idempotencyDecision.kind === "replay") {
        return Response.json(idempotencyDecision.body, { status: idempotencyDecision.statusCode });
    }

    if (idempotencyDecision.kind === "pending") {
        return Response.json({
            code: "REQUEST_IN_PROGRESS",
            error: "An identical answer submit request is already in progress.",
            retryable: true,
        }, { status: idempotencyContract.replay.pendingHttpStatus });
    }

    if (idempotencyDecision.kind === "conflict") {
        return Response.json({
            code: "IDEMPOTENCY_MISMATCH",
            error: "Idempotency key cannot be reused with a different answer submit payload.",
            retryable: false,
        }, { status: idempotencyContract.replay.conflictHttpStatus });
    }

    let completed = false;
    let persistenceStage: CandidateAnswerSubmitDiagnostic["persistenceStage"] = "save_idempotency";
    try {
        if (practiceSessionRepository.saveAnswerIdempotencyRecord) {
            persistenceStage = "save_idempotency";
            await practiceSessionRepository.saveAnswerIdempotencyRecord({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                record: createCandidateAnswerIdempotencyPendingRecord({
                    contract: idempotencyContract,
                    requestedAt: now,
                }),
            });
        }

        let voiceTranscriptEdited: boolean | null = null;
        if (submitRequest.draft.mode === "voice") {
            if (!answerAttemptRepository?.authorizeVoiceAnswerTranscript) {
                return Response.json({
                    code: "VOICE_ANSWER_PERSISTENCE_UNAVAILABLE",
                    error: "Voice answer persistence is not available.",
                    retryable: true,
                }, { status: 503 });
            }
            persistenceStage = "authorize_voice_transcript";
            const authorizedTranscript = await answerAttemptRepository.authorizeVoiceAnswerTranscript({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                questionSlotId: submitRequest.draft.slotId,
                questionIndex: submitRequest.draft.questionIndex,
                sourceVoiceTranscriptionRunId: submitRequest.sourceVoiceTranscriptionRunId!,
                voiceSubmissionPath: submitRequest.voiceSubmissionPath!,
                transcriptText: submitRequest.draft.text,
                updatedAt: submitRequest.requestedAt,
            });
            if (!authorizedTranscript) {
                return Response.json({
                    code: "VOICE_TRANSCRIPT_SOURCE_NOT_CURRENT",
                    error: "This transcript is no longer the current voice answer for this question.",
                    retryable: false,
                }, { status: 409 });
            }
            voiceTranscriptEdited = authorizedTranscript.voiceTranscriptEdited;
        }

        let answerSubmission = createCandidateAnswerSubmission({
            request: submitRequest,
        });

        if (answerAttemptRepository) {
            persistenceStage = "append_answer_attempt";
            const attemptWrite = await answerAttemptRepository.appendAnswerAttempt({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                questionSlotId: submitRequest.draft.slotId,
                questionIndex: submitRequest.draft.questionIndex,
                mode: submitRequest.draft.mode,
                answerText: submitRequest.draft.text,
                submittedAt: submitRequest.requestedAt,
                trigger: submitRequest.trigger ?? "initial_submit",
                supersedesCandidateAnswerAttemptId: submitRequest.supersedesAnswerAttemptId ?? null,
                idempotencyKey: idempotencyContract.key,
                payloadFingerprint: createCandidateAnswerAttemptPayloadFingerprint({
                    candidatePracticeSessionId: sessionId,
                    questionSlotId: submitRequest.draft.slotId,
                    questionIndex: submitRequest.draft.questionIndex,
                    mode: submitRequest.draft.mode,
                    answerText: submitRequest.draft.text,
                    trigger: submitRequest.trigger ?? "initial_submit",
                    supersedesCandidateAnswerAttemptId: submitRequest.supersedesAnswerAttemptId ?? null,
                    sourceVoiceTranscriptionRunId: submitRequest.sourceVoiceTranscriptionRunId ?? null,
                    voiceSubmissionPath: submitRequest.voiceSubmissionPath ?? null,
                    voiceTranscriptEdited,
                }),
                sourceVoiceTranscriptionRunId: submitRequest.sourceVoiceTranscriptionRunId ?? null,
                voiceSubmissionPath: submitRequest.voiceSubmissionPath ?? null,
                voiceTranscriptEdited,
            });

            if (!attemptWrite) {
                return Response.json({
                    code: "ANSWER_ATTEMPT_TRANSITION_INVALID",
                    error: "This answer has already been submitted. Start a coach-guided retry before submitting another answer.",
                    retryable: false,
                }, { status: 409 });
            }
            if (attemptWrite.outcome === "idempotency_conflict") {
                return Response.json({
                    code: "IDEMPOTENCY_MISMATCH",
                    error: "Idempotency key cannot be reused with a different answer submit payload.",
                    retryable: false,
                }, { status: 409 });
            }

            answerSubmission = toLatestCandidateAnswerSubmission(attemptWrite.attempt);
        }

        persistenceStage = "save_answer_projection";
        const answerSubmissions = await practiceSessionRepository.saveAnswerSubmission({
            candidatePracticeSessionId: sessionId,
            candidateProfileId: identity.candidateProfileId,
            answerSubmission,
        });

        if (!answerSubmissions) {
            return Response.json({ error: "Candidate answer submission could not be saved." }, { status: 404 });
        }

        const responseBody = {
            status: "answer_submit_saved",
            answerSubmissions,
            request: submitRequest,
            next: "analysis_not_connected",
        };

        if (practiceSessionRepository.saveAnswerIdempotencyRecord) {
            persistenceStage = "complete_idempotency";
            await practiceSessionRepository.saveAnswerIdempotencyRecord({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                record: completeCandidateAnswerIdempotencyRecord({
                    record: idempotencyDecision.record,
                    completedAt: now,
                    statusCode: 202,
                    body: responseBody,
                }),
            });
        }

        completed = true;
        return Response.json(responseBody, { status: 202 });
    } catch (error) {
        recordDiagnostic({
            event: "candidate_answer_submit",
            outcome: "failed",
            statusCode: 503,
            answerMode: submitRequest.draft.mode,
            persistenceStage,
            failureClass: "database_error",
            ...safeDatabaseCode(error),
        });
        return Response.json({
            code: "ANSWER_SUBMIT_FAILED",
            error: "Candidate answer could not be saved.",
            retryable: true,
        }, { status: 503 });
    } finally {
        if (!completed && practiceSessionRepository.clearAnswerIdempotencyRecord) {
            await practiceSessionRepository.clearAnswerIdempotencyRecord({
                candidatePracticeSessionId: sessionId,
                candidateProfileId: identity.candidateProfileId,
                recordKey: idempotencyDecision.record.recordKey,
            }).catch(() => undefined);
        }
    }
}

function safeDatabaseCode(error: unknown): { databaseCode?: string } {
    const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)
        ? { databaseCode: code }
        : {};
}

function recordDefaultCandidateAnswerSubmitDiagnostic(event: CandidateAnswerSubmitDiagnostic) {
    console.info("candidate_answer_submit", event);
}

function createDefaultCandidateAnswerSubmitDependencies(): Pick<
    CandidateAnswerSubmitRouteDependencies,
    "resolveCandidateSessionIdentity" | "practiceSessionRepository" | "answerAttemptRepository"
> {
    const databaseUrl = process.env[CANDIDATE_HOST_LAUNCH_DATABASE_URL_ENV]?.trim();
    if (!databaseUrl) {
        return {};
    }

    const queryClient = createLazyPostgresQueryClient(databaseUrl);

    return {
        resolveCandidateSessionIdentity: (request) =>
            resolveCandidateOwnedRequestIdentity(request, queryClient),
        practiceSessionRepository: createCandidatePracticeSessionRepository(queryClient),
        answerAttemptRepository: createCandidateAnswerHistoryRepository(queryClient),
    };
}

type CandidateAnswerSubmitQueryClient = {
    query: (sql: string, values: unknown[]) => Promise<{
        rows: Array<Record<string, unknown>>;
    }>;
};

function createLazyPostgresQueryClient(databaseUrl: string): CandidateAnswerSubmitQueryClient {
    let pool: import("pg").Pool | null = null;

    return {
        async query(sql, values) {
            const { Pool } = await import("pg");
            pool ??= new Pool({
                connectionString: databaseUrl,
                ssl: getRuntimeSslConfig(databaseUrl),
                max: 2,
                application_name: "interview-coach-candidate-answer-submit",
            });
            return pool.query(sql, values);
        },
    };
}

function parseAnswerSubmitBody(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const body = value as Record<string, unknown>;
    const slotId = readString(body.slotId);
    const mode: CandidateAnswerMode | null = body.mode === "text" || body.mode === "voice"
        ? body.mode
        : null;
    const sourceVoiceTranscriptionRunId = readUuid(body.sourceVoiceTranscriptionRunId);
    const voiceSubmissionPath: VoiceTranscriptSubmissionPath | null = body.voiceSubmissionPath === "quick_submit"
        || body.voiceSubmissionPath === "transcript_review"
        ? body.voiceSubmissionPath
        : null;
    if (
        !slotId
        || !mode
        || typeof body.text !== "string"
        || !body.text.trim()
        || body.text.length > EVIDENCE_FIRST_INPUT_LIMITS.answerText
        || typeof body.questionIndex !== "number"
        || !Number.isInteger(body.questionIndex)
        || body.questionIndex < 0
        || (mode === "voice" && (!sourceVoiceTranscriptionRunId || !voiceSubmissionPath))
        || (mode === "text" && (
            typeof body.sourceVoiceTranscriptionRunId !== "undefined"
            || typeof body.voiceSubmissionPath !== "undefined"
        ))
    ) {
        return null;
    }

    const trigger: "initial_submit" | "feedback_retry" = body.trigger === "feedback_retry"
        ? "feedback_retry"
        : "initial_submit";
    const supersedesAnswerAttemptId = readString(body.supersedesAnswerAttemptId);
    if (
        (typeof body.trigger !== "undefined" && body.trigger !== "initial_submit" && body.trigger !== "feedback_retry")
        || (trigger === "feedback_retry" && !supersedesAnswerAttemptId)
        || (trigger === "initial_submit" && supersedesAnswerAttemptId)
    ) {
        return null;
    }

    return {
        slotId,
        questionIndex: body.questionIndex,
        mode,
        text: body.text,
        trigger,
        supersedesAnswerAttemptId: trigger === "feedback_retry" ? supersedesAnswerAttemptId! : null,
        sourceVoiceTranscriptionRunId: mode === "voice" ? sourceVoiceTranscriptionRunId! : null,
        voiceSubmissionPath: mode === "voice" ? voiceSubmissionPath! : null,
    };
}

function isAuthorizedFeedbackRetry(
    session: CandidateAnswerSubmitSession,
    retry: {
        slotId: string;
        questionIndex: number;
        supersedesAnswerAttemptId: string | null;
    },
) {
    const sourceAttemptId = retry.supersedesAnswerAttemptId;
    const latestSubmission = session.answerSubmissions?.[retry.slotId];
    const latestAnalysis = session.answerAnalysisSnapshots?.[retry.slotId];
    const feedbackAction = session.feedbackActionEvents?.[retry.slotId];

    return Boolean(
        sourceAttemptId
        && latestSubmission?.answerAttemptId === sourceAttemptId
        && latestSubmission.questionIndex === retry.questionIndex
        && latestAnalysis?.answer.answerAttemptId === sourceAttemptId
        && latestAnalysis.answer.questionIndex === retry.questionIndex
        && feedbackAction?.answer.answerAttemptId === sourceAttemptId
        && feedbackAction.answer.questionIndex === retry.questionIndex
        && feedbackAction.answer.attemptNumber === latestSubmission.attemptNumber
        && feedbackAction.answer.attemptNumber === latestAnalysis.answer.attemptNumber
        && feedbackAction.answer.trigger === latestSubmission.trigger
        && feedbackAction.answer.trigger === latestAnalysis.answer.trigger
        && feedbackAction.actionKind === "retry_answer"
        && feedbackAction.transition === "retry_current_question"
    );
}

function readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function readUuid(value: unknown) {
    const normalized = readString(value);
    return normalized && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
        ? normalized
        : null;
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
