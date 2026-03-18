'use client';

import React, { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Loader2, SendHorizontal, CheckCircle2, LayoutDashboard, PlusCircle } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/cn';

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
    onDashboard
}) => {
    const fromEmail = "Rangam Interview Coach <interviews@coach.rangam.com>";
    const to = data.recipientEmails.length === 1 ? data.recipientEmails[0] : "";
    const bcc = data.recipientEmails.length > 1 ? data.recipientEmails.join(', ') : "";
    const cc = data.recruiterEmail || "";
    const subject = `Interview Invitation: ${data.role || 'Role'}`;
    const currentYear = new Date().getFullYear();
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const successPrimaryButtonRef = useRef<HTMLButtonElement>(null);
    const lastFocusedElementRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!isOpen) {
            lastFocusedElementRef.current?.focus();
            return;
        }

        lastFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusTarget = sendSuccess ? successPrimaryButtonRef.current : closeButtonRef.current;
        focusTarget?.focus();
    }, [isOpen, sendSuccess]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
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
                        className={cn(
                            "relative w-full overflow-hidden bg-surface-base border border-border/50 shadow-2xl rounded-[32px] flex flex-col",
                            sendSuccess ? "max-w-md h-auto" : "max-w-5xl h-[90vh]"
                        )}
                    >
                        {sendSuccess ? (
                                <div className="p-12 flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in duration-500">
                                    <div className="w-20 h-20 rounded-full bg-state-success/10 flex items-center justify-center text-state-success ring-8 ring-state-success/5">
                                        <CheckCircle2 size={40} />
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <h2 id={titleId} className="text-4xl font-black text-text-primary">Delivered!</h2>
                                        <p id={descriptionId} className="text-sm font-medium text-text-secondary leading-relaxed max-w-[280px] mx-auto">
                                            Your invitations have been sent successfully.
                                        </p>
                                    </div>

                                    <div className="w-full space-y-3 pt-4">
                                        <button
                                            ref={successPrimaryButtonRef}
                                            onClick={onNewInvite}
                                            className="w-full h-14 bg-primary text-primary-foreground font-bold rounded-2xl shadow-raised-1 hover:shadow-raised-2 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                        >
                                        <PlusCircle size={20} />
                                        Start New Invite
                                    </button>
                                    <button
                                        onClick={onDashboard}
                                        className="w-full h-14 bg-surface-subtle text-text-primary font-bold rounded-2xl border border-border/30 hover:bg-surface-muted transition-all flex items-center justify-center gap-3"
                                    >
                                        <LayoutDashboard size={20} />
                                        Go to Dashboard
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm bg-surface-base/90">
                                    <p id={descriptionId} className="text-[13px] font-medium text-text-secondary leading-tight text-left">
                                        Verify and click <strong>Send</strong> or <strong>Cancel</strong> to edit.
                                    </p>
                                    
                                    <div className="flex items-center gap-2">
                                        <button
                                            ref={closeButtonRef}
                                            onClick={onClose}
                                            className="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-subtle rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={onSend}
                                            disabled={isSending || data.recipientEmails.length === 0}
                                            className="px-6 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-raised-1 hover:shadow-raised-2 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                                        >
                                            {isSending ? <Loader2 size={14} className="animate-spin" /> : <SendHorizontal size={14} />}
                                            {isSending ? "Sending..." : "Send"}
                                        </button>
                                        <div className="w-[1px] h-6 bg-border/30 mx-1" />
                                        <button
                                            onClick={onClose}
                                            className="p-2 hover:bg-surface-muted rounded-full transition-colors flex items-center justify-center"
                                            aria-label="Close invite preview"
                                        >
                                            <X size={20} className="text-text-disabled hover:text-text-secondary" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-surface-subtle/20 custom-scrollbar">
                                    {errorMessage && (
                                        <div className="px-8 pt-6">
                                            <div
                                                className="rounded-2xl border border-state-critical/20 bg-state-critical/10 px-4 py-3 text-sm font-semibold text-state-critical"
                                                role="alert"
                                                aria-live="assertive"
                                            >
                                                {errorMessage}
                                            </div>
                                        </div>
                                    )}
                                    <div className="px-8 py-6 space-y-3 bg-surface-base border-b border-border/30">
                                        <div className="flex flex-wrap gap-y-1">
                                            <span className="w-16 text-[11px] font-bold text-text-disabled uppercase tracking-wider">From:</span>
                                            <span className="text-[11px] text-text-secondary truncate">{fromEmail}</span>
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
                                                    src="/rangam-logo.png" 
                                                    alt="Rangam" 
                                                    width={140} 
                                                    height={36} 
                                                    className="h-9 w-auto" 
                                                />
                                            </div>

                                            <div className="px-10 pb-12 space-y-6">
                                                <h1 id={titleId} className="text-2xl font-bold text-text-primary leading-[1.15]">
                                                    Interview Invitation: {data.role}
                                                </h1>
                                                
                                                <div className="space-y-4 text-text-secondary">
                                                    <p className="text-[15px] font-medium">
                                                        Hi {data.recipientFirstName || 'Candidate'},
                                                    </p>
                                                    <p className="text-[15px] leading-relaxed font-medium">
                                                        I&apos;d like to invite you to a preliminary interview practice session for the <strong>{data.role}</strong> role. This interactive session will help us understand your experience better.
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

                                                <div className="pt-6 border-t border-border/50 flex flex-col gap-0.5">
                                                    <p className="text-sm font-bold text-text-primary">{data.recruiterName}</p>
                                                    <p className="text-xs font-semibold text-text-secondary">{data.recruiterTitle}</p>
                                                    <p className="text-xs font-semibold text-text-secondary">{data.recruiterCompany}</p>
                                                    {(data.recruiterPhone || data.recruiterEmail) && (
                                                        <div className="pt-2 text-[11px] font-semibold text-text-disabled font-mono">
                                                            {data.recruiterPhone && <span className="block">M: {data.recruiterPhone}</span>}
                                                            {data.recruiterEmail && <span className="block">E: {data.recruiterEmail}</span>}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="pt-4">
                                                        <Image 
                                                            src="/rangam-logo.png" 
                                                            alt="Rangam" 
                                                            width={80} 
                                                            height={20} 
                                                            className="h-5 w-auto" 
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
                                    <ShieldCheck size={14} className="text-state-success" />
                                    <span className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">
                                        Secure automated delivery via Resend
                                    </span>
                                </div>
                            </>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
