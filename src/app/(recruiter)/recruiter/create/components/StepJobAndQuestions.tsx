"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Save, X } from "lucide-react";
import { Details, QuestionInput, StepFooterProps } from "../constants";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { showDemoTools } from "@/lib/feature-flags";
import { RecruiterTemplate } from "@/lib/domain/template";

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
        <div className="space-y-8">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold font-display">Step 1: Job Details & Questions</h2>
                        <p className="text-muted-foreground">Define the role and interview questions.</p>
                    </div>

                    {/* Demo Tools (formerly Dev Only) */}
                    {isDemo && (
                        <div className="flex gap-2 items-center">
                            {onRandomizeJob && (
                                <button
                                    onClick={onRandomizeJob}
                                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border border-amber-200"
                                >
                                    🎲 Random Job
                                </button>
                            )}
                            {onGenerateQuestionsAI && (
                                <button
                                    onClick={onGenerateQuestionsAI}
                                    disabled={isGeneratingQuestions}
                                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors border border-emerald-200 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {isGeneratingQuestions ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                                    ) : (
                                        <>✨ AI Generate</>
                                    )}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Template Select - Now Stacked Below */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Apply Template:</span>
                    <div className="relative">
                        <select
                            className="h-9 min-w-[200px] rounded-md border text-xs px-3 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
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

            {/* Job Details Section */}
            <Card>
                <CardHeader>
                    <CardTitle>Job Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Req ID</label>
                            <input className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                value={details.reqId} onChange={e => setDetails({ ...details, reqId: e.target.value })}
                                placeholder="e.g. RCI-ENG-101" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Target Role</label>
                            <input className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                value={details.role} onChange={e => setDetails({ ...details, role: e.target.value })}
                                placeholder="e.g. Senior Product Manager" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Job Description <span className="text-muted-foreground font-normal">(Optional)</span></label>
                        <textarea className="flex min-h-[100px] w-full rounded-md border bg-muted/50 px-3 py-2 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                            value={details.jd} onChange={e => setDetails({ ...details, jd: e.target.value })}
                            placeholder="Paste the job description here..." />
                    </div>

                </CardContent>
            </Card>

            {/* Questions Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-semibold text-slate-900">Interview Questions</h3>
                </div>

                {/* STAR Section */}
                <Card>
                    <CardHeader><CardTitle>STAR Questions (Behavioral)</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {star.map((q, idx) => (
                            <div key={q.id}>
                                <input className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                    value={q.text} onChange={e => updateQuestion(setStar, star, q.id, e.target.value)}
                                    placeholder={`STAR Question ${idx + 1}...`} />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* PERMA Section */}
                <Card>
                    <CardHeader><CardTitle>PERMA Questions (Culture/Fit)</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {perma.map(q => (
                            <div key={q.id}>
                                <input className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                    value={q.text} onChange={e => updateQuestion(setPerma, perma, q.id, e.target.value)}
                                    placeholder={`${q.label} Question...`} />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Technical Section */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Technical Questions</CardTitle>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={addTechnical}
                            type="button"
                            className="hidden sm:flex text-emerald-600 border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Add
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {technical.map((q, idx) => (
                            <div key={q.id} className="flex gap-2 items-center">
                                <div className="flex-1">
                                    <input className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                        value={q.text} onChange={e => updateQuestion(setTechnical, technical, q.id, e.target.value)}
                                        placeholder={`Technical Question ${idx + 1}...`} />
                                </div>
                                {technical.length > 1 && (
                                    <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeQuestion(setTechnical, technical, q.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            onClick={addTechnical}
                            type="button"
                            className="w-full sm:hidden border-dashed text-emerald-600 border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 mt-2"
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
                        className="text-slate-600 w-full h-12 sm:h-10"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl border w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-bold text-slate-900">Save Interview Template</h3>
                            <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveSubmit} className="p-4 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Template Name</label>
                                <input
                                    autoFocus
                                    className="flex h-10 w-full rounded-md border px-3 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                    value={templateName}
                                    onChange={e => setTemplateName(e.target.value)}
                                    placeholder="e.g. Senior Backend Engineer"
                                />
                                <p className="text-[10px] text-slate-500 italic">
                                    Includes: Role &quot;{details.role}&quot; and {star.length + perma.length + technical.length} questions.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 py-2">
                                <input
                                    type="checkbox"
                                    id="isShared"
                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                    checked={isShared}
                                    onChange={e => setIsShared(e.target.checked)}
                                />
                                <label htmlFor="isShared" className="text-sm text-slate-700 cursor-pointer select-none">
                                    Allow other recruiters to see and use this template
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowSaveModal(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={!templateName.trim() || isSaving}>
                                    {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Template"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

