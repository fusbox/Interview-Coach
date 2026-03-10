"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Save, X } from "lucide-react";
import { Details, QuestionInput, StepFooterProps } from "../constants";
import { useState, useLayoutEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { showDemoTools } from "@/lib/feature-flags";
import { RecruiterTemplate } from "@/lib/domain/template";
import { SectionHeader } from "@/components/patterns/SectionHeader";

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
    onGenerateQuestionsAI?: () => void;
    isGeneratingQuestions?: boolean;
    StepFooter: React.ComponentType<StepFooterProps>;
    templates?: RecruiterTemplate[];
    onSaveTemplate: (name: string, isShared: boolean) => Promise<void>;
}

// Reactive auto-resize textarea helper - Moved outside component to prevent focus loss on re-render
const AutoResizeTextarea = ({
    value,
    onChange,
    placeholder,
    className
}: {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    className?: string;
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            className={className}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={1}
            style={{ resize: 'none', overflow: 'hidden' }}
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
    onSaveTemplate
}: StepJobAndQuestionsProps) {
    const isDemo = showDemoTools();
    const [isSaving, setIsSaving] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [templateName, setTemplateName] = useState("");
    const [isShared, setIsShared] = useState(true);

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
        try {
            await onSaveTemplate(templateName, isShared);
            setShowSaveModal(false);
            setTemplateName("");
        } catch (err) {
            console.error("Save template failed:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const hasAtLeastOneQuestion =
        star.some(q => q.text.trim()) ||
        perma.some(q => q.text.trim()) ||
        technical.some(q => q.text.trim());

    const isNextDisabled = !details.role || !details.reqId || !hasAtLeastOneQuestion;

    return (
        <div className="space-y-10">
            <div className="flex flex-col gap-6">
                <SectionHeader
                    title="Job Details & Questions"
                    description="Define the role and interview questions."
                    actions={
                        isDemo && (
                            <div className="flex gap-2 items-center">
                                {onRandomizeJob && (
                                    <button
                                        onClick={onRandomizeJob}
                                        className="px-3 py-1.5 text-micro font-bold uppercase tracking-wider rounded-full bg-state-warning/10 text-state-warning hover:bg-state-warning/20 transition-all border border-state-warning/20"
                                    >
                                        🎲 Random Job
                                    </button>
                                )}
                                {onGenerateQuestionsAI && (
                                    <button
                                        onClick={onGenerateQuestionsAI}
                                        disabled={isGeneratingQuestions}
                                        className="px-3 py-1.5 text-micro font-bold uppercase tracking-wider rounded-full bg-state-success/10 text-state-success hover:bg-state-success/20 transition-all border border-state-success/20 disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {isGeneratingQuestions ? (
                                            <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                                        ) : (
                                            <>✨ AI Generate</>
                                        )}
                                    </button>
                                )}
                            </div>
                        )
                    }
                />

                {/* Template Select - Now Stacked Below */}
                <div className="flex items-center gap-2">
                    <span className="text-micro font-bold uppercase tracking-widest text-text-disabled">Apply Template:</span>
                    <div className="relative">
                        <select
                            className="h-9 min-w-[200px] rounded-lg border border-border bg-surface-base text-[11px] px-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-flat"
                            defaultValue=""
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

            {/* Cards Section: Job Details & Questions */}
            <div className="space-y-8">
                {/* Job Details Section */}
                <Card className="border-border/50 shadow-raised-1">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-bold tracking-tight">Job Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-micro font-bold uppercase tracking-wider text-text-secondary ml-1">Req ID</label>
                                <input className="flex h-11 w-full rounded-xl border border-border bg-surface-subtle px-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={details.reqId} onChange={e => setDetails({ ...details, reqId: e.target.value })}
                                    placeholder="e.g. RCI-ENG-101" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-micro font-bold uppercase tracking-wider text-text-secondary ml-1">Target Role</label>
                                <input className="flex h-11 w-full rounded-xl border border-border bg-surface-subtle px-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={details.role} onChange={e => setDetails({ ...details, role: e.target.value })}
                                    placeholder="e.g. Senior Product Manager" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-micro font-bold uppercase tracking-wider text-text-secondary ml-1">Job Description <span className="text-text-disabled font-normal lowercase tracking-normal">(Optional)</span></label>
                            <textarea className="flex min-h-[120px] w-full rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all leading-relaxed"
                                value={details.jd} onChange={e => setDetails({ ...details, jd: e.target.value })}
                                placeholder="Paste the job description here..." />
                        </div>
                    </CardContent>
                </Card>

                {/* STAR Section */}
                <Card className="border-border/50 shadow-raised-1">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-bold tracking-tight">STAR Questions (Behavioral)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {star.map((q, idx) => (
                            <div key={q.id}>
                                <AutoResizeTextarea
                                    className="flex min-h-[44px] w-full rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={q.text}
                                    onChange={val => updateQuestion(setStar, star, q.id, val)}
                                    placeholder={`STAR Question ${idx + 1}...`}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* PERMA Section */}
                <Card className="border-border/50 shadow-raised-1">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-bold tracking-tight">PERMA Questions (Culture/Fit)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {perma.map(q => (
                            <div key={q.id}>
                                <AutoResizeTextarea
                                    className="flex min-h-[44px] w-full rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={q.text}
                                    onChange={val => updateQuestion(setPerma, perma, q.id, val)}
                                    placeholder={`${q.label} Question...`}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Technical Section */}
                <Card className="border-border/50 shadow-raised-1 overflow-hidden transition-all duration-base">
                    <CardHeader className="flex flex-row items-center justify-between pb-4 bg-surface-base border-b border-border/30">
                        <CardTitle className="text-base font-bold tracking-tight">Technical Questions</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={addTechnical}
                            type="button"
                            className="hidden sm:flex text-state-success border-state-success/30 hover:bg-state-success/5 hover:border-state-success/50 transition-all rounded-xl"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        {technical.map((q, idx) => (
                            <div key={q.id} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-1 duration-base">
                                <div className="flex-1">
                                    <AutoResizeTextarea
                                        className="flex min-h-[44px] w-full rounded-xl border border-border bg-surface-subtle px-4 py-3 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                        value={q.text}
                                        onChange={val => updateQuestion(setTechnical, technical, q.id, val)}
                                        placeholder={`Technical Question ${idx + 1}...`}
                                    />
                                </div>
                                {technical.length > 1 && (
                                    <Button size="icon" variant="ghost" className="text-state-critical hover:bg-state-critical/5 shrink-0" onClick={() => removeQuestion(setTechnical, technical, q.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            onClick={addTechnical}
                            type="button"
                            className="w-full sm:hidden border-dashed text-state-success border-state-success/30 hover:bg-state-success/5 mt-2 rounded-2xl"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Add Technical Question
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <StepFooter
                onNext={onNext}
                nextLabel={<>Next: Add Candidates <ChevronRight className="ml-2 w-4 h-4" /></>}
                isNextDisabled={isNextDisabled}
                customAction={
                    <Button
                        variant="outline"
                        className="text-slate-600 w-full h-12 sm:h-10 rounded-2xl"
                        onClick={() => setShowSaveModal(true)}
                        disabled={!details.role || !hasAtLeastOneQuestion}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save as Template
                    </Button>
                }
            />

            {/* Save Template Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text-primary/40 backdrop-blur-md animate-in fade-in duration-slow">
                    <Card className="shadow-floating border-border/50 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-base ease-emphasized">
                        <div className="flex items-center justify-between p-6 border-b border-border/50 bg-surface-base">
                            <h3 className="font-bold text-lg tracking-tight text-text-primary">Save Interview Template</h3>
                            <button onClick={() => setShowSaveModal(false)} className="text-text-disabled hover:text-text-secondary transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSubmit} className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-micro font-bold uppercase tracking-wider text-text-secondary ml-1">Template Name</label>
                                <input
                                    autoFocus
                                    className="flex h-11 w-full rounded-xl border border-border bg-surface-subtle px-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="e.g. Senior Backend Engineer"
                                />
                                <p className="text-micro text-text-muted italic ml-1">
                                    Includes: Role &quot;{details.role}&quot; and {star.length + perma.length + technical.length} questions.
                                </p>
                            </div>

                            <div className="flex items-center gap-3 py-2 px-1">
                                <div className="relative flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        id="isShared"
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
                                <Button type="button" variant="ghost" className="flex-1 rounded-2xl" onClick={() => setShowSaveModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1 shadow-raised-1 rounded-2xl" disabled={!templateName.trim() || isSaving}>
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

