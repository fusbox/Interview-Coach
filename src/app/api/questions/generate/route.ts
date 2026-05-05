"use server";

import { NextRequest, NextResponse } from "next/server";
import { GenerateQuestionsRequestSchema, GeneratedInterviewQuestionsSchema } from "@/lib/domain/schemas";
import { ai, AI_MODELS } from "@/lib/server/services/ai-config";
import { getReadingLevelContext } from "@/lib/ai/prompts";
import {
    createCorrelationId,
    internalErrorResponse,
    unauthorizedResponse,
    validationErrorResponse
} from "@/lib/server/api-errors";
import { enforceIpRateLimit } from "@/lib/server/abuse-protection";
import { incrementMetric, observeMetric, recordAuthDenial } from "@/lib/server/metrics";
import { createClient } from "@/lib/supabase/server";
import { parseProviderJson } from "@/lib/server/provider-response";
import { createServerLogger } from "@/lib/server/server-logger";
import { ProviderResponseError } from "@/lib/server/provider-errors";
import { captureAiGeneration } from "@/lib/server/ai-quality/capture-ai-generation";
import { redactPii } from "@/lib/server/ai-quality/redaction";
import {
    buildJobDescriptionContextArtifacts,
    buildResumeContextArtifacts,
} from "@/lib/server/ai-quality/context-artifacts";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_QUESTION_GENERATION_REQUESTS = 15;
const QUESTION_GENERATION_PROMPT_VERSION = "question-generation-v1";

export async function POST(req: NextRequest) {
    const correlationId = createCorrelationId();
    const startedAt = Date.now();
    let actorId: string | undefined;
    let generationInput: { role: string; jobDescription?: string; resume?: string } | null = null;
    let rawProviderOutput: string | undefined;
    let redactedPromptSnapshot: { prompt: string; promptVersion: string } | undefined;
    const routeLogger = createServerLogger("QuestionsAPI", {
        correlationId,
        route: "/api/questions/generate",
        actorType: "recruiter",
        method: req.method
    });

    try {
        const rateLimitResponse = await enforceIpRateLimit({
            request: req,
            scope: "questions_generate",
            correlationId,
            maxRequests: MAX_QUESTION_GENERATION_REQUESTS,
            windowMs: WINDOW_MS,
            route: "/api/questions/generate",
            actorType: "recruiter"
        });
        if (rateLimitResponse) {
            return rateLimitResponse;
        }

        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            recordAuthDenial({
                actorType: "recruiter",
                route: "/api/questions/generate",
                reason: "missing_supabase_user"
            });
            return unauthorizedResponse(correlationId, "Authentication required");
        }
        actorId = user.id;

        const body = await req.json().catch(() => null);
        const parseResult = GenerateQuestionsRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return validationErrorResponse(correlationId);
        }

        const { role, jobDescription, resume } = parseResult.data;
        generationInput = { role, jobDescription, resume };
        const privacyFlags = resume ? ["contains_resume"] : [];
        const contextArtifacts = [
            ...buildJobDescriptionContextArtifacts(jobDescription),
            ...buildResumeContextArtifacts(resume),
        ];
        const redactedGenerationInput = redactPii({
            role,
            hasJobDescription: !!jobDescription,
            hasResumeText: !!resume,
        });

        if (!ai) {
            routeLogger.warn("AI API key missing; returning mock questions", {
                outcome: "mock_fallback"
            });
            const mockQuestions = getMockQuestions(role);
            const redactedMockQuestions = redactPii(mockQuestions);
            await captureAiGeneration({
                appName: "recruiter_app",
                surface: "question_generation",
                status: "success",
                inputSnapshot: redactedGenerationInput,
                contextArtifacts,
                promptSnapshot: {
                    promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
                    providerConfigured: false,
                },
                promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
                modelProvider: "mock",
                modelName: "mock-question-generator",
                modelParams: {},
                rawOutput: redactedMockQuestions,
                parsedOutput: redactedMockQuestions,
                latencyMs: Date.now() - startedAt,
                correlationId,
                sourceRefs: [{ type: "route", route: "/api/questions/generate" }],
                createdBy: actorId,
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
            incrementMetric("ai_requests_total", {
                operation: "question_generation",
                outcome: "mock_fallback"
            });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, {
                operation: "question_generation",
                outcome: "mock_fallback"
            });
            return NextResponse.json(mockQuestions);
        }

        const readingLevelContext = getReadingLevelContext(role);

        const prompt = `
SYSTEM:
You are a Lead Recruiter designing high-fidelity interview questions for a "${role}" position.
Your goal is to create a realistic, inclusive, and role-appropriate interview set.

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}\n` : ''}
${resume ? `CANDIDATE RESUME:\n${resume}\n` : ''}

