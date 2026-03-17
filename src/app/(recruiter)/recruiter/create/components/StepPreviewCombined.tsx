"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Details, QuestionInput, InviteResult, RecruiterProfile } from "../constants";
import { CandidateRow } from "./StepCandidates";
import { ChevronLeft, Edit, Eye, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { InviteEmailPreviewModal } from "@/components/patterns/InviteEmailPreviewModal";

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
    isGenerated?: boolean;
    results: InviteResult[];
    error: string | null;
    recruiterProfile: RecruiterProfile;
    onNewInvite: () => void;
    onDashboard: () => void;
}

export function StepPreviewCombined({
    details, setDetailStep,
    star, perma, technical,
    candidates, setCandidateStep,
    onBack, onHandleCreate,
    isLoading, isGenerated = false,
    results,
    error,
    recruiterProfile,
    onNewInvite,
    onDashboard
}: StepPreviewCombinedProps) {
    const [localIsGenerated, setLocalIsGenerated] = useState(isGenerated);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [hasUserManuallyClosed, setHasUserManuallyClosed] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);

    const activeStar = star.filter(q => q.text.trim());
    const activePerma = perma.filter(q => q.text.trim());
    const activeTechnical = technical.filter(q => q.text.trim());

    useEffect(() => {
        if (isGenerated && !localIsGenerated) {
            setLocalIsGenerated(true);
        }
    }, [isGenerated, localIsGenerated]);

    const handleAction = async () => {
        if (!isGenerated) {
            setHasUserManuallyClosed(false); // Reset on new attempt if needed
            await onHandleCreate();
        } else {
            setHasUserManuallyClosed(false); // Reset so it can be opened manually
            setIsPreviewOpen(true);
        }
    };

    useEffect(() => {
        // Only auto-open if results exist, generation finished, it's not already open, 
        // we haven't successfully sent yet, AND the user hasn't manually closed it.
        if (isGenerated && isLoading === false && !isPreviewOpen && !sendSuccess && !hasUserManuallyClosed) {
            setIsPreviewOpen(true);
        }
    }, [isGenerated, isLoading, isPreviewOpen, sendSuccess, hasUserManuallyClosed]);

    const handleSendAll = async () => {
        if (!results.length) return;
        setIsSending(true);
        try {
            // Send individually to ensure personalized tokens and greeting
            const sendPromises = results.map(async (result) => {
                const response = await fetch('/api/invite/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipientEmail: result.email,
                        recipientFirstName: result.firstName,
                        role: details.role,
                        inviteLink: result.link,
                        recruiterName: recruiterProfile.name,
                        recruiterTitle: recruiterProfile.title,
                        recruiterCompany: recruiterProfile.company,
                        recruiterPhone: recruiterProfile.phone,
                        recruiterEmail: recruiterProfile.email,
                        sessionIds: [result.id]
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to send invite to ${result.email}`);
                }
                return response.json();
            });

            await Promise.all(sendPromises);
            setSendSuccess(true);
        } catch (err) {
            console.error("Failed to send invites:", err);
            // In a production app, we might want to track which ones failed
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-slow">
            <SectionHeader
                title="Confirm Details & Invite"
                description="Finalize your job requirements and candidate list. Once generated, you can preview and send the invitations."
            />

            <Card className="border-border/50 shadow-raised-2 overflow-hidden bg-surface-base">
                <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
                        {/* Left Column: Job Details */}
                        <div className="p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-base font-bold text-text-primary font-sans flex items-center gap-2.5">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        Job Details
                                    </h3>
                                </div>
                                {setDetailStep && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={setDetailStep} 
                                        className="h-9 px-4 text-primary hover:bg-brand-glass-start hover:text-primary font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95"
                                    >
                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <p className="text-micro font-bold uppercase tracking-wider text-text-secondary ml-1">Role</p>
                                    <p className="text-sm font-bold text-text-primary font-sans">{details.role || "Not Specified"}</p>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-micro font-bold uppercase tracking-wider text-text-secondary ml-1">Req ID</p>
                                    <p className="text-sm font-bold text-text-primary font-sans">{details.reqId || "N/A"}</p>
                                </div>

                                <div className="pt-2 space-y-3">
                                    <p className="text-micro font-bold uppercase tracking-wider text-text-secondary ml-1 mb-2 flex items-center gap-2">
                                        Configuration
                                    </p>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'Behavioral', count: activeStar.length },
                                            { label: 'Culture', count: activePerma.length },
                                            { label: 'Technical', count: activeTechnical.length }
                                        ].map((cat, i) => (
                                            <div key={i} className={cn(
                                                "flex items-center gap-4 transition-all duration-300",
                                                cat.count > 0 ? "text-text-primary" : "text-text-disabled opacity-60"
                                            )}>
                                                <span className={cn(
                                                    "text-sm font-bold min-w-[12px] text-left",
                                                    cat.count > 0 ? "text-primary" : "text-text-disabled"
                                                )}>
                                                    {cat.count}
                                                </span>
                                                <span className="text-sm font-bold font-sans">{cat.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Candidates */}
                        <div className="p-8 space-y-8 bg-surface-subtle/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-base font-bold text-text-primary font-sans flex items-center gap-2.5">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        Candidates
                                    </h3>
                                </div>
                                {setCandidateStep && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={setCandidateStep} 
                                        className="h-9 px-4 text-primary hover:bg-brand-glass-start hover:text-primary font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95"
                                    >
                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
                                {candidates.map((c, i) => (
                                    <div key={c.id} className="group flex items-center justify-between transition-all duration-300 animate-in slide-in-from-right-4" style={{ animationDelay: `${i * 50}ms` }}>
                                        <div className="flex items-center gap-4">
                                            <div className="text-xs font-bold text-text-disabled min-w-[12px] text-left group-hover:text-primary transition-colors">
                                                {i + 1}
                                            </div>
                                            <div className="text-sm font-bold text-text-primary font-sans">{c.firstName} {c.lastName}</div>
                                        </div>
                                        <div className="text-xs font-medium text-text-secondary font-mono bg-surface-subtle/80 px-2 py-1 rounded-lg truncate max-w-[160px] md:max-w-none">
                                            {c.email}
                                        </div>
                                    </div>
                                ))}
                                {candidates.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border/50 rounded-3xl text-text-disabled space-y-2">
                                        <p className="font-bold text-sm uppercase">No candidates added</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {error && (
                <div className="p-4 bg-state-critical/10 text-state-critical rounded-2xl text-sm border border-state-critical/20 font-bold flex items-center gap-3 animate-in shake-in">
                    <div className="w-8 h-8 rounded-xl bg-state-critical/20 flex items-center justify-center shrink-0">
                        <X size={16} />
                    </div>
                    {error}
                </div>
            )}

            <div className="mt-8 pt-8 border-t border-border/30">
                <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-4 w-full">
                    <div>
                        <Button
                            variant="outline"
                            onClick={onBack}
                            className="w-full sm:w-auto h-12 sm:h-11 shadow-flat rounded-2xl"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                    </div>

                    <div className="relative w-full sm:w-auto">
                        <Button
                            onClick={handleAction}
                            disabled={isLoading || isSending || sendSuccess}
                            className="w-full sm:w-auto h-12 sm:h-11 text-base sm:text-sm font-semibold shadow-raised-1 rounded-2xl transition-all flex items-center gap-3"
                        >
                            {(isLoading || isSending) ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <Eye size={18} />
                            )}
                            {(isLoading || isSending) ? (isLoading ? "Generating..." : "Sending...") : "Preview & Send"}
                        </Button>
                    </div>
                </div>
            </div>

            {recruiterProfile && (
                <InviteEmailPreviewModal 
                    isOpen={isPreviewOpen}
                    onClose={() => {
                        setIsPreviewOpen(false);
                        setHasUserManuallyClosed(true);
                    }}
                    data={{
                        recipientEmails: candidates.length > 0 ? candidates.map(c => c.email) : results.map(r => r.email),
                        recipientFirstName: candidates.length === 1 ? candidates[0].firstName : (results.length === 1 ? results[0].firstName : "Candidate"),
                        role: details.role,
                        inviteLink: results.length > 0 ? results[0].link : "",
                        recruiterName: recruiterProfile.name,
                        recruiterTitle: recruiterProfile.title,
                        recruiterCompany: recruiterProfile.company,
                        recruiterPhone: recruiterProfile.phone,
                        recruiterEmail: recruiterProfile.email
                    }}
                    onSend={handleSendAll}
                    isSending={isSending}
                    sendSuccess={sendSuccess}
                    onNewInvite={onNewInvite}
                    onDashboard={onDashboard}
                />
            )}
        </div>
    );
}
