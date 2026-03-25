import { NextResponse } from "next/server";
import { TTSService } from "@/lib/server/services/tts-service";
import {
    createCorrelationId,
    internalErrorResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { authorizeCandidateSessionRequest } from "@/lib/server/candidate-route-auth";
import { z } from "zod";
import { createServerLogger } from "@/lib/server/server-logger";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_TTS_REQUESTS = 15;
const TtsRequestSchema = z.object({
    text: z.string().trim().min(1, "Missing text")
});

// export const runtime = 'edge'; // Optional: Use edge if compatible, otherwise default to node
// GenAI SDK might rely on Node built-ins, so keeping standard runtime for safety initially.

export async function POST(request: Request) {
    const correlationId = createCorrelationId();
    const routeLogger = createServerLogger("TTSAPI", {
        correlationId,
        route: "/api/tts",
        actorType: "candidate",
        method: request.method
    });

    try {
        const rateLimitResponse = await enforceIpRateLimit({
            request,
            scope: "tts",
            correlationId,
            maxRequests: MAX_TTS_REQUESTS,
            windowMs: WINDOW_MS
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const sessionId = request.headers.get("x-session-id");
        if (!sessionId) {
            return validationErrorResponse(correlationId, "Session is required");
        }
        const sessionLogger = createServerLogger("TTSAPI", {
            correlationId,
            route: "/api/tts",
            actorType: "candidate",
            sessionId,
            method: request.method
        });

        const authResponse = await authorizeCandidateSessionRequest(request, sessionId, correlationId);
        if (authResponse) {
            return authResponse;
        }

        const body = await request.json().catch(() => null);
        const parseResult = TtsRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }
        const { text } = parseResult.data;

        sessionLogger.info("Generating candidate TTS audio", {
            outcome: "start"
        });

        const { audioData, mimeType } = await TTSService.generateSpeech(text);

        return new NextResponse(new Uint8Array(audioData), {
            headers: {
                'Content-Type': mimeType,
                'Content-Length': audioData.length.toString(),
            }
        });

    } catch (error: unknown) {
        routeLogger.error("TTS route failed", {
            error,
            errorCode: "TTS_ROUTE_FAILED"
        });
        return internalErrorResponse(correlationId);
    }
}
