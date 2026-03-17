import { NextResponse } from "next/server";
import { TTSService } from "@/lib/server/services/tts-service";
import { Logger } from "@/lib/logger";
import {
    createCorrelationId,
    internalErrorResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { authorizeCandidateSessionRequest } from "@/lib/server/candidate-route-auth";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_TTS_REQUESTS = 15;

// export const runtime = 'edge'; // Optional: Use edge if compatible, otherwise default to node
// GenAI SDK might rely on Node built-ins, so keeping standard runtime for safety initially.

export async function POST(request: Request) {
    const correlationId = createCorrelationId();

    try {
        const rateLimitResponse = enforceIpRateLimit({
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

        const authResponse = await authorizeCandidateSessionRequest(request, sessionId, correlationId);
        if (authResponse) {
            return authResponse;
        }

        const body = await request.json();
        const { text } = body;

        if (!text) {
            return validationErrorResponse(correlationId, "Missing text");
        }

        const { audioData, mimeType } = await TTSService.generateSpeech(text);

        return new NextResponse(new Uint8Array(audioData), {
            headers: {
                'Content-Type': mimeType,
                'Content-Length': audioData.length.toString(),
            }
        });

    } catch (error: unknown) {
        Logger.error("TTS API failed", { correlationId, error }, "TTSAPI");
        return internalErrorResponse(correlationId);
    }
}
