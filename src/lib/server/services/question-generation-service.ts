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
import {
    buildQuestionPlan,
    getInterviewStageLabel,
    normalizeInterviewStage,
    QUESTION_PLAN_CATEGORY_ORDER,
    type InterviewStage,
    type QuestionPlan,
    type QuestionPlanCategory,
} from "@/lib/server/services/question-plan-service";

export const QUESTION_GENERATION_PROMPT_VERSION = "question-generation-v2";

type GeneratedInterviewQuestions = z.infer<typeof GeneratedInterviewQuestionsSchema>;

export type PracticeInterviewType = "behavioral" | "technical" | "case" | "screening" | "general";

export type QuestionGenerationInput = {
    role: string;
    jobDescription?: string | null;
    resume?: string | null;
    interviewType?: PracticeInterviewType | null;
    interviewStage?: InterviewStage | null;
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

type NormalizedQuestionGenerationInput = Required<Pick<QuestionGenerationInput, "role">>
    & Omit<QuestionGenerationInput, "role" | "interviewStage">
    & { interviewStage: InterviewStage | null };

type CandidateQuestionTemplate = Omit<Question, "id" | "index">;

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
        interviewStage: normalizedInput.interviewStage,
        questionCount: normalizedInput.questionCount,
    });

    if (!ai) {
        const mockQuestions = getMockQuestions(normalizedInput.role);
        const repairedMockQuestions = repairQuestionSetForPlan(mockQuestions, normalizedInput);
        const redactedMockQuestions = redactPii(repairedMockQuestions);
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
        return repairedMockQuestions;
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

        const parsedResult = parseProviderJson(rawProviderOutput, GeneratedInterviewQuestionsSchema, {
            provider: "gemini",
            operation: "generateQuestions",
        });
        const result = repairQuestionSetForPlan(parsedResult, normalizedInput);
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
    const normalizedInput = normalizeQuestionGenerationInput(input);
    const questionSet = await generateInterviewQuestionSet(normalizedInput, context);
    const questionPlan = normalizedInput.interviewStage
        ? buildQuestionPlan({
            interviewStage: normalizedInput.interviewStage,
            questionCount: normalizedInput.questionCount,
        })
        : null;
    const count = questionPlan?.questionCount ?? normalizeQuestionCount(normalizedInput.questionCount);
    const createQuestionId = dependencies.createQuestionId ?? (() => uuidv7());

    const flattenedQuestions = questionPlan
        ? flattenCandidateQuestionSetByPlan(questionSet, questionPlan, normalizedInput.interviewType ?? null)
        : flattenCandidateQuestionSet(questionSet, normalizedInput.interviewType ?? null);

    return flattenedQuestions
        .slice(0, count)
        .map((question, index) => ({
            ...question,
            id: createQuestionId(index),
            index,
        }));
}

function normalizeQuestionGenerationInput(input: QuestionGenerationInput): NormalizedQuestionGenerationInput {
    return {
        role: input.role.trim(),
        jobDescription: input.jobDescription?.trim() || null,
        resume: input.resume?.trim() || null,
        interviewType: input.interviewType ?? null,
        interviewStage: input.interviewStage ? normalizeInterviewStage(input.interviewStage) : null,
        questionCount: normalizeQuestionCount(input.questionCount),
    };
}

