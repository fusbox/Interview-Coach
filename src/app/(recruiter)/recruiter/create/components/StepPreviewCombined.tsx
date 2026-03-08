"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Details, QuestionInput, StepFooterProps } from "../constants";
import { CandidateRow } from "./StepCandidates";
import { Edit, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { MetricCard } from "@/components/patterns/MetricCard";

interface StepPreviewCombinedProps {
    details: Details;
    setDetailStep?: () => void;
    star: QuestionInput[];
    perma: QuestionInput[];
    technical: QuestionInput[];
    candidates: CandidateRow[];
    setCandidateStep?: () => void;
    onBack: () => void;
    onHandleCreate: () => void;
    isLoading: boolean;
    error: string | null;
    StepFooter: React.ComponentType<StepFooterProps>;
}

export function StepPreviewCombined({
    details, setDetailStep,
    star, perma, technical,
    candidates, setCandidateStep,
    onBack, onHandleCreate,
    isLoading, error,
    StepFooter
}: StepPreviewCombinedProps) {

    const activeStar = star.filter(q => q.text.trim());
    const activePerma = perma.filter(q => q.text.trim());
    const activeTechnical = technical.filter(q => q.text.trim());
    const totalQuestions = activeStar.length + activePerma.length + activeTechnical.length;

    return (
        <div className="space-y-10">
            <SectionHeader
                title="Preview & Confirm"
                description="Review the details before generating the invites."
            />

            <div className="grid grid-cols-1 gap-6">
                {/* Job & Questions Summary */}
                <Card className="border-border/50 shadow-raised-1 overflow-hidden">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 px-6 border-b border-border/30 bg-surface-base gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <Badge variant="outline" className="bg-state-info/5 text-state-info border-state-info/20 px-2.5 py-0.5 text-micro font-bold uppercase tracking-wider shrink-0 w-fit">Job Details</Badge>
                            <span className="font-bold text-text-primary truncate tracking-tight">{details.role}</span>
                            <span className="hidden sm:inline text-border">|</span>
                            <span className="text-text-disabled font-mono text-micro sm:text-xs">{details.reqId}</span>
                        </div>
                        {setDetailStep && (
                            <Button variant="ghost" size="sm" onClick={setDetailStep} className="hidden sm:flex h-8 text-text-secondary hover:bg-surface-subtle transition-all">
                                <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <MetricCard
                                title="Behavioral"
                                value={activeStar.length}
                                variant="default"
                            />
                            <MetricCard
                                title="Culture"
                                value={activePerma.length}
                                variant="default"
                            />
                            <MetricCard
                                title="Technical"
                                value={activeTechnical.length}
                                variant="default"
                            />
                        </div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-text-disabled flex items-center gap-2">
                            <div className="h-[1px] flex-1 bg-border/30" />
                            Total {totalQuestions} questions configured
                            <div className="h-[1px] flex-1 bg-border/30" />
                        </div>

                        {setDetailStep && (
                            <Button variant="ghost" size="sm" onClick={setDetailStep} className="sm:hidden w-full h-12 border-2 border-dashed border-border/50 text-text-secondary hover:bg-surface-subtle transition-all mt-2 rounded-xl">
                                <Edit className="w-4 h-4 mr-2" /> Edit Job Details / Questions
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Candidates Summary */}
                <Card className="border-border/50 shadow-raised-1 overflow-hidden">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 px-6 border-b border-border/30 bg-surface-base gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-state-info/5 text-state-info border-state-info/20 px-2.5 py-0.5 text-micro font-bold uppercase tracking-wider shrink-0">Candidates</Badge>
                                <span className="font-bold text-text-primary tracking-tight sm:hidden">{candidates.length} Recipients</span>
                            </div>
                            <span className="hidden sm:inline font-bold text-text-primary tracking-tight">{candidates.length} Recipients</span>
                        </div>
                        {setCandidateStep && (
                            <Button variant="ghost" size="sm" onClick={setCandidateStep} className="hidden sm:flex h-8 text-text-secondary hover:bg-surface-subtle transition-all">
                                <Edit className="w-3.5 h-3.5 mr-2" /> Edit
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {candidates.map((c, i) => (
                                <div key={c.id} className="flex items-center justify-between text-sm p-3 rounded-xl hover:bg-surface-subtle border border-transparent hover:border-border/30 transition-all group animate-in fade-in slide-in-from-top-1 duration-base">
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono text-text-disabled text-micro w-5 text-center px-1.5 py-0.5 bg-surface-base border border-border/20 rounded shadow-flat group-hover:bg-primary/5 group-hover:text-primary transition-colors">{(i + 1).toString().padStart(2, '0')}</span>
                                        <div className="font-bold text-text-primary tracking-tight">{c.firstName} {c.lastName}</div>
                                    </div>
                                    <div className="text-text-secondary font-medium">{c.email}</div>
                                </div>
                            ))}
                        </div>

                        {setCandidateStep && (
                            <Button variant="ghost" size="sm" onClick={setCandidateStep} className="sm:hidden w-full h-12 border-2 border-dashed border-border/50 text-text-secondary hover:bg-surface-subtle transition-all mt-4 rounded-xl">
                                <Edit className="w-4 h-4 mr-2" /> Edit Candidates
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="p-4 bg-state-critical/5 text-state-critical rounded-xl text-sm border border-state-critical/20 font-medium animate-in shake-in duration-base">
                    Error: {error}
                </div>
            )}

            <StepFooter
                onBack={onBack}
                onNext={onHandleCreate}
                nextLabel={isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <><Check className="w-4 h-4 mr-2" /> Generate Invites</>}
                isNextDisabled={isLoading}
            />
        </div>
    );
}