PHASE 1: SIGNAL ANALYSIS (Internal Reasoning)
1. Extract 3-4 core "Unspoken" requirements from the JD (e.g., physical stamina for warehouse, empathy for healthcare, or strategic influence for leaders).
2. If a RESUME is provided, identify 2-3 specific background markers to anchor questions (e.g., previous experience in a similar industry).

PHASE 2: COGNITIVE CALIBRATION
${readingLevelContext}
- BEHAVIORAL STYLE: Use "Concrete Situational Scenarios" (e.g., "What would you do if...") instead of abstract "Tell me about a time..." questions for entry-level roles.

PHASE 3: QUESTION GENERATION
Generate interview questions in these categories:

1. Behavioral Questions - Generate exactly 4 distinct behavioral questions as a keyed object.
   - Each question must be a complete, cohesive scenario (e.g., "Tell me about a time when..."). 
   - DO NOT fragmented them into S/T/A/R segments.
   - KEYS: "Conflict/Resolution", "Adaptability", "Initiative/Growth", "Role-Specific Scenario".

2. Culture/Fit Questions - Generate exactly 5 questions as a keyed object based on PERMA dimensions:
   - KEYS: "Positive Emotion", "Engagement", "Relationships", "Meaning", "Accomplishment".
   - Anchor these to the specific company environment implied in the JD.

3. Technical/Hard Skill Questions - Generate 1-2 questions.
   - Anchor these to the actual tools or tasks mentioned in the JD.
   - If a Resume is provided, tie the technical question to their stated tools/experience.

OUTPUT FORMAT (strict JSON, no other text):
{
  "behavioral": {
    "Conflict/Resolution": "complete question text",
    "Adaptability": "complete question text",
    "Initiative/Growth": "complete question text",
    "Role-Specific Scenario": "complete question text"
  },
  "culture": {
    "Positive Emotion": "complete question text",
    "Engagement": "complete question text",
    "Relationships": "complete question text",
    "Meaning": "complete question text",
    "Accomplishment": "complete question text"
  },
  "technical": [
    { "text": "question text" }
  ]
}

