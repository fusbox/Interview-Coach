import { Part } from "@google/genai";
import { Question, Blueprint, AnalysisResult, InterviewSession, Answer, Dimension, DimensionScore } from "@/lib/domain/types";
import { buildAnalysisContext, getReadingLevelContext } from "@/lib/ai/prompts";
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

        // 2. Strict JSON System Prompt (V3 Pulse Engine)
        const systemPrompt = `SYSTEM:
You are an expert Interview Coach. Evaluate the candidate's answer across 9 distinct dimensions on a scale of 1-5.

SCORING SCALE:
1: Poor (Missing or irrelevant)
2: Fair (Significant gaps/concerns)
3: Good (Meets basic expectations/Polish needed)
4: Strong (Very effective)
5: Exceptional (World-class clarity/impact)

DIMENSIONS TO SCORE:
${FEEDBACK_DIMENSIONS.map((d, i) => `${i + 1}. ${d}`).join('\n')}

COACHING RULES:
- First, quietly score all 9 dimensions internally with a brief string 'label' explaining the score. These are hidden from the user but used for post-session telemetry.
- IMPACT-DRIVEN COACHING: You MUST connect your pulse feedback directly to the candidate's target role. Explain WHY this behavior matters for someone doing that specific job. Avoid generic praise like "You spoke clearly." Instead say, "Your concise framing is essential when briefing executives."
- THE GRACEFUL PIVOT (NOTEBOOK-LM STYLE): Always look for ANY positive signal or relevant transferrable skill first and explicitly affirm it. Then, gracefully pivot to what the question is *really* indexing for. Example framework: "It's great that you brought up [X]. Interviewers ask this to understand your ability to [underlying dimension]. Here, what they're looking for is..."
- PERSPECTIVE: You MUST use first/second person perspective (e.g., "Your answer was...", "You wrote/spoke..."). 
- ACK: EXACTLY 1 sentence, warm and personal. You MUST explicitly reference one specific observation, noun, or concept they mentioned in their answer to prove they were heard (e.g. "I love your approach to reconciling cash drawers.").
- NEXT ACTION LOGIC: If the candidate scores a 1 or 2 on any dimension, you MUST recommend 'redo_answer'. If all scores are 3 or higher, recommend 'next_question'.

EVIDENCE RULES & PULSE GENERATION:
You must generate at least 1, but no more than 2, High-Impact "Pulses" highlighting the most critical feedback.

1. **Content Pulse (ALWAYS REQUIRED)**: Focus on 'structural_clarity', 'outcome_explicitness', 'specificity_concreteness', 'decision_rationale', or 'focus_relevance'. You MUST include a direct, exact 'quote' extracted from the user's transcript to anchor your feedback. 

2. **Delivery / Mechanics Pulse (EXCEPTION-BASED ONLY)**: Focus on objective mechanics: 'filler_words', 'signposting', 'conciseness', or 'resilience'. 
   - MODALITY AWARENESS: The candidate provided this answer via **${audioData ? "VOICE (AUDIO)" : "TEXT (TYPED)"}**. 
   - If TEXT (TYPED): Do NOT mention "speaking", "listening", "sounding", "vocal tone", or spoken "filler words" like "um / uh". Instead, critique their "writing", "readability", "drafting", or "written structure".
   - If VOICE (AUDIO): Critique their vocal delivery, pacing, and spoken filler words.
   - DO NOT generate a Delivery Pulse for average/fine performance (scores 3 or 4).
   - ONLY generate a Delivery Pulse if the candidate urgently needs help (scored 1 or 2) OR demonstrated exceptional mastery (scored 5).
   - Examples: "You used 'um' 14 times, which distracts from your expertise" OR "Your use of 'First, Second, Third' signposting made your complex answer incredibly easy to follow."
`;

        const schemaPrompt = `
Generate feedback as strict JSON matching this schema:
{
  "ack": "string",
  "transcript": "string (The highly accurate transcription of the audio, including full punctuation and correct sentence structure. Required if audio is provided.)",
  "scores": {
    ${FEEDBACK_DIMENSIONS.map(d => `"${d}": { "score": 1-5, "label": "string" }`).join(',\n    ')}
  },
  "contentPulse": {
    "dimension": "structural_clarity | outcome_explicitness | specificity_concreteness | decision_rationale | focus_relevance",
    "headline": "string (Short action-oriented title)",
    "body": "string (Narrative coaching tying behavior to role impact)",
    "quote": "string (Exact quote from transcript)"
  },
  "deliveryPulse": { 
    "//": "OPTIONAL: Include ONLY IF a delivery dimension scored 1, 2, or 5.",
    "dimension": "filler_words | signposting | conciseness | resilience",
    "headline": "string (Short action-oriented title)",
    "body": "string (Narrative coaching tying behavior to role impact. NO QUOTES.)"
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
                contentPulse: { dimension: "focus_relevance", headline: "Setup Needed", body: "Please add your Gemini API key to evaluate your response.", quote: "" }
            };
        }

        try {
            const combinedPrompt = `${systemPrompt}\n\n${contextPrompt}\n\n${schemaPrompt}\n\n${audioData ? "Analyze this recording. Provide a high-quality transcription in the 'transcript' field of the JSON, including correct punctuation and sentence structure. Do NOT mention being an AI in the transcription." : `USER ANSWER: "${answerText}"`}`;

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
                // Legacy support (to be fully removed when UI updates)
                readinessBand: calculatedRL,
                coachReaction: result.ack,
                __debugPrompt: combinedPrompt
            };

            return mappedResult;

        } catch (error) {
            Logger.error("AI Analysis Failed", error);
            return {
                ack: "I noted your answer.",
                meta: { tier: 1, modality: audioData ? "voice" : "text", signalQuality: "insufficient", confidence: "medium", readinessLevel: "RL4" },
                transcript: answerText || "Audio Answer",
                readinessBand: "RL4",
                contentPulse: {
                    dimension: "focus_relevance",
                    headline: "System Offline",
                    body: "I couldn't analyze that response right now. Please try again.",
                    quote: ""
                }
            };
        }
    }

    static async summarizeSession(
        session: InterviewSession
    ): Promise<string> {
        if (!ai) return "Session completed. No automated debrief available.";

        const answersContext = Object.values(session.answers as Record<string, Answer> || {})
            .map((a: Answer, i: number) => {
                const qText = session.questions.find((q: Question) => q.id === a.questionId)?.text || "Unknown Question";

                // Extract hidden telemetry to feed the debrief engine
                let scoreContext = "No telemetry recorded.";
                if (a.analysis?.scores) {
                    const scoreMap = Object.entries(a.analysis.scores).map(([dim, data]) => {
                        return `${dim}: ${data.score}/5 (${data.label})`;
                    });
                    scoreContext = scoreMap.join('\n');
                }

                return `--- Question ${i + 1} ---\nQ: ${qText}\nTRANSCRIPT: ${a.transcript || 'No transcript'}\n\nHIDDEN TELEMETRY SCORES:\n${scoreContext}\n`;
            })
            .join("\n\n");

        const readingLevelContext = getReadingLevelContext(session.role);

        const prompt = `SYSTEM:
You are an expert Interview Coach. The candidate has just finished a multi-question interview session for the role of ${session.role}.

Below are their answers to all questions, along with the internal 1-5 telemetry scores you awarded them on 9 dimensions for each question.

YOUR TASK:
Synthesize this data into a high-impact, actionable Post-Session Debrief formatted in standard Markdown.
Speak directly to the candidate ("you"), not about them ("the candidate"). Address them warmly and professionally.

${readingLevelContext}

Analyze the telemetry numbers to find PATTERNS:
- Did they consistently score low in 'pace' across all answers? That's a thematic growth area.
- Did they score '5' in 'structural_clarity' every time? That's a core strength.

Output EXACTLY this Markdown structure (do not wrap in markdown code blocks like \`\`\`markdown, just return the raw text):

### Executive Summary
[2-3 sentences summarizing your overall performance, trajectory, and fit for the role. Mention the role explicitly. Be encouraging and direct.]

### Core Strengths
- **[Pattern 1 Name]**: [Describe the behavior seen across answers and *why* it makes you strong for the role. Give a brief example from the transcript.]
- **[Pattern 2 Name]**: [Same as above]

### Primary Growth Area
- **[Pattern Name]**: [Identify the most significant weakness seen across multiple answers. Explain *why* it matters.]
- **[Tip for Next Time]**: [Provide highly actionable, specific advice on exactly how to improve this behavior for the next round.]

### Readiness & Next Steps
[1-2 sentences synthesizing your overall readiness into an affirming, encouraging statement. DO NOT use internal codes like RL1, RL2, RL3, or RL4. Instead, use phrases like "You are highly prepared", "You have strong potential with a bit of polish", "More practice is recommended before the real interview", etc.]

SESSION DATA:
${answersContext}

ROLE CONTEXT:
${session.jobDescription || "No specific job description provided."}
`;

        try {
            const response = await ai.models.generateContent({
                model: AI_MODELS.ANALYSIS,
                contents: [{ text: prompt }]
            });

            return response.text || "No summary generated.";
        } catch (error) {
            Logger.error("Session Summarization Failed", error);
            return `### Executive Summary\nThe candidate completed the interview for the ${session.role} position. They demonstrated consistent effort across all questions.`;
        }
    }
}
