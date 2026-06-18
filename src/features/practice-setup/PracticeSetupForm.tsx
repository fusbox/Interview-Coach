"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, ClipboardList, FileText, ListChecks } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldLabel, textFieldClassName, textareaFieldClassName } from "@/components/ui/FormField";
import {
    normalizeInterviewStage,
    type InterviewStage,
} from "@/lib/domain/interview-stage";

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
    interviewStage?: InterviewStage | null;
    questionCount?: number | null;
};

type PracticeSetupErrors = Partial<Record<PracticeSetupField, string>>;

const fieldErrorIds: Record<PracticeSetupField, string> = {
    targetRole: "target-role-error",
    jobDescription: "job-description-error",
    resumeText: "resume-text-error",
};

const questionCountOptions = [3, 5, 7, 10] as const;

const candidateInterviewStageOptions: ReadonlyArray<{
    value: InterviewStage;
    label: string;
    description: string;
}> = [
    {
        value: "practice_only",
        label: "I'm not sure / No interview scheduled yet",
        description: "Use a balanced round when you want practice or are not sure what kind of interview is coming.",
    },
    {
        value: "initial_screening",
        label: "First conversation or screening",
        description: "Prepare for interest, background, availability, fit, and a few role basics.",
    },
    {
        value: "initial_interview",
        label: "First interview",
        description: "Practice the main role questions you are likely to hear after screening.",
    },
    {
        value: "follow_up_final",
        label: "Follow-up or final interview",
        description: "Go deeper on role scenarios, decision-making, and examples from your experience.",
    },
];

function normalizeCandidateInterviewStage(value: unknown): InterviewStage {
    const normalized = normalizeInterviewStage(value);
    return normalized === "not_sure" ? "practice_only" : normalized;
}