function repairQuestionSetForPlan(
    questionSet: GeneratedInterviewQuestions,
    input: NormalizedQuestionGenerationInput,
): GeneratedInterviewQuestions {
    if (!input.interviewStage) {
        return questionSet;
    }

    const questionPlan = buildQuestionPlan({
        interviewStage: input.interviewStage,
        questionCount: input.questionCount,
    });
    const behavioral = { ...questionSet.behavioral };
    const caseScenario = { ...questionSet.caseScenario };
    const culture = { ...questionSet.culture };
    const screening = { ...questionSet.screening };
    const technical = [...questionSet.technical];
    moveLegacyCaseScenarioQuestions(behavioral, caseScenario);

    ensureObjectCategoryCount({
        object: behavioral,
        desiredCount: questionPlan.categoryCounts.behavioral,
        existingKeyFilter: (key) => !isCaseScenarioQuestionKey(key),
        keyPrefix: "Behavioral",
        createKey: (index) => `Behavioral Follow-Up ${index}`,
        createQuestion: () => createFallbackQuestionText("behavioral", input.role),
    });
    ensureObjectCategoryCount({
        object: caseScenario,
        desiredCount: questionPlan.categoryCounts.case_scenario,
        existingKeyFilter: () => true,
        keyPrefix: "Case / Scenario",
        createKey: (index) => `Case / Scenario ${index}`,
        createQuestion: () => createFallbackQuestionText("case_scenario", input.role),
    });
    ensureObjectCategoryCount({
        object: culture,
        desiredCount: questionPlan.categoryCounts.culture_fit,
        existingKeyFilter: () => true,
        keyPrefix: "Culture / Fit",
        createKey: (index) => `Culture / Fit Follow-Up ${index}`,
        createQuestion: () => createFallbackQuestionText("culture_fit", input.role),
    });
    ensureObjectCategoryCount({
        object: screening,
        desiredCount: questionPlan.categoryCounts.screening,
        existingKeyFilter: () => true,
        keyPrefix: "Screening",
        createKey: (index) => `Screening Follow-Up ${index}`,
        createQuestion: () => createFallbackQuestionText("screening", input.role),
    });
    ensureTechnicalCategoryCount(technical, questionPlan.categoryCounts.technical_role_specific, input.role);

    return {
        ...questionSet,
        behavioral,
        caseScenario,
        culture,
        technical,
        screening,
    };
}

function ensureObjectCategoryCount({
    object,
    desiredCount,
    existingKeyFilter,
    keyPrefix,
    createKey,
    createQuestion,
}: {
    object: Record<string, string>;
    desiredCount: number;
    existingKeyFilter: (key: string) => boolean;
    keyPrefix: string;
    createKey: (index: number) => string;
    createQuestion: (index: number) => string;
}) {
    let matchingCount = Object.keys(object).filter(existingKeyFilter).length;
    let nextIndex = matchingCount + 1;

    while (matchingCount < desiredCount) {
        const key = findAvailableQuestionKey(object, createKey(nextIndex), keyPrefix, nextIndex);
        object[key] = createQuestion(nextIndex);
        matchingCount += 1;
        nextIndex += 1;
    }
}

function moveLegacyCaseScenarioQuestions(
    behavioral: Record<string, string>,
    caseScenario: Record<string, string>,
) {
    for (const [key, text] of Object.entries(behavioral)) {
        if (!isCaseScenarioQuestionKey(key)) {
            continue;
        }

        const targetKey = findAvailableQuestionKey(caseScenario, key, "Case / Scenario", Object.keys(caseScenario).length + 1);
        caseScenario[targetKey] = text;
        delete behavioral[key];
    }
}

function ensureTechnicalCategoryCount(
    technical: Array<{ text: string }>,
    desiredCount: number,
    role: string,
) {
    while (technical.length < desiredCount) {
        technical.push({
            text: createFallbackQuestionText("technical_role_specific", role),
        });
    }
}

function findAvailableQuestionKey(
    object: Record<string, string>,
    preferredKey: string,
    fallbackPrefix: string,
    startIndex: number,
) {
    if (!object[preferredKey]) {
        return preferredKey;
    }

    let index = startIndex;
    let key = `${fallbackPrefix} ${index}`;
    while (object[key]) {
        index += 1;
        key = `${fallbackPrefix} ${index}`;
    }
    return key;
}

function isCaseScenarioQuestionKey(key: string) {
    const normalizedKey = key.toLowerCase();
    return normalizedKey.includes("scenario") || normalizedKey.includes("role-specific") || normalizedKey.includes("case");
}

function createFallbackQuestionText(category: QuestionPlanCategory, role: string) {
    if (category === "screening") {
        return `What should the interviewer know about your interest, background, or availability for this ${role} role?`;
    }

    if (category === "culture_fit") {
        return `What kind of team environment helps you do your best work as a ${role}, and how do you contribute to that environment?`;
    }

    if (category === "case_scenario") {
        return `Imagine a realistic ${role} situation where priorities change and a customer, teammate, or process needs attention. What would you do first, and why?`;
    }

    if (category === "technical_role_specific") {
        return `Walk me through a tool, process, or technique you would use to do high-quality work as a ${role}.`;
    }

    return `Tell me about a time you handled an important ${role} responsibility well. What did you do, and what changed because of your actions?`;
}

