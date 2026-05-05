import { NextResponse } from "next/server";
import { AnalyzeAnswerRequestSchema } from "@/lib/domain/schemas";
import { AIService } from "@/lib/server/services/ai-service";
import { Question, Blueprint } from "@/lib/domain/types";
import {
    createCorrelationId,
    internalErrorResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { authorizeCandidateSessionRequest } from "@/lib/server/candidate-route-auth";
import { createServerLogger } from "@/lib/server/server-logger";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ANALYSIS_REQUESTS = 30;

export async function POST(request: Request) {
    const correlationId = createCorrelationId();
    let sessionId: string | undefined;
    const routeLogger = createServerLogger("AnalysisAPI", {
        correlationId,
        route: "/api/analysis",
        actorType: "candidate",
        method: request.method
    });

    try {
        const rateLimitResponse = await enforceIpRateLimit({
            request,
            scope: "analysis",
            correlationId,
            maxRequests: MAX_ANALYSIS_REQUESTS,
            windowMs: WINDOW_MS
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const body = await request.json();

        // Validate Input
        const parseResult = AnalyzeAnswerRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }

        const { question, input, blueprint, intakeData } = parseResult.data;
        sessionId = parseResult.data.sessionId;
        const authResponse = await authorizeCandidateSessionRequest(request, sessionId, correlationId);
        if (authResponse) {
            return authResponse;
        }

        let answerText: string | null = null;
        let audioData: { base64: string; mimeType: string } | null = null;

        if (typeof input === "string") {
            answerText = input;
        } else if (input && typeof input === "object" && "data" in input && "mimeType" in input) {
            audioData = {
                base64: (input as Record<string, string>).data,
                mimeType: (input as Record<string, string>).mimeType
            };
        } else {
            return validationErrorResponse(correlationId, "Invalid input format");
        }

        // Delegate to Service
        // Adapter: Construct a minimal Question object from the string input
        const questionObj = {
            id: parseResult.data.questionId || "temp",
            text: question,
            category: "General",
            index: 0
        };

        const analysis = await AIService.analyzeAnswer(
            questionObj as Question,
            answerText,
            audioData,
            blueprint as Blueprint | undefined,
            intakeData,
            undefined,
            undefined,
            {
                appName: "candidate_app",
                correlationId,
                sessionId,
                sourceRefs: [
                    { type: "route", route: "/api/analysis" },
                    { type: "question", questionId: questionObj.id },
                ],
                privacyFlags: audioData ? ["contains_audio_input"] : [],
            }
        );

        return NextResponse.json(analysis);

    } catch (error) {
        routeLogger.error("Analysis route failed", {
            error,
            sessionId,
            errorCode: "ANALYSIS_ROUTE_FAILED"
        });
        return internalErrorResponse(correlationId);
    }
}