export function PracticeSetupForm({ initialValues = null, practiceDraftId = null, submissionError = null }: PracticeSetupFormProps) {
    const router = useRouter();
    const [fieldErrors, setFieldErrors] = useState<PracticeSetupErrors>({});
    const [actionError, setActionError] = useState<string | null>(null);
    const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);
    const initialInterviewStage = normalizeCandidateInterviewStage(initialValues?.interviewStage);
    const initialQuestionCount = String(initialValues?.questionCount ?? PRACTICE_SETUP_LIMITS.questionCountDefault);
    const [selectedInterviewStage, setSelectedInterviewStage] = useState(initialInterviewStage);
    const [selectedQuestionCount, setSelectedQuestionCount] = useState(initialQuestionCount);

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
        const jobDescription = formData.get("jobDescription")?.toString() ?? "";
        const result = safeParsePracticeSetupInput({
            targetRole: formData.get("targetRole"),
            jobDescription,
            resumeText: formData.get("resumeText"),
            questionCount: formData.get("questionCount"),
        });
        const intakeResult = safeParsePracticeSetupIntakeInput({
            confidenceLevel: null,
            interviewType: null,
            interviewStage: formData.get("interviewStage"),
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
                        required
                        defaultValue={initialValues?.jobDescription ?? ""}
                        aria-invalid={fieldErrors.jobDescription ? "true" : "false"}
                        aria-describedby={fieldErrors.jobDescription ? fieldErrorIds.jobDescription : undefined}
                        placeholder="Paste the role description so practice can target the role clearly."
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
                        Resume content
                    </FieldLabel>
                    <textarea
                        id="resume-text"
                        name="resumeText"
                        rows={7}
                        defaultValue={initialValues?.resumeText ?? ""}
                        aria-invalid={fieldErrors.resumeText ? "true" : "false"}
                        aria-describedby={fieldErrors.resumeText ? fieldErrorIds.resumeText : undefined}
                        placeholder="Include resume content when you want questions to reflect your background."
                        className={`${textareaFieldClassName} aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100`}
                    />
                    {fieldErrors.resumeText ? (
                        <p id={fieldErrorIds.resumeText} className="text-sm font-semibold text-red-700">
                            {fieldErrors.resumeText}
                        </p>
                    ) : null}
                </div>
            </div>

            <section className="space-y-3" aria-labelledby="interview-details-heading">
                <div className="ml-1 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ListChecks className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h2
                        id="interview-details-heading"
                        className="text-[0.625rem] font-bold uppercase tracking-wider text-[rgb(var(--candidate-muted))]"
                    >
                        Interview Details
                    </h2>
                </div>
                <div className="rounded-xl border border-[rgb(var(--candidate-border))] bg-white p-4 shadow-[var(--candidate-shadow-soft)] sm:p-5">
                    <div className="space-y-6">
                        <fieldset className="space-y-3" aria-describedby="interview-stage-help">
                            <legend className="text-micro font-bold uppercase tracking-widest text-primary">
                                Interview Stage
                            </legend>
                            <p id="interview-stage-help" className="text-sm leading-6 text-text-secondary">
                                Choose the closest match for the interview you want to practice.
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                                {candidateInterviewStageOptions.map((option) => (
                                    <PracticeSetupOption
                                        key={option.value}
                                        name="interviewStage"
                                        value={option.value}
                                        label={option.label}
                                        description={option.description}
                                        checked={selectedInterviewStage === option.value}
                                        onChange={(value) => setSelectedInterviewStage(normalizeCandidateInterviewStage(value))}
                                    />
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className="space-y-3" aria-describedby="question-count-help">
                            <legend className="text-micro font-bold uppercase tracking-widest text-primary">
                                Question Count
                            </legend>
                            <p id="question-count-help" className="text-sm leading-6 text-text-secondary">
                                Select how many questions to include in this practice round.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {questionCountOptions.map((option) => {
                                    const value = String(option);

                                    return (
                                        <QuestionCountOption
                                            key={option}
                                            name="questionCount"
                                            value={value}
                                            label={`${option} questions`}
                                            checked={selectedQuestionCount === value}
                                            onChange={setSelectedQuestionCount}
                                        />
                                    );
                                })}
                            </div>
                        </fieldset>
                    </div>
                </div>
            </section>

            <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm leading-6 text-text-secondary">
                <p>
                    Interview Coach uses AI to generate practice questions, coaching, and summaries from the role,
                    job description, and any resume content you include. Practice content is saved to support session
                    continuity and your own review.
                </p>
                <p>
                    Resume content is optional. Include only what you want used for practice. Access to practice data is
                    limited by app security controls and approved support or quality-review permissions.
                </p>
                <label className="flex items-start gap-3 font-semibold text-text-primary">
                    <input
                        type="checkbox"
                        name="aiDataAcknowledgement"
                        className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span>
                        I understand Interview Coach uses AI for practice coaching and may save my practice content for
                        session continuity, summaries, and my own review.
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

function PracticeSetupOption({
    name,
    value,
    label,
    description,
    checked,
    onChange,
}: {
    name: string;
    value: string;
    label: string;
    description?: string;
    checked: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <label
            className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 transition-all ${
                checked
                    ? "border-primary/40 bg-primary/5 text-text-primary"
                    : "border-[rgb(var(--candidate-border))] bg-white text-text-secondary hover:border-primary/30 hover:bg-primary/5"
            }`}
        >
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={() => onChange(value)}
                className="mt-1 h-4 w-4 border-border text-primary accent-primary focus:ring-primary/20"
            />
            <span>
                <span className="block text-sm font-bold text-text-primary">{label}</span>
                {description ? (
                    <span className="mt-1 block text-sm font-normal leading-6 text-text-secondary">{description}</span>
                ) : null}
            </span>
        </label>
    );
}

function QuestionCountOption({
    name,
    value,
    label,
    checked,
    onChange,
}: {
    name: string;
    value: string;
    label: string;
    checked: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                checked
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-[rgb(var(--candidate-border))] bg-white text-text-secondary hover:border-primary/30 hover:bg-primary/5"
            }`}
        >
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={() => onChange(value)}
                className="h-4 w-4 border-border text-primary accent-primary focus:ring-primary/20"
            />
            {label}
        </label>
    );
}
