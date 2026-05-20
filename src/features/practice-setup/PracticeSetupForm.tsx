"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, ClipboardList, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldLabel, textFieldClassName, textareaFieldClassName } from "@/components/ui/FormField";

import { startPracticeGenerationAction } from "./actions";
import { PRACTICE_SETUP_LIMITS, safeParsePracticeSetupInput, safeParsePracticeSetupIntakeInput } from "./practice-setup-schema";

type PracticeSetupField = "targetRole" | "jobDescription" | "resumeText";

type PracticeSetupFormProps = {
    initialValues?: PracticeSetupFormInitialValues | null;
    practiceDraftId?: string | null;
    submissionError?: string | null;
};

export type PracticeSetupFormInitialValues = {
    targetRole?: string | null;
    jobDescription?: string | null;
    resumeText?: string | null;
    interviewType?: "behavioral" | "technical" | "case" | "screening" | "general" | null;
    questionCount?: number | null;
};

type PracticeSetupErrors = Partial<Record<PracticeSetupField, string>>;

const fieldErrorIds: Record<PracticeSetupField, string> = {
    targetRole: "target-role-error",
    jobDescription: "job-description-error",
    resumeText: "resume-text-error",
};

const interviewTypeOptions = [
    { value: "behavioral", label: "Behavioral" },
    { value: "technical", label: "Technical" },
    { value: "case", label: "Case" },
    { value: "screening", label: "Screening" },
] as const;

const questionCountOptions = [3, 5, 7, 10] as const;

