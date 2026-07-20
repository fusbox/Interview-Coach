import { NextRequest, NextResponse } from "next/server";

import { getCurrentRecruiterAccess, type RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";
import { createCandidateQuestionWordingRuntimeFromEnvironment } from "@/features/candidate-session-v2/candidate-question-wording-runtime-selection";
import type { CandidateQuestionWordingRuntimeTelemetry } from "@/features/candidate-session-v2/candidate-question-wording-runtime";
import {
    parseRecruiterInvitationCreateRequest,
    RecruiterInvitationCreateValidationError,
    type RecruiterCreateInvitationsRequest,
    type RecruiterPrepareQuestionsRequest,
} from "@/features/recruiter-invites-v2/recruiter-invitation-create-contract";
import {
    createRecruiterInvitationsFromQuestionSet,
    prepareRecruiterInvitationQuestions,
    RecruiterQuestionSetConflictError,
    RecruiterQuestionSetFailedError,
    RecruiterQuestionSetInProgressError,
    RecruiterQuestionSetPersistenceError,
    RecruiterQuestionSetUnauthorizedError,
    RecruiterQuestionSetUnavailableError,
} from "@/features/recruiter-invites-v2/recruiter-invitation-create-service";
import { createRecruiterInvitationQuestionSetRepository } from "@/features/recruiter-invites-v2/recruiter-invitation-question-set-repository";
import { RecruiterInvitationConflictError } from "@/features/recruiter-invites-v2/recruiter-invitation-service";
import { createRecruiterInvitationRepository } from "@/features/recruiter-invites-v2/recruiter-invitation-repository";
import { createInvitedPracticeTokenVault } from "@/features/recruiter-invites-v2/invited-practice-token-vault";
import { createRecruiterInvitationCopyMessage } from "@/features/recruiter-invites-v2/recruiter-invitation-message";
import { getAppUserDisplayName } from "@/features/recruiter-auth-v2/app-user";
import { resolveRecruiterInvitationAppOrigin } from "@/features/recruiter-invites-v2/recruiter-invitation-app-origin";

const MAX_REQUEST_BYTES = 3_000_000;
const DEFAULT_INVITE_TOKEN_TTL_SECONDS = 14 * 24 * 60 * 60;

type PrepareQuestions = (
    recruiterId: string,
    request: RecruiterPrepareQuestionsRequest,
) => ReturnType<typeof prepareRecruiterInvitationQuestions>;

type CreateInvitations = (
    recruiterId: string,
    request: RecruiterCreateInvitationsRequest,
) => ReturnType<typeof createRecruiterInvitationsFromQuestionSet>;

export function createRecruiterInvitationsRouteHandler(dependencies: {
    resolveAccess?: () => Promise<RecruiterAccess>;
    prepareQuestions?: PrepareQuestions;
    createInvitations?: CreateInvitations;
    resolveAppOrigin?: (request: NextRequest) => string;
} = {}) {
    return async function recruiterInvitationsRoute(request: NextRequest) {
        const declaredLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
            return jsonError(413, "REQUEST_TOO_LARGE", "The invitation request is too large.");
        }

        const access = await (dependencies.resolveAccess ?? getCurrentRecruiterAccess)();
        if (access.kind === "missing") {
            return jsonError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue.");
        }
        if (access.kind === "forbidden") {
            return jsonError(403, "RECRUITER_ACCESS_REQUIRED", "Recruiter access is required.");
        }
        if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
            return jsonError(415, "JSON_REQUIRED", "This endpoint accepts JSON requests only.");
        }

        let parsed;
        try {
            const rawBody = await request.text();
            if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
                return jsonError(413, "REQUEST_TOO_LARGE", "The invitation request is too large.");
            }
            parsed = parseRecruiterInvitationCreateRequest(JSON.parse(rawBody));
        } catch (error) {
            if (error instanceof RecruiterInvitationCreateValidationError || error instanceof SyntaxError) {
                return jsonError(400, "INVALID_REQUEST", "Review the invitation details and try again.");
            }
            return jsonError(400, "INVALID_REQUEST", "Review the invitation details and try again.");
        }

        try {
            if (parsed.operation === "prepare_questions") {
                const result = await (dependencies.prepareQuestions ?? defaultPrepareQuestions)(access.user.id, parsed);
                const questionSet = result.questionSet;
                return noStoreJson({
                    status: "questions_ready",
                    outcome: result.outcome,
                    questionSetId: questionSet.questionSetId,
                    source: questionSet.source,
                    targetRole: questionSet.targetRole,
                    interviewStage: questionSet.interviewStage,
                    questionCount: questionSet.questionPlanSnapshot.questionCount,
                    questions: questionSet.questionWordingSnapshot.questions.map((question) => {
                        const slot = questionSet.questionPlanSnapshot.slots[question.index];
                        return {
                            slotId: question.slotId,
                            index: question.index,
                            category: question.category,
                            label: slot?.label ?? "Question",
                            questionText: question.questionText,
                        };
                    }),
                }, result.outcome === "created" ? 201 : 200);
            }

            const result = await (dependencies.createInvitations ?? defaultCreateInvitations)(access.user.id, parsed);
            const appOrigin = (dependencies.resolveAppOrigin ?? defaultResolveAppOrigin)(request);
            return noStoreJson({
                status: "invitations_created",
                outcome: result.outcome,
                batchId: result.batchId,
                targetRole: result.targetRole,
                recipients: result.recipients.map((recipient) => {
                    const inviteLink = `${appOrigin}/s/${encodeURIComponent(recipient.rawToken)}`;
                    return {
                        recipientId: recipient.recipientId,
                        sessionId: recipient.sessionId,
                        firstName: recipient.firstName,
                        lastName: recipient.lastName,
                        email: recipient.email,
                        inviteLink,
                        copyMessage: createRecruiterInvitationCopyMessage({
                            firstName: recipient.firstName,
                            targetRole: result.targetRole,
                            inviteLink,
                            recruiterName: getAppUserDisplayName(access.user),
                        }),
                        tokenExpiresAt: recipient.tokenExpiresAt,
                    };
                }),
            }, result.outcome === "created" ? 201 : 200);
        } catch (error) {
            return mapCreateError(error);
        }
    };
}

