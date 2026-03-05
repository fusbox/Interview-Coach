"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, Copy, CheckCircle2 } from "lucide-react";
import { RecruiterProfile, InviteResult } from "../constants";
import Image from "next/image";
import { useState } from "react";
import { captureFeedbackAction } from "@/app/actions/feedback";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/patterns/SectionHeader";


interface StepBatchSendProps {
    results: InviteResult[];
    role: string;
    recruiterProfile: RecruiterProfile;
    onBack: () => void;
    resetWizard: () => void;
}

export function StepBatchSend({
    results,
    role,
    recruiterProfile,
    onBack,
    resetWizard
}: StepBatchSendProps) {
    const [rating, setRating] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleRating = async (r: number) => {
        setRating(r);
        setIsSubmitted(true);
        try {
            await captureFeedbackAction({
                type: 'recruiter_friction_invite',
                rating: r,
                metadata: {
                    recruiter_email: recruiterProfile.email,
                    role: role,
                    invite_count: results.length
                }
            });
        } catch (err) {
            console.error('Failed to capture recruiter feedback', err);
        }
    };

    const subject = `Interview Invitation: ${role}`;
    const getBody = (firstName: string, link: string) =>
        `Hi ${firstName},

I'd like to invite you to a preliminary interview practice session for the ${role} role. This interactive session will help us understand your experience better.

Please click the button below to start whenever you're ready:
${link}

Best regards,

${recruiterProfile.name}
${recruiterProfile.title || 'Recruiter'}
${recruiterProfile.company || 'Rangam Consultants Inc.'}

M: ${recruiterProfile.phone}
E: ${recruiterProfile.email}`;

    return (
        <div className="space-y-10 animate-in fade-in duration-slow">
            <SectionHeader
                title={
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-state-success" />
                        <span className="text-state-success">Invites Generated!</span>
                    </div>
                }
                description="Send the invites to your candidates using the dashboard below."
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
                {/* Column 1: Generic Email Preview */}
                <Card className="flex flex-col overflow-hidden border-border/50 shadow-raised-1 bg-surface-base">
                    <CardHeader className="bg-surface-subtle/50 border-b border-border/30 py-3 px-6">
                        <CardTitle className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">Email Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-8 font-sans text-sm leading-relaxed text-text-secondary">
                        <div className="mb-8 pb-4 border-b border-border/30">
                            <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                                <span className="text-text-disabled font-bold uppercase text-[10px] tracking-wider pt-1">Subject:</span>
                                <span className="font-bold text-text-primary text-base tracking-tight">{subject}</span>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <p>Hi [Candidate Name],</p>
                            <p>I&apos;d like to invite you to a preliminary interview practice session for the <strong className="text-text-primary font-bold">{role}</strong> role. This interactive session will help us understand your experience better.</p>
                            <p>Please click the button below to start whenever you&apos;re ready:</p>

                            <div className="py-6 flex flex-col items-center sm:items-start group">
                                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 pointer-events-none px-8 py-6 rounded-xl shadow-raised-1 font-bold tracking-tight">
                                    Start Interview Session
                                </Button>
                                <div className="text-[10px] text-text-disabled mt-4 font-mono italic bg-surface-subtle px-3 py-1.5 rounded-lg border border-border/20">
                                    Link: https://ready2work.ai/s/example-token
                                </div>
                            </div>

                            <div className="text-text-secondary space-y-1.5 pt-8 border-t border-border/30 mt-10">
                                <div className="text-xs text-text-disabled font-medium">Best regards,</div>
                                <div className="font-bold text-text-primary text-base tracking-tight pt-2">{recruiterProfile.name}</div>
                                <div className="text-xs font-medium text-text-secondary">{recruiterProfile.title || 'Recruiter'}</div>
                                <div className="font-bold text-primary tracking-tight">{recruiterProfile.company || 'Rangam Consultants Inc.'}</div>
                                <div className="py-4">
                                    <Image
                                        src="/rangam-logo.webp"
                                        alt="Rangam"
                                        width={100}
                                        height={36}
                                        className="h-9 w-auto object-contain opacity-80"
                                    />
                                </div>
                                <div className="text-[11px] text-text-disabled font-medium space-y-0.5 pt-2 border-t border-border/10">
                                    <div className="flex items-center gap-2"><span className="w-3 text-center inline-block">M:</span> {recruiterProfile.phone}</div>
                                    <div className="flex items-center gap-2"><span className="w-3 text-center inline-block">E:</span> {recruiterProfile.email}</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Column 2: Action List */}
                <Card className="flex flex-col overflow-hidden border-border/50 shadow-raised-1 bg-surface-subtle/30">
                    <CardHeader className="bg-surface-base border-b border-border/30 py-3 px-6">
                        <CardTitle className="text-[10px] font-bold text-text-disabled uppercase tracking-widest">Candidate Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {results.map((result, idx) => {
                            const mailtoLink = `mailto:${result.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getBody(result.firstName, result.link))}`;

                            return (
                                <Card key={idx} className="bg-surface-base hover:shadow-raised-2 transition-all duration-base border-border/50 shadow-raised-1 overflow-hidden group animate-in slide-in-from-right-4 ease-emphasized" style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className="p-5 flex items-center justify-between bg-surface-base border-b border-border/10">
                                        <div>
                                            <div className="font-bold text-text-primary text-lg tracking-tight">{result.firstName} {result.lastName}</div>
                                            <div className="text-[11px] text-text-disabled font-bold uppercase tracking-wider mt-0.5">{result.email}</div>
                                        </div>
                                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" className="gap-2 bg-state-info text-white shadow-raised-1 transition-all active:scale-95 px-5 font-bold uppercase text-[10px] tracking-widest h-10 border-b-2 border-state-info/20">
                                                <Mail className="w-3.5 h-3.5" />
                                                Send Invite
                                            </Button>
                                        </a>
                                    </div>
                                    <div className="px-5 py-4 flex items-center gap-3 bg-surface-subtle/50">
                                        <div className="text-[10px] text-text-secondary font-mono bg-surface-base px-3 py-2 rounded-lg border border-border/20 flex-1 truncate shadow-flat group-hover:bg-primary/5 transition-colors">
                                            {result.link}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-text-disabled hover:text-primary hover:bg-primary/10 transition-all rounded-xl shadow-flat bg-surface-base border border-border/20"
                                            onClick={() => navigator.clipboard.writeText(result.link)}
                                            title="Copy Link"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-6 pt-10 border-t border-border/50">
                {!isSubmitted ? (
                    <div className="flex flex-col md:flex-row items-center gap-5 bg-surface-subtle p-5 rounded-3xl border border-border/30 shadow-flat w-full md:w-auto">
                        <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">How easy was it?</span>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => handleRating(val)}
                                    className={cn(
                                        "w-11 h-11 rounded-xl border flex items-center justify-center font-bold text-sm transition-all duration-base shadow-flat",
                                        rating === val
                                            ? "bg-primary border-primary text-primary-foreground scale-110 shadow-raised-1"
                                            : "bg-surface-base border-border text-text-disabled hover:border-primary/50 hover:text-primary"
                                    )}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 text-sm font-bold text-state-success bg-state-success/5 px-6 py-4 rounded-3xl border border-state-success/20 animate-in fade-in slide-in-from-left-4 shadow-flat">
                        <CheckCircle2 className="w-5 h-5" />
                        Thanks for your feedback!
                    </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 sm:pt-0">
                    <Button variant="ghost" onClick={onBack} className="h-12 sm:h-11 px-6 font-bold uppercase text-[10px] tracking-widest text-text-disabled hover:text-text-primary transition-all">
                        <ArrowRight className="w-4 h-4 mr-2 rotate-180" /> Back to Preview
                    </Button>
                    <Button onClick={resetWizard} variant="outline" className="h-12 sm:h-11 px-6 font-bold uppercase text-[10px] tracking-widest border-border/50 shadow-flat hover:bg-surface-subtle transition-all">
                        Start New Batch
                    </Button>
                </div>
            </div>
        </div>
    );
}
