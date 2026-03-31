import { Part } from "@google/genai";
import { Question, Blueprint, AnalysisResult, InterviewSession, Answer, Dimension, DimensionScore } from "@/lib/domain/types";
import { AnalysisResultSchema } from "@/lib/domain/schemas";
import { buildAnalysisContext, getReadingLevelContext } from "@/lib/ai/prompts";
import { Logger } from "@/lib/logger";
import { ai, AI_MODELS } from "./ai-config";
import { FEEDBACK_DIMENSIONS } from "@/lib/constants";
import { NonEmptyProviderTextSchema, parseProviderJson, parseProviderValue } from "@/lib/server/provider-response";
import { incrementMetric, observeMetric } from "@/lib/server/metrics";
import { ProviderResponseError } from "@/lib/server/provider-errors";

export class AIService {
    private static readonly detectabilityLevels = ["clear", "moderate", "ambiguous", "thin"] as const;

    private static mapDetectabilityToConfidence(
        detectability?: typeof AIService.detectabilityLevels[number]
    ): "low" | "medium" | "high" {
        switch (detectability) {
            case "clear":
                return "high";
            case "moderate":
                return "medium";
            case "ambiguous":
            case "thin":
                return "low";
            default:
                return "medium";
        }
    }

    /**
     * Internal readiness calibration remains available for downstream/internal tooling.
     * This is intentionally hidden from the candidate-facing experience.
     */
    private static calculateReadiness(scores: Record<string, number>): "RL1" | "RL2" | "RL3" | "RL4" {
        const foundational = ["focus_relevance", "structural_clarity", "confidence"];
        const middle = ["specificity_concreteness", "outcome_explicitness", "pace", "clarity"];

        const hasFoundationalFail = foundational.some((d) => scores[d] <= 2);
        const avgFoundational = foundational.reduce((acc, d) => acc + (scores[d] || 3), 0) / foundational.length;
        const avgMiddle = middle.reduce((acc, d) => acc + (scores[d] || 3), 0) / middle.length;

        if (avgFoundational <= 2) return "RL4";
        if (hasFoundationalFail || avgFoundational < 3.5) return "RL3";
        if (avgMiddle < 3.8) return "RL2";
        return "RL1";
    }

