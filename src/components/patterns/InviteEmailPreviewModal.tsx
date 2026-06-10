'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Loader2, SendHorizontal, CheckCircle2, LayoutDashboard, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { AlertPanel } from '@/components/patterns/AlertPanel';
import { FeedbackChoiceButton } from '@/components/patterns/FeedbackChoiceButton';
import { FeedbackPill } from '@/components/patterns/FeedbackPill';
import { captureFeedbackAction } from '@/app/actions/feedback';
import { useAccessibleDialog } from '@/lib/hooks/use-accessible-dialog';
import { getPilotSupportLine, pilotRollout } from '@/lib/config/pilot-rollout';
import { normalizeRecruiterSignature } from '@/lib/recruiter-signature';

interface InviteEmailPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: {
        recipientEmails: string[];
        recipientFirstName: string;
        role: string;
        inviteLink: string;
        recruiterName: string;
        recruiterTitle?: string;
        recruiterCompany?: string;
        recruiterPhone?: string;
        recruiterEmail?: string;
    };
    onSend: () => void;
    isSending?: boolean;
    sendSuccess?: boolean;
    errorMessage?: string | null;
    onNewInvite?: () => void;
    onDashboard?: () => void;
    successPrimaryLabel?: string;
    successPrimaryIcon?: React.ReactNode;
    successSecondaryLabel?: string;
    successSecondaryIcon?: React.ReactNode;
    showSuccessFeedbackPrompt?: boolean;
    disableSend?: boolean;
    tourMode?: boolean;
}

