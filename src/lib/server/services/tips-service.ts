import { Type } from "@google/genai";
import { Blueprint, Competency, QuestionTips } from "@/lib/domain/types";
import { QuestionTipsSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";
import { z } from "zod";
import { ai, AI_MODELS } from "./ai-config";
import { getReadingLevelContext } from "@/lib/ai/prompts";
import { parseProviderJson } from "@/lib/server/provider-response";
import { incrementMetric, observeMetric } from "@/lib/server/metrics";

// --- Schema Definition ---
export const GenerateTipsSchema = z.object({
    question: z.string(),
    role: z.string(),
    competency: z.any().optional(),
    blueprint: z.any().optional(),
    resumeText: z.string().optional(),
});

// --- Service ---

export class TipsService {
    static async generateTips(
        questionText: string,
        role: string,
        competency?: Competency,
        blueprint?: Blueprint,
        resumeText?: string
    ): Promise<QuestionTips> {
        const startedAt = Date.now();

        if (!ai) {
            Logger.warn("[TipsService] No API Key, returning mock tips.");
            incrementMetric("ai_requests_total", { operation: "tips", outcome: "mock_fallback" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tips", outcome: "mock_fallback" });
            return {
                doThis: "Pick one specific moment from your experience and describe the exact action you took, with the result.",
                avoidThis: "Don't just say you 'stayed positive' — the interviewer wants to see what you did, not how you felt.",
            };
        }

        // --- Context Construction ---
        let competencyContext = '';
        if (competency) {
            competencyContext = `
COMPETENCY FOCUS: ${competency.name}
DEFINITION: ${competency.definition}
`;
        }

        // --- Reading Level (shared utility) ---
        const readingLevelContext = getReadingLevelContext(blueprint?.title || role);

        // --- Seniority label for prompt copy ---
        const roleTitle = (blueprint?.title || role).toLowerCase();
        const isSenior = roleTitle.includes('senior') || roleTitle.includes('lead') || roleTitle.includes('principal') || roleTitle.includes('manager') || roleTitle.includes('director') || roleTitle.includes('vp') || roleTitle.includes('head');
        const isEntryLevel = roleTitle.includes('coordinator') || roleTitle.includes('assistant') || roleTitle.includes('associate') || roleTitle.includes('clerk') || roleTitle.includes('entry') || roleTitle.includes('junior') || roleTitle.includes('apprentice');

        let seniorityContext = '';
        if (isEntryLevel) {
            seniorityContext = `
SENIORITY: Entry-Level / Junior
- Expect small, specific, tactical stories — not strategic narratives.
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

        // --- Resume Context (Optional) ---
        let resumeContext = '';
        if (resumeText && resumeText.trim().length > 0) {
            resumeContext = `
CANDIDATE RESUME (use to personalize guidance):
${resumeText}

RESUME INTEGRATION RULES:
- Scan for experiences that would naturally produce a strong example for this question.
- Reference the candidate's domain or experience area to help them find the right story.
- Do NOT script their answer or assume specific events — nudge toward their richest material.
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

2. ROLE_CALIBRATION: What does "good" look like at this specific seniority level for this role? Adjust your bar accordingly — don't expect strategic narratives from entry-level candidates, and don't accept vague generalities from senior candidates.

3. RESUME_INTEGRATION (if resume provided): What experiences from this candidate's background would naturally produce a strong example? Their richest material is likely in high-volume, cross-functional, or high-pressure situations. Reference their domain without scripting their answer.

4. DIFFERENTIATOR_IDENTIFICATION: What separates the top 20% of answers from the bottom 80% for this question type? The top 20% almost always have: a specific trigger event, a named personal action (not "we"), and a measurable or observable result. The bottom 80% describe feelings, use vague assertions, or give conceptual answers without evidence.

5. HINT_SYNTHESIS: Compress your reasoning into exactly 2 outputs.

CRITICAL OUTPUT RULES:
- Each output must be 1-2 sentences. Be specific and actionable.
- Never say "use STAR" or reference any framework by name — instead say what to ACTUALLY DO.
- Never give generic advice like "be specific" — instead name the KIND of specificity that matters for this question.
- If resume is available, reference the candidate's domain or experience area to help them find the right story.
- Strictly follow READING LEVEL above — match complexity to the role.

Return strictly JSON.
`;

        try {
            const response = await ai.models.generateContent({
                model: AI_MODELS.TIPS,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            doThis: { type: Type.STRING },
                            avoidThis: { type: Type.STRING },
                        },
                        required: ['doThis', 'avoidThis'],
                    },
                },
            });

            const parsedData: QuestionTips = parseProviderJson(response.text, QuestionTipsSchema, {
                provider: "gemini",
                operation: "generateTips"
            });
            parsedData.__debugPrompt = prompt;
            incrementMetric("ai_requests_total", { operation: "tips", outcome: "success" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tips", outcome: "success" });

            return parsedData;

        } catch (error) {
            Logger.error("[TipsService] Generation Failed", error);
            incrementMetric("ai_requests_total", { operation: "tips", outcome: "error" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "tips", outcome: "error" });
            throw error;
        }
    }
}