function normalizeQuestionCount(questionCount: number | null | undefined) {
    if (!questionCount || !Number.isInteger(questionCount)) {
        return 5;
    }

    return Math.min(Math.max(questionCount, 1), 20);
}

function buildQuestionGenerationPrompt(input: QuestionGenerationInput) {
    const readingLevelContext = getReadingLevelContext(input.role);
    const interviewStage = normalizeInterviewStage(input.interviewStage);
    const questionPlan = input.interviewStage
        ? buildQuestionPlan({
            interviewStage,
            questionCount: input.questionCount,
        })
        : null;
    const practiceConfiguration = [
        input.interviewStage ? `- Interview stage: ${getInterviewStageLabel(interviewStage)}` : null,
        input.interviewType ? `- Practice emphasis: ${input.interviewType}` : null,
        input.questionCount ? `- Desired session length: ${input.questionCount} questions` : null,
        questionPlan ? `- Planned category mix: ${formatQuestionPlanCategoryMix(questionPlan)}` : null,
    ].filter(Boolean).join("\n");
    const contextGuide = [
        `- Target role: Use "${input.role}" as the specific job the practice is preparing for.`,
        input.jobDescription
            ? "- Job description: Treat this as the primary source for duties, work setting, tools, constraints, and role-specific signals."
            : "- Job description: None was provided, so rely on common expectations for the target role without inventing employer-specific facts.",
        input.resume
            ? "- Resume content: Use it to personalize questions around the candidate's background and transferable experience; do not quote private details unnecessarily."
            : "- Resume content: None was provided, so keep questions role/JD-centered and do not invent candidate background.",
        questionPlan
            ? `- Stage and count: Generate exactly ${questionPlan.questionCount} total questions distributed as ${formatQuestionPlanCategoryMix(questionPlan)}.`
            : "- Stage and count: No deterministic question plan was provided; generate a balanced compatibility pool for older callers.",
    ].join("\n");
    const questionPlanInstructions = questionPlan
        ? `Generate exactly the planned category counts. Do not add unused extra questions beyond the planned mix.

Planned output counts:
${formatQuestionPlanOutputCounts(questionPlan)}

Category-to-JSON mapping:
- Screening questions go in "screening" as a keyed object.
- Behavioral questions go in "behavioral" as keyed object entries whose keys do not include "Case" or "Scenario".
- Culture/Fit questions go in "culture" as a keyed object.
- Case/Scenario questions go in "caseScenario" as a keyed object.
- Technical/Role-Specific questions go in "technical" as array objects with a "text" field.
- Categories with a planned count of 0 must be empty: {} for keyed objects or [] for technical.`
        : `Generate a balanced compatibility pool for older callers:
- 4 behavioral questions in "behavioral".
- 5 culture/fit questions in "culture".
- 1-2 technical/role-specific questions in "technical".
- 3 screening questions in "screening".`;

    return `
SYSTEM:
You are a Lead Recruiter designing high-fidelity interview questions for a "${input.role}" position.
Your goal is to create a realistic, inclusive, and role-appropriate interview set.

${input.jobDescription ? `JOB DESCRIPTION:\n${input.jobDescription}\n` : ""}
${input.resume ? `CANDIDATE RESUME:\n${input.resume}\n` : ""}
${practiceConfiguration ? `PRACTICE CONFIGURATION:\n${practiceConfiguration}\n` : ""}

CONTEXT GUIDE:
${contextGuide}

PHASE 1: SIGNAL ANALYSIS (Internal Reasoning)
1. Extract 3-4 core "Unspoken" requirements from the JD (e.g., physical stamina for warehouse, empathy for healthcare, or strategic influence for leaders).
2. If a RESUME is provided, identify 2-3 specific background markers to anchor questions (e.g., previous experience in a similar industry).

PHASE 2: COGNITIVE CALIBRATION
${readingLevelContext}
- BEHAVIORAL STYLE: Use "Concrete Situational Scenarios" (e.g., "What would you do if...") instead of abstract "Tell me about a time..." questions for entry-level roles.

PHASE 3: QUESTION GENERATION
${questionPlanInstructions}

Question-category guidance:
- Screening: Ask about interest, background, role logistics, schedule, shift, start date, travel, or availability when the JD supports it. If the JD does not mention availability constraints, ask a general readiness or interview-logistics question.
- Behavioral: Ask for past examples or concrete situational responses tied to work habits, judgment, ownership, adaptability, or collaboration. Do not fragment questions into S/T/A/R parts.
- Culture/Fit: Ask about team environment, motivation, service orientation, communication norms, values alignment, and the work setting implied by the JD. Do not mention PERMA.
- Case/Scenario: Ask realistic "what would you do" or "walk me through" scenarios based on a role-specific situation, customer/client need, operational tradeoff, or prioritization moment.
- Technical/Role-Specific: Ask about tools, processes, compliance, quality checks, domain tasks, or role-specific methods named or implied in the JD. If resume content is provided, you may connect the question to stated tools or experience.

OUTPUT FORMAT (strict JSON, no other text):
{
  "behavioral": {
    "Behavioral 1": "complete question text"
  },
  "caseScenario": {
    "Case / Scenario 1": "complete question text"
  },
  "culture": {
    "Culture / Fit 1": "complete question text"
  },
  "technical": [
    { "text": "question text" }
  ],
  "screening": {
    "Interest": "complete question text"
  }
}

RULES:
- Questions must be relevant to the specific role, job description, and candidate context when available.
- Use plain, supportive language for entry-level roles.
- Do not mention the word "STAR" or "PERMA" in the question text.
- Do not include internal category names, scoring language, or implementation terms in the question text.
- Output the exact JSON shape above. Empty planned categories must still be present as empty objects or arrays.
- Output ONLY valid JSON.`;
}

