import { NextRequest, NextResponse } from 'next/server';
import { StrongResponseService } from '@/lib/server/services/strong-response-service';
import { Logger } from '@/lib/logger';
import { z } from 'zod';
import {
    createCorrelationId,
    internalErrorResponse,
    validationErrorResponse
} from '@/lib/server/api-errors';
import { enforceIpRateLimit } from '@/lib/server/abuse-protection';
import { authorizeCandidateSessionRequest } from '@/lib/server/candidate-route-auth';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_STRONG_RESPONSE_REQUESTS = 30;

const GenerateStrongResponseSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    role: z.string().optional(),
    resumeText: z.string().optional(),
    sessionId: z.string().min(1, 'Session is required'),
});

export async function POST(req: NextRequest) {
    const correlationId = createCorrelationId();

    try {
        const rateLimitResponse = enforceIpRateLimit({
            request: req,
            scope: 'response_generate',
            correlationId,
            maxRequests: MAX_STRONG_RESPONSE_REQUESTS,
            windowMs: WINDOW_MS
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const body = await req.json();

        // Validate request body
        const result = GenerateStrongResponseSchema.safeParse(body);

        if (!result.success) {
            Logger.warn('[API] Invalid Strong Response request', result.error);
            return validationErrorResponse(correlationId);
        }

        const { question, role, resumeText, sessionId } = result.data;
        const authResponse = await authorizeCandidateSessionRequest(req, sessionId, correlationId);
        if (authResponse) {
            return authResponse;
        }

        // Generate content (fully self-sufficient — no tips dependency)
        const data = await StrongResponseService.generateStrongResponse(question, role || "Professional", resumeText);

        return NextResponse.json(data);

    } catch (error) {
        Logger.error('[API] Strong Response generation failed', { correlationId, error }, 'StrongResponseAPI');
        return internalErrorResponse(correlationId);
    }
}
