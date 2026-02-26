"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, ChevronRight, UserPlus } from "lucide-react";
import { StepFooterProps } from "../constants";
import { showDemoTools } from "@/lib/feature-flags";

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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold font-display">Step 2: Add Candidates</h2>
                    <p className="text-muted-foreground">Enter the details for one or more candidates.</p>
                </div>
                {isDemo && onRandomizeCandidate && (
                    <button
                        onClick={onRandomizeCandidate}
                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors border border-violet-200"
                    >
                        🎲 Add Random
                    </button>
                )}
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                    <CardTitle className="text-base font-semibold">Candidate List</CardTitle>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={addCandidate}
                        className="text-emerald-600 border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Candidate
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {candidates.length === 0 && (
                        <div className="text-center py-8 text-slate-400 border-2 border-dashed rounded-lg bg-slate-50">
                            No candidates added yet. Click &quot;Add Candidate&quot; to start.
                        </div>
                    )}

                    {candidates.map((candidate, index) => (
                        <div key={candidate.id} className="flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="pt-3 text-xs font-bold text-slate-400 w-6 text-center">
                                #{index + 1}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                                <input
                                    className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                    value={candidate.firstName}
                                    onChange={(e) => updateCandidate(candidate.id, 'firstName', e.target.value)}
                                    placeholder="First Name"
                                />
                                <input
                                    className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                    value={candidate.lastName}
                                    onChange={(e) => updateCandidate(candidate.id, 'lastName', e.target.value)}
                                    placeholder="Last Name"
                                />
                                <input
                                    className="flex h-10 w-full rounded-md border bg-muted/50 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                                    value={candidate.email}
                                    onChange={(e) => updateCandidate(candidate.id, 'email', e.target.value)}
                                    placeholder="Email Address"
                                    type="email"
                                />
                                {isDemo && (
                                    <input
                                        className="flex h-10 w-full rounded-md border bg-violet-50/50 dark:bg-violet-900/10 px-3 placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400 text-xs md:col-span-3"
                                        value={candidate.resumeText || ''}
                                        onChange={(e) => updateCandidate(candidate.id, 'resumeText', e.target.value)}
                                        placeholder="📋 Paste resume text (dev only)"
                                    />
                                )}
                            </div>
                            <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive shrink-0 mt-1 hover:bg-red-50"
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
                            className="w-full border-2 border-dashed border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-600 mt-2"
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
