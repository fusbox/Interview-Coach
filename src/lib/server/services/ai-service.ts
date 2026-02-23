import { Part } from "@google/genai";
import { Question, Blueprint, AnalysisResult, InterviewSession, Answer, Dimension, DimensionScore, TaggedObservation } from "@/lib/domain/types";
import { buildAnalysisContext } from "@/lib/ai/prompts";
import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "./ai-config";
import { FEEDBACK_DIMENSIONS } from "@/lib/constants";

export class AIService {
    /**
     * Internal Algorithm to determine Readiness Level based on foundational vs advanced dimensions.
     * Foundational: focus_relevance, structural_clarity, confidence
     * Middle: specificity_concreteness, outcome_explicitness, pace, clarity
     * Advanced: decision_rationale, energy
     */
    private static calculateReadiness(scores: Record<string, number>): string {
        const foundational = ['focus_relevance', 'structural_clarity', 'confidence'];
        const middle = ['specificity_concreteness', 'outcome_explicitness', 'pace', 'clarity'];

        // If any foundational is failing (1 or 2), it's RL3 or RL4
        const hasFoundationalFail = foundational.some(d => scores[d] <= 2);
        const avgFoundational = foundational.reduce((acc, d) => acc + (scores[d] || 3), 0) / foundational.length;
        const avgMiddle = middle.reduce((acc, d) => acc + (scores[d] || 3), 0) / middle.length;

        if (avgFoundational <= 2) return "RL4"; // Incomplete/Incoherent
        if (hasFoundationalFail || avgFoundational < 3.5) return "RL3"; // Practice Recommended
        if (avgMiddle < 3.8) return "RL2"; // Strong Potential
        return "RL1"; // Ready
    }

