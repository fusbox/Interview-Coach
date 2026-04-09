"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Trash2, Loader2, Save, X } from "lucide-react";
import { Details, QuestionInput, StepFooterProps } from "../constants";
import { useEffect, useState, useLayoutEffect, useRef, useId } from "react";
import { ChevronRight } from "lucide-react";
import { showDemoTools } from "@/lib/feature-flags";
import { RecruiterTemplate } from "@/lib/domain/template";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { FieldGroup, FieldHint, FieldLabel, textFieldClassName, textareaFieldClassName } from "@/components/patterns/FormField";
import { useAccessibleDialog } from "@/lib/hooks/use-accessible-dialog";

interface StepJobAndQuestionsProps {
    details: Details;
    setDetails: (details: Details) => void;
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

export function StepJobAndQuestions({
    details, setDetails,
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
    const templateSelectId = useId();
    const reqIdInputId = useId();
    const targetRoleInputId = useId();
    const jobDescriptionInputId = useId();
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
        }
    }, [isTourLocked]);

    const addTechnical = () => {
        setTechnical([...technical, {
            id: `tech-${Date.now()}`,
            text: '',
            category: 'Technical',
            label: `Technical Q${technical.length + 1}`
        }]);
    };

    const removeQuestion = (set: (val: QuestionInput[]) => void, list: QuestionInput[], id: string) => {
        set(list.filter(q => q.id !== id));
    };

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

        if (!details.role.trim() || !details.jd.trim()) {
            setGenerationFeedback({
                tone: "warning",
                message: "Add a Target Role and Job Description first so AI can generate relevant interview questions.",
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
        } catch {
            setGenerationFeedback({
                tone: "critical",
                message: "AI question generation failed. Please review the job details and try again.",
            });
        }
    };

    const hasAtLeastOneQuestion =
        star.some(q => q.text.trim()) ||
        perma.some(q => q.text.trim()) ||
        technical.some(q => q.text.trim());

    const isNextDisabled = !details.role.trim() || !details.reqId.trim() || !details.jd.trim() || !hasAtLeastOneQuestion;

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
                
                {/* Questions Group: AI Generator + Question Sections */}
                <div className="space-y-4" data-tour-step-id="tour-recruiter-create-questions">
                    {/* AI Generator Action - Contextually placed closer to questions */}
                    {onGenerateQuestionsAI && (
                        <div className="space-y-3">
                            <div className="flex justify-start" data-tour-step-id="tour-recruiter-create-ai-generate">
                                <Button
                                    onClick={handleGenerateQuestions}
                                    disabled={isGeneratingQuestions || isTourLocked}
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

                    {/* STAR Section */}
                    <Card className="border-border/50 shadow-raised-1">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-bold font-sans flex items-center gap-2.5">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                STAR Questions (Behavioral)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {star.map((q, idx) => (
                                <div key={q.id} className="relative group/field">
                                    <AutoResizeTextarea
                                        className={`${textareaFieldClassName} min-h-[44px] pl-4 pr-10`}
                                        value={q.text}
                                        onChange={val => updateQuestion(setStar, star, q.id, val)}
                                        placeholder={`STAR Question ${idx + 1}...`}
                                        ariaLabel={`STAR question ${idx + 1}`}
                                        name={`star-question-${idx + 1}`}
                                        disabled={isTourLocked}
                                    />
                                    {q.text && (
                                        <button
                                            type="button"
                                            onClick={() => clearQuestion(setStar, star, q.id)}
                                            disabled={isTourLocked}
                                            className="absolute right-3 top-3 p-1 text-rose-700 hover:text-rose-800 transition-all duration-base dark:text-rose-300 dark:hover:text-rose-200"
                                            title="Clear content"
                                            aria-label={`Clear STAR question ${idx + 1}`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* PERMA Section */}
                    <Card className="border-border/50 shadow-raised-1">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-base font-bold font-sans flex items-center gap-2.5">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                PERMA Questions (Culture/Fit)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {perma.map((q, idx) => (
                                <div key={q.id} className="relative group/field">
                                    <AutoResizeTextarea
                                        className={`${textareaFieldClassName} min-h-[44px] pl-4 pr-10`}
                                        value={q.text}
                                        onChange={val => updateQuestion(setPerma, perma, q.id, val)}
                                        placeholder={`${q.label} Question...`}
                                        ariaLabel={`${q.label} question`}
                                        name={`perma-question-${idx + 1}`}
                                        disabled={isTourLocked}
                                    />
                                    {q.text && (
                                        <button
                                            type="button"
                                            onClick={() => clearQuestion(setPerma, perma, q.id)}
                                            disabled={isTourLocked}
                                            className="absolute right-3 top-3 p-1 text-rose-700 hover:text-rose-800 transition-all duration-base dark:text-rose-300 dark:hover:text-rose-200"
                                            title="Clear content"
                                            aria-label={`Clear ${q.label} question`}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Technical Section */}
                    <Card className="border-border/50 shadow-raised-1 overflow-hidden transition-all duration-base">
                        <CardHeader className="flex flex-row items-center justify-between pb-4 bg-surface-base border-b border-border/30">
                            <CardTitle className="text-base font-bold font-sans flex items-center gap-2.5">
                                <div className="w-1 h-4 bg-primary rounded-full" />
                                Technical & Role-Specific Questions
                            </CardTitle>
                            <Button
                                emphasis="secondary"
                                density="compact"
                                shape="square"
                                label="strong"
                                onClick={addTechnical}
                                type="button"
                                disabled={isTourLocked}
                                className="hidden sm:flex rounded-xl text-emerald-800 border-emerald-400 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-900 transition-all dark:text-emerald-200 dark:border-emerald-400/50 dark:hover:bg-emerald-500/10"
                            >
                                <Plus className="w-4 h-4 mr-1" /> Add
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-6">
                            {technical.map((q, idx) => (
                                <div key={q.id} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-base">
                                    <div className="flex-1 relative group/field">
                                        <AutoResizeTextarea
                                        className={`${textareaFieldClassName} min-h-[44px] pl-4 pr-10`}
                                        value={q.text}
                                        onChange={val => updateQuestion(setTechnical, technical, q.id, val)}
                                        placeholder={`Technical Question ${idx + 1}...`}
                                        ariaLabel={`Technical question ${idx + 1}`}
                                        name={`technical-question-${idx + 1}`}
                                        disabled={isTourLocked}
                                    />
                                        {q.text && (
                                            <button
                                                type="button"
                                                onClick={() => clearQuestion(setTechnical, technical, q.id)}
                                                disabled={isTourLocked}
                                                className="absolute right-3 top-3 p-1 text-rose-700 hover:text-rose-800 transition-all duration-base dark:text-rose-300 dark:hover:text-rose-200"
                                                title="Clear content"
                                                aria-label={`Clear technical question ${idx + 1}`}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {technical.length > 1 && (
                                        <Button size="icon" variant="ghost" shape="square" className="text-rose-700 hover:bg-rose-50 shrink-0 dark:text-rose-300 dark:hover:bg-rose-500/10" onClick={() => removeQuestion(setTechnical, technical, q.id)} aria-label={`Remove technical question ${idx + 1}`} disabled={isTourLocked}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                            <Button
                                emphasis="secondary"
                                density="comfortable"
                                shape="app"
                                label="strong"
                                onClick={addTechnical}
                                type="button"
                                disabled={isTourLocked}
                                className="mt-2 w-full border-dashed text-emerald-800 border-emerald-400 hover:bg-emerald-50 hover:border-emerald-500 dark:text-emerald-200 dark:border-emerald-400/50 dark:hover:bg-emerald-500/10 sm:hidden"
                            >
                                <Plus className="w-4 h-4 mr-2" /> Add Technical Question
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

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

