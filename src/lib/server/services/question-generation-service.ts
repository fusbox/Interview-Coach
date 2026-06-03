import { z } from "zod";
import { uuidv7 } from "uuidv7";

import { getReadingLevelContext } from "@/lib/ai/prompts";
import { GeneratedInterviewQuestionsSchema } from "@/lib/domain/schemas";
import type { Question } from "@/lib/domain/types";
import { buildJobDescriptionContextArtifacts, buildResumeContextArtifacts } from "@/lib/server/ai-quality/context-artifacts";
import { captureAiGeneration } from "@/lib/server/ai-quality/capture-ai-generation";
import { redactPii } from "@/lib/server/ai-quality/redaction";
import { ProviderResponseError } from "@/lib/server/provider-errors";
import { parseProviderJson } from "@/lib/server/provider-response";
import { ai, AI_MODELS } from "@/lib/server/services/ai-config";

export const QUESTION_GENERATION_PROMPT_VERSION = "question-generation-v1";

type GeneratedInterviewQuestions = z.infer<typeof GeneratedInterviewQuestionsSchema>;

export type PracticeInterviewType = "behavioral" | "technical" | "case" | "screening" | "general";

export type QuestionGenerationInput = {
    role: string;
    jobDescription?: string | null;
    resume?: string | null;
    interviewType?: PracticeInterviewType | null;
    questionCount?: number | null;
};

export type QuestionGenerationContext = {
    appName: "recruiter_app" | "candidate_app";
    actorType: "recruiter" | "candidate";
    actorId?: string;
    correlationId: string;
    sourceRefs: Array<{ type: string; route?: string; name?: string }>;
    onProviderOutcome?: (outcome: "success" | "mock_fallback") => void;
};

type CandidateQuestionSnapshotDependencies = {
    createQuestionId?: (index: number) => string;
};

export async function generateInterviewQuestionSet(
    input: QuestionGenerationInput,
    context: QuestionGenerationContext,
): Promise<GeneratedInterviewQuestions> {
    const startedAt = Date.now();
    const normalizedInput = normalizeQuestionGenerationInput(input);
    const privacyFlags = normalizedInput.resume ? ["contains_resume"] : [];
    const contextArtifacts = [
        ...buildJobDescriptionContextArtifacts(normalizedInput.jobDescription ?? undefined),
        ...buildResumeContextArtifacts(normalizedInput.resume ?? undefined),
    ];
    const inputSnapshot = redactPii({
        role: normalizedInput.role,
        hasJobDescription: !!normalizedInput.jobDescription,
        hasResumeText: !!normalizedInput.resume,
    });

    if (!ai) {
        const mockQuestions = getMockQuestions(normalizedInput.role);
        const redactedMockQuestions = redactPii(mockQuestions);
        const actorCaptureFields = getActorCaptureFields(context);
        await captureAiGeneration({
            appName: context.appName,
            surface: "question_generation",
            status: "success",
            inputSnapshot,
            contextArtifacts,
            promptSnapshot: {
                promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
                providerConfigured: false,
            },
            promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
            modelProvider: "mock",
            modelName: "mock-question-generator",
            modelParams: {},
            rawOutput: redactedMockQuestions,
            parsedOutput: redactedMockQuestions,
            latencyMs: Date.now() - startedAt,
            correlationId: context.correlationId,
            sourceRefs: context.sourceRefs,
            ...actorCaptureFields,
            privacyFlags,
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
        });
        context.onProviderOutcome?.("mock_fallback");
        return mockQuestions;
    }

    const prompt = buildQuestionGenerationPrompt(normalizedInput);
    const promptSnapshot = {
        prompt: redactPii(prompt),
        promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
    };
    const actorCaptureFields = getActorCaptureFields(context);

    let rawProviderOutput: string | undefined;
    try {
        const response = await ai.models.generateContent({
            model: AI_MODELS.QUESTION_GEN,
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" },
        });
        rawProviderOutput = response.text;

        const result = parseProviderJson(rawProviderOutput, GeneratedInterviewQuestionsSchema, {
            provider: "gemini",
            operation: "generateQuestions",
        });
        await captureAiGeneration({
            appName: context.appName,
            surface: "question_generation",
            status: "success",
            inputSnapshot,
            contextArtifacts,
            promptSnapshot,
            promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
            modelProvider: "gemini",
            modelName: AI_MODELS.QUESTION_GEN,
            modelParams: { responseMimeType: "application/json" },
            rawOutput: redactPii(rawProviderOutput),
            parsedOutput: redactPii(result),
            latencyMs: Date.now() - startedAt,
            correlationId: context.correlationId,
            sourceRefs: context.sourceRefs,
            ...actorCaptureFields,
            privacyFlags,
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
        });
        context.onProviderOutcome?.("success");
        return result;
    } catch (error) {
        await captureAiGeneration({
            appName: context.appName,
            surface: "question_generation",
            status: "failed",
            inputSnapshot,
            contextArtifacts,
            promptSnapshot,
            promptVersion: QUESTION_GENERATION_PROMPT_VERSION,
            modelProvider: error instanceof ProviderResponseError ? error.provider : "gemini",
            modelName: AI_MODELS.QUESTION_GEN,
            modelParams: { responseMimeType: "application/json" },
            rawOutput: rawProviderOutput ? redactPii(rawProviderOutput) : undefined,
            parsedOutput: null,
            latencyMs: Date.now() - startedAt,
            correlationId: context.correlationId,
            sourceRefs: context.sourceRefs,
            ...actorCaptureFields,
            error: serializeAiGenerationError(error),
            privacyFlags,
            redactionStatus: "redacted",
            retentionClass: "eval_redacted",
        });
        throw error;
    }
}

