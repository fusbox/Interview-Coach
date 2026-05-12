import { z } from "zod";

import { MAX_NORMALIZED_RESUME_TEXT_LENGTH } from "@/lib/candidate/resume-normalization";

export const PRACTICE_SETUP_LIMITS = {
    targetRole: 120,
    jobDescription: 12_000,
    resumeText: MAX_NORMALIZED_RESUME_TEXT_LENGTH,
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

export const practiceSetupSchema = z.object({
    targetRole: z
        .string()
        .trim()
        .min(1, "Target role is required.")
        .max(PRACTICE_SETUP_LIMITS.targetRole, `Target role must be ${PRACTICE_SETUP_LIMITS.targetRole} characters or fewer.`),
    jobDescription: optionalSetupText("Job description", PRACTICE_SETUP_LIMITS.jobDescription),
    resumeText: optionalSetupText("Resume text", PRACTICE_SETUP_LIMITS.resumeText),
});

export type PracticeSetupInput = z.infer<typeof practiceSetupSchema>;

export function parsePracticeSetupInput(payload: unknown): PracticeSetupInput {
    return practiceSetupSchema.parse(payload);
}

export function safeParsePracticeSetupInput(payload: unknown) {
    return practiceSetupSchema.safeParse(payload);
}
