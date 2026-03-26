import { NextResponse } from "next/server";
import { InitSessionSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";
import { incrementMetric, observeMetric } from "@/lib/server/metrics";
import {
    createCorrelationId,
    forbiddenResponse,
    internalErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { startSessionCommand } from "@/lib/server/application/session/start-session";
import { SessionStartAccessError, SessionStartNotFoundError } from "@/lib/server/application/session/errors";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_SESSION_START_REQUESTS = 10;

export async function POST(request: Request) {
    const correlationId = createCorrelationId();
    const startedAt = Date.now();

    try {
        const rateLimitResponse = await enforceIpRateLimit({
            request,
            scope: "session_start",
            correlationId,
            maxRequests: MAX_SESSION_START_REQUESTS,
            windowMs: WINDOW_MS,
            route: "/api/session/start",
            actorType: "candidate"
        });
        if (rateLimitResponse) {
            incrementMetric("session_start_total", { outcome: "rate_limited" });
            observeMetric("session_start_duration_ms", Date.now() - startedAt, { outcome: "rate_limited" });
            return rateLimitResponse;
        }

        const body = await request.json();

        // 1. Validation
        const parseResult = InitSessionSchema.safeParse(body);
        if (!parseResult.success) {
            incrementMetric("session_start_total", { outcome: "invalid_request" });
            observeMetric("session_start_duration_ms", Date.now() - startedAt, { outcome: "invalid_request" });
            return validationErrorResponse(correlationId);
        }

        const input = parseResult.data;
        const { session, candidateToken } = await startSessionCommand(request, input);

        const response = NextResponse.json(session);
        response.headers.set("x-candidate-token", candidateToken);
        incrementMetric("session_start_total", { outcome: "success", mode: input.parentId ? "clone" : "new" });
        observeMetric("session_start_duration_ms", Date.now() - startedAt, { outcome: "success", mode: input.parentId ? "clone" : "new" });
        return response;

    } catch (error) {
        if (error instanceof SessionStartAccessError) {
            const outcome = error.status === 401 ? "unauthorized" : "forbidden";
            incrementMetric("session_start_total", { outcome, mode: "clone" });
            observeMetric("session_start_duration_ms", Date.now() - startedAt, { outcome, mode: "clone" });
            return error.status === 401
                ? unauthorizedResponse(correlationId, error.message)
                : forbiddenResponse(correlationId, error.message);
        }

        if (error instanceof SessionStartNotFoundError) {
            incrementMetric("session_start_total", { outcome: "not_found", mode: "clone" });
            observeMetric("session_start_duration_ms", Date.now() - startedAt, { outcome: "not_found", mode: "clone" });
            return notFoundResponse(correlationId, error.message);
        }

        Logger.error("Link Start Error", { correlationId, error }, "SessionStartAPI");
        incrementMetric("session_start_total", { outcome: "error" });
        observeMetric("session_start_duration_ms", Date.now() - startedAt, { outcome: "error" });
        return internalErrorResponse(correlationId);
    }
}
