import { z } from "zod";

import { MAX_NORMALIZED_RESUME_TEXT_LENGTH } from "@/lib/candidate/resume-normalization";
import { normalizeInterviewStage } from "@/lib/domain/interview-stage";

export const PRACTICE_SETUP_LIMITS = {
    targetRole: 120,
    jobDescription: 12_000,
    resumeText: MAX_NORMALIZED_RESUME_TEXT_LENGTH,
    questionCountMin: 3,
    questionCountMax: 10,
    questionCountDefault: 5,
    timeline: 240,
    concerns: 1_000,
    practiceFocus: 80,
} as const;

const optionalSetupText = (fieldName: string, maxLength: number) =>
    z.preprocess(
        (value) => (value == null ? "" : value),
        z
            .string()
            .trim()
            .max(maxLength, `${fieldName} must be ${maxLength.toLocaleString()} characters or fewer.`)
            .transform((value) => (value.length > 0 ? value : null)),
    );

const requiredSetupText = (fieldName: string, maxLength: number) =>
    z.preprocess(
        (value) => (value == null ? "" : value),
        z
            .string()
            .trim()
            .min(1, `${fieldName} is required.`)
            .max(maxLength, `${fieldName} must be ${maxLength.toLocaleString()} characters or fewer.`),
    );

export const practiceSetupSchema = z.object({
    targetRole: z
        .string()
        .trim()
        .min(1, "Target role is required.")
        .max(PRACTICE_SETUP_LIMITS.targetRole, `Target role must be ${PRACTICE_SETUP_LIMITS.targetRole} characters or fewer.`),
    jobDescription: requiredSetupText("Job description", PRACTICE_SETUP_LIMITS.jobDescription),
    resumeText: optionalSetupText("Resume content", PRACTICE_SETUP_LIMITS.resumeText),
    questionCount: z.preprocess(
        (value) => (value == null || value === "" ? PRACTICE_SETUP_LIMITS.questionCountDefault : value),
        z.coerce
            .number()
            .int("Question count must be a whole number.")
            .min(PRACTICE_SETUP_LIMITS.questionCountMin, `Question count must be at least ${PRACTICE_SETUP_LIMITS.questionCountMin}.`)
            .max(PRACTICE_SETUP_LIMITS.questionCountMax, `Question count must be ${PRACTICE_SETUP_LIMITS.questionCountMax} or fewer.`),
    ),
});

export type PracticeSetupInput = z.infer<typeof practiceSetupSchema>;

export const practiceSetupIntakeSchema = z.object({
    confidenceLevel: z.enum(["low", "medium", "high"]).nullable(),
    interviewType: z.enum(["behavioral", "technical", "case", "screening", "general"]).nullable().optional().transform((value) => value ?? null),
    interviewStage: z.preprocess(normalizeInterviewStage, z.enum(["not_sure", "initial_screening", "initial_interview", "follow_up_final", "practice_only"])),
    timeline: optionalSetupText("Timeline", PRACTICE_SETUP_LIMITS.timeline),
    concerns: optionalSetupText("Concerns", PRACTICE_SETUP_LIMITS.concerns),
    practiceFocus: z
        .array(z.string().trim().min(1).max(PRACTICE_SETUP_LIMITS.practiceFocus))
        .transform((values) => Array.from(new Set(values)).slice(0, 6)),
});

export type PracticeSetupIntakeInput = z.infer<typeof practiceSetupIntakeSchema>;

export function parsePracticeSetupInput(payload: unknown): PracticeSetupInput {
    return practiceSetupSchema.parse(payload);
}

export function safeParsePracticeSetupInput(payload: unknown) {
    return practiceSetupSchema.safeParse(payload);
}

export function safeParsePracticeSetupIntakeInput(payload: unknown) {
    return practiceSetupIntakeSchema.safeParse(payload);
}
