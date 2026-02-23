import { Type } from "@google/genai";
import { Blueprint, Competency } from "@/lib/domain/types";
import { Logger } from "@/lib/logger";
import { z } from "zod";
import { ai, AI_MODELS } from "./ai-config";

// --- Schema Definition ---
export const GenerateTipsSchema = z.object({
    question: z.string(),
    role: z.string(),
    competency: z.any().optional(), // typed loosely here, but we use the domain type in logic
    blueprint: z.any().optional()
});

export type TipsResponse = {
    lookingFor: string;
    pointsToCover: string[];
    answerFramework: string;
    industrySpecifics: {
        metrics: string;
        tools: string;
    };
    mistakesToAvoid: string[];
    proTip: string;
};

// --- Service ---

export class TipsService {
    static async generateTips(
        questionText: string,
        role: string,
        competency?: Competency,
        blueprint?: Blueprint
    ): Promise<TipsResponse> {

        if (!ai) {
            Logger.warn("[TipsService] No API Key, returning mock tips.");
            // Mock fallback for dev/testing without key
            return {
                lookingFor: "Demonstration of specific skills relative to the role.",
                pointsToCover: ["Situation", "Task", "Action", "Result"],
                answerFramework: "STAR Method",
                industrySpecifics: { metrics: "N/A", tools: "N/A" },
                mistakesToAvoid: ["Being vague", "Rambling"],
                proTip: "Keep it concise and focused."
            };
        }

        // --- Context Construction ---
        let competencyContext = '';
        if (competency) {
            competencyContext = `
            COMPETENCY FOCUS: ${competency.name}
            DEFINITION: ${competency.definition}
            SIGNALS (Points to Cover): ${competency.id === 'unknown' ? 'General best practices' : 'Relevant behavioral indicators'}
            `;
            // Simplified from backup to reduce token usage / complexity
        }

        const readingLevelContext = blueprint?.readingLevel
            ? `
            READING LEVEL: Mode ${blueprint.readingLevel.mode || 'Professional'}
            - Max ${blueprint.readingLevel.maxSentenceWords || 20} words/sentence.
            - Avoid Jargon: ${blueprint.readingLevel.avoidJargon ? 'Yes' : 'No'}
            `
            : '';

        const prompt = `
        You are an expert interview coach for ${role} roles.
        Provide detailed interview tips for the following question: "${questionText}"

        ${competencyContext}
        ${readingLevelContext}

        Return strictly JSON matching this structure:
        {
           lookingFor: "What the interviewer is trying to assess (1 sentence)",
           pointsToCover: ["Point 1", "Point 2", "Point 3"],
           answerFramework: "Recommended structure (e.g. STAR, Past-Present-Future)",
           industrySpecifics: { metrics: "Key KPIs to mention", tools: "Relevant software/tools" },
           mistakesToAvoid: ["Mistake 1", "Mistake 2", "Mistake 3"],
           proTip: "One advanced insight or unique tip"
        }
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
            });

            const text = response.text;
            if (!text) throw new Error('No text returned from Gemini for tips');

            return JSON.parse(text) as TipsResponse;

        } catch (error) {
            Logger.error("[TipsService] Generation Failed", error);
            throw error;
        }
    }
}