function formatQuestionPlanCategoryMix(questionPlan: QuestionPlan) {
    return QUESTION_PLAN_CATEGORY_ORDER
        .map((category) => ({
            label: getQuestionPlanCategoryPromptLabel(category),
            count: questionPlan.categoryCounts[category],
        }))
        .filter((item) => item.count > 0)
        .map((item) => `${item.count} ${item.label}`)
        .join(", ");
}

function formatQuestionPlanOutputCounts(questionPlan: QuestionPlan) {
    return QUESTION_PLAN_CATEGORY_ORDER
        .map((category) => `- ${getQuestionPlanCategoryPromptLabel(category)}: ${questionPlan.categoryCounts[category]}`)
        .join("\n");
}

function getQuestionPlanCategoryPromptLabel(category: QuestionPlanCategory) {
    if (category === "screening") {
        return "Screening";
    }

    if (category === "behavioral") {
        return "Behavioral";
    }

    if (category === "culture_fit") {
        return "Culture/Fit";
    }

    if (category === "case_scenario") {
        return "Case/Scenario";
    }

    return "Technical/Role-Specific";
}

function flattenCandidateQuestionSet(questionSet: GeneratedInterviewQuestions, interviewType: PracticeInterviewType | null): CandidateQuestionTemplate[] {
    const {
        behavioralQuestions,
        caseScenarioQuestions,
        cultureQuestions,
        technicalQuestions,
        screeningQuestions,
    } = buildCandidateQuestionBuckets(questionSet);

    if (interviewType === "technical") {
        return [...technicalQuestions, ...caseScenarioQuestions, ...behavioralQuestions, ...cultureQuestions, ...screeningQuestions];
    }

    if (interviewType === "behavioral") {
        return [...behavioralQuestions, ...caseScenarioQuestions, ...cultureQuestions, ...technicalQuestions, ...screeningQuestions];
    }

    if (interviewType === "case") {
        return [
            ...caseScenarioQuestions,
            ...technicalQuestions,
            ...behavioralQuestions.filter((question) => !isCaseScenarioQuestionKey(question.framework ?? "")),
            ...cultureQuestions,
            ...screeningQuestions,
        ];
    }

    if (interviewType === "screening") {
        return [
            ...cultureQuestions,
            ...screeningQuestions,
            ...behavioralQuestions,
            ...caseScenarioQuestions,
            ...technicalQuestions,
        ];
    }

    return [
        ...behavioralQuestions.slice(0, 2),
        ...caseScenarioQuestions,
        ...technicalQuestions,
        ...screeningQuestions.slice(0, 1),
        ...cultureQuestions.slice(0, 2),
        ...behavioralQuestions.slice(2),
        ...screeningQuestions.slice(1),
        ...cultureQuestions.slice(2),
    ];
}

