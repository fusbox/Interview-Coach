"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, FileText, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

import { startPracticeGenerationAction } from "./actions";
import { safeParsePracticeSetupInput } from "./practice-setup-schema";

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
};

type PracticeSetupErrors = Partial<Record<PracticeSetupField, string>>;

const fieldErrorIds: Record<PracticeSetupField, string> = {
    targetRole: "target-role-error",
    jobDescription: "job-description-error",
    resumeText: "resume-text-error",
};

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

        if (!result.success) {
            const flattenedErrors = result.error.flatten().fieldErrors;
            setFieldErrors({
                targetRole: flattenedErrors.targetRole?.[0],
                jobDescription: flattenedErrors.jobDescription?.[0],
                resumeText: flattenedErrors.resumeText?.[0],
            });
            return;
        }

        setFieldErrors({});

        if (practiceDraftId) {
            const generationResult = await startPracticeGenerationAction(practiceDraftId);
            if (!generationResult.ok) {
                setActionError(generationResult.error);
                return;
            }

            router.push(`/session/${generationResult.sessionId}`);
        }
    }

    return (
        <form
            noValidate
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-border bg-white p-6 shadow-flat"
            aria-label="Practice setup form"
        >
            {alertMessage ? (
                <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
                    {alertMessage}
                </div>
            ) : null}

            <div className="space-y-2">
                <label htmlFor="target-role" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <Briefcase className="h-4 w-4 text-primary" />
                    Target role
                </label>
                <input
                    id="target-role"
                    name="targetRole"
                    required
                    defaultValue={initialValues?.targetRole ?? ""}
                    aria-invalid={fieldErrors.targetRole ? "true" : "false"}
                    aria-describedby={fieldErrors.targetRole ? fieldErrorIds.targetRole : undefined}
                    placeholder="Warehouse lead, QA analyst, customer success manager..."
                    className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100"
                />
                {fieldErrors.targetRole ? (
                    <p id={fieldErrorIds.targetRole} className="text-sm font-semibold text-red-700">
                        {fieldErrors.targetRole}
                    </p>
                ) : null}
            </div>

            <div className="space-y-2">
                <label htmlFor="job-description" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <FileText className="h-4 w-4 text-primary" />
                    Job description
                </label>
                <textarea
                    id="job-description"
                    name="jobDescription"
                    rows={7}
                    defaultValue={initialValues?.jobDescription ?? ""}
                    aria-invalid={fieldErrors.jobDescription ? "true" : "false"}
                    aria-describedby={fieldErrors.jobDescription ? fieldErrorIds.jobDescription : undefined}
                    placeholder="Paste the role description if it will make practice more relevant."
                    className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-base leading-7 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100"
                />
                {fieldErrors.jobDescription ? (
                    <p id={fieldErrorIds.jobDescription} className="text-sm font-semibold text-red-700">
                        {fieldErrors.jobDescription}
                    </p>
                ) : null}
            </div>

            <div className="space-y-2">
                <label htmlFor="resume-text" className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <FileText className="h-4 w-4 text-primary" />
                    Resume text
                </label>
                <textarea
                    id="resume-text"
                    name="resumeText"
                    rows={7}
                    defaultValue={initialValues?.resumeText ?? ""}
                    aria-invalid={fieldErrors.resumeText ? "true" : "false"}
                    aria-describedby={fieldErrors.resumeText ? fieldErrorIds.resumeText : undefined}
                    placeholder="Paste resume text when you want questions to reflect your background."
                    className="w-full resize-y rounded-xl border border-input bg-background px-4 py-3 text-base leading-7 text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100"
                />
                {fieldErrors.resumeText ? (
                    <p id={fieldErrorIds.resumeText} className="text-sm font-semibold text-red-700">
                        {fieldErrors.resumeText}
                    </p>
                ) : null}
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-4">
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