export const InviteEmailPreviewModal: React.FC<InviteEmailPreviewModalProps> = ({
    isOpen,
    onClose,
    data,
    onSend,
    isSending = false,
    sendSuccess = false,
    errorMessage,
    onNewInvite,
    onDashboard,
    successPrimaryLabel = "Start New Invite",
    successPrimaryIcon = <PlusCircle size={20} />,
    successSecondaryLabel = "Go to Dashboard",
    successSecondaryIcon = <LayoutDashboard size={20} />,
    showSuccessFeedbackPrompt = true,
    disableSend = false,
    tourMode = false,
}) => {
    const fromEmail = "Rangam Interview Coach <interviews@coach.rangam.com>";
    const fromEmailMobile = "interviews@coach.rangam.com";
    const pilotSupportLine = getPilotSupportLine();
    const recruiterSignature = normalizeRecruiterSignature({
        name: data.recruiterName,
        title: data.recruiterTitle,
        company: data.recruiterCompany,
        phone: data.recruiterPhone,
        email: data.recruiterEmail,
    });
    const to = data.recipientEmails.length === 1 ? data.recipientEmails[0] : "";
    const bcc = data.recipientEmails.length > 1 ? data.recipientEmails.join(', ') : "";
    const cc = data.recruiterEmail || "";
    const subject = `Practice Interview Invitation: ${data.role || 'Role'}`;
    const currentYear = new Date().getFullYear();
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const successPrimaryButtonRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const feedbackResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const titleId = useId();
    const descriptionId = useId();
    const [inviteEaseRating, setInviteEaseRating] = useState<number | null>(null);
    const [savedRating, setSavedRating] = useState<number | null>(null);
    const [feedbackError, setFeedbackError] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    useEffect(() => {
        return () => {
            if (feedbackResetTimeoutRef.current) {
                clearTimeout(feedbackResetTimeoutRef.current);
            }
        };
    }, []);

    useAccessibleDialog({
        isOpen,
        containerRef: dialogRef,
        initialFocusRef: sendSuccess ? successPrimaryButtonRef : closeButtonRef,
        onClose,
    });

    const handleInviteEaseFeedback = async (rating: number) => {
        setInviteEaseRating(rating);
        setSavedRating(null);
        setFeedbackError(null);

        const result = await captureFeedbackAction({
            type: 'recruiter_friction_invite',
            rating,
            metadata: {
                role: data.role,
                invite_count: data.recipientEmails.length,
                recruiter_email: data.recruiterEmail,
            },
        });

        if (!result.success) {
            setFeedbackError("We couldn't save that response right now.");
            return;
        }

        setSavedRating(rating);
        if (feedbackResetTimeoutRef.current) {
            clearTimeout(feedbackResetTimeoutRef.current);
        }
        feedbackResetTimeoutRef.current = setTimeout(() => setSavedRating(null), 2000);
    };

    if (!isMounted) {
        return null;
    }

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div 
                    className={cn(
                        "fixed inset-0 z-[100] flex justify-center p-4 md:p-8",
                        tourMode && !sendSuccess
                            ? "items-end pt-40 md:items-center md:pt-8"
                            : "items-center"
                    )}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    aria-describedby={descriptionId}
                >
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 glass-overlay"
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        ref={dialogRef}
                        className={cn(
                            "relative w-full overflow-hidden bg-surface-base border flex flex-col",
                            sendSuccess
                                ? "max-w-md h-auto border-border shadow-floating rounded-3xl"
                                : tourMode
                                  ? "max-w-5xl h-[calc(100vh-11rem)] md:h-[90vh] border-border/50 shadow-2xl rounded-[32px]"
                                  : "max-w-5xl h-[90vh] border-border/50 shadow-2xl rounded-[32px]"
                        )}
                        data-tour-step-id="tour-recruiter-create-preview-modal"
                        tabIndex={-1}
                    >
                        {sendSuccess ? (
                                <div className="p-12 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in duration-500">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-800 ring-4 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/10">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <h2 id={titleId} className="text-4xl font-black text-text-primary">Delivered!</h2>
                                    </div>

                                    {showSuccessFeedbackPrompt && (
                                        <div id={descriptionId} className="w-full max-w-sm space-y-4">
                                            <p className="text-sm font-semibold text-text-secondary">
                                                How easy was it to set up this interview?
                                            </p>
                                            <div className="flex items-center justify-center gap-2">
                                                {[1, 2, 3, 4, 5].map((value) => (
                                                    <div key={value} className="relative">
                                                        <FeedbackChoiceButton
                                                            onClick={() => handleInviteEaseFeedback(value)}
                                                            kind="compact"
                                                            tone="primary"
                                                            selected={inviteEaseRating === value}
                                                            className={cn(
                                                                "min-w-10 justify-center px-0",
                                                                inviteEaseRating === value
                                                                    ? "border-state-info bg-state-info text-primary-foreground shadow-md"
                                                                    : "border-border bg-surface-base text-sky-800 hover:border-sky-300 hover:bg-sky-50 dark:text-sky-200 dark:hover:bg-sky-500/10"
                                                            )}
                                                            aria-label={`Rate invite setup ease ${value} out of 5`}
                                                        >
                                                            {value}
                                                        </FeedbackChoiceButton>
                                                        <FeedbackPill isVisible={savedRating === value} text="" />
                                                    </div>
                                                ))}
                                            </div>
                                            {feedbackError && (
                                                <AlertPanel tone="critical" size="sm" className="justify-center bg-state-critical/10 text-left">
                                                    {feedbackError}
                                                </AlertPanel>
                                            )}
                                        </div>
                                    )}

                                    <div className="w-full space-y-3 pt-2">
                                        <Button
                                            ref={successPrimaryButtonRef}
                                            onClick={onNewInvite}
                                            autoFocus
                                            emphasis="primary"
                                            density="hero"
                                            shape="app"
                                            label="strong"
                                            className="w-full gap-3"
                                        >
                                            {successPrimaryIcon}
                                            {successPrimaryLabel}
                                        </Button>
                                        <Button
                                            onClick={onDashboard}
                                            emphasis="secondary"
                                            density="hero"
                                            shape="app"
                                            label="strong"
                                            className="w-full gap-3 border-border/30"
                                        >
                                            {successSecondaryIcon}
                                            {successSecondaryLabel}
                                        </Button>
                                    </div>
                            </div>
                        ) : (
                            <>
                                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/30 bg-surface-base/90 px-6 py-3 backdrop-blur-sm">
                                    <div id={descriptionId} className="space-y-1">
                                        <p className="text-left text-[13px] font-medium leading-tight text-text-secondary">
                                            Verify email details.
                                        </p>
                                        {pilotRollout.enabled && (
                                            <p className="text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                                                Pilot rollout copy
                                            </p>
                                        )}
                                    </div>
                                    
                                    <div className="ml-auto flex items-center gap-2">
                                        <Button
                                            ref={closeButtonRef}
                                            onClick={onClose}
                                            autoFocus
                                            emphasis="secondary"
                                            density="compact"
                                            shape="square"
                                            label="strong"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={onSend}
                                            disabled={disableSend || isSending || data.recipientEmails.length === 0}
                                            emphasis="primary"
                                            density="compact"
                                            shape="square"
                                            label="strong"
                                            className="gap-2 disabled:scale-100"
                                        >
                                            {isSending ? <Loader2 size={14} className="animate-spin" /> : <SendHorizontal size={14} />}
                                            {disableSend ? "Send Disabled During Tour" : isSending ? "Sending..." : "Send"}
                                        </Button>
                                        <div className="mx-1 hidden h-6 w-[1px] bg-border/30 md:block" />
                                        <Button
                                            onClick={onClose}
                                            variant="ghost"
                                            size="icon"
                                            shape="pill"
                                            className="hidden md:inline-flex"
                                            aria-label="Close invite preview"
                                        >
                                            <X size={20} className="text-text-disabled hover:text-text-secondary" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-surface-subtle/20 custom-scrollbar">
                                    {errorMessage && (
                                        <div className="px-8 pt-6">
                                            <AlertPanel tone="critical" weight="semibold" className="bg-state-critical/10" role="alert" aria-live="assertive">
                                                {errorMessage}
                                            </AlertPanel>
                                        </div>
                                    )}
                                    <div className="px-8 py-6 space-y-3 bg-surface-base border-b border-border/30">
                                        <div className="flex flex-wrap gap-y-1">
                                            <span className="w-16 text-[11px] font-bold text-text-disabled uppercase tracking-wider">From:</span>
                                            <span className="text-[11px] text-text-secondary md:hidden">{fromEmailMobile}</span>
                                            <span className="hidden truncate text-[11px] text-text-secondary md:inline">{fromEmail}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-y-1">
                                            <span className="w-16 text-[11px] font-bold text-text-disabled uppercase tracking-wider">To:</span>
                                            <span className="text-[11px] text-text-secondary">
                                                {to || (data.recipientEmails.length > 1 ? `Batch Invite (${data.recipientEmails.length} recipients)` : "Recipient Email")}
                                            </span>
                                        </div>
                                        {cc && (
                                            <div className="flex flex-wrap gap-y-1">
                                                <span className="w-16 text-[11px] font-bold text-text-disabled uppercase tracking-wider">Cc:</span>
                                                <span className="text-[11px] text-text-secondary">{cc}</span>
                                            </div>
                                        )}
                                        {bcc && (
                                            <div className="flex flex-wrap gap-y-1">
                                                <span className="w-16 text-[11px] font-bold text-text-disabled uppercase tracking-wider">Bcc:</span>
                                                <span className="text-[11px] text-text-secondary truncate max-w-md">{bcc}</span>
                                            </div>
                                        )}
                                        <div className="flex flex-wrap gap-y-1 pt-1">
                                            <span className="w-16 text-[11px] font-bold text-text-disabled uppercase tracking-wider">Subject:</span>
                                            <span className="text-xs font-bold text-text-primary">{subject}</span>
                                        </div>
                                    </div>

                                    <div className="p-4 md:p-12">
                                        <div className="max-w-[600px] mx-auto bg-white shadow-card-1 rounded-2xl overflow-hidden border border-border/10">
                                            <div className="px-10 py-10 pb-6">
                                                <Image 
                                                    src="/TA-logo.png" 
                                                    alt="Rangam" 
                                                    width={140} 
                                                    height={36} 
                                                    className="h-9 w-auto" 
                                                    style={{ width: "auto", height: "36px" }}
                                                    unoptimized
                                                />
                                            </div>

                                            <div className="px-10 pb-12 space-y-6">
                                                <h1 id={titleId} className="text-2xl font-bold text-text-primary leading-[1.15]">
                                                    Practice Interview Invitation: {data.role}
                                                </h1>
                                                
                                                <div className="space-y-4 text-text-secondary">
                                                    <p className="text-[15px] font-medium">
                                                        Hi {data.recipientFirstName || 'Candidate'},
                                                    </p>
                                                    <p className="text-[15px] leading-relaxed font-medium">
                                                        I&apos;d like to invite you to a guided interview practice session for the <strong>{data.role}</strong> role. Your practice responses help us tailor how we support your preparation during the selection process.
                                                    </p>
                                                    <p className="text-[15px] leading-relaxed font-medium">
                                                        Please click the button below to start whenever you&apos;re ready:
                                                    </p>
                                                </div>

                                                <div className="py-6">
                                                    <div className="inline-block bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-[15px] shadow-raised-1">
                                                        Start My Practice Session
                                                    </div>
                                                </div>

                                                {pilotRollout.enabled && (
                                                    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-5 text-sky-950">
                                                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
                                                            Pilot Notice
                                                        </p>
                                                        <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-slate-700">
                                                            <p>
                                                                This invitation is part of a limited pilot rollout of Rangam&apos;s interview practice experience. It is intended for practice and product testing, not as a standalone hiring or assessment tool.
                                                            </p>
                                                            <p>
                                                                Spoken or written responses may be transcribed and reviewed by the recruiting team to support candidate preparation. All AI coaching feedback remains visible only to the candidate.
                                                            </p>
                                                            <p>
                                                                Questions about this pilot can be directed to {pilotSupportLine}.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="pt-6 border-t border-border/50 flex flex-col gap-0.5">
                                                    <p className="text-sm font-bold text-text-primary">{recruiterSignature.name}</p>
                                                    <p className="text-xs font-semibold text-text-secondary">{recruiterSignature.title}</p>
                                                    <p className="text-xs font-semibold text-text-secondary">{recruiterSignature.company}</p>
                                                    {(recruiterSignature.phone || recruiterSignature.email) && (
                                                        <div className="pt-2 text-[11px] font-semibold text-text-disabled font-mono">
                                                            {recruiterSignature.phone && <span className="block">M: {recruiterSignature.phone}</span>}
                                                            {recruiterSignature.email && <span className="block">E: {recruiterSignature.email}</span>}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="pt-4">
                                                        <Image 
                                                            src="/TA-logo.png" 
                                                            alt="Rangam" 
                                                            width={80} 
                                                            height={20} 
                                                            className="h-5 w-auto" 
                                                            style={{ width: "auto", height: "20px" }}
                                                            unoptimized
                                                        />
                                                    </div>
                                                </div>

                                                <p className="text-[10px] text-text-disabled font-medium pt-8">
                                                    &copy; {currentYear} Rangam. All rights reserved.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-8 py-4 bg-surface-subtle/50 border-t border-border/30 flex items-center gap-2">
                                    <ShieldCheck size={14} className="text-emerald-700 dark:text-emerald-300" />
                                    <div className="space-y-1">
                                        <span className="block text-[10px] font-bold text-text-disabled uppercase tracking-widest">
                                            Secure automated delivery
                                        </span>
                                        {pilotRollout.enabled && (
                                            <span className="block text-[11px] text-text-secondary">
                                                Internal pilot note: this tool does not deliver assessment data. Any sourcing or selection decision remains solely the recruiter&apos;s responsibility.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    , document.body);
};
