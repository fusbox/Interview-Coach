import { NextResponse } from "next/server";
import { createSession, addQuestions, cloneSession } from "@/lib/server/session/orchestrator";
import { QuestionService } from "@/lib/server/services/question-service";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { InitSessionSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";
import {
    createCorrelationId,
    forbiddenResponse,
    internalErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";

const repository = new SupabaseSessionRepository();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_SESSION_START_REQUESTS = 10;

export async function POST(request: Request) {
    const correlationId = createCorrelationId();

    try {
        const rateLimitResponse = enforceIpRateLimit({
            request,
            scope: "session_start",
            correlationId,
            maxRequests: MAX_SESSION_START_REQUESTS,
            windowMs: WINDOW_MS
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const body = await request.json();

        // 1. Validation
        const parseResult = InitSessionSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }

        const input = parseResult.data;
        let session;

        // 2. Orchestration (Clone or Create)
        if (input.parentId) {
            const parentAuth = await requireCandidateToken(request, input.parentId);
            if (!parentAuth.ok) {
                if (parentAuth.status === 401) {
                    return unauthorizedResponse(correlationId, parentAuth.error);
                }

                return forbiddenResponse(correlationId, parentAuth.error);
            }

            // CLONE FLOW
            const parentSession = await repository.get(input.parentId);
            if (!parentSession) {
                return notFoundResponse(correlationId, "Parent session not found");
            }
            session = cloneSession(parentSession);
            // Questions are now cloned with new IDs inside cloneSession
        } else {
            // NEW SESSION FLOW
            session = createSession(input);
            // Service Logic (Question Generation)
            const questions = await QuestionService.generateQuestions(session.role || "General");
            session = addQuestions(session, questions);
        }

        // 3. Persistence
        await repository.create(session);

        // 4. Auth Token Issuance
        const { issueCandidateToken } = await import("@/lib/server/auth/candidate-token");
        const token = await issueCandidateToken(session.id);

        const response = NextResponse.json(session);
        response.headers.set("x-candidate-token", token);
        return response;

    } catch (error) {
        Logger.error("Link Start Error", { correlationId, error }, "SessionStartAPI");
        return internalErrorResponse(correlationId);
    }
}