    static async analyzeAnswer(
        question: Question,
        answerText: string | null,
        audioData: { base64: string; mimeType: string } | null,
        blueprint?: Blueprint,
        intakeData?: Record<string, unknown>,
        retryContext?: { trigger: 'user' | 'coach'; focus?: string },
        progress?: { current: number; total: number }
    ): Promise<AnalysisResult> {
        const startedAt = Date.now();

        // 1. Context Construction
        const contextPrompt = buildAnalysisContext(question, blueprint, intakeData, retryContext);
        const progressPrompt = progress
            ? `PROGRESS: The candidate is on question ${progress.current} of ${progress.total}.`
            : "";

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
- COHERENCE RULE: The ACK, Content Pulse, Delivery Pulse, Recommendation, and Next Action must all read like one coach responding from one central interpretation of the answer. The ACK should preview or frame the main pulse, not compete with it.
- IMPACT-DRIVEN COACHING: You MUST connect your pulse feedback directly to the candidate's target role. Explain WHY this behavior matters for someone doing that specific job. Avoid generic praise like "You spoke clearly." Instead say, "Your concise framing is essential when briefing executives."
- THE GRACEFUL PIVOT (NOTEBOOK-LM STYLE): Always look for ANY positive signal or relevant transferrable skill first and explicitly affirm it. Then, gracefully pivot to what the question is *really* indexing for. Example framework: "It's great that you brought up [X]. Interviewers ask this to understand your ability to [underlying dimension]. Here, what they're looking for is..."
- PERSPECTIVE: You MUST use first/second person perspective (e.g., "Your answer was...", "You wrote/spoke..."). 
- INTERNAL PLANNING: Before writing visible feedback, determine one central read of the answer, one primary anchor, the anchor's valence (strength|mixed|growth), the anchor's detectability (clear|moderate|ambiguous|thin), and the highest-value coaching intervention. Return that plan in the JSON.
- RANKING INTENT: Use the hidden scores and evidence only to rank candidate signals and choose the most teachable, best-supported dimension to coach on. Do NOT turn the response into a laundry list.
- ACK: EXACTLY 1 sentence, warm and personal. ACK is the opening coaching move, not generic praise. It MUST come from the primary anchor, explicitly reference a specific observation, noun, quote fragment, or behavior from the answer, and connect that signal to interviewer value or what the question is testing.
- ACK SIGNAL RULES:
  - If valence is strength, sound energized and affirming.
  - If valence is mixed, affirm the real starting point and pivot toward what interviewers are listening for.
  - If valence is growth, do not invent praise; acknowledge effort or the starting point and frame the missing target.
- DETECTABILITY RULES:
  - If detectability is clear, you may sound direct and confident.
  - If detectability is moderate, stay specific but avoid overclaiming.
  - If detectability is ambiguous or thin, avoid hard claims and orient the candidate toward the stronger target pattern.
- INTERVENTION LOGIC:
  - You MUST choose exactly one intervention type in feedbackPlan.intervention.type:
    - amplify_strength: the candidate showed a clear, high-value signal worth reinforcing
    - sharpen_signal: the answer has a real signal, but it needs more precision, specificity, or stronger interviewer-facing proof
    - repair_foundation: the answer is missing a core structural or relevance requirement and should be rebuilt
    - polish_response: the core answer is usable, and the best next move is a focused polish note that may come from either content or delivery
- NEXT ACTION LOGIC:
  - Base nextAction on the intervention, signal valence, and detectability, not on raw score thresholds.
  - repair_foundation => recommend 'redo_answer'.
  - sharpen_signal => recommend 'redo_answer' if the missing piece materially weakens interviewer confidence; otherwise recommend 'next_question' with a focused polish tip.
  - amplify_strength => recommend 'next_question'.
  - polish_response => recommend 'next_question' unless the identified issue materially obscures the candidate's meaning, in which case recommend 'redo_answer'.
  - LAST QUESTION EXCEPTION: If the correct action would otherwise be 'next_question' AND this is the last question (${progress?.total || 'X'} of ${progress?.total || 'X'}), you MUST recommend 'stop_for_now' and set the label to 'See Session Summary'.
- RECOMMENDATION GUIDANCE:
  - If REDO, explain the missing critical piece the candidate should focus on.
  - If NEXT, affirm the strongest signal you heard and give one focused polish tip.
  - If LAST (Summary), briefly summarize their overall trajectory across the questions and congratulate them on finishing.

EVIDENCE RULES & PULSE GENERATION:
You must generate at least 1, but no more than 2, High-Impact "Pulses" highlighting the most critical feedback.

1. **Content Pulse (ALWAYS REQUIRED)**: Focus on 'structural_clarity', 'outcome_explicitness', 'specificity_concreteness', 'decision_rationale', or 'focus_relevance'. You MUST include a direct, exact 'quote' extracted from the user's transcript to anchor your feedback. 

2. **Delivery / Mechanics Pulse (EXCEPTION-BASED ONLY)**: Focus on objective mechanics: 'filler_words', 'signposting', 'conciseness', or 'resilience'. 
   - MODALITY AWARENESS: The candidate provided this answer via **${audioData ? "VOICE (AUDIO)" : "TEXT (TYPED)"}**. 
   - If TEXT (TYPED): Do NOT mention "speaking", "listening", "sounding", "vocal tone", or spoken "filler words" like "um / uh". Instead, critique their "writing", "readability", "drafting", or "written structure".
   - If VOICE (AUDIO): Critique their vocal delivery, pacing, and spoken filler words.
   - POLISH CAN COME FROM BOTH CONTENT AND DELIVERY. Do NOT assume all polish notes belong in the Delivery Pulse.
   - ONLY generate a Delivery Pulse if delivery/mechanics are materially affecting interpretation, credibility, or ease of understanding, or if delivery demonstrates standout mastery worth explicitly reinforcing.
   - If the primary anchor source is 'delivery', you MUST generate a Delivery Pulse.
   - If the primary anchor source is 'content', only generate a Delivery Pulse when it adds a clearly distinct second insight. Do NOT generate it for minor polish notes.
   - Examples: "You used 'um' 14 times, which distracts from your expertise" OR "Your use of 'First, Second, Third' signposting made your complex answer incredibly easy to follow."
`;

        const schemaPrompt = `
Generate feedback as strict JSON matching this schema:
{
  "feedbackPlan": {
    "centralRead": "string (One-sentence summary of the core coaching read)",
    "signal": {
      "valence": "strength | mixed | growth",
      "detectability": "clear | moderate | ambiguous | thin"
    },
    "primaryAnchor": {
      "source": "content | delivery | fallback",
      "signalType": "quote | behavior | pattern | effort | omission",
      "dimension": "${FEEDBACK_DIMENSIONS.join(' | ')}",
      "candidateEvidence": "string",
      "interviewerValue": "string"
    },
    "intervention": {
      "type": "amplify_strength | sharpen_signal | repair_foundation | polish_response",
      "reason": "string"
    }
  },
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
    "//": "OPTIONAL: Include ONLY IF delivery/mechanics materially affect interpretation or show standout mastery.",
    "dimension": "filler_words | signposting | conciseness | resilience",
    "headline": "string (Short action-oriented title)",
    "body": "string (Narrative coaching tying behavior to role impact. NO QUOTES.)"
  },
  "nextAction": {
    "label": "string",
    "actionType": "redo_answer | next_question"
  },
  "recommendation": "string (A contextual summary for the next step. If REDO, explain the missing critical piece. If NEXT, affirm the strongest signal and add one focused polish tip.)",
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
            incrementMetric("ai_requests_total", { operation: "analysis", outcome: "mock_fallback" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "analysis", outcome: "mock_fallback" });
            return {
                ack: "I noted your answer. (No API Key)",
                meta: { tier: 1, modality: audioData ? "voice" : "text", confidence: "medium", readinessLevel: "RL4" },
                transcript: answerText || "Audio Answer (Mock)",
                contentPulse: { dimension: "focus_relevance", headline: "Setup Needed", body: "Please add your Gemini API key to evaluate your response.", quote: "" }
            };
        }

