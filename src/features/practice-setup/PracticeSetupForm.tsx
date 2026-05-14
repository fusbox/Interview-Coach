"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, ClipboardList, FileText, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldHint, FieldLabel, textFieldClassName, textareaFieldClassName } from "@/components/ui/FormField";

import { startPracticeGenerationAction } from "./actions";
import { safeParsePracticeSetupInput, safeParsePracticeSetupIntakeInput } from "./practice-setup-schema";

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
    confidenceLevel?: "low" | "medium" | "high" | null;
    interviewType?: "behavioral" | "technical" | "case" | "screening" | "general" | null;
    timeline?: string | null;
    concerns?: string | null;
    practiceFocus?: string[] | null;
};

type PracticeSetupErrors = Partial<Record<PracticeSetupField, string>>;

const fieldErrorIds: Record<PracticeSetupField, string> = {
    targetRole: "target-role-error",
    jobDescription: "job-description-error",
    resumeText: "resume-text-error",
};

const confidenceOptions = [
    { value: "low", label: "Getting started" },
    { value: "medium", label: "Somewhat ready" },
    { value: "high", label: "Nearly ready" },
] as const;

const interviewTypeOptions = [
    { value: "general", label: "General" },
    { value: "behavioral", label: "Behavioral" },
    { value: "technical", label: "Technical" },
    { value: "case", label: "Case" },
    { value: "screening", label: "Screening" },
] as const;

const practiceFocusOptions = [
    { value: "structure", label: "Clear structure" },
    { value: "specific examples", label: "Specific examples" },
    { value: "concise answers", label: "Concise answers" },
    { value: "confidence", label: "Confidence" },
] as const;

export function PracticeSetupForm({ initialValues = null, practiceDraftId = null, submissionError = null }: PracticeSetupFormProps) {
    const router = useRouter();
    const [fieldErrors, setFieldErrors] = useState<PracticeSetupErrors>({});
    const [actionError, setActionError] = useState<string | null>(null);

    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    const alertMessage = useMemo(() => {
        if (submissionError) {
            return submissionError;
        }

        if (actionError) {
            return actionError;
        }

        if (hasFieldErrors) {
            return "Review the highlighted fields before starting practice.";
        }

        return null;
    }, [actionError, hasFieldErrors, submissionError]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setActionError(null);

        const formData = new FormData(event.currentTarget);
        const result = safeParsePracticeSetupInput({
            targetRole: formData.get("targetRole"),
            jobDescription: formData.get("jobDescription"),
            resumeText: formData.get("resumeText"),
        });
        const intakeResult = safeParsePracticeSetupIntakeInput({
            confidenceLevel: nullableFormValue(formData.get("confidenceLevel")),
            interviewType: nullableFormValue(formData.get("interviewType")),
            timeline: formData.get("timeline"),
            concerns: formData.get("concerns"),
            practiceFocus: formData.getAll("practiceFocus"),
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
            className="surface-elevated space-y-8 p-5 md:p-7"
            aria-label="Practice setup form"
        >
            <div className="flex items-start gap-3 border-b border-[rgb(var(--candidate-border)/0.72)] pb-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgb(var(--candidate-primary-soft))] text-[rgb(var(--candidate-primary))]">
                    <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                    <p className="eyebrow">Practice setup</p>
                    <h2 className="mt-2 font-display text-2xl font-bold text-[rgb(var(--candidate-foreground))]">
                        Tune the interview before you start.
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[rgb(var(--candidate-muted))]">
                        Add only the context that will make the questions more useful. You can keep it light and move straight into practice.
                    </p>
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

            <section className="space-y-5 rounded-2xl border border-[rgb(var(--candidate-border)/0.78)] bg-[rgb(var(--candidate-surface-subtle))] p-4 md:p-5" aria-label="Personalization intake">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--candidate-accent-soft))] text-[rgb(var(--candidate-accent))]">
                        <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                        <h3 className="text-sm font-bold text-[rgb(var(--candidate-foreground))]">Personalize the coaching</h3>
                        <p className="mt-1 text-sm leading-6 text-[rgb(var(--candidate-muted))]">
                            These details help shape the tone and focus without turning setup into a long questionnaire.
                        </p>
                    </div>
                </div>

                <fieldset className="space-y-3" aria-label="How ready do you feel">
                    <legend className="sr-only">How ready do you feel?</legend>
                    <FieldHint>How ready do you feel?</FieldHint>
                    <div className="grid gap-3 sm:grid-cols-3">
                        {confidenceOptions.map((option) => (
                            <label key={option.value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[rgb(var(--candidate-border))] bg-white px-4 py-3 text-sm font-semibold text-[rgb(var(--candidate-foreground))] transition hover:border-[rgb(var(--candidate-primary))]">
                                <input type="radio" name="confidenceLevel" value={option.value} defaultChecked={initialValues?.confidenceLevel === option.value} />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="grid gap-5 lg:grid-cols-2">
                    <div className="space-y-3">
                        <FieldLabel htmlFor="interview-type">Interview type</FieldLabel>
                        <select id="interview-type" name="interviewType" defaultValue={initialValues?.interviewType ?? ""} className={textFieldClassName}>
                            <option value="">Choose if known</option>
                            {interviewTypeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-3">
                        <FieldLabel htmlFor="timeline">Timeline</FieldLabel>
                        <input id="timeline" name="timeline" defaultValue={initialValues?.timeline ?? ""} placeholder="Interview next week, first round tomorrow..." className={textFieldClassName} />
                    </div>
                </div>

                <fieldset className="space-y-3" aria-label="What should the coach pay attention to">
                    <legend className="sr-only">What should the coach pay attention to?</legend>
                    <FieldHint>What should the coach pay attention to?</FieldHint>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {practiceFocusOptions.map((option) => (
                            <label key={option.value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[rgb(var(--candidate-border))] bg-white px-4 py-3 text-sm font-semibold text-[rgb(var(--candidate-foreground))] transition hover:border-[rgb(var(--candidate-primary))]">
                                <input type="checkbox" name="practiceFocus" value={option.value} defaultChecked={initialValues?.practiceFocus?.includes(option.value) ?? false} />
                                {option.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="space-y-3">
                    <FieldLabel htmlFor="concerns">Anything you want to improve?</FieldLabel>
                    <textarea id="concerns" name="concerns" rows={4} defaultValue={initialValues?.concerns ?? ""} placeholder="For example: I ramble when I get nervous, or I need stronger examples." className={textareaFieldClassName} />
                </div>
            </section>

            <div className="rounded-2xl border border-dashed border-[rgb(var(--candidate-border))] bg-[rgb(var(--candidate-surface-subtle))] p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Upload className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-text-primary">Resume file upload is coming next.</p>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">
                            This first slice keeps pasted text available while preserving the upload path for the resume pipeline.
                        </p>
                    </div>
                </div>
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
