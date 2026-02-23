import { GoogleGenAI } from "@google/genai";
import { Logger } from "@/lib/logger";

/**
 * Model Registry: Canonical source of truth for AI models used in the system.
 */
export const AI_MODELS = {
    ANALYSIS: 'gemini-2.5-flash',
    STRONG_RESPONSE: 'gemini-2.5-flash',
    TIPS: 'gemini-2.5-flash',
    TTS: 'gemini-2.5-flash-preview-tts',
    QUESTION_GEN: 'gemini-2.5-flash',
} as const;

const apiKey = process.env.GEMINI_API_KEY;

/**
 * Shared AI Client Instance.
 * We use a single instance where possible to benefit from internal caching or optimizations.
 */
export const getAIClient = () => {
    if (!apiKey) {
        Logger.warn("[AIConfig] GEMINI_API_KEY is missing. AI features will fallback to Mocks.");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const ai = getAIClient();