        try {
            const combinedPrompt = `${systemPrompt}\n\n${contextPrompt}\n\n${progressPrompt}\n\n${schemaPrompt}\n\n${audioData ? "Analyze this recording. Provide a high-quality transcription in the 'transcript' field of the JSON, including correct punctuation and sentence structure. Do NOT mention being an AI in the transcription." : `USER ANSWER: "${answerText}"`}`;

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
            const result = parseProviderJson(text, AnalysisResultSchema, {
                provider: "gemini",
                operation: "analyzeAnswer"
            });
            Logger.info("AI Parsed Result", { hasScores: !!result.scores, hasAck: !!result.ack });

            const scoreValues: Record<string, number> = {};
            if (result.scores) {
                Object.entries(result.scores as Record<Dimension, DimensionScore>).forEach(([dim, data]) => {
                    scoreValues[dim] = data.score;
                });
            }

            const calculatedRL = AIService.calculateReadiness(scoreValues);

            // Ensure transcript exists even when the provider omits it.
            const finalTranscript = result.transcript || answerText || "Audio Answer";

            const mappedResult: AnalysisResult = {
                ...result,
                transcript: finalTranscript,
                meta: {
                    tier: result.meta?.tier ?? 1,
                    modality: result.meta?.modality ?? (audioData ? "voice" : "text"),
                    ...result.meta,
                    readinessLevel: calculatedRL,
                    confidence: result.meta?.confidence ?? AIService.mapDetectabilityToConfidence(result.feedbackPlan?.signal.detectability)
                },
                __debugPrompt: combinedPrompt
            };

            incrementMetric("ai_requests_total", { operation: "analysis", outcome: "success" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "analysis", outcome: "success" });

            return mappedResult;

        } catch (error) {
            const outcome = error instanceof ProviderResponseError ? "malformed_response" : "error";
            Logger.error("AI Analysis Failed", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : "gemini",
                operation: error instanceof ProviderResponseError ? error.operation : "analyzeAnswer",
                providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined
            });
            incrementMetric("ai_requests_total", { operation: "analysis", outcome });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "analysis", outcome });
            return {
                ack: "I noted your answer.",
                meta: { tier: 1, modality: audioData ? "voice" : "text", confidence: "medium", readinessLevel: "RL4" },
                transcript: answerText || "Audio Answer",
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
        const startedAt = Date.now();
        if (!ai) {
            incrementMetric("ai_requests_total", { operation: "session_summary", outcome: "mock_fallback" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "session_summary", outcome: "mock_fallback" });
            return "Session completed. No automated debrief available.";
        }

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

                const modality = a.analysis?.meta?.modality || 'text';

                return `--- Question ${i + 1} ---\nQ: ${qText}\nMODALITY: ${modality === 'voice' ? 'VOICE (SPOKEN)' : 'TEXT (TYPED)'}\nTRANSCRIPT: ${a.transcript || 'No transcript'}\n\nHIDDEN TELEMETRY SCORES:\n${scoreContext}\n`;
            })
            .join("\n\n");

        const readingLevelContext = getReadingLevelContext(session.role);

        const prompt = `SYSTEM:
You are an expert Interview Coach. The candidate has just finished a multi-question interview session for the role of ${session.role}.

Below are their answers to all questions, along with the internal 1-5 telemetry scores you awarded them on 9 dimensions for each question.

YOUR TASK:
Synthesize this data into a high-impact, actionable Post-Session Debrief formatted in standard Markdown.
Speak directly to the candidate ("you"), not about them ("the candidate"). Address them warmly and professionally.

MODALITY AWARENESS:
- You MUST acknowledge the candidate's chosen response mode. 
- IF the session was primarily VOICE (SPOKEN), use verbs like "said", "spoke", "sounded", "vocal tone".
- IF the session was primarily TEXT (TYPED), use verbs like "wrote", "crafted", "drafted", "written structure".
- IF the session was a HYBRID, acknowledge both modes (e.g., "In both your spoken and written answers...").

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

### Momentum & Next Steps
[1-2 sentences synthesizing your overall trajectory into an affirming, encouraging statement. Highlight what to keep doing and the single next practice focus that would create the biggest improvement.]

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

            const summary = parseProviderValue(response.text, NonEmptyProviderTextSchema, {
                provider: "gemini",
                operation: "summarizeSession"
            });
            incrementMetric("ai_requests_total", { operation: "session_summary", outcome: "success" });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "session_summary", outcome: "success" });
            return summary;
        } catch (error) {
            const outcome = error instanceof ProviderResponseError ? "malformed_response" : "error";
            Logger.error("Session Summarization Failed", {
                error,
                provider: error instanceof ProviderResponseError ? error.provider : "gemini",
                operation: error instanceof ProviderResponseError ? error.operation : "summarizeSession",
                providerErrorKind: error instanceof ProviderResponseError ? error.kind : undefined
            });
            incrementMetric("ai_requests_total", { operation: "session_summary", outcome });
            observeMetric("ai_request_duration_ms", Date.now() - startedAt, { operation: "session_summary", outcome });
            return `### Executive Summary\nThe candidate completed the interview for the ${session.role} position. They demonstrated consistent effort across all questions.`;
        }
    }
}