async function defaultPrepareQuestions(recruiterId: string, request: RecruiterPrepareQuestionsRequest) {
    const client = createRecruiterAuthQueryClientFromEnv();
    return prepareRecruiterInvitationQuestions(recruiterId, request, {
        repository: createRecruiterInvitationQuestionSetRepository(client),
        wordingRuntime: createCandidateQuestionWordingRuntimeFromEnvironment({
            env: { ...process.env },
            recordTelemetry: recordRecruiterQuestionWordingTelemetry,
        }),
    });
}

async function defaultCreateInvitations(recruiterId: string, request: RecruiterCreateInvitationsRequest) {
    const client = createRecruiterAuthQueryClientFromEnv();
    return createRecruiterInvitationsFromQuestionSet(recruiterId, request, {
        questionSetRepository: createRecruiterInvitationQuestionSetRepository(client),
        invitationRepository: createRecruiterInvitationRepository(client),
        tokenVault: createInvitedPracticeTokenVault(),
        tokenTtlSeconds: resolveInviteTokenTtlSeconds(process.env.RECRUITER_INVITE_TOKEN_TTL_SECONDS),
    });
}

function mapCreateError(error: unknown) {
    if (error instanceof RecruiterQuestionSetInProgressError) {
        const response = jsonError(409, "QUESTION_SET_IN_PROGRESS", "Questions are still being prepared. Try again shortly.", true);
        response.headers.set("Retry-After", "2");
        return response;
    }
    if (error instanceof RecruiterQuestionSetConflictError || error instanceof RecruiterInvitationConflictError) {
        return jsonError(409, "ACTION_KEY_CONFLICT", "This action changed after it began. Start over and try again.");
    }
    if (error instanceof RecruiterQuestionSetFailedError) {
        return jsonError(422, "QUESTION_SET_FAILED", "Questions could not be prepared. Start over to try again.");
    }
    if (error instanceof RecruiterQuestionSetUnavailableError) {
        return jsonError(409, "QUESTION_SET_UNAVAILABLE", "That prepared question set is no longer available. Start over.");
    }
    if (error instanceof RecruiterQuestionSetUnauthorizedError) {
        return jsonError(403, "RECRUITER_ACCESS_REQUIRED", "Recruiter access is required.");
    }
    if (error instanceof RecruiterQuestionSetPersistenceError) {
        return jsonError(503, "QUESTION_SET_SAVE_UNAVAILABLE", "Questions could not be saved. Try again.", true);
    }
    return jsonError(503, "INVITATION_CREATE_UNAVAILABLE", "Invitation creation is temporarily unavailable.", true);
}

function defaultResolveAppOrigin(request: NextRequest) {
    return resolveRecruiterInvitationAppOrigin(request.url);
}

function resolveInviteTokenTtlSeconds(value: string | undefined) {
    if (!value?.trim()) return DEFAULT_INVITE_TOKEN_TTL_SECONDS;
    const seconds = Number(value);
    if (!Number.isInteger(seconds) || seconds < 60 || seconds > 90 * 24 * 60 * 60) {
        throw new Error("RECRUITER_INVITE_TOKEN_TTL_SECONDS is invalid.");
    }
    return seconds;
}

function recordRecruiterQuestionWordingTelemetry(event: CandidateQuestionWordingRuntimeTelemetry) {
    console.info("recruiter_question_wording_runtime", {
        requestFingerprint: event.requestFingerprint,
        interviewStage: event.interviewStage,
        questionCount: event.questionCount,
        provider: event.provider,
        modelName: event.modelName,
        profileId: event.profileId,
        outcome: event.outcome,
        errorCode: event.errorCode,
        retryable: event.retryable,
        latencyMs: event.latencyMs,
    });
}

function jsonError(status: number, code: string, message: string, retryable = false) {
    return NextResponse.json({ code, message, retryable }, { status });
}

function noStoreJson(body: Record<string, unknown>, status: number) {
    return NextResponse.json(body, {
        status,
        headers: { "Cache-Control": "private, no-store" },
    });
}