function getActorCaptureFields(context: QuestionGenerationContext) {
    if (!context.actorId) {
        return {};
    }

    if (context.actorType === "candidate") {
        return { candidateId: context.actorId };
    }

    return { createdBy: context.actorId };
}

export async function generateCandidateQuestionSnapshot(
    input: QuestionGenerationInput,
    context: QuestionGenerationContext,
    dependencies: CandidateQuestionSnapshotDependencies = {},
): Promise<Question[]> {
    const questionSet = await generateInterviewQuestionSet(input, context);
    const count = normalizeQuestionCount(input.questionCount);
    const createQuestionId = dependencies.createQuestionId ?? (() => uuidv7());

    return flattenCandidateQuestionSet(questionSet, input.interviewType ?? null)
        .slice(0, count)
        .map((question, index) => ({
            ...question,
            id: createQuestionId(index),
            index,
        }));
}

function normalizeQuestionGenerationInput(input: QuestionGenerationInput): Required<Pick<QuestionGenerationInput, "role">> & Omit<QuestionGenerationInput, "role"> {
    return {
        role: input.role.trim(),
        jobDescription: input.jobDescription?.trim() || null,
        resume: input.resume?.trim() || null,
        interviewType: input.interviewType ?? null,
        questionCount: normalizeQuestionCount(input.questionCount),
    };
}

function normalizeQuestionCount(questionCount: number | null | undefined) {
    if (!questionCount || !Number.isInteger(questionCount)) {
        return 5;
    }

    return Math.min(Math.max(questionCount, 3), 10);
}

function buildQuestionGenerationPrompt(input: QuestionGenerationInput) {
    const readingLevelContext = getReadingLevelContext(input.role);
    const practiceConfiguration = [
        input.interviewType ? `- Interview type: ${input.interviewType}` : null,
        input.questionCount ? `- Desired session length: ${input.questionCount} questions` : null,
    ].filter(Boolean).join("\n");

    return `
SYSTEM:
You are a Lead Recruiter designing high-fidelity interview questions for a "${input.role}" position.
Your goal is to create a realistic, inclusive, and role-appropriate interview set.

${input.jobDescription ? `JOB DESCRIPTION:\n${input.jobDescription}\n` : ""}
${input.resume ? `CANDIDATE RESUME:\n${input.resume}\n` : ""}
${practiceConfiguration ? `PRACTICE CONFIGURATION:\n${practiceConfiguration}\n` : ""}

PHASE 1: SIGNAL ANALYSIS (Internal Reasoning)
1. Extract 3-4 core "Unspoken" requirements from the JD (e.g., physical stamina for warehouse, empathy for healthcare, or strategic influence for leaders).
2. If a RESUME is provided, identify 2-3 specific background markers to anchor questions (e.g., previous experience in a similar industry).

PHASE 2: COGNITIVE CALIBRATION
${readingLevelContext}
- BEHAVIORAL STYLE: Use "Concrete Situational Scenarios" (e.g., "What would you do if...") instead of abstract "Tell me about a time..." questions for entry-level roles.

PHASE 3: QUESTION GENERATION
Generate interview questions in these categories:

1. Behavioral Questions - Generate exactly 4 distinct behavioral questions as a keyed object.
   - Each question must be a complete, cohesive scenario (e.g., "Tell me about a time when...").
   - DO NOT fragmented them into S/T/A/R segments.
   - KEYS: "Conflict/Resolution", "Adaptability", "Initiative/Growth", "Role-Specific Scenario".

2. Culture/Fit Questions - Generate exactly 5 questions as a keyed object based on PERMA dimensions:
   - KEYS: "Positive Emotion", "Engagement", "Relationships", "Meaning", "Accomplishment".
   - Anchor these to the specific company environment implied in the JD.

3. Technical/Hard Skill Questions - Generate 1-2 questions.
   - Anchor these to the actual tools or tasks mentioned in the JD.
   - If a Resume is provided, tie the technical question to their stated tools/experience.

4. Screening Questions - Generate exactly 3 questions as a keyed object.
   - KEYS: "Interest", "Background", "Availability".
   - Interest asks why the candidate is interested in this role or workplace.
   - Background asks for a brief, role-relevant overview of experience without duplicating technical depth.
   - Availability asks about schedule, shift, start date, travel, or other availability constraints only when the JD mentions them; otherwise ask a general readiness or logistics question.

OUTPUT FORMAT (strict JSON, no other text):
{
  "behavioral": {
    "Conflict/Resolution": "complete question text",
    "Adaptability": "complete question text",
    "Initiative/Growth": "complete question text",
    "Role-Specific Scenario": "complete question text"
  },
  "culture": {
    "Positive Emotion": "complete question text",
    "Engagement": "complete question text",
    "Relationships": "complete question text",
    "Meaning": "complete question text",
    "Accomplishment": "complete question text"
  },
  "technical": [
    { "text": "question text" }
  ],
  "screening": {
    "Interest": "complete question text",
    "Background": "complete question text",
    "Availability": "complete question text"
  }
}

RULES:
- Questions must be relevant to the specific role and candidates.
- Use plain, supportive language for entry-level roles.
- Do not mention the word "STAR" or "PERMA" in the question text.
- Output ONLY valid JSON.`;
}

