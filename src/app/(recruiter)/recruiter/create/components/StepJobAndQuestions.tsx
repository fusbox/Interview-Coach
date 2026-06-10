"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Save, X } from "lucide-react";
import { Details, InterviewDetails, QuestionInput, StepFooterProps } from "../constants";
import { useEffect, useState, useLayoutEffect, useRef, useId, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { showDemoTools } from "@/lib/feature-flags";
import { RecruiterTemplate } from "@/lib/domain/template";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { FieldGroup, FieldHint, FieldLabel, textFieldClassName, textareaFieldClassName } from "@/components/patterns/FormField";
import { useAccessibleDialog } from "@/lib/hooks/use-accessible-dialog";
import { INTERVIEW_STAGE_OPTIONS, type InterviewStage, normalizeInterviewStage } from "@/lib/domain/interview-stage";
import { buildQuestionPlan, QUESTION_PLAN_CATEGORY_ORDER, type QuestionPlanCategory } from "@/lib/domain/question-plan";

interface StepJobAndQuestionsProps {
    details: Details;
    setDetails: (details: Details) => void;
    interviewDetails: InterviewDetails;
    setInterviewDetails: (details: InterviewDetails) => void;
    star: QuestionInput[];
    setStar: (val: QuestionInput[]) => void;
    perma: QuestionInput[];
    setPerma: (val: QuestionInput[]) => void;
    technical: QuestionInput[];
    setTechnical: (val: QuestionInput[]) => void;
    onNext: () => void;
    onRandomizeJob?: () => void;
    onGenerateQuestionsAI?: () => Promise<void>;
    isGeneratingQuestions?: boolean;
    StepFooter: React.ComponentType<StepFooterProps>;
    templates?: RecruiterTemplate[];
    onSaveTemplate: (name: string, isShared: boolean) => Promise<void>;
    isTourLocked?: boolean;
}

// Reactive auto-resize textarea helper - Moved outside component to prevent focus loss on re-render
const AutoResizeTextarea = ({
    value,
    onChange,
    placeholder,
    className,
    ariaLabel,
    name,
    disabled = false,
}: {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    className?: string;
    ariaLabel?: string;
    name?: string;
    disabled?: boolean;
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fieldId = useId();

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            id={fieldId}
            name={name ?? ariaLabel ?? placeholder}
            className={className}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={1}
            style={{ resize: 'none', overflow: 'hidden' }}
            aria-label={ariaLabel}
            disabled={disabled}
            readOnly={disabled}
        />
    );
};

const questionCountOptions = [3, 5, 7, 10] as const;

const questionPlanCategoryLabels: Record<QuestionPlanCategory, string> = {
    screening: "Screening",
    behavioral: "Behavioral",
    culture_fit: "Culture / Fit",
    case_scenario: "Case / Scenario",
    technical_role_specific: "Technical / Role-Specific",
};

const recruiterInterviewStageOptions = INTERVIEW_STAGE_OPTIONS
    .filter((option) => option.value !== "not_sure")
    .map((option) => option.value === "practice_only"
        ? {
            ...option,
            label: "General practice",
            description: "Use a balanced role-specific question set when this is not tied to a scheduled interview stage.",
        }
        : option
    );

const recruiterInterviewStageLabels = new Map<InterviewStage, string>(
    recruiterInterviewStageOptions.map((option) => [option.value, option.label])
);

function getRecruiterInterviewStageLabel(value: InterviewStage): string {
    return recruiterInterviewStageLabels.get(value) ?? "First interview";
}

function isScreeningQuestion(question: QuestionInput): boolean {
    return question.category.toLowerCase() === "screening";
}

function isCaseScenarioQuestion(question: QuestionInput): boolean {
    const label = question.label.toLowerCase();
    const category = question.category.toLowerCase();
    return category.includes("case") ||
        category.includes("scenario") ||
        label.includes("scenario") ||
        label.includes("role-specific");
}

function getQuestionSectionGroups({
    star,
    perma,
    technical,
}: {
    star: QuestionInput[];
    perma: QuestionInput[];
    technical: QuestionInput[];
}) {
    const screening = star.filter(isScreeningQuestion);
    const caseScenario = star.filter((question) => !isScreeningQuestion(question) && isCaseScenarioQuestion(question));
    const behavioral = star.filter((question) => !isScreeningQuestion(question) && !isCaseScenarioQuestion(question));

    return {
        screening,
        behavioral,
        cultureFit: perma,
        caseScenario,
        technicalRoleSpecific: technical,
    };
}

function createEmptyQuestion(id: string, category: string, label: string): QuestionInput {
    return { id, text: "", category, label };
}

function buildManualQuestionInputs(questionPlan: ReturnType<typeof buildQuestionPlan>) {
    const star = [
        ...Array.from({ length: questionPlan.categoryCounts.screening }, (_, index) =>
            createEmptyQuestion(`screening-${index + 1}`, "Screening", `Screening Q${index + 1}`)
        ),
        ...Array.from({ length: questionPlan.categoryCounts.behavioral }, (_, index) =>
            createEmptyQuestion(`behavioral-${index + 1}`, "Behavioral", `Behavioral Q${index + 1}`)
        ),
        ...Array.from({ length: questionPlan.categoryCounts.case_scenario }, (_, index) =>
            createEmptyQuestion(`case-${index + 1}`, "Case / Scenario", `Case / Scenario Q${index + 1}`)
        ),
    ];

    const perma = Array.from({ length: questionPlan.categoryCounts.culture_fit }, (_, index) =>
        createEmptyQuestion(`culture-${index + 1}`, "Culture / Fit", `Culture / Fit Q${index + 1}`)
    );

    const technical = Array.from({ length: questionPlan.categoryCounts.technical_role_specific }, (_, index) =>
        createEmptyQuestion(`technical-${index + 1}`, "Technical", `Technical / Role-Specific Q${index + 1}`)
    );

    return { star, perma, technical };
}

function selectPlannedQuestions(
    questions: QuestionInput[],
    count: number,
    createFallback: (index: number) => QuestionInput
): QuestionInput[] {
    return Array.from({ length: count }, (_, index) => {
        const fallback = createFallback(index);
        const generated = questions[index];

        if (!generated) {
            return fallback;
        }

        return {
            ...generated,
            id: fallback.id,
            category: fallback.category,
            label: fallback.label,
        };
    });
}

function buildQuestionInputsFromPlan(
    questionPlan: ReturnType<typeof buildQuestionPlan>,
    questionGroups: ReturnType<typeof getQuestionSectionGroups>
) {
    const star = [
        ...selectPlannedQuestions(
            questionGroups.screening,
            questionPlan.categoryCounts.screening,
            (index) => createEmptyQuestion(`screening-${index + 1}`, "Screening", `Screening Q${index + 1}`)
        ),
        ...selectPlannedQuestions(
            questionGroups.behavioral,
            questionPlan.categoryCounts.behavioral,
            (index) => createEmptyQuestion(`behavioral-${index + 1}`, "Behavioral", `Behavioral Q${index + 1}`)
        ),
        ...selectPlannedQuestions(
            questionGroups.caseScenario,
            questionPlan.categoryCounts.case_scenario,
            (index) => createEmptyQuestion(`case-${index + 1}`, "Case / Scenario", `Case / Scenario Q${index + 1}`)
        ),
    ];

    const perma = selectPlannedQuestions(
        questionGroups.cultureFit,
        questionPlan.categoryCounts.culture_fit,
        (index) => createEmptyQuestion(`culture-${index + 1}`, "Culture / Fit", `Culture / Fit Q${index + 1}`)
    );

    const technical = selectPlannedQuestions(
        questionGroups.technicalRoleSpecific,
        questionPlan.categoryCounts.technical_role_specific,
        (index) => createEmptyQuestion(`technical-${index + 1}`, "Technical", `Technical / Role-Specific Q${index + 1}`)
    );

    return { star, perma, technical };
}

export function StepJobAndQuestions({
    details, setDetails,
    interviewDetails, setInterviewDetails,
    star, setStar,
    perma, setPerma,
    technical, setTechnical,
    onNext,
    onRandomizeJob,
    onGenerateQuestionsAI,
    isGeneratingQuestions,
    StepFooter,
    templates = [],
    onSaveTemplate,
    isTourLocked = false
}: StepJobAndQuestionsProps) {
    const isDemo = showDemoTools();
    const [isSaving, setIsSaving] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isManualEntryReady, setIsManualEntryReady] = useState(false);
    const [isQuestionMixAccepted, setIsQuestionMixAccepted] = useState(false);
    const [questionMixReviewMode, setQuestionMixReviewMode] = useState<"ai" | "manual" | null>(null);
    const [questionCountMode, setQuestionCountMode] = useState<"preset" | "other">(
        questionCountOptions.includes(interviewDetails.questionCount as (typeof questionCountOptions)[number]) ? "preset" : "other",
    );
    const [templateName, setTemplateName] = useState("");
    const [isShared, setIsShared] = useState(true);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [generationFeedback, setGenerationFeedback] = useState<{
        tone: "critical" | "warning";
        message: string;
    } | null>(null);
    const saveTemplateInputRef = useRef<HTMLInputElement>(null);
    const saveDialogRef = useRef<HTMLDivElement>(null);
    const generationFeedbackTimeoutRef = useRef<number | null>(null);
    const saveDialogTitleId = useId();
    const questionMixDialogTitleId = useId();
    const templateSelectId = useId();
    const reqIdInputId = useId();
    const targetRoleInputId = useId();
    const jobDescriptionInputId = useId();
    const interviewStageHelpId = useId();
    const questionCountHelpId = useId();
    const otherQuestionCountInputId = useId();
    const templateNameInputId = useId();

    useAccessibleDialog({
        isOpen: showSaveModal,
        containerRef: saveDialogRef,
        initialFocusRef: saveTemplateInputRef,
        onClose: () => setShowSaveModal(false),
    });

    useEffect(() => {
        return () => {
            if (generationFeedbackTimeoutRef.current !== null) {
                window.clearTimeout(generationFeedbackTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (details.role.trim() && details.jd.trim() && generationFeedback?.tone === "warning") {
            setGenerationFeedback(null);
        }
    }, [details.jd, details.role, generationFeedback?.tone]);

    useEffect(() => {
        if (isTourLocked) {
            setShowSaveModal(false);
            setQuestionMixReviewMode(null);
        }
    }, [isTourLocked]);

    const questionPlan = useMemo(() => buildQuestionPlan(interviewDetails), [interviewDetails]);
    const questionPlanRows = useMemo(() => (
        QUESTION_PLAN_CATEGORY_ORDER
            .map((category) => ({
                category,
                label: questionPlanCategoryLabels[category],
                count: questionPlan.categoryCounts[category],
            }))
            .filter((row) => row.count > 0)
    ), [questionPlan]);

    const updateQuestion = (set: (val: QuestionInput[]) => void, list: QuestionInput[], id: string, text: string) => {
        set(list.map(q => q.id === id ? { ...q, text } : q));
    };

    const clearQuestion = (set: (val: QuestionInput[]) => void, list: QuestionInput[], id: string) => {
        set(list.map(q => q.id === id ? { ...q, text: '' } : q));
    };

    const handleApplyTemplate = (templateId: string) => {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        setDetails({ ...details, role: template.targetRole });
        setStar(template.questions.star);
        setPerma(template.questions.perma);
        setTechnical(template.questions.technical);
        setIsManualEntryReady(true);
        setIsQuestionMixAccepted(true);
    };

    const handleSaveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!templateName.trim()) return;

        setIsSaving(true);
        setSaveError(null);
        try {
            await onSaveTemplate(templateName, isShared);
            setShowSaveModal(false);
            setTemplateName("");
        } catch {
            setSaveError("Failed to save template. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGenerateQuestions = async () => {
        if (!onGenerateQuestionsAI) {
            return;
        }

        if (generationFeedbackTimeoutRef.current !== null) {
            window.clearTimeout(generationFeedbackTimeoutRef.current);
            generationFeedbackTimeoutRef.current = null;
        }

        if (!isJobDetailsComplete) {
            setGenerationFeedback({
                tone: "warning",
                message: "Add Req ID, Target Role, and Job Description first so AI can generate relevant interview questions.",
            });
            generationFeedbackTimeoutRef.current = window.setTimeout(() => {
                setGenerationFeedback(null);
                generationFeedbackTimeoutRef.current = null;
            }, 4500);
            return;
        }

        setGenerationFeedback(null);
        try {
            await onGenerateQuestionsAI();
            setIsManualEntryReady(false);
            setIsQuestionMixAccepted(false);
            setQuestionMixReviewMode("ai");
        } catch {
            setGenerationFeedback({
                tone: "critical",
                message: "AI question generation failed. Please review the job details and try again.",
            });
        }
    };

    const isJobDetailsComplete = Boolean(details.role.trim() && details.reqId.trim() && details.jd.trim());

    const handleManualEntry = () => {
        if (!isJobDetailsComplete || isTourLocked) {
            return;
        }
        setIsManualEntryReady(false);
        setIsQuestionMixAccepted(false);
        setQuestionMixReviewMode("manual");
        setGenerationFeedback(null);
    };

    const handleConfirmQuestionMix = () => {
        setIsQuestionMixAccepted(true);
        if (questionMixReviewMode === "manual") {
            const manualQuestions = buildManualQuestionInputs(questionPlan);
            setStar(manualQuestions.star);
            setPerma(manualQuestions.perma);
            setTechnical(manualQuestions.technical);
            setIsManualEntryReady(true);
        } else if (questionMixReviewMode === "ai") {
            const plannedQuestions = buildQuestionInputsFromPlan(questionPlan, questionGroups);
            setStar(plannedQuestions.star);
            setPerma(plannedQuestions.perma);
            setTechnical(plannedQuestions.technical);
            setIsManualEntryReady(false);
        }
        setQuestionMixReviewMode(null);
    };

    const handleResetQuestionSetup = () => {
        setQuestionMixReviewMode(null);
        setIsQuestionMixAccepted(false);
        setIsManualEntryReady(false);
        setGenerationFeedback(null);
        setStar([]);
        setPerma([]);
        setTechnical([]);
    };

    const handleBackToInterviewDetails = () => {
        setQuestionMixReviewMode(null);
        setIsQuestionMixAccepted(false);
        setIsManualEntryReady(false);

        if (questionMixReviewMode === "ai") {
            setStar(star.map((question) => ({ ...question, text: "" })));
            setPerma(perma.map((question) => ({ ...question, text: "" })));
            setTechnical(technical.map((question) => ({ ...question, text: "" })));
        }
    };

    const updateInterviewStage = (value: string) => {
        setInterviewDetails({
            ...interviewDetails,
            interviewStage: normalizeInterviewStage(value),
        });
    };

    const updateQuestionCount = (questionCount: number) => {
        setInterviewDetails({
            ...interviewDetails,
            questionCount: Math.min(Math.max(Math.trunc(questionCount), 1), 20),
        });
    };

    const hasAtLeastOneQuestion =
        star.some(q => q.text.trim()) ||
        perma.some(q => q.text.trim()) ||
        technical.some(q => q.text.trim());

    const isNextDisabled = !isJobDetailsComplete || !hasAtLeastOneQuestion;
    const questionGroups = getQuestionSectionGroups({ star, perma, technical });
    const questionSectionConfigs: Array<{
        category: QuestionPlanCategory;
        title: string;
        questions: QuestionInput[];
        setQuestions: (val: QuestionInput[]) => void;
        list: QuestionInput[];
        ariaLabelPrefix: string;
        emptyMessage: string;
    }> = [
        {
            category: "screening",
            title: "Screening Questions",
            questions: questionGroups.screening,
            setQuestions: setStar,
            list: star,
            ariaLabelPrefix: "Screening",
            emptyMessage: "No screening questions are planned for this invite.",
        },
        {
            category: "behavioral",
            title: "Behavioral Questions",
            questions: questionGroups.behavioral,
            setQuestions: setStar,
            list: star,
            ariaLabelPrefix: "Behavioral",
            emptyMessage: "No behavioral questions are planned for this invite.",
        },
        {
            category: "culture_fit",
            title: "Culture / Fit Questions",
            questions: questionGroups.cultureFit,
            setQuestions: setPerma,
            list: perma,
            ariaLabelPrefix: "Culture / Fit",
            emptyMessage: "No culture or fit questions are planned for this invite.",
        },
        {
            category: "case_scenario",
            title: "Case / Scenario Questions",
            questions: questionGroups.caseScenario,
            setQuestions: setStar,
            list: star,
            ariaLabelPrefix: "Case / Scenario",
            emptyMessage: "No case or scenario questions are planned for this invite.",
        },
        {
            category: "technical_role_specific",
            title: "Technical / Role-Specific Questions",
            questions: questionGroups.technicalRoleSpecific,
            setQuestions: setTechnical,
            list: technical,
            ariaLabelPrefix: "Technical / Role-Specific",
            emptyMessage: "No technical or role-specific questions are planned for this invite.",
        },
    ];

    const renderQuestionSection = ({
        title,
        questions,
        setQuestions,
        list,
        ariaLabelPrefix,
        emptyMessage,
    }: {
        title: string;
        questions: QuestionInput[];
        setQuestions: (val: QuestionInput[]) => void;
        list: QuestionInput[];
        ariaLabelPrefix: string;
        emptyMessage: string;
    }) => (
        <Card className="border-border/50 shadow-raised-1">
            <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold font-sans flex items-center gap-2.5">
                    <div className="w-1 h-4 bg-primary rounded-full" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {questions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
                        {emptyMessage}
                    </div>
                ) : questions.map((question, index) => (
                    <div key={question.id} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-base">
                        <div className="flex-1 relative group/field">
                            <AutoResizeTextarea
                                className={`${textareaFieldClassName} min-h-[44px] pl-4 pr-10`}
                                value={question.text}
                                onChange={(value) => updateQuestion(setQuestions, list, question.id, value)}
                                placeholder={`${title.replace(" Questions", "")} Question ${index + 1}...`}
                                ariaLabel={`${ariaLabelPrefix} question ${index + 1}`}
                                name={`${ariaLabelPrefix.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-question-${index + 1}`}
                                disabled={isTourLocked}
                            />
                            {question.text && (
                                <button
                                    type="button"
                                    onClick={() => clearQuestion(setQuestions, list, question.id)}
                                    disabled={isTourLocked}
                                    className="absolute right-3 top-3 p-1 text-rose-700 hover:text-rose-800 transition-all duration-base dark:text-rose-300 dark:hover:text-rose-200"
                                    title="Clear content"
                                    aria-label={`Clear ${ariaLabelPrefix} question ${index + 1}`}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-10">
            <div className="flex flex-col gap-6">
                <SectionHeader
                    title="Job Details & Questions"
                    description="Define the role and interview questions."
                    actions={
                        <div className="flex gap-2 items-center">
                            {isDemo && onRandomizeJob && (
                                <Button
                                    onClick={onRandomizeJob}
                                    emphasis="secondary"
                                    density="compact"
                                    shape="pill"
                                    label="chrome"
                                    disabled={isTourLocked}
                                    className="border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/25"
                                >
                                    🎲 Random Job
                                </Button>
                            )}
                        </div>
                    }
                />

            </div>

            {/* Cards Section: Job Details & Questions */}
            <div className="space-y-8">
                {/* Job Details Section */}
                <Card
                    className="border-border/50 shadow-raised-1"
                    data-tour-step-id="tour-recruiter-create-job-details"
                >
                    <CardHeader className="pb-4">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <CardTitle className="text-base font-bold font-sans flex items-center gap-2.5">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                Job Details
                            </CardTitle>

                            {/* Template Select */}
                            <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[280px]">
                                <label htmlFor={templateSelectId} className="text-micro font-bold uppercase tracking-widest text-primary">
                                    Use a Template
                                </label>
                                <div className="relative w-full">
                                    <select
                                        id={templateSelectId}
                                        name="templateId"
                                        className="h-11 w-full rounded-xl border border-border bg-surface-base px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-flat"
                                        defaultValue=""
                                        disabled={isTourLocked}
                                        onChange={(e) => handleApplyTemplate(e.target.value)}
                                    >
                                        <option value="" disabled>Select a Template...</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <FieldGroup className="space-y-2">
                                    <FieldLabel htmlFor={reqIdInputId}>Req ID</FieldLabel>
                                    <input id={reqIdInputId} className={`${textFieldClassName} h-11 py-0`}
                                        name="reqId"
                                        disabled={isTourLocked}
                                        value={details.reqId} onChange={e => setDetails({ ...details, reqId: e.target.value })}
                                        placeholder="e.g. RCI-ENG-101" />
                                </FieldGroup>
                                <FieldGroup className="space-y-2">
                                    <FieldLabel htmlFor={targetRoleInputId}>Target Role</FieldLabel>
                                    <input id={targetRoleInputId} className={`${textFieldClassName} h-11 py-0`}
                                        name="targetRole"
                                        disabled={isTourLocked}
                                        value={details.role} onChange={e => setDetails({ ...details, role: e.target.value })}
                                        placeholder="e.g. Senior Product Manager" />
                                </FieldGroup>
                            </div>
                            <FieldGroup className="space-y-2">
                                <FieldLabel htmlFor={jobDescriptionInputId}>Job Description</FieldLabel>
                                <textarea id={jobDescriptionInputId} className={textareaFieldClassName}
                                    name="jobDescription"
                                    disabled={isTourLocked}
                                    value={details.jd} onChange={e => setDetails({ ...details, jd: e.target.value })}
                                    placeholder="Paste the job description here..." />
                            </FieldGroup>
                    </CardContent>
                </Card>

                <Card
                    className="border-border/50 shadow-raised-1"
                    data-tour-step-id="tour-recruiter-create-interview-details"
                >
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-bold font-sans flex items-center gap-2.5">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            Interview Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <fieldset className="space-y-3" aria-describedby={interviewStageHelpId}>
                            <legend className="text-micro font-bold uppercase tracking-widest text-primary">
                                Interview Stage
                            </legend>
                            <p id={interviewStageHelpId} className="text-sm leading-6 text-text-secondary">
                                Choose the closest match for the practice invite.
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                                {recruiterInterviewStageOptions.map((option) => (
                                    <label
                                        key={option.value}
                                        className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 transition-all ${
                                            interviewDetails.interviewStage === option.value
                                                ? "border-primary/40 bg-primary/5 text-text-primary"
                                                : "border-border bg-surface-base text-text-secondary hover:border-primary/30 hover:bg-primary/5"
                                        } ${isTourLocked ? "cursor-not-allowed opacity-60" : ""}`}
                                    >
                                        <input
                                            type="radio"
                                            name="recruiterInterviewStage"
                                            value={option.value}
                                            checked={interviewDetails.interviewStage === option.value}
                                            onChange={(event) => updateInterviewStage(event.target.value)}
                                            disabled={isTourLocked}
                                            className="mt-1 h-4 w-4 border-border text-primary accent-primary focus:ring-primary/20"
                                        />
                                        <span>
                                            <span className="block text-sm font-bold text-text-primary">{option.label}</span>
                                            <span className="mt-1 block text-sm leading-6 text-text-secondary">{option.description}</span>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className="space-y-3" aria-describedby={questionCountHelpId}>
                            <legend className="text-micro font-bold uppercase tracking-widest text-primary">
                                Question Count
                            </legend>
                            <p id={questionCountHelpId} className="text-sm leading-6 text-text-secondary">
                                Select how many questions to add to this practice invite.
                            </p>
                            <div className="flex flex-wrap gap-3">
                                {questionCountOptions.map((option) => (
                                    <label
                                        key={option}
                                        className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                                            questionCountMode === "preset" && interviewDetails.questionCount === option
                                                ? "border-primary/40 bg-primary/5 text-primary"
                                                : "border-border bg-surface-base text-text-secondary hover:border-primary/30 hover:bg-primary/5"
                                        } ${isTourLocked ? "cursor-not-allowed opacity-60" : ""}`}
                                    >
                                        <input
                                            type="radio"
                                            name="recruiterQuestionCount"
                                            value={option}
                                            checked={questionCountMode === "preset" && interviewDetails.questionCount === option}
                                            onChange={() => {
                                                setQuestionCountMode("preset");
                                                updateQuestionCount(option);
                                            }}
                                            disabled={isTourLocked}
                                            className="h-4 w-4 border-border text-primary accent-primary focus:ring-primary/20"
                                        />
                                        {option} questions
                                    </label>
                                ))}
                                <label
                                    className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                                        questionCountMode === "other"
                                            ? "border-primary/40 bg-primary/5 text-primary"
                                            : "border-border bg-surface-base text-text-secondary hover:border-primary/30 hover:bg-primary/5"
                                    } ${isTourLocked ? "cursor-not-allowed opacity-60" : ""}`}
                                >
                                    <input
                                        type="radio"
                                        name="recruiterQuestionCount"
                                        value="other"
                                        checked={questionCountMode === "other"}
                                        onChange={() => setQuestionCountMode("other")}
                                        disabled={isTourLocked}
                                        className="h-4 w-4 border-border text-primary accent-primary focus:ring-primary/20"
                                    />
                                    Other
                                </label>
                            </div>
                            {questionCountMode === "other" && (
                                <FieldGroup className="max-w-xs space-y-2">
                                    <FieldLabel htmlFor={otherQuestionCountInputId}>Number of questions</FieldLabel>
                                    <input
                                        id={otherQuestionCountInputId}
                                        className={`${textFieldClassName} h-11 py-0`}
                                        type="number"
                                        min={1}
                                        max={20}
                                        value={interviewDetails.questionCount}
                                        disabled={isTourLocked}
                                        onChange={(event) => updateQuestionCount(Number(event.target.value))}
                                    />
                                    <FieldHint>Use any number from 1 to 20.</FieldHint>
                                </FieldGroup>
                            )}

                        </fieldset>
                    </CardContent>
                </Card>
                
                {/* Questions Group: AI Generator + Question Sections */}
                <div className="space-y-4" data-tour-step-id="tour-recruiter-create-questions">
                    {/* AI Generator Action - Contextually placed closer to questions */}
                    <div className="flex min-h-[52px] flex-col gap-3 sm:flex-row sm:items-center">
                        {isQuestionMixAccepted ? (
                            <div className="flex w-full flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 shadow-flat sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-micro font-bold uppercase tracking-widest text-primary">
                                        Question setup
                                    </p>
                                    <p className="mt-1 truncate text-sm font-semibold text-text-secondary">
                                        {questionPlan.questionCount} {questionPlan.questionCount === 1 ? "question" : "questions"} - {getRecruiterInterviewStageLabel(questionPlan.interviewStage)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    emphasis="tertiary"
                                    density="compact"
                                    shape="square"
                                    label="strong"
                                    onClick={handleResetQuestionSetup}
                                    disabled={isTourLocked}
                                    className="shrink-0 justify-center text-primary hover:bg-primary/10"
                                >
                                    Start over
                                </Button>
                            </div>
                        ) : (
                            <>
                                {onGenerateQuestionsAI && (
                                    <div className="space-y-3">
                                        <div className="flex justify-start" data-tour-step-id="tour-recruiter-create-ai-generate">
                                            <Button
                                                onClick={handleGenerateQuestions}
                                                disabled={!isJobDetailsComplete || isGeneratingQuestions || isTourLocked}
                                                emphasis="primary"
                                                density="comfortable"
                                                shape="pill"
                                                label="chrome"
                                                className="min-w-[200px] justify-center gap-2 border border-brand-deep/20 bg-brand-deep text-primary-foreground hover:bg-brand-deep/90 hover:text-primary-foreground"
                                            >
                                                {isGeneratingQuestions ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating Questions...</>
                                                ) : (
                                                    <><Sparkles className="w-4 h-4" /> AI Generate Questions</>
                                                )}
                                            </Button>
                                        </div>

                                        {generationFeedback && (
                                            <AlertPanel
                                                tone={generationFeedback.tone}
                                                size="sm"
                                                role={generationFeedback.tone === "critical" ? "alert" : "status"}
                                                aria-live={generationFeedback.tone === "critical" ? "assertive" : "polite"}
                                                className="max-w-2xl animate-in fade-in slide-in-from-top-1"
                                            >
                                                {generationFeedback.message}
                                            </AlertPanel>
                                        )}
                                    </div>
                                )}
                                <Button
                                    type="button"
                                    emphasis="secondary"
                                    density="comfortable"
                                    shape="app"
                                    label="strong"
                                    onClick={handleManualEntry}
                                    disabled={!isJobDetailsComplete || isTourLocked}
                                >
                                    Enter my own questions
                                </Button>
                            </>
                        )}
                    </div>

                    {isQuestionMixAccepted && (isManualEntryReady || hasAtLeastOneQuestion) && (
                        <>
                            {questionSectionConfigs
                                .filter((section) => questionPlan.categoryCounts[section.category] > 0)
                                .map((section) => (
                                    <div key={section.category}>
                                        {renderQuestionSection(section)}
                                    </div>
                                ))}
                        </>
                    )}
                </div>
            </div>

            {questionMixReviewMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-overlay animate-in fade-in duration-slow">
                    <Card
                        className="w-full max-w-xl overflow-hidden rounded-[32px] border-border/50 shadow-2xl animate-in zoom-in-95 duration-base ease-emphasized"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={questionMixDialogTitleId}
                    >
                        <div className="border-b border-border/50 bg-surface-base p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <p className="text-micro font-bold uppercase tracking-widest text-primary">
                                        Question setup
                                    </p>
                                    <h3 id={questionMixDialogTitleId} className="font-sans text-xl font-bold text-text-primary">
                                        Review question setup
                                    </h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    shape="pill"
                                    onClick={handleBackToInterviewDetails}
                                    aria-label="Back to job and interview details"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-text-secondary">
                                I&apos;ve set up this question mix for a {questionPlan.questionCount}-question {getRecruiterInterviewStageLabel(questionPlan.interviewStage)} practice session.
                            </p>
                        </div>
                        <div className="space-y-4 p-6">
                            <div className="rounded-2xl border border-border/60 bg-surface-subtle p-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {questionPlanRows.map((row) => (
                                        <div key={row.category} className="rounded-xl border border-border bg-surface-base px-4 py-3">
                                            <p className="text-sm font-bold text-text-primary">{row.label}</p>
                                            <p className="mt-1 text-sm text-text-secondary">
                                                {row.count} {row.count === 1 ? "question" : "questions"}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    emphasis="secondary"
                                    density="comfortable"
                                    shape="app"
                                    label="strong"
                                    onClick={handleBackToInterviewDetails}
                                >
                                    Back to job/interview details
                                </Button>
                                <Button
                                    type="button"
                                    emphasis="primary"
                                    density="comfortable"
                                    shape="app"
                                    label="strong"
                                    onClick={handleConfirmQuestionMix}
                                >
                                    Looks good
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            <StepFooter
                onNext={onNext}
                nextLabel={<>Next: Add Candidates <ChevronRight className="ml-2 w-4 h-4" /></>}
                isNextDisabled={isNextDisabled}
                disableManualNavigation={isTourLocked}
                customAction={
                    <Button
                        emphasis="secondary"
                        density="comfortable"
                        shape="app"
                        label="strong"
                        className="w-full text-text-secondary"
                        onClick={() => setShowSaveModal(true)}
                        disabled={isTourLocked || !details.role.trim() || !hasAtLeastOneQuestion}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save as Template
                    </Button>
                }
            />

            {/* Save Template Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 glass-overlay animate-in fade-in duration-slow">
                    <Card
                        ref={saveDialogRef}
                        className="shadow-floating border-border/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-base ease-emphasized"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={saveDialogTitleId}
                        tabIndex={-1}
                    >
                        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-surface-base">
                            <h3 id={saveDialogTitleId} className="font-bold text-lg text-text-primary font-sans">Save Interview Template</h3>
                            <Button type="button" variant="ghost" size="icon" shape="pill" onClick={() => setShowSaveModal(false)} aria-label="Close save template dialog">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                        <form onSubmit={handleSaveSubmit} className="p-6 space-y-6">
                            {saveError && <AlertPanel tone="critical">{saveError}</AlertPanel>}
                            <FieldGroup className="space-y-2">
                                <FieldLabel htmlFor={templateNameInputId}>Template Name</FieldLabel>
                                <input
                                    id={templateNameInputId}
                                    name="templateName"
                                    ref={saveTemplateInputRef}
                                    className={`${textFieldClassName} h-11 py-0`}
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="e.g. Senior Backend Engineer"
                                />
                                <FieldHint>
                                    Includes: Role &quot;{details.role}&quot; and {star.length + perma.length + technical.length} questions.
                                </FieldHint>
                            </FieldGroup>

                            <div className="flex items-center gap-3 py-2 px-1">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        id="isShared"
                                        name="isShared"
                                        className="w-5 h-5 rounded-md border-border bg-surface-subtle text-primary focus:ring-primary/20 transition-all cursor-pointer"
                                        checked={isShared}
                                        onChange={e => setIsShared(e.target.checked)}
                                    />
                                </div>
                                <label htmlFor="isShared" className="text-sm font-medium text-text-secondary cursor-pointer select-none leading-none">
                                    Allow other recruiters to see and use this template
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button type="button" emphasis="secondary" density="comfortable" shape="app" label="strong" className="flex-1" onClick={() => setShowSaveModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" emphasis="primary" density="comfortable" shape="app" label="strong" className="flex-1" disabled={!templateName.trim() || isSaving}>
                                    {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Template"}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}

