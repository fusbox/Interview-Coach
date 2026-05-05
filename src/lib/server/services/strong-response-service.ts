import { Type } from "@google/genai";
import { StrongResponseResult } from "@/lib/domain/types";
import { StrongResponseResultSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "./ai-config";
import { getReadingLevelContext } from "@/lib/ai/prompts";
import { parseProviderJson } from "@/lib/server/provider-response";
import { incrementMetric, observeMetric } from "@/lib/server/metrics";
import { ProviderResponseError } from "@/lib/server/provider-errors";
import { captureAiGeneration } from "@/lib/server/ai-quality/capture-ai-generation";
import { redactPii } from "@/lib/server/ai-quality/redaction";
import { serializeAiQualityError } from "@/lib/server/ai-quality/error-serialization";
import { buildResumeContextArtifacts } from "@/lib/server/ai-quality/context-artifacts";
import type { AiGenerationCaptureContext } from "@/lib/server/ai-quality/types";

const STRONG_RESPONSE_PROMPT_VERSION = "strong-response-v1";

export class StrongResponseService {
    static async generateStrongResponse(
        questionText: string,
        role: string,
        resumeText?: string,
        captureContext: AiGenerationCaptureContext = {}
    ): Promise<StrongResponseResult> {
        const startedAt = Date.now();
        let rawProviderOutput: string | undefined;

        const readingLevelContext = getReadingLevelContext(role);

        let resumeContext = "";
        if (resumeText && resumeText.trim().length > 0) {
            resumeContext = `
CANDIDATE RESUME (use to anchor the example response):
${resumeText}

RESUME INTEGRATION RULES:
- The "Strong Response" should feel like it could plausibly come from THIS candidate.
- Reference their industry, domain, or types of experiences without fabricating specific events.
- The goal is to show a relatable model answer, not a generic one.
`;
        }

        const prompt = `
You are an expert interview coach.
Interview Question: "${questionText}".
Target Role: ${role}

${readingLevelContext}
${resumeContext}
YOUR INTERNAL REASONING (do NOT output this):
1. What is this question actually testing?
2. What does a "10/10" answer look like for a ${role}?
3. What specific structure, evidence, and tone would make this answer exceptional?

Task:
1. GENERATE A STRONG RESPONSE: Create a hypothetical "Strong" (10/10) answer to this question that a candidate for this SPECIFIC role would give.
   - It should be natural, professional, and ~150-200 words.
   - Include: a specific trigger event or situation, a clear personal action, and a measurable/observable result.
   - CRITICAL: It must strictly adhere to the READING LEVEL constraints above.
2. GENERATE "WHY THIS WORKS": Write 2-3 sentences explaining why this response is effective.
   - Name the specific techniques used (e.g., "opening with the specific challenge immediately establishes relevance").
   - Explain what makes it stand out from average answers.
   - Match the explanation's reading level to the READING LEVEL constraints above.

Return strictly JSON matching this structure:
{
   "strongResponse": "The full text of the robust answer",
   "whyThisWorks": "2-3 sentence explanation of why this answer is effective"
}
`;

        const privacyFlags = Array.from(new Set([
            ...(captureContext.privacyFlags ?? []),
            ...(resumeText ? ["contains_resume"] : []),
        ]));
        const inputSnapshot = redactPii({
            questionText,
            role,
            hasResumeText: !!resumeText,
        });
        const contextArtifacts = buildResumeContextArtifacts(resumeText);
        const promptSnapshot = {
            prompt: redactPii(prompt),
            promptVersion: STRONG_RESPONSE_PROMPT_VERSION,
        };

        if (!ai) {
            Logger.warn("[StrongResponseService] No API Key, returning mock response.");
            const mockResponse = {
                strongResponse: "This is a mock strong response because the API key is missing. It would usually be a comprehensive answer following best practices for this role.",
                whyThisWorks: "This response demonstrates specificity, clear ownership of actions, and a measurable outcome - the three key differentiators that separate top-20% answers from the rest.",
            };
            await captureAiGeneration({
                appName: captureContext.appName ?? "candidate_app",
                surface: "strong_response",
                status: "success",
                inputSnapshot,
                contextArtifacts,
                promptSnapshot: { promptVersion: STRONG_RESPONSE_PROMPT_VERSION, providerConfigured: false },
                promptVersion: STRONG_RESPONSE_PROMPT_VERSION,
                modelProvider: "mock",
                modelName: "mock-strong-response-generator",
                modelParams: {},
                rawOutput: redactPii(mockResponse),
                parsedOutput: redactPii(mockResponse),
                latencyMs: Date.now() - startedAt,
                correlationId: captureContext.correlationId,
                traceId: captureContext.traceId,
                sourceRefs: captureContext.sourceRefs ?? [{ type: "service", service: "StrongResponseService.generateStrongResponse" }],
                createdBy: captureContext.createdBy,
                sessionId: captureContext.sessionId,
                inviteBatchId: captureContext.inviteBatchId,
                candidateId: captureContext.candidateId,
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
            incrementMetric("ai_requests_total", { operation: "strong_response", outcome: "mock_fallback" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "strong_response", outcome: "mock_fallback" });
            return mockResponse;
        }

        try {
            const response = await ai.models.generateContent({
                model: AI_MODELS.STRONG_RESPONSE,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            strongResponse: { type: Type.STRING },
                            whyThisWorks: { type: Type.STRING },
                        },
                        required: ["strongResponse", "whyThisWorks"],
                    },
                },
            });

            rawProviderOutput = response.text;
            const parsedData: StrongResponseResult = parseProviderJson(rawProviderOutput, StrongResponseResultSchema, {
                provider: "gemini",
                operation: "generateStrongResponse",
            });
            parsedData.__debugPrompt = prompt;
            await captureAiGeneration({
                appName: captureContext.appName ?? "candidate_app",
                surface: "strong_response",
                status: "success",
                inputSnapshot,
                contextArtifacts,
                promptSnapshot,
                promptVersion: STRONG_RESPONSE_PROMPT_VERSION,
                modelProvider: "gemini",
                modelName: AI_MODELS.STRONG_RESPONSE,
                modelParams: { responseMimeType: "application/json" },
                rawOutput: redactPii(rawProviderOutput),
                parsedOutput: redactPii(parsedData),
                latencyMs: Date.now() - startedAt,
                correlationId: captureContext.correlationId,
                traceId: captureContext.traceId,
                sourceRefs: captureContext.sourceRefs ?? [{ type: "service", service: "StrongResponseService.generateStrongResponse" }],
                createdBy: captureContext.createdBy,
                sessionId: captureContext.sessionId,
                inviteBatchId: captureContext.inviteBatchId,
                candidateId: captureContext.candidateId,
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
            incrementMetric("ai_requests_total", { operation: "strong_response", outcome: "success" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "strong_response", outcome: "success" });

            return parsedData;

        } catch (error) {
            const outcome = error instanceof ProviderResponseError ? "malformed_response" : "error";
            await captureAiGeneration({
                appName: captureContext.appName ?? "candidate_app",
                surface: "strong_response",
                status: "failed",
                inputSnapshot,
                contextArtifacts,
                promptSnapshot,
                promptVersion: STRONG_RESPONSE_PROMPT_VERSION,
                modelProvider: error instanceof ProviderResponseError ? error.provider : "gemini",
                modelName: AI_MODELS.STRONG_RESPONSE,
                modelParams: { responseMimeType: "application/json" },
                rawOutput: rawProviderOutput ? redactPii(rawProviderOutput) : undefined,
                parsedOutput: null,
                latencyMs: Date.now() - startedAt,
                correlationId: captureContext.correlationId,
                traceId: captureContext.traceId,
                sourceRefs: captureContext.sourceRefs ?? [{ type: "service", service: "StrongResponseService.generateStrongResponse" }],
                createdBy: captureContext.createdBy,
                sessionId: captureContext.sessionId,
                inviteBatchId: captureContext.inviteBatchId,
                candidateId: captureContext.candidateId,
                error: serializeAiQualityError(error),
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
            Logger.error("[StrongResponseService] Generation Failed", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : "gemini",
                operation: error instanceof ProviderResponseError ? error.operation : "generateStrongResponse",
                providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined,
            });
            incrementMetric("ai_requests_total", { operation: "strong_response", outcome });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "strong_response", outcome });
            throw error;
        }
    }
}
