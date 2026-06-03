"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, ChevronDown, ClipboardList, FileText, SlidersHorizontal } from "lucide-react";

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
    {
        value: "",
        label: "Balanced practice",
        description: "Mix common question types when you want a general interview round.",
    },
    {
        value: "behavioral",
        label: "Behavioral stories",
        description: "Practice examples about judgment, teamwork, ownership, and how you handled past situations.",
    },
    {
        value: "technical",
        label: "Technical depth",
        description: "Focus on explaining tools, methods, domain knowledge, and how you make decisions.",
    },
    {
        value: "case",
        label: "Case or scenario",
        description: "Work through what you would do in realistic role-specific situations.",
    },
    {
        value: "screening",
        label: "Screening basics",
        description: "Prepare for early conversations about fit, interest, availability, and background.",
    },
] as const;

const questionCountOptions = [3, 5, 7, 10] as const;

export function PracticeSetupForm({ initialValues = null, practiceDraftId = null, submissionError = null }: PracticeSetupFormProps) {
    const router = useRouter();
    const [fieldErrors, setFieldErrors] = useState<PracticeSetupErrors>({});
    const [actionError, setActionError] = useState<string | null>(null);
    const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);
    const [advancedSetupOpen, setAdvancedSetupOpen] = useState(false);
    const initialInterviewType = normalizeInterviewType(initialValues?.interviewType);
    const initialQuestionCount = String(initialValues?.questionCount ?? PRACTICE_SETUP_LIMITS.questionCountDefault);
    const [selectedInterviewType, setSelectedInterviewType] = useState(initialInterviewType);
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

            {!advancedSetupOpen ? (
                <>
                    <input type="hidden" name="interviewType" value={selectedInterviewType} aria-label="Default interview type value" />
                    <input type="hidden" name="questionCount" value={selectedQuestionCount} aria-label="Default question amount value" />
                </>
            ) : null}

            <div className="rounded-2xl border border-[rgb(var(--candidate-border)/0.72)] bg-white/80 p-4 shadow-flat">
                <button
                    type="button"
                    aria-expanded={advancedSetupOpen ? "true" : "false"}
                    aria-controls="advanced-setup-panel"
                    onClick={() => setAdvancedSetupOpen((isOpen) => !isOpen)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                >
                    <span className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span>
                            <span className="block text-sm font-bold text-text-primary">Advanced setup</span>
                            <span className="mt-1 block text-sm leading-6 text-text-secondary">
                                Adjust focus or question count only when you need a more specific round.
                            </span>
                        </span>
                    </span>
                    <ChevronDown
                        className={`h-5 w-5 shrink-0 text-text-secondary transition-transform ${advancedSetupOpen ? "rotate-180" : ""}`}
                        aria-hidden="true"
                    />
                </button>

                {advancedSetupOpen ? (
                    <div
                        id="advanced-setup-panel"
                        aria-label="Advanced setup controls"
                        className="mt-5 rounded-2xl bg-[rgb(var(--candidate-surface-subtle))] p-4 shadow-flat sm:p-5"
                    >
                        <div className="grid gap-5 sm:grid-cols-2">
                            <fieldset
                                className="space-y-3"
                                aria-describedby="interview-type-help"
                            >
                                <legend className="ml-1 text-[0.625rem] font-bold uppercase tracking-wider text-[rgb(var(--candidate-muted))]">
                                    Practice focus
                                </legend>
                                <p id="interview-type-help" className="text-sm leading-6 text-text-secondary sm:min-h-12">
                                    Choose what this round should emphasize. Balanced practice mixes common interview question types.
                                </p>
                                <div className="space-y-2">
                                    {interviewTypeOptions.map((option) => (
                                        <AdvancedSetupOption
                                            key={option.value || "balanced"}
                                            name="interviewType"
                                            value={option.value}
                                            label={option.label}
                                            description={option.description}
                                            checked={selectedInterviewType === option.value}
                                            onChange={setSelectedInterviewType}
                                        />
                                    ))}
                                </div>
                            </fieldset>

                            <fieldset
                                className="space-y-3"
                                aria-describedby="question-count-help"
                            >
                                <legend className="ml-1 text-[0.625rem] font-bold uppercase tracking-wider text-[rgb(var(--candidate-muted))]">
                                    Question count
                                </legend>
                                <p id="question-count-help" className="text-sm leading-6 text-text-secondary sm:min-h-12">
                                    Choose how many prompts you want in this practice round.
                                </p>
                                <div className="space-y-2">
                                    {questionCountOptions.map((option) => {
                                        const value = String(option);

                                        return (
                                            <AdvancedSetupOption
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
                ) : null}
            </div>

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

function nullableFormValue(value: FormDataEntryValue | null) {
    return typeof value === "string" && value.trim() ? value : null;
}

function normalizeInterviewType(value: PracticeSetupFormInitialValues["interviewType"]) {
    return value === "general" ? "" : (value ?? "");
}

function AdvancedSetupOption({
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
            className={[
                "flex min-h-12 cursor-pointer flex-col items-start rounded-2xl border px-4 py-3 text-sm font-bold transition-all",
                checked
                    ? "border-primary/45 bg-primary/5 text-text-primary"
                    : "border-[rgb(var(--candidate-border)/0.78)] bg-white text-text-primary hover:border-primary/45 hover:bg-primary/5",
            ].join(" ")}
        >
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                onChange={() => onChange(value)}
                className="sr-only"
            />
            <span>{label}</span>
            {description ? (
                <span className="mt-1 text-sm font-normal leading-6 text-text-secondary">{description}</span>
            ) : null}
        </label>
    );
}
