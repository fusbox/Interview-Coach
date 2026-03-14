"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronRight, UserPlus } from "lucide-react";
import { StepFooterProps } from "../constants";
import { showDemoTools } from "@/lib/feature-flags";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { EmptyState } from "@/components/patterns/EmptyState";

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
    onRandomizeCandidate?: () => void; // Dev helper
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

    // Validation: Check if all candidates have filled fields
    const isValid = candidates.every(c =>
        c.firstName.trim() && c.lastName.trim() && c.email.trim() && c.email.includes('@')
    ) && candidates.length > 0;

    return (
        <div className="space-y-10">
            <SectionHeader
                title="Add Candidates"
                description="Enter the details for one or more candidates."
                actions={
                    isDemo && onRandomizeCandidate && (
                        <button
                            onClick={onRandomizeCandidate}
                            className="px-3 py-1.5 text-micro font-bold uppercase tracking-wider rounded-full bg-state-info/10 text-state-info hover:bg-state-info/20 transition-all border border-state-info/20 shadow-sm"
                        >
                            🎲 Add Random
                        </button>
                    )
                }
            />

            <Card className="border-border/50 shadow-raised-1">
                <CardHeader className="flex flex-row items-center justify-between py-5 border-b border-border/30 bg-surface-base">
                    <CardTitle className="text-base font-bold tracking-tight">Candidate List</CardTitle>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={addCandidate}
                        className="text-state-success border-state-success/30 hover:bg-state-success/5 hover:border-state-success/50 transition-all rounded-2xl"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Candidate
                    </Button>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    {candidates.length === 0 && (
                        <div className="py-8">
                            <EmptyState
                                title="No candidates yet"
                                description="Click the button above to start adding candidates to this batch."
                                icon={<UserPlus className="w-10 h-10 text-muted-foreground/40" />}
                            />
                        </div>
                    )}

                    {candidates.map((candidate, index) => (
                        <div key={candidate.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="pt-3 text-xs font-bold text-text-disabled w-6 text-center">
                                #{index + 1}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                                <input
                                    className="flex h-11 w-full rounded-xl border border-border bg-surface-subtle px-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={candidate.firstName}
                                    onChange={(e) => updateCandidate(candidate.id, 'firstName', e.target.value)}
                                    placeholder="First Name"
                                />
                                <input
                                    className="flex h-11 w-full rounded-xl border border-border bg-surface-subtle px-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={candidate.lastName}
                                    onChange={(e) => updateCandidate(candidate.id, 'lastName', e.target.value)}
                                    placeholder="Last Name"
                                />
                                <input
                                    className="flex h-11 w-full rounded-xl border border-border bg-surface-subtle px-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    value={candidate.email}
                                    onChange={(e) => updateCandidate(candidate.id, 'email', e.target.value)}
                                    placeholder="Email Address"
                                    type="email"
                                />
                                <input
                                    className="flex h-11 w-full rounded-xl border border-border bg-surface-subtle px-4 text-sm placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all md:col-span-3"
                                    value={candidate.resumeText || ''}
                                    onChange={(e) => updateCandidate(candidate.id, 'resumeText', e.target.value)}
                                    placeholder="Paste resume text (optional)"
                                />
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive shrink-0 mt-1 hover:bg-state-critical/5"
                                onClick={() => removeCandidate(candidate.id)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}

                    {candidates.length > 0 && (
                        <Button
                            variant="ghost"
                            onClick={addCandidate}
                            className="w-full border-2 border-dashed border-border/50 text-text-disabled hover:text-text-secondary hover:bg-surface-subtle hover:border-border transition-all mt-4 py-8 rounded-2xl"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Add Another Candidate
                        </Button>
                    )}
                </CardContent>
            </Card>

            <StepFooter
                onBack={onBack}
                onNext={onNext}
                nextLabel={<>Next: Preview <ChevronRight className="ml-2 w-4 h-4" /></>}
                isNextDisabled={!isValid}
            />
        </div>
    );
}
