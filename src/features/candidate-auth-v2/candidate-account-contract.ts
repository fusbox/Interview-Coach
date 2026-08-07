import { z } from "zod";

const nameSchema = z.string().trim().min(1).max(80);

export const candidateRegistrationRequestSchema = z.object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: z.string().trim().email().max(320),
    password: z.string().min(12).max(128),
    phone: z.string().trim().min(8).max(32).refine(
        (value) => normalizeCandidatePhone(value) !== null,
        "Enter a valid US or international phone number.",
    ),
    postalCode: z.string().trim().regex(/^[0-9]{5}$/),
    contactPreferences: z.object({
        email: z.boolean(),
        sms: z.boolean(),
        phone: z.boolean(),
    }).strict(),
    contactAuthorization: z.boolean(),
    platformPolicyAccepted: z.literal(true),
    responsibleAiAcknowledged: z.literal(true),
}).strict().superRefine((value, context) => {
    const hasSelectedChannel = Object.values(value.contactPreferences).some(Boolean);
    if (hasSelectedChannel !== value.contactAuthorization) {
        context.addIssue({
            code: "custom",
            path: ["contactAuthorization"],
            message: "Contact authorization must match the selected contact methods.",
        });
    }
});

export const candidateLoginRequestSchema = z.object({
    email: z.string().trim().email().max(320),
    password: z.string().min(1).max(128),
}).strict();

export const candidateVerificationResendRequestSchema = z.object({
    email: z.string().trim().email().max(320),
}).strict();

export const candidateVerificationConsumeRequestSchema = z.object({
    token: z.string().trim().min(32).max(512),
}).strict();

export const candidatePasswordResetRequestSchema = z.object({
    email: z.string().trim().email().max(320),
}).strict();

export const candidatePasswordResetConsumeRequestSchema = z.object({
    token: z.string().trim().min(32).max(512),
    password: z.string().min(12).max(128),
}).strict();

export type CandidateRegistrationRequest = z.infer<typeof candidateRegistrationRequestSchema>;

export function normalizeCandidatePhone(value: string): string | null {
    const trimmed = value.trim();
    if (!/^\+?[0-9().\-\s]+$/.test(trimmed)) return null;
    const digits = trimmed.replace(/\D/g, "");
    if (trimmed.startsWith("+")) {
        return /^[1-9][0-9]{7,14}$/.test(digits) ? `+${digits}` : null;
    }
    return /^[0-9]{10}$/.test(digits) ? `+1${digits}` : null;
}