function flattenCandidateQuestionSetByPlan(
    questionSet: GeneratedInterviewQuestions,
    questionPlan: QuestionPlan,
    legacyInterviewType: PracticeInterviewType | null,
): CandidateQuestionTemplate[] {
    const buckets = buildCandidateQuestionBuckets(questionSet);
    const byPlanCategory: Record<QuestionPlanCategory, CandidateQuestionTemplate[]> = {
        screening: buckets.screeningQuestions,
        behavioral: buckets.behavioralQuestions.filter((question) => !isCaseScenarioQuestionKey(question.framework ?? "")),
        culture_fit: buckets.cultureQuestions,
        case_scenario: buckets.caseScenarioQuestions,
        technical_role_specific: buckets.technicalQuestions,
    };
    const fallbackQuestions = flattenCandidateQuestionSet(questionSet, legacyInterviewType);
    const selectedQuestions: CandidateQuestionTemplate[] = [];
    const usedKeys = new Set<string>();

    for (const slot of questionPlan.slots) {
        const question = takeUnusedQuestion(byPlanCategory[slot.category], usedKeys) ?? takeUnusedQuestion(fallbackQuestions, usedKeys);
        if (question) {
            selectedQuestions.push(question);
        }
    }

    return selectedQuestions;
}

function takeUnusedQuestion(questions: CandidateQuestionTemplate[], usedKeys: Set<string>) {
    const question = questions.find((candidate) => !usedKeys.has(getCandidateQuestionKey(candidate)));
    if (!question) {
        return null;
    }

    usedKeys.add(getCandidateQuestionKey(question));
    return question;
}

function getCandidateQuestionKey(question: CandidateQuestionTemplate) {
    return `${question.category}:${question.framework ?? ""}:${question.text}`;
}

function buildCandidateQuestionBuckets(questionSet: GeneratedInterviewQuestions) {
    const behavioralQuestions = Object.entries(questionSet.behavioral).map(([framework, text]) => ({
        id: "",
        text,
        category: "Behavioral",
        framework,
        index: 0,
    }));
    const legacyCaseScenarioQuestions = behavioralQuestions
        .filter((question) => isCaseScenarioQuestionKey(question.framework ?? ""))
        .map((question) => ({
            ...question,
            category: "Case / Scenario",
        }));
    const caseScenarioQuestions = [
        ...Object.entries(questionSet.caseScenario).map(([framework, text]) => ({
            id: "",
            text,
            category: "Case / Scenario",
            framework,
            index: 0,
        })),
        ...legacyCaseScenarioQuestions,
    ];
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
    const screeningQuestions = Object.entries(questionSet.screening).map(([framework, text]) => ({
        id: "",
        text,
        category: "Screening",
        framework,
        index: 0,
    }));

    return {
        behavioralQuestions,
        caseScenarioQuestions,
        cultureQuestions,
        technicalQuestions,
        screeningQuestions,
    };
}

function getMockQuestions(role: string): GeneratedInterviewQuestions {
    return {
        behavioral: {
            "Conflict/Resolution": `Tell me about a time you had to resolve a conflict with a teammate or patient while working as a ${role}.`,
            "Adaptability": "Describe a situation where you had to adapt quickly to a major change in your shift or responsibilities.",
            "Initiative/Growth": "Tell me about a time you took the initiative to improve a process or help a colleague without being asked.",
        },
        caseScenario: {
            "Case / Scenario 1": `Walk me through a specific role-specific challenge you faced as a ${role} and how you handled it.`,
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
