'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Loader2, SendHorizontal } from 'lucide-react';
import Image from 'next/image';

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
    onSend?: () => void;
    isSending?: boolean;
}

export const InviteEmailPreviewModal: React.FC<InviteEmailPreviewModalProps> = ({
    isOpen,
    onClose,
    data,
    onSend,
    isSending = false
}) => {
    if (!isOpen) return null;

    const fromEmail = "Rangam Interview Coach <interviews@coach.rangam.com>";
    const to = data.recipientEmails.length === 1 ? data.recipientEmails[0] : "";
    const bcc = data.recipientEmails.length > 1 ? data.recipientEmails.join(', ') : "";
    const cc = data.recruiterEmail || "";
    const subject = `Interview Invitation: ${data.role || 'Role'}`;
    const currentYear = new Date().getFullYear();

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl bg-surface-base rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[90vh] md:h-auto md:max-h-[85vh]"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-border/30 flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm bg-surface-base/90">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-bold text-text-primary tracking-tight">Preview & Send</h3>
                        </div>

                        <div className="flex items-center gap-6">
                            <p className="hidden md:block text-[11px] font-medium text-text-secondary max-w-[240px] leading-tight text-left italic">
                                Verify invite details. Click <strong>Send</strong> or <strong>Cancel</strong> to edit.
                            </p>
                            
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-subtle rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onSend}
                                    disabled={isSending}
                                    className="px-6 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                                >
                                    {isSending ? <Loader2 size={14} className="animate-spin" /> : <SendHorizontal size={14} />}
                                    {isSending ? "Sending..." : "Send"}
                                </button>
                                <div className="w-[1px] h-6 bg-border/30 mx-1" />
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-surface-muted rounded-full transition-colors flex items-center justify-center"
                                >
                                    <X size={20} className="text-text-disabled hover:text-text-secondary" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Metadata Header (Gmail style) */}
                    <div className="px-8 py-6 space-y-3 bg-surface-subtle/30 border-b border-border/30">
                        <div className="flex flex-wrap gap-y-2">
                            <span className="w-16 text-xs font-bold text-text-disabled">From:</span>
                            <span className="text-xs text-text-secondary truncate">{fromEmail}</span>
                        </div>
                        <div className="flex flex-wrap gap-y-2">
                            <span className="w-16 text-xs font-bold text-text-disabled">To:</span>
                            <span className="text-xs text-text-secondary italic">
                                {to || (data.recipientEmails.length > 1 ? "(BCC used for batch)" : "Pending...")}
                            </span>
                        </div>
                        {cc && (
                            <div className="flex flex-wrap gap-y-2">
                                <span className="w-16 text-xs font-bold text-text-disabled">Cc:</span>
                                <span className="text-xs text-text-secondary">{cc}</span>
                            </div>
                        )}
                        {bcc && (
                            <div className="flex flex-wrap gap-y-2">
                                <span className="w-16 text-xs font-bold text-text-disabled">Bcc:</span>
                                <span className="text-xs text-text-secondary truncate max-w-md">{bcc}</span>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-y-2 pt-2">
                            <span className="w-16 text-xs font-bold text-text-disabled">Subject:</span>
                            <span className="text-sm font-bold text-text-primary">{subject}</span>
                        </div>
                    </div>

                    {/* Email Content Container */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-surface-subtle/50 p-4 md:p-8">
                        <div className="max-w-[600px] mx-auto bg-surface-base shadow-sm rounded-xl overflow-hidden border border-border/50">
                            {/* Logo Row */}
                            <div className="p-8 pb-0">
                                <Image 
                                    src="/rangam-logo.png" 
                                    alt="Rangam" 
                                    width={160} 
                                    height={40} 
                                    className="opacity-100 h-auto" 
                                />
                            </div>

                            {/* Body */}
                            <div className="p-8 pt-6 space-y-6">
                                <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                                    Interview Invitation: {data.role || '[Role]'}
                                </h1>

                                <p className="text-base text-slate-600 leading-relaxed">
                                    Hi {data.recipientFirstName || 'Candidate'},
                                </p>

                                <p className="text-base text-slate-600 leading-relaxed">
                                    I&apos;d like to invite you to a preliminary interview practice session for the <strong>{data.role || '[Role]'}</strong> role. This interactive session will help us understand your experience better.
                                </p>

                                <p className="text-base text-slate-600 leading-relaxed">
                                    Please click the button below to start whenever you&apos;re ready:
                                </p>

                                <div className="py-4">
                                    <div className="inline-block bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-base shadow-lg shadow-blue-200">
                                        Start My Practice Session
                                    </div>
                                </div>

                                <hr className="border-slate-100" />

                                {/* Signature Block */}
                                <div className="pt-2 text-sm text-slate-600 leading-relaxed">
                                    <p className="font-bold text-slate-900 m-0">{data.recruiterName || 'Recruiter Name'}</p>
                                    <p className="m-0">{data.recruiterTitle || 'Recruiter'}</p>
                                    <p className="m-0">{data.recruiterCompany || 'Rangam Consultants Inc.'}</p>
                                    {data.recruiterPhone && <p className="m-0 mt-1">M: {data.recruiterPhone}</p>}
                                    {data.recruiterEmail && <p className="m-0">E: {data.recruiterEmail}</p>}
                                    
                                    <div className="mt-4">
                                        <Image 
                                            src="/rangam-logo.png" 
                                            alt="Rangam" 
                                            width={100} 
                                            height={25} 
                                            className="opacity-100 h-auto" 
                                        />
                                    </div>
                                </div>

                                <p className="text-[10px] text-slate-400 pt-8">
                                    &copy; {currentYear} Rangam. All rights reserved.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Disclaimer */}
                    <div className="px-8 py-4 bg-surface-subtle border-t border-border/30 flex items-center gap-2">
                        <ShieldCheck size={14} className="text-state-success" />
                        <p className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">
                            Secure automated delivery via Resend
                        </p>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
