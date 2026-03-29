"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronRight, UserPlus } from "lucide-react";
import { StepFooterProps } from "../constants";
import { showDemoTools } from "@/lib/feature-flags";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { EmptyState } from "@/components/patterns/EmptyState";
import { textFieldClassName } from "@/components/patterns/FormField";

export interface CandidateRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    resumeText?: string;
}

interface StepCandidatesProps {
    candidates: CandidateRow[];
    setCandidates: (c: CandidateRow[]) => void;
    onBack: () => void;
    onNext: () => void;
    onRandomizeCandidate?: () => void;
    StepFooter: React.ComponentType<StepFooterProps>;
}

export function StepCandidates({
    candidates,
    setCandidates,
    onBack,
    onNext,
    onRandomizeCandidate,
    StepFooter
}: StepCandidatesProps) {
    const isDemo = showDemoTools();

    const addCandidate = () => {
        setCandidates([
            ...candidates,
            { id: `cand-${Date.now()}`, firstName: "", lastName: "", email: "" }
        ]);
    };

    const removeCandidate = (id: string) => {
        setCandidates(candidates.filter(c => c.id !== id));
    };

    const updateCandidate = (id: string, field: keyof CandidateRow, value: string) => {
        setCandidates(candidates.map(c =>
            c.id === id ? { ...c, [field]: value } : c
        ));
    };

    const isValid = candidates.every(c =>
        c.firstName.trim() && c.lastName.trim() && c.email.trim() && c.email.includes("@")
    ) && candidates.length > 0;

    return (
        <div className="space-y-10">
            <SectionHeader
                title="Add Candidates"
                description="Enter the details for one or more candidates."
                actions={
                    isDemo && onRandomizeCandidate && (
                        <Button
                            onClick={onRandomizeCandidate}
                            emphasis="secondary"
                            density="compact"
                            shape="pill"
                            label="chrome"
                            className="border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200 dark:hover:bg-sky-500/25"
                        >
                            Add Random
                        </Button>
                    )
                }
            />

            <Card className="overflow-hidden rounded-[1.5rem] border-border/50 shadow-raised-1">
                <CardHeader className="flex flex-row items-center justify-between border-b border-border/30 bg-surface-base py-5">
                    <CardTitle className="flex items-center gap-2.5 font-sans text-base font-bold">
                        <div className="h-4 w-1 rounded-full bg-primary" />
                        Candidate List
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {candidates.length === 0 && (
                        <div className="py-8">
                            <EmptyState
                                title="No candidates yet"
                                description="Click the button below to start adding candidates to this batch."
                                icon={<UserPlus className="h-10 w-10 text-muted-foreground/40" />}
                            />
                        </div>
                    )}

                    {candidates.map((candidate, index) => (
                        <div key={candidate.id} className="animate-in slide-in-from-top-2 flex items-start gap-1 md:gap-3 duration-200 fade-in">
                            <div className="w-4 pt-3 text-center text-[10px] font-bold text-text-disabled md:w-6 md:text-xs">
                                #{index + 1}
                            </div>
                            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
                                <input
                                    id={`${candidate.id}-first-name`}
                                    name={`candidate-${candidate.id}-first-name`}
                                    className={`${textFieldClassName} h-11 py-0`}
                                    value={candidate.firstName}
                                    onChange={(e) => updateCandidate(candidate.id, "firstName", e.target.value)}
                                    placeholder="First Name"
                                />
                                <input
                                    id={`${candidate.id}-last-name`}
                                    name={`candidate-${candidate.id}-last-name`}
                                    className={`${textFieldClassName} h-11 py-0`}
                                    value={candidate.lastName}
                                    onChange={(e) => updateCandidate(candidate.id, "lastName", e.target.value)}
                                    placeholder="Last Name"
                                />
                                <input
                                    id={`${candidate.id}-email`}
                                    name={`candidate-${candidate.id}-email`}
                                    className={`${textFieldClassName} h-11 py-0`}
                                    value={candidate.email}
                                    onChange={(e) => updateCandidate(candidate.id, "email", e.target.value)}
                                    placeholder="Email Address"
                                    type="email"
                                />
                                <input
                                    id={`${candidate.id}-resume-text`}
                                    name={`candidate-${candidate.id}-resume-text`}
                                    className={`${textFieldClassName} h-11 py-0 md:col-span-3`}
                                    value={candidate.resumeText || ""}
                                    onChange={(e) => updateCandidate(candidate.id, "resumeText", e.target.value)}
                                    placeholder="Paste resume text (optional)"
                                />
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                shape="square"
                                className="-mr-2 mt-1 h-8 w-8 shrink-0 rounded-lg px-0 text-destructive hover:bg-rose-50 dark:hover:bg-rose-500/10 md:mr-0 md:h-10 md:w-10 md:rounded-xl"
                                onClick={() => removeCandidate(candidate.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}

                    <Button
                        emphasis="secondary"
                        density="hero"
                        shape="app"
                        label="strong"
                        onClick={addCandidate}
                        className="mt-4 w-full gap-2 text-emerald-800 border-emerald-400 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-900 dark:text-emerald-200 dark:border-emerald-400/50 dark:hover:bg-emerald-500/10"
                    >
                        <UserPlus className="h-4 w-4" />
                        Add Candidate
                    </Button>
                </CardContent>
            </Card>

            <StepFooter
                onBack={onBack}
                onNext={onNext}
                nextLabel={<>Next: Preview <ChevronRight className="ml-2 h-4 w-4" /></>}
                isNextDisabled={!isValid}
            />
        </div>
    );
}
