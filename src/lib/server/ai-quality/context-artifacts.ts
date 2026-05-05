import { redactPii } from "./redaction";

export type AiContextArtifact = {
    type: "resume" | "job_description" | "blueprint";
    label: string;
    content: unknown;
    metadata?: Record<string, unknown>;
    redactionStatus: "redacted";
    retentionClass: "eval_redacted";
};

export function buildResumeContextArtifacts(resumeText?: string | null): AiContextArtifact[] {
    if (!hasText(resumeText)) return [];

    return [{
        type: "resume",
        label: "Candidate resume",
        content: redactPii(resumeText),
        metadata: {
            characterCount: resumeText.trim().length,
        },
        redactionStatus: "redacted",
        retentionClass: "eval_redacted",
    }];
}

export function buildJobDescriptionContextArtifacts(jobDescription?: string | null): AiContextArtifact[] {
    if (!hasText(jobDescription)) return [];

    return [{
        type: "job_description",
        label: "Job description",
        content: redactPii(jobDescription),
        metadata: {
            characterCount: jobDescription.trim().length,
        },
        redactionStatus: "redacted",
        retentionClass: "eval_redacted",
    }];
}

export function buildBlueprintContextArtifacts(blueprint?: unknown): AiContextArtifact[] {
    if (!blueprint) return [];

    return [{
        type: "blueprint",
        label: "Interview blueprint",
        content: redactPii(blueprint),
        redactionStatus: "redacted",
        retentionClass: "eval_redacted",
    }];
}

export function buildIntakeContextArtifacts(intakeData?: Record<string, unknown>): AiContextArtifact[] {
    return buildResumeContextArtifacts(asString(intakeData?.resumeText));
}

export function buildIntakeSnapshot(intakeData?: Record<string, unknown>) {
    if (!intakeData) return undefined;

    const { resumeText, ...rest } = intakeData;
    const resumeString = asString(resumeText);

    return redactPii({
        ...rest,
        hasResumeText: !!resumeString,
        resumeTextCharacterCount: resumeString?.length ?? 0,
    });
}

function hasText(value?: string | null): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
