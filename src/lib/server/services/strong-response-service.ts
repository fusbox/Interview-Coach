import { Type } from "@google/genai";
import { StrongResponseResult } from "@/lib/domain/types";
import { StrongResponseResultSchema } from "@/lib/domain/schemas";
import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "./ai-config";
import { getReadingLevelContext } from "@/lib/ai/prompts";
import { parseProviderJson } from "@/lib/server/provider-response";

export class StrongResponseService {
    static async generateStrongResponse(
        questionText: string,
        role: string,
        resumeText?: string
    ): Promise<StrongResponseResult> {

        if (!ai) {
            Logger.warn("[StrongResponseService] No API Key, returning mock response.");
            return {
                strongResponse: "This is a mock strong response because the API key is missing. It would usually be a comprehensive answer following best practices for this role.",
                whyThisWorks: "This response demonstrates specificity, clear ownership of actions, and a measurable outcome — the three key differentiators that separate top-20% answers from the rest."
            };
        }

        // --- Reading Level (shared utility) ---
        const readingLevelContext = getReadingLevelContext(role);

        // --- Resume Context (Optional) ---
        let resumeContext = '';
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

        try {
            const response = await ai.models.generateContent({
                model: AI_MODELS.STRONG_RESPONSE,
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            strongResponse: { type: Type.STRING },
                            whyThisWorks: { type: Type.STRING },
                        },
                        required: ['strongResponse', 'whyThisWorks'],
                    },
                },
            });

            const parsedData: StrongResponseResult = parseProviderJson(response.text, StrongResponseResultSchema, {
                provider: "gemini",
                operation: "generateStrongResponse"
            });
            parsedData.__debugPrompt = prompt;

            return parsedData;

        } catch (error) {
            Logger.error("[StrongResponseService] Generation Failed", error);
            throw error;
        }
    }
}