export function PracticeSetupForm({ initialValues = null, practiceDraftId = null, submissionError = null }: PracticeSetupFormProps) {
    const router = useRouter();
    const [fieldErrors, setFieldErrors] = useState<PracticeSetupErrors>({});
    const [actionError, setActionError] = useState<string | null>(null);
    const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);

    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const alertMessage = useMemo(() => {
        if (submissionError) {
            return submissionError;
        }

        if (actionError) {
            return actionError;
        }

        if (acknowledgementError) {
            return acknowledgementError;
        }

        if (hasFieldErrors) {
            return "Review the highlighted fields before starting practice.";
        }

        return null;
    }, [acknowledgementError, actionError, hasFieldErrors, submissionError]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setActionError(null);
        setAcknowledgementError(null);

        const formData = new FormData(event.currentTarget);
        const result = safeParsePracticeSetupInput({
            targetRole: formData.get("targetRole"),
            jobDescription: formData.get("jobDescription"),
            resumeText: formData.get("resumeText"),
            questionCount: formData.get("questionCount"),
        });
        const intakeResult = safeParsePracticeSetupIntakeInput({
            confidenceLevel: null,
            interviewType: nullableFormValue(formData.get("interviewType")),
            timeline: null,
            concerns: null,
            practiceFocus: [],
        });

        if (!result.success) {
            const flattenedErrors = result.error.flatten().fieldErrors;
            setFieldErrors({
                targetRole: flattenedErrors.targetRole?.[0],
                jobDescription: flattenedErrors.jobDescription?.[0],
                resumeText: flattenedErrors.resumeText?.[0],
            });
            return;
        }

        if (!intakeResult.success) {
            setActionError("Review the personalization fields before starting practice.");
            return;
        }

        if (formData.get("aiDataAcknowledgement") !== "on") {
            setAcknowledgementError("Confirm the AI and data acknowledgement before starting practice.");
            setFieldErrors({});
            return;
        }

        setFieldErrors({});

        const generationResult = await startPracticeGenerationAction({
            practiceDraftId,
            setup: result.data,
            intakeResponses: intakeResult.data,
        });
        if (!generationResult.ok) {
            setActionError(generationResult.error);
            return;
        }

        router.push(`/session/${generationResult.sessionId}`);
    }

    return (
        <form
            noValidate
            onSubmit={handleSubmit}
            className="surface-elevated space-y-8 p-5 shadow-raised-1 md:p-7"
            aria-label="Practice setup form"
        >
            <div className="flex items-start gap-3 border-b border-[rgb(var(--candidate-border)/0.72)] pb-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--candidate-primary-soft))] text-[rgb(var(--candidate-primary))]">
                    <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                    <h1 className="font-display text-2xl font-bold text-[rgb(var(--candidate-foreground))]">
                        Practice Setup
                    </h1>
                </div>
            </div>

            {alertMessage ? (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
                    {alertMessage}
                </div>
            ) : null}

            <div className="space-y-3">
                <FieldLabel htmlFor="target-role" className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Target role
                </FieldLabel>
                <input
                    id="target-role"
                    name="targetRole"
                    required
                    defaultValue={initialValues?.targetRole ?? ""}
                    aria-invalid={fieldErrors.targetRole ? "true" : "false"}
                    aria-describedby={fieldErrors.targetRole ? fieldErrorIds.targetRole : undefined}
                    placeholder="Warehouse lead, QA analyst, customer success manager..."
                    className={`${textFieldClassName} aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100`}
                />
                {fieldErrors.targetRole ? (
                    <p id={fieldErrorIds.targetRole} className="text-sm font-semibold text-red-700">
                        {fieldErrors.targetRole}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                    <FieldLabel htmlFor="job-description" className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Job description
                    </FieldLabel>
                    <textarea
                        id="job-description"
                        name="jobDescription"
                        rows={7}
                        defaultValue={initialValues?.jobDescription ?? ""}
                        aria-invalid={fieldErrors.jobDescription ? "true" : "false"}
                        aria-describedby={fieldErrors.jobDescription ? fieldErrorIds.jobDescription : undefined}
                        placeholder="Paste the role description if it will make practice more relevant."
                        className={`${textareaFieldClassName} aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100`}
                    />
                    {fieldErrors.jobDescription ? (
                        <p id={fieldErrorIds.jobDescription} className="text-sm font-semibold text-red-700">
                            {fieldErrors.jobDescription}
                        </p>
                    ) : null}
                </div>

                <div className="space-y-3">
                    <FieldLabel htmlFor="resume-text" className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Resume text
                    </FieldLabel>
                    <textarea
                        id="resume-text"
                        name="resumeText"
                        rows={7}
                        defaultValue={initialValues?.resumeText ?? ""}
                        aria-invalid={fieldErrors.resumeText ? "true" : "false"}
                        aria-describedby={fieldErrors.resumeText ? fieldErrorIds.resumeText : undefined}
                        placeholder="Paste resume text when you want questions to reflect your background."
                        className={`${textareaFieldClassName} aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100`}
                    />
                    {fieldErrors.resumeText ? (
                        <p id={fieldErrorIds.resumeText} className="text-sm font-semibold text-red-700">
                            {fieldErrors.resumeText}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-3">
                    <FieldLabel htmlFor="interview-type">Interview type</FieldLabel>
                    <select id="interview-type" name="interviewType" defaultValue={initialValues?.interviewType ?? ""} className={textFieldClassName}>
                        <option value="">Balanced practice</option>
                        {interviewTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3">
                    <FieldLabel htmlFor="question-count">Question count</FieldLabel>
                    <select
                        id="question-count"
                        name="questionCount"
                        defaultValue={String(initialValues?.questionCount ?? PRACTICE_SETUP_LIMITS.questionCountDefault)}
                        className={textFieldClassName}
                    >
                        {questionCountOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-text-secondary">
                <p>
                    Interview Coach uses AI to generate practice questions and coaching from the role, job description,
                    and resume text you provide. Your practice content may be saved so you can return to it in your
                    candidate dashboard.
                </p>
                <p>Resume text is optional. Paste only what you want used for practice.</p>
                <label className="flex items-start gap-3 font-semibold text-text-primary">
                    <input
                        type="checkbox"
                        name="aiDataAcknowledgement"
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>
                        I understand Interview Coach uses AI for practice coaching and may save my practice content for
                        my dashboard.
                    </span>
                </label>
            </div>

            <Button type="submit" density="hero" shape="pill" label="strong" className="w-full sm:w-auto">
                Start generating questions
                <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </form>
    );
}

function nullableFormValue(value: FormDataEntryValue | null) {
    return typeof value === "string" && value.trim() ? value : null;
}