    static async analyzeAnswer(
        question: Question,
        answerText: string | null,
        audioData: { base64: string; mimeType: string } | null,
        blueprint?: Blueprint,
        intakeData?: Record<string, unknown>,
        retryContext?: { trigger: 'user' | 'coach'; focus?: string }
    ): Promise<AnalysisResult> {

        // 1. Context Construction
        const contextPrompt = buildAnalysisContext(question, blueprint, intakeData, retryContext);

        // 2. Strict JSON System Prompt (V2.5 Quantified Engine)
        const systemPrompt = `SYSTEM:
You are an expert Interview Coach. Evaluate the candidate's answer across 9 distinct dimensions on a scale of 1-5.

SCORING SCALE:
1: Poor (Missing or irrelevant)
2: Fair (Significant gaps)
3: Good (Meets basic expectations/Polish needed)
4: Strong (Very effective)
5: Exceptional (World-class clarity/impact)

DIMENSIONS TO SCORE:
${FEEDBACK_DIMENSIONS.map((d, i) => `${i + 1}. ${d}`).join('\n')}

COACHING LADDER RULES:
- If overall performance is strong (RL1), your feedback should be for "Polishing" (e.g., matching energy to role).
- If performance is weak, focus ONLY on foundational fixes (Relevance, Structure).
- Acknowledge (ack) should be EXACTLY 1 sentence, warm and personal.

DIMENSION TAGGING:
For every observation/evidence you find, you MUST link it to one of the 9 dimensions above.
`;

        const schemaPrompt = `
Generate feedback as strict JSON matching this schema:
{
  "ack": "string",
  "scores": {
    ${FEEDBACK_DIMENSIONS.map(d => `"${d}": { "score": 1-5, "label": "string" }`).join(',\n    ')}
  },
  "taggedObservations": [
    { "text": "string", "dimension": "dimension_name", "type": "strength|growth" }
  ],
  "primaryFocus": {
    "dimension": "${FEEDBACK_DIMENSIONS.join(' | ')}",
    "headline": "string",
    "body": "string"
  },
  "nextAction": {
    "label": "string",
    "actionType": "redo_answer | next_question"
  },
  "meta": {
    "tier": 1,
    "modality": "text|voice"
  }
}
`;
        // 3. Assemble Gemini Prompt Parts
        if (!ai) {
            Logger.warn("AI Service: No API Key, returning mock analysis.");
            await new Promise(r => setTimeout(r, 800));
            return {
                ack: "I noted your answer. (No API Key)",
                meta: { tier: 1, modality: audioData ? "voice" : "text", signalQuality: "insufficient", confidence: "medium", readinessLevel: "RL4" },
                transcript: answerText || "Audio Answer (Mock)",
                primaryFocus: { dimension: "focus_relevance", headline: "Setup Needed", body: "Please add your Gemini API key to evaluate your response." }
            };
        }

        try {
            const combinedPrompt = `${systemPrompt}\n\n${contextPrompt}\n\n${schemaPrompt}\n\n${audioData ? "Analyze this recording." : `USER ANSWER: "${answerText}"`}`;

            const promptParts: Part[] = [{ text: combinedPrompt }];

            if (audioData) {
                promptParts.push({
                    inlineData: {
                        mimeType: audioData.mimeType,
                        data: audioData.base64
                    }
                });
            }

            const response = await ai.models.generateContent({
                model: AI_MODELS.ANALYSIS,
                contents: { parts: promptParts },
                config: {
                    responseMimeType: 'application/json',
                },
            });

            const text = response.text;
            Logger.info("AI Raw Response", { textLength: text?.length, textPreview: text?.substring(0, 100) });
            if (!text) throw new Error("Empty AI Response");

            const result = JSON.parse(text);
            Logger.info("AI Parsed Result", { hasScores: !!result.scores, hasAck: !!result.ack });

            // 1. Extract raw scores for Algorithm
            const scoreValues: Record<string, number> = {};
            if (result.scores) {
                Object.entries(result.scores as Record<Dimension, DimensionScore>).forEach(([dim, data]) => {
                    scoreValues[dim] = data.score;
                });
            }

            // 2. Calculate Readiness Level via Server-Side Weights
            const calculatedRL = AIService.calculateReadiness(scoreValues);

            // 3. Ensure transcript exists
            const finalTranscript = result.transcript || answerText || "Audio Answer";

            const mappedResult: AnalysisResult = {
                ...result,
                transcript: finalTranscript,
                meta: {
                    ...result.meta,
                    readinessLevel: calculatedRL,
                    confidence: scoreValues.confidence <= 2 ? 'low' : scoreValues.confidence >= 4 ? 'high' : 'medium'
                },
                // Legacy support
                readinessBand: calculatedRL,
                coachReaction: result.ack,
                strengths: (result.taggedObservations as TaggedObservation[])?.filter(o => o.type === 'strength').map(o => o.text) || [],
                opportunities: [result.primaryFocus?.headline || "Review feedback"]
            };

            return mappedResult;

        } catch (error) {
            Logger.error("AI Analysis Failed", error);
            return {
                ack: "I noted your answer.",
                primaryFocus: {
                    dimension: "focus_relevance",
                    headline: "System Offline",
                    body: "I couldn't analyze that response right now. Please try again."
                },
                meta: { tier: 1, modality: audioData ? "voice" : "text", signalQuality: "insufficient", confidence: "medium", readinessLevel: "RL4" },
                transcript: answerText || "Audio Answer",
                readinessBand: "RL4"
            };
        }
    }

    static async summarizeSession(
        session: InterviewSession
    ): Promise<string> {
        if (!ai) return "Session completed. No automated summary available.";

        const answersContext = Object.values(session.answers as Record<string, Answer> || {})
            .map((a: Answer, i: number) => {
                const qText = session.questions.find((q: Question) => q.id === a.questionId)?.text || "Unknown Question";
                return `Q${i + 1}: ${qText} \nA: ${a.transcript} \nResult: ${a.analysis?.readinessBand || 'RL4'} `;
            })
            .join("\n\n");

        const prompt = `
        SYSTEM:
You are an expert recruiter assistant.
Summarize the following interview session into a concise, professional 1 - 2 sentence executive summary for a recruiter.
Focus on the candidate's core strengths and primary readiness level.
Do not use pass / fail language.
Be specific about the role: ${session.role}.

        ANSWERS:
${answersContext}

ROLE CONTEXT:
${session.jobDescription}

Generate ONLY the summary string(no JSON, no intro).
`;

        try {
            const response = await ai.models.generateContent({
                model: AI_MODELS.ANALYSIS,
                contents: [{ text: prompt }]
            });

            return response.text || "No summary generated.";
        } catch (error) {
            Logger.error("Session Summarization Failed", error);
            // Fallback for UI
            return `The candidate completed the interview for the ${session.role} position.They demonstrated consistent effort across all questions.`;
        }
    }
}
