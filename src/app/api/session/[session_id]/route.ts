import { NextResponse } from "next/server";
import { requireCandidateToken } from "@/lib/server/auth/candidate-token";
import { UpdateSessionSchema } from "@/lib/domain/schemas";
import {
    createCorrelationId,
    forbiddenResponse,
    internalErrorResponse,
    notFoundResponse,
    unauthorizedResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { createServerLogger } from "@/lib/server/server-logger";
import { updateSessionCommand } from "@/lib/server/application/session/update-session";
import { SessionUpdateNotFoundError, SessionUpdateValidationError } from "@/lib/server/application/session/errors";
import { getSessionCommand } from "@/lib/server/application/session/get-session";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ session_id: string }> }
) {
    const { session_id } = await params;
    const correlationId = createCorrelationId();
    const routeLogger = createServerLogger("SessionAPI", {
        correlationId,
        route: "/api/session/[session_id]",
        actorType: "candidate",
        sessionId: session_id,
        method: request.method
    });
    const auth = await requireCandidateToken(request, session_id);
    if (!auth.ok) {
        if (auth.status === 401) {
            return unauthorizedResponse(correlationId, auth.error);
        }

        return forbiddenResponse(correlationId, auth.error);
    }

    try {
        const session = await getSessionCommand(session_id);
        return NextResponse.json(session);
    } catch (error) {
        if (error instanceof SessionUpdateNotFoundError) {
            return notFoundResponse(correlationId, error.message);
        }

        routeLogger.error("Session fetch GET failed", {
            error,
            errorCode: "SESSION_GET_FAILED"
        });
        return internalErrorResponse(correlationId);
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ session_id: string }> }
) {
    const correlationId = createCorrelationId();
    const { session_id } = await params;
    const routeLogger = createServerLogger("SessionAPI", {
        correlationId,
        route: "/api/session/[session_id]",
        actorType: "candidate",
        sessionId: session_id,
        method: request.method
    });
    const auth = await requireCandidateToken(request, session_id);
    if (!auth.ok) {
        if (auth.status === 401) {
            return unauthorizedResponse(correlationId, auth.error);
        }

        return forbiddenResponse(correlationId, auth.error);
    }

    try {
        const body = await request.json();
        const parseResult = UpdateSessionSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }
        const session = await updateSessionCommand(session_id, parseResult.data);

        return NextResponse.json(session);
    } catch (error) {
        if (error instanceof SessionUpdateNotFoundError) {
            return notFoundResponse(correlationId, error.message);
        }

        if (error instanceof SessionUpdateValidationError) {
            return validationErrorResponse(correlationId, error.message);
        }

        routeLogger.error("Session update PATCH failed", {
            error,
            errorCode: "SESSION_PATCH_FAILED"
        });
        return internalErrorResponse(correlationId);
    }
}