function flattenCandidateQuestionSet(questionSet: GeneratedInterviewQuestions, interviewType: PracticeInterviewType | null): Question[] {
    const behavioralQuestions = Object.entries(questionSet.behavioral).map(([framework, text]) => ({
        id: "",
        text,
        category: "Behavioral",
        framework,
        index: 0,
    }));
    const cultureQuestions = Object.entries(questionSet.culture).map(([framework, text]) => ({
        id: "",
        text,
        category: "Culture",
        framework,
        index: 0,
    }));
    const technicalQuestions = questionSet.technical.map((question) => ({
        id: "",
        text: question.text,
        category: "Technical",
        framework: "Technical",
        index: 0,
    }));
    const screeningQuestions = Object.entries(questionSet.screening ?? {}).map(([framework, text]) => ({
        id: "",
        text,
        category: "Screening",
        framework,
        index: 0,
    }));

    if (interviewType === "technical") {
        return [...technicalQuestions, ...behavioralQuestions, ...cultureQuestions, ...screeningQuestions];
    }

    if (interviewType === "behavioral") {
        return [...behavioralQuestions, ...cultureQuestions, ...technicalQuestions, ...screeningQuestions];
    }

    if (interviewType === "case") {
        return [
            ...behavioralQuestions.filter((question) => question.framework === "Role-Specific Scenario"),
            ...technicalQuestions,
            ...behavioralQuestions.filter((question) => question.framework !== "Role-Specific Scenario"),
            ...cultureQuestions,
            ...screeningQuestions,
        ];
    }

    if (interviewType === "screening") {
        return [
            ...cultureQuestions,
            ...screeningQuestions,
            ...behavioralQuestions,
            ...technicalQuestions,
        ];
    }

    return [
        ...behavioralQuestions.slice(0, 2),
        ...technicalQuestions,
        ...screeningQuestions.slice(0, 1),
        ...cultureQuestions.slice(0, 2),
        ...behavioralQuestions.slice(2),
        ...screeningQuestions.slice(1),
        ...cultureQuestions.slice(2),
    ];
}

function getMockQuestions(role: string): GeneratedInterviewQuestions {
    return {
        behavioral: {
            "Conflict/Resolution": `Tell me about a time you had to resolve a conflict with a teammate or patient while working as a ${role}.`,
            "Adaptability": "Describe a situation where you had to adapt quickly to a major change in your shift or responsibilities.",
            "Initiative/Growth": "Tell me about a time you took the initiative to improve a process or help a colleague without being asked.",
            "Role-Specific Scenario": `Walk me through a specific role-specific challenge you faced as a ${role} and how you handled it.`,
        },
        culture: {
            "Positive Emotion": `How do you maintain enthusiasm in your role as a ${role}?`,
            "Engagement": `What aspects of the ${role} position keep you most engaged?`,
            "Relationships": "How do you build effective working relationships with your team?",
            "Meaning": `What does your work as a ${role} mean to you?`,
            "Accomplishment": "What professional accomplishment are you most proud of?",
        },
        technical: [
            { text: `What tools or techniques do you use most frequently as a ${role}?` },
            { text: `How do you check the quality of your work as a ${role}?` },
        ],
        screening: {
            "Interest": `What interests you most about this ${role} opportunity?`,
            "Background": `Give me a quick overview of the experience that would help you succeed as a ${role}.`,
            "Availability": `What should the team know about your availability or schedule readiness for this ${role}?`,
        },
    };
}

function serializeAiGenerationError(error: unknown) {
    if (error instanceof ProviderResponseError) {
        return {
            name: error.name,
            message: error.message,
            provider: error.provider,
            operation: error.operation,
            kind: error.kind,
        };
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    return { message: String(error) };
}
