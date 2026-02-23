import { Type } from "@google/genai";
import { QuestionTips, StrongResponseResult } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "./ai-config";

export class StrongResponseService {
    static async generateStrongResponse(
        questionText: string,
        tips: QuestionTips,
        role: string
    ): Promise<StrongResponseResult> {

        if (!ai) {
            Logger.warn("[StrongResponseService] No API Key, returning mock response.");
            return {
                strongResponse: "This is a mock strong response because the API key is missing. It would usually be a comprehensive answer following the STAR method.",
                whyThisWorks: {
                    lookingFor: "Demonstration of resilience (Mock)",
                    pointsToCover: ["Situation", "Action", "Result"],
                    answerFramework: "STAR (Mock)",
                    industrySpecifics: { metrics: "N/A", tools: "N/A" },
                    mistakesToAvoid: ["N/A"],
                    proTip: "Mock Pro Tip"
                }
            };
        }

        // Helper to format tips for the prompt
        const tipsContext = `
        Use the following coaching tips as the standard for your analysis and generation:
        - What they're looking for: "${tips.lookingFor}"
        - Points to cover: ${JSON.stringify(tips.pointsToCover)}
        - Answer framework: "${tips.answerFramework}"
        - Industry specifics: ${JSON.stringify(tips.industrySpecifics)}
        - Mistakes to avoid: ${JSON.stringify(tips.mistakesToAvoid)}
        - Pro tip: "${tips.proTip}"
        `;

        const roleTitle = role.toLowerCase();
        const isSenior = roleTitle.includes('senior') || roleTitle.includes('lead') || roleTitle.includes('principal') || roleTitle.includes('manager') || roleTitle.includes('director') || roleTitle.includes('vp') || roleTitle.includes('head');
        const isTechnical = roleTitle.includes('engineer') || roleTitle.includes('developer') || roleTitle.includes('architect') || roleTitle.includes('data');

        let readingLevelContext = `
        READING LEVEL:
        - Keep language clear, professional, but accessible.
        - Adopt a supportive, coaching tone.
        `;

        if (!isSenior && !isTechnical) {
            readingLevelContext += `
        - CRITICAL: This is an entry-level or non-technical role.
        - Use simple, plain-spoken language (8th grade reading level).
        - Avoid corporate jargon or complex abstract concepts.
        - Keep sentences short and direct.
        `;
        } else if (isSenior) {
            readingLevelContext += `
        - Adapt tone for a senior candidate: professional, concise, and focusing on strategic impact.
        `;
        }

        const prompt = `
        You are an expert interview coach.
        Interview Question: "${questionText}".
        Target Role: ${role}
        
        ${tipsContext}
        ${readingLevelContext}

        Task:
        1. GENERATE A STRONG RESPONSE: Create a hypothetical "Strong" (10/10) answer to this question that a candidate for this SPECIFIC role would give.
           - It MUST explicitly follow the provided "Answer Framework" and "Points to Cover".
           - It should be natural, professional, and ~150-200 words.
           - CRITICAL: It must strictly adhere to the READING LEVEL constraints above.
        2. GENERATE "WHY THIS WORKS": Explain why your generated strong response is effective by mapping it back to the specific categories in the coaching tips.
           - Fill out a structure IDENTICAL to the input tips, but the content should be your explanation of how the strong response meets that criteria.

        Return strictly JSON matching this structure:
        {
           strongResponse: "The full text of the robust answer",
           whyThisWorks: {
               lookingFor: "Explanation relative to answer",
               pointsToCover: ["Point 1 explanation", "Point 2 explanation"],
               answerFramework: "Framework usage explanation",
               industrySpecifics: { metrics: "Metrics used", tools: "Tools mentioned" },
               mistakesToAvoid: ["How mistakes were avoided"],
               proTip: "How the pro tip was applied"
           }
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
                            whyThisWorks: {
                                type: Type.OBJECT,
                                properties: {
                                    lookingFor: { type: Type.STRING },
                                    pointsToCover: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING },
                                    },
                                    answerFramework: { type: Type.STRING },
                                    industrySpecifics: {
                                        type: Type.OBJECT,
                                        properties: {
                                            metrics: { type: Type.STRING },
                                            tools: { type: Type.STRING },
                                        },
                                    },
                                    mistakesToAvoid: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING },
                                    },
                                    proTip: { type: Type.STRING },
                                },
                                required: [
                                    'lookingFor',
                                    'pointsToCover',
                                    'answerFramework',
                                    'industrySpecifics',
                                    'mistakesToAvoid',
                                    'proTip',
                                ],
                            },
                        },
                        required: ['strongResponse', 'whyThisWorks'],
                    },
                },
            });

            const text = response.text;
            if (!text) throw new Error('No text returned from Gemini for strong response');

            return JSON.parse(text) as StrongResponseResult;

        } catch (error) {
            Logger.error("[StrongResponseService] Generation Failed", error);
            throw error;
        }
    }
}
