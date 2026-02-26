import { NextRequest, NextResponse } from 'next/server';
import { StrongResponseService } from '@/lib/server/services/strong-response-service';
import { Logger } from '@/lib/logger';
import { z } from 'zod';

const GenerateStrongResponseSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    role: z.string().optional(),
    resumeText: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Validate request body
        const result = GenerateStrongResponseSchema.safeParse(body);

        if (!result.success) {
            Logger.warn('[API] Invalid Strong Response request', result.error);
            return NextResponse.json(
                { error: 'Invalid request', details: result.error.format() },
                { status: 400 }
            );
        }

        const { question, role, resumeText } = result.data;

        // Generate content (fully self-sufficient — no tips dependency)
        const data = await StrongResponseService.generateStrongResponse(question, role || "Professional", resumeText);

        return NextResponse.json(data);

    } catch (error) {
        Logger.error('[API] Strong Response generation failed', error);
        return NextResponse.json(
            { error: 'Failed to generate strong response' },
            { status: 500 }
        );
    }
}
