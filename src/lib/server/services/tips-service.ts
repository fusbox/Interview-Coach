import { Type } from "@google/genai";
import { Blueprint, Competency, QuestionTips } from "@/lib/domain/types";
import { QuestionTipsSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "./ai-config";
import { getReadingLevelContext } from "@/lib/ai/prompts";
import { parseProviderJson } from "@/lib/server/provider-response";
import { incrementMetric, observeMetric } from "@/lib/server/metrics";
import { ProviderResponseError } from "@/lib/server/provider-errors";
import { captureAiGeneration } from "@/lib/server/ai-quality/capture-ai-generation";
import { redactPii } from "@/lib/server/ai-quality/redaction";
import { serializeAiQualityError } from "@/lib/server/ai-quality/error-serialization";
import { buildBlueprintContextArtifacts, buildResumeContextArtifacts } from "@/lib/server/ai-quality/context-artifacts";
import type { AiGenerationCaptureContext } from "@/lib/server/ai-quality/types";

const HINT_PROMPT_VERSION = "hint-v1";

type TipsCompetencyInput = Partial<Competency>;
type TipsBlueprintInput = {
    title?: string;
    competencies?: TipsCompetencyInput[];
    readingLevel?: Blueprint["readingLevel"];
};

export class TipsService {
    static async generateTips(
        questionText: string,
        role: string,
        competency?: TipsCompetencyInput,
        blueprint?: TipsBlueprintInput,
        resumeText?: string,
        captureContext: AiGenerationCaptureContext = {}
    ): Promise<QuestionTips> {
        const startedAt = Date.now();
        let rawProviderOutput: string | undefined;

        let competencyContext = "";
        if (competency) {
            competencyContext = `
COMPETENCY FOCUS: ${competency.name}
DEFINITION: ${competency.definition}
`;
        }

        const readingLevelContext = getReadingLevelContext(blueprint?.title || role);

        const roleTitle = (blueprint?.title || role).toLowerCase();
        const isSenior = roleTitle.includes("senior") || roleTitle.includes("lead") || roleTitle.includes("principal") || roleTitle.includes("manager") || roleTitle.includes("director") || roleTitle.includes("vp") || roleTitle.includes("head");
        const isEntryLevel = roleTitle.includes("coordinator") || roleTitle.includes("assistant") || roleTitle.includes("associate") || roleTitle.includes("clerk") || roleTitle.includes("entry") || roleTitle.includes("junior") || roleTitle.includes("apprentice");

        let seniorityContext = "";
        if (isEntryLevel) {
            seniorityContext = `
SENIORITY: Entry-Level / Junior
- Expect small, specific, tactical stories - not strategic narratives.
- "Good" means: handled a chaotic day without someone rescuing them.
`;
        } else if (isSenior) {
            seniorityContext = `
SENIORITY: Senior / Leadership
- Expect strategic impact, decision rationale, and influence narratives.
- "Good" means: demonstrated judgment under ambiguity with measurable outcomes.
`;
        } else {
            seniorityContext = `
SENIORITY: Mid-Level Professional
- Expect competency mastery and clear ownership of outcomes.
- "Good" means: specific contributions with tangible results.
`;
        }

        let resumeContext = "";
        if (resumeText && resumeText.trim().length > 0) {
            resumeContext = `
CANDIDATE RESUME (use to personalize guidance):
${resumeText}

RESUME INTEGRATION RULES:
- Scan for experiences that would naturally produce a strong example for this question.
- Reference the candidate's domain or experience area to help them find the right story.
- Do NOT script their answer or assume specific events - nudge toward their richest material.
`;
        }

        const prompt = `
You are an expert interview coach and hiring professional.

INPUTS:
- Question: "${questionText}"
- Role: ${role}
${readingLevelContext}
${competencyContext}
${seniorityContext}
${resumeContext}

YOUR INTERNAL REASONING PROCESS (follow these steps in order, do NOT output them):

1. QUESTION_INTENT_DECODE: What is the interviewer ACTUALLY testing with this question? What is their hidden concern about a bad hire? What "real question" are they asking beneath the surface?

2. ROLE_CALIBRATION: What does "good" look like at this specific seniority level for this role? Adjust your bar accordingly - don't expect strategic narratives from entry-level candidates, and don't accept vague generalities from senior candidates.

3. RESUME_INTEGRATION (if resume provided): What experiences from this candidate's background would naturally produce a strong example? Their richest material is likely in high-volume, cross-functional, or high-pressure situations. Reference their domain without scripting their answer.

4. DIFFERENTIATOR_IDENTIFICATION: What separates the top 20% of answers from the bottom 80% for this question type? The top 20% almost always have: a specific trigger event, a named personal action (not "we"), and a measurable or observable result. The bottom 80% describe feelings, use vague assertions, or give conceptual answers without evidence.

5. HINT_SYNTHESIS: Compress your reasoning into exactly 2 outputs.

CRITICAL OUTPUT RULES:
- Each output must be 1-2 sentences. Be specific and actionable.
- Never say "use STAR" or reference any framework by name - instead say what to ACTUALLY DO.
- Never give generic advice like "be specific" - instead name the KIND of specificity that matters for this question.
- If resume is available, reference the candidate's domain or experience area to help them find the right story.
- Strictly follow READING LEVEL above - match complexity to the role.

Return strictly JSON.
`;

        const privacyFlags = Array.from(new Set([
            ...(captureContext.privacyFlags ?? []),
            ...(resumeText ? ["contains_resume"] : []),
        ]));
        const inputSnapshot = redactPii({
            questionText,
            role,
            competency,
            hasResumeText: !!resumeText,
        });
        const contextArtifacts = [
            ...buildBlueprintContextArtifacts(blueprint),
            ...buildResumeContextArtifacts(resumeText),
        ];
        const promptSnapshot = {
            prompt: redactPii(prompt),
            promptVersion: HINT_PROMPT_VERSION,
        };

        if (!ai) {
            Logger.warn("[TipsService] No API Key, returning mock tips.");
            const mockTips = {
                doThis: "Pick one specific moment from your experience and describe the exact action you took, with the result.",
                avoidThis: "Don't just say you stayed positive. The interviewer wants to see what you did, not how you felt.",
            };
            await captureAiGeneration({
                appName: captureContext.appName ?? "candidate_app",
                surface: "hint",
                status: "success",
                inputSnapshot,
                contextArtifacts,
                promptSnapshot: { promptVersion: HINT_PROMPT_VERSION, providerConfigured: false },
                promptVersion: HINT_PROMPT_VERSION,
                modelProvider: "mock",
                modelName: "mock-hint-generator",
                modelParams: {},
                rawOutput: redactPii(mockTips),
                parsedOutput: redactPii(mockTips),
                latencyMs: Date.now() - startedAt,
                correlationId: captureContext.correlationId,
                traceId: captureContext.traceId,
                sourceRefs: captureContext.sourceRefs ?? [{ type: "service", service: "TipsService.generateTips" }],
                createdBy: captureContext.createdBy,
                sessionId: captureContext.sessionId,
                inviteBatchId: captureContext.inviteBatchId,
                candidateId: captureContext.candidateId,
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
            incrementMetric("ai_requests_total", { operation: "tips", outcome: "mock_fallback" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tips", outcome: "mock_fallback" });
            return mockTips;
        }

        try {
            const response = await ai.models.generateContent({
                model: AI_MODELS.TIPS,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            doThis: { type: Type.STRING },
                            avoidThis: { type: Type.STRING },
                        },
                        required: ["doThis", "avoidThis"],
                    },
                },
            });

            rawProviderOutput = response.text;
            const parsedData: QuestionTips = parseProviderJson(rawProviderOutput, QuestionTipsSchema, {
                provider: "gemini",
                operation: "generateTips",
            });
            parsedData.__debugPrompt = prompt;
            await captureAiGeneration({
                appName: captureContext.appName ?? "candidate_app",
                surface: "hint",
                status: "success",
                inputSnapshot,
                contextArtifacts,
                promptSnapshot,
                promptVersion: HINT_PROMPT_VERSION,
                modelProvider: "gemini",
                modelName: AI_MODELS.TIPS,
                modelParams: { responseMimeType: "application/json" },
                rawOutput: redactPii(rawProviderOutput),
                parsedOutput: redactPii(parsedData),
                latencyMs: Date.now() - startedAt,
                correlationId: captureContext.correlationId,
                traceId: captureContext.traceId,
                sourceRefs: captureContext.sourceRefs ?? [{ type: "service", service: "TipsService.generateTips" }],
                createdBy: captureContext.createdBy,
                sessionId: captureContext.sessionId,
                inviteBatchId: captureContext.inviteBatchId,
                candidateId: captureContext.candidateId,
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
            incrementMetric("ai_requests_total", { operation: "tips", outcome: "success" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tips", outcome: "success" });

            return parsedData;

        } catch (error) {
            const outcome = error instanceof ProviderResponseError ? "malformed_response" : "error";
            await captureAiGeneration({
                appName: captureContext.appName ?? "candidate_app",
                surface: "hint",
                status: "failed",
                inputSnapshot,
                contextArtifacts,
                promptSnapshot,
                promptVersion: HINT_PROMPT_VERSION,
                modelProvider: error instanceof ProviderResponseError ? error.provider : "gemini",
                modelName: AI_MODELS.TIPS,
                modelParams: { responseMimeType: "application/json" },
                rawOutput: rawProviderOutput ? redactPii(rawProviderOutput) : undefined,
                parsedOutput: null,
                latencyMs: Date.now() - startedAt,
                correlationId: captureContext.correlationId,
                traceId: captureContext.traceId,
                sourceRefs: captureContext.sourceRefs ?? [{ type: "service", service: "TipsService.generateTips" }],
                createdBy: captureContext.createdBy,
                sessionId: captureContext.sessionId,
                inviteBatchId: captureContext.inviteBatchId,
                candidateId: captureContext.candidateId,
                error: serializeAiQualityError(error),
                privacyFlags,
                redactionStatus: "redacted",
                retentionClass: "eval_redacted",
            });
            Logger.error("[TipsService] Generation Failed", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : "gemini",
                operation: error instanceof ProviderResponseError ? error.operation : "generateTips",
                providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined,
            });
            incrementMetric("ai_requests_total", { operation: "tips", outcome });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tips", outcome });
            throw error;
        }
    }
}
