"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Details, InviteBatchSummary, InviteFailure, QuestionInput, InviteResult, RecruiterProfile } from "../constants";
import { CandidateRow } from "./StepCandidates";
import { AlertTriangle, ChevronLeft, Edit, Eye, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";
import { InviteEmailPreviewModal } from "@/components/patterns/InviteEmailPreviewModal";
import { AlertPanel } from "@/components/patterns/AlertPanel";

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
    failures: InviteFailure[];
    summary: InviteBatchSummary | null;
    error: string | null;
    recruiterProfile: RecruiterProfile;
    onNewInvite: () => void;
    onDashboard: () => void;
    forcedPreviewOpen?: boolean;
    disableSend?: boolean;
    isTourLocked?: boolean;
}

export function StepPreviewCombined({
    details, setDetailStep,
    star, perma, technical,
    candidates, setCandidateStep,
    onBack, onHandleCreate,
    isLoading, isGenerated = false,
    results,
    failures,
    summary,
    error,
    recruiterProfile,
    onNewInvite,
    onDashboard,
    forcedPreviewOpen = false,
    disableSend = false,
    isTourLocked = false,
}: StepPreviewCombinedProps) {
    const [localIsGenerated, setLocalIsGenerated] = useState(isGenerated);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [hasUserManuallyClosed, setHasUserManuallyClosed] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    const activeStar = star.filter(q => q.text.trim());
    const activePerma = perma.filter(q => q.text.trim());
    const activeTechnical = technical.filter(q => q.text.trim());

    useEffect(() => {
        if (isGenerated && !localIsGenerated) {
            setLocalIsGenerated(true);
        }
    }, [isGenerated, localIsGenerated]);

    const handleAction = async () => {
        setSendError(null);
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
        if (!results.length) {
            setSendError("No generated invites are available to send yet.");
            return;
        }

        setIsSending(true);
        setSendError(null);
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
                    const errorBody = await response.json().catch(() => null);
                    throw new Error(
                        errorBody?.message ||
                        errorBody?.error ||
                        `Failed to send invite to ${result.email}`
                    );
                }
                return response.json();
            });

            await Promise.all(sendPromises);
            setSendSuccess(true);
        } catch (err) {
            console.error("Failed to send invites:", err);
            setSendError(err instanceof Error ? err.message : "Failed to send invites.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-slow" data-tour-step-id="tour-recruiter-create-preview">
            <SectionHeader
                title="Confirm Details & Invite"
                description="Finalize your job requirements and candidate list. Once generated, you can preview and send the invitations."
            />

            <Card className="border-border/50 shadow-raised-1 overflow-hidden bg-surface-base">
                <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                        {/* Left Column: Job Details */}
                        <div className="flex-1 p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-base font-bold text-text-primary font-sans flex items-center gap-2.5">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        Job Details
                                    </h3>
                                </div>
                                {setDetailStep && (
                                    <Button 
                                        emphasis="tertiary"
                                        density="compact"
                                        shape="square"
                                        label="strong"
                                        onClick={setDetailStep} 
                                        disabled={isTourLocked}
                                        className="text-primary hover:bg-brand-glass-start hover:text-primary"
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

                        <div
                            aria-hidden="true"
                            className="mx-6 h-3 rounded-full bg-surface-subtle/80 border border-border/40 md:mx-0 md:my-6 md:h-auto md:w-3 md:self-stretch"
                        />

                        {/* Right Column: Candidates */}
                        <div className="flex-1 p-8 space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-base font-bold text-text-primary font-sans flex items-center gap-2.5">
                                        <div className="w-1 h-4 bg-primary rounded-full" />
                                        Candidates
                                    </h3>
                                </div>
                                {setCandidateStep && (
                                    <Button 
                                        emphasis="tertiary"
                                        density="compact"
                                        shape="square"
                                        label="strong"
                                        onClick={setCandidateStep} 
                                        disabled={isTourLocked}
                                        className="text-primary hover:bg-brand-glass-start hover:text-primary"
                                    >
                                        <Edit className="w-4 h-4 mr-2" /> Edit
                                    </Button>
                                )}
                            </div>

                            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                                {candidates.map((c, i) => (
                                    <div
                                        key={c.id}
                                        className="group grid grid-cols-[20px_minmax(0,1fr)] gap-3 transition-all duration-300 animate-in slide-in-from-right-4"
                                        style={{ animationDelay: `${i * 50}ms` }}
                                    >
                                        <div className="pt-1 text-xs font-bold text-text-disabled text-left group-hover:text-primary transition-colors">
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 items-center justify-between gap-3 md:gap-4">
                                                <div className="min-w-0 shrink-0">
                                                    <div className="text-sm font-bold text-text-primary font-sans truncate">
                                                        {c.firstName} {c.lastName}
                                                    </div>
                                                </div>
                                                <div className="min-w-0 flex-1 text-right">
                                                    <div className="inline-block max-w-full rounded-lg bg-surface-subtle/80 px-3 py-1.5 font-mono text-xs font-medium text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis md:max-w-[24rem] lg:max-w-[28rem] xl:max-w-[32rem]">
                                                        {c.email}
                                                    </div>
                                                </div>
                                            </div>
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
                <AlertPanel
                    tone="critical"
                    weight="semibold"
                    className="animate-in shake-in bg-state-critical/10"
                    icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-state-critical/20"><X size={16} /></div>}
                    role="alert"
                    aria-live="assertive"
                >
                    {error}
                </AlertPanel>
            )}

            {summary?.hasFailures && failures.length > 0 && (
                <AlertPanel
                    tone="warning"
                    weight="semibold"
                    className="animate-in fade-in-50"
                    icon={<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-state-warning/20"><AlertTriangle size={16} /></div>}
                    role="status"
                    aria-live="polite"
                >
                    <div className="space-y-2">
                        <p>
                            {summary.succeeded} of {summary.requested} invites were created. {summary.failed} candidate{summary.failed === 1 ? "" : "s"} need{summary.failed === 1 ? "s" : ""} follow-up before sending.
                        </p>
                        <p className="text-xs font-medium text-text-secondary">
                            Failed: {failures.map((failure) => failure.email).join(", ")}
                        </p>
                    </div>
                </AlertPanel>
            )}

            <div className="mt-8 pt-8 border-t border-border/30">
                <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-4 w-full">
                    <div>
                        <Button
                            emphasis="secondary"
                            density="comfortable"
                            shape="app"
                            label="strong"
                            onClick={onBack}
                            disabled={isTourLocked}
                            className="w-full sm:w-auto"
                        >
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                    </div>

                    <div className="relative w-full sm:w-auto">
                        <Button
                            onClick={handleAction}
                            disabled={isLoading || isSending || sendSuccess || isTourLocked}
                            emphasis="primary"
                            density="comfortable"
                            shape="app"
                            label="strong"
                            className="w-full sm:w-auto gap-3"
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
                    isOpen={isPreviewOpen || forcedPreviewOpen}
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
                    onSend={disableSend ? () => undefined : handleSendAll}
                    isSending={isSending}
                    sendSuccess={sendSuccess}
                    errorMessage={sendError}
                    onNewInvite={onNewInvite}
                    onDashboard={onDashboard}
                    disableSend={disableSend}
                    tourMode={isTourLocked && forcedPreviewOpen}
                />
            )}
        </div>
    );
}
