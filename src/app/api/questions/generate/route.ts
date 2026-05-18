"use server";

import { NextRequest, NextResponse } from "next/server";

import { GenerateQuestionsRequestSchema } from "@/lib/domain/schemas";
import {
    createCorrelationId,
    internalErrorResponse,
    unauthorizedResponse,
    validationErrorResponse,
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { getAuthenticatedRouteUser } from "@/lib/server/auth/current-user";
import { incrementMetric, observeMetric } from "@/lib/server/metrics";
import { ProviderResponseError } from "@/lib/server/provider-errors";
import { createServerLogger } from "@/lib/server/server-logger";
import { generateInterviewQuestionSet } from "@/lib/server/services/question-generation-service";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_QUESTION_GENERATION_REQUESTS = 15;

export async function POST(req: NextRequest) {
    const correlationId = createCorrelationId();
    const startedAt = Date.now();
    let providerOutcome: "success" | "mock_fallback" = "success";
    const routeLogger = createServerLogger("QuestionsAPI", {
        correlationId,
        route: "/api/questions/generate",
        actorType: "recruiter",
        method: req.method,
    });

    try {
        const rateLimitResponse = await enforceIpRateLimit({
            request: req,
            scope: "questions_generate",
            correlationId,
            maxRequests: MAX_QUESTION_GENERATION_REQUESTS,
            windowMs: WINDOW_MS,
            route: "/api/questions/generate",
            actorType: "recruiter",
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const user = await getAuthenticatedRouteUser({
            actorType: "recruiter",
            route: "/api/questions/generate",
        });
        if (!user) {
            incrementMetric("ai_requests_total", {
                operation: "question_generation",
                outcome: "unauthorized",
            });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, {
                operation: "question_generation",
                outcome: "unauthorized",
            });
            return unauthorizedResponse(correlationId, "Authentication required");
        }

        const body = await req.json().catch(() => null);
        const parseResult = GenerateQuestionsRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }

        routeLogger.info("Generating questions", {
            actorId: user.id,
            role: parseResult.data.role,
        });

        const questions = await generateInterviewQuestionSet(
            parseResult.data,
            {
                appName: "recruiter_app",
                actorType: "recruiter",
                actorId: user.id,
                correlationId,
                sourceRefs: [{ type: "route", route: "/api/questions/generate" }],
                onProviderOutcome: (outcome) => {
                    providerOutcome = outcome;
                },
            },
        );

        routeLogger.info("Questions generated successfully", {
            actorId: user.id,
            outcome: providerOutcome,
            role: parseResult.data.role,
        });
        incrementMetric("ai_requests_total", {
            operation: "question_generation",
            outcome: providerOutcome,
        });
        observeMetric("ai_request_duration_ms", Date.now() - startedAt, {
            operation: "question_generation",
            outcome: providerOutcome,
        });

        return NextResponse.json(questions);
    } catch (error) {
        const outcome = error instanceof ProviderResponseError ? "malformed_response" : "error";
        routeLogger.error("Question generation failed", {
            error,
            errorCode: "QUESTION_GENERATION_FAILED",
            provider: error instanceof ProviderResponseError ? error.provider : "gemini",
            operation: error instanceof ProviderResponseError ? error.operation : "generateQuestions",
            providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined,
        });
        incrementMetric("ai_requests_total", {
            operation: "question_generation",
            outcome,
        });
        observeMetric("ai_request_duration_ms", Date.now() - startedAt, {
            operation: "question_generation",
            outcome,
        });
        return internalErrorResponse(correlationId);
    }
}
