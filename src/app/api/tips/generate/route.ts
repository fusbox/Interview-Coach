import { NextRequest, NextResponse } from "next/server";
import { TipsService, GenerateTipsSchema } from "@/lib/server/services/tips-service";
import { Logger } from "@/lib/logger";
import {
    createCorrelationId,
    internalErrorResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { authorizeCandidateSessionRequest } from "@/lib/server/candidate-route-auth";
import { z } from "zod";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_TIPS_REQUESTS = 30;
const GenerateTipsRequestSchema = GenerateTipsSchema.extend({
    sessionId: z.string().min(1, "Session is required")
});

export async function POST(req: NextRequest) {
    const correlationId = createCorrelationId();

    try {
        const rateLimitResponse = await enforceIpRateLimit({
            request: req,
            scope: "tips_generate",
            correlationId,
            maxRequests: MAX_TIPS_REQUESTS,
            windowMs: WINDOW_MS
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const body = await req.json();

        // Validate input
        const validation = GenerateTipsRequestSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(correlationId);
        }

        const { question, role, competency, blueprint, resumeText, sessionId } = validation.data;
        const authResponse = await authorizeCandidateSessionRequest(req, sessionId, correlationId);
        if (authResponse) {
            return authResponse;
        }

        // Generate Tips
        const tips = await TipsService.generateTips(
            question,
            role,
            competency,
            blueprint,
            resumeText
        );

        return NextResponse.json(tips);

    } catch (error) {
        Logger.error("[API] Tips Generation Failed", { correlationId, error }, "TipsAPI");
        return internalErrorResponse(correlationId);
    }
}