RULES:
- Questions must be relevant to the specific role and candidates.
- Use plain, supportive language for entry-level roles.
- Do not mention the word "STAR" or "PERMA" in the question text.
- Output ONLY valid JSON.`;
        redactedPromptSnapshot = {
            prompt: redactPii(prompt),
            promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
        };

        routeLogger.info("Generating questions", {
            actorId: user.id,
            role
        });

        const response = await ai.models.generateContent({
            model: AI_MODELS.QUESTION_GEN,
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' },
        });
        rawProviderOutput = response.text;

        const result = parseProviderJson(rawProviderOutput, GeneratedInterviewQuestionsSchema, {
            provider: "gemini",
            operation: "generateQuestions"
        });
        const redactedRawProviderOutput = redactPii(rawProviderOutput);
        const redactedResult = redactPii(result);
        await captureAiGeneration({
            appName: "recruiter_app",
            surface: "question_generation",
            status: "success",
            inputSnapshot: redactedGenerationInput,
            contextArtifacts,
            promptSnapshot: redactedPromptSnapshot,
            promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
            modelProvider: "gemini",
            modelName: AI_MODELS.QUESTION_GEN,
            modelParams: { responseMimeType: "application/json" },
            rawOutput: redactedRawProviderOutput,
            parsedOutput: redactedResult,
            latencyMs: Date.now() - startedAt,
            correlationId,
            sourceRefs: [{ type: "route", route: "/api/questions/generate" }],
            createdBy: actorId,
            privacyFlags,
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
        });
        
        routeLogger.info("Questions generated successfully", {
            actorId: user.id,
            outcome: "success",
            role
        });
        incrementMetric("ai_requests_total", {
            operation: "question_generation",
            outcome: "success"
        });
        observeMetric("ai_request_duration_ms", Date.now() - startedAt, {
            operation: "question_generation",
            outcome: "success"
        });
        
        return NextResponse.json(result);

    } catch (error) {
        const outcome = error instanceof ProviderResponseError ? "malformed_response" : "error";
        if (generationInput) {
            const privacyFlags = generationInput.resume ? ["contains_resume"] : [];
            const contextArtifacts = [
                ...buildJobDescriptionContextArtifacts(generationInput.jobDescription),
                ...buildResumeContextArtifacts(generationInput.resume),
            ];
            await captureAiGeneration({
                appName: "recruiter_app",
                surface: "question_generation",
                status: "failed",
                inputSnapshot: redactPii({
                    role: generationInput.role,
                    hasJobDescription: !!generationInput.jobDescription,
                    hasResumeText: !!generationInput.resume,
                }),
                contextArtifacts,
                promptSnapshot: redactedPromptSnapshot,
                promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
                modelProvider: error instanceof ProviderResponseError ? error.provider : "gemini",
                modelName: AI_MODELS.QUESTION_GEN,
                modelParams: { responseMimeType: "application/json" },
                rawOutput: rawProviderOutput ? redactPii(rawProviderOutput) : undefined,
                parsedOutput: null,
                latencyMs: Date.now() - startedAt,
                correlationId,
                sourceRefs: [{ type: "route", route: "/api/questions/generate" }],
                createdBy: actorId,
                error: serializeAiGenerationError(error),
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
        }
        routeLogger.error("Question generation failed", {
            error,
            errorCode: "QUESTION_GENERATION_FAILED",
            provider: error instanceof ProviderResponseError ? error.provider : "gemini",
            operation: error instanceof ProviderResponseError ? error.operation : "generateQuestions",
            providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined
        });
        incrementMetric("ai_requests_total", {
            operation: "question_generation",
            outcome
        });
        observeMetric("ai_request_duration_ms", Date.now() - startedAt, {
            operation: "question_generation",
            outcome
        });
        return internalErrorResponse(correlationId);
    }
}

function serializeAiGenerationError(error: unknown) {
    if (error instanceof ProviderResponseError) {
        return {
            name: error.name,
            message: error.message,
            provider: error.provider,
            operation: error.operation,
            kind: error.kind,
        };
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    return { message: String(error) };
}

function getMockQuestions(role: string) {
    return {
        behavioral: {
            "Conflict/Resolution": `Tell me about a time you had to resolve a conflict with a teammate or patient while working as a ${role}.`,
            "Adaptability": `Describe a situation where you had to adapt quickly to a major change in your shift or responsibilities.`,
            "Initiative/Growth": `Tell me about a time you took the initiative to improve a process or help a colleague without being asked.`,
            "Role-Specific Scenario": `Walk me through a specific role-specific challenge you faced as a ${role} and how you handled it.`
        },
        culture: {
            "Positive Emotion": `How do you maintain enthusiasm in your role as a ${role}?`,
            "Engagement": `What aspects of the ${role} position keep you most engaged?`,
            "Relationships": `How do you build effective working relationships with your team?`,
            "Meaning": `What does your work as a ${role} mean to you?`,
            "Accomplishment": `What professional accomplishment are you most proud of?`
        },
        technical: [
            { text: `What tools or techniques do you use most frequently as a ${role}?` }
        ]
    };
}
