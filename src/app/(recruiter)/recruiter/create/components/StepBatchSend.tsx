"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight, Copy } from "lucide-react";
import { RecruiterProfile, InviteResult } from "../constants";
import Image from "next/image";
import { useState } from "react";
import { captureFeedbackAction } from "@/app/actions/feedback";
import { cn } from "@/lib/cn";


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
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold font-display text-emerald-600">Invites Generated!</h2>
                <p className="text-muted-foreground">Send the invites to your candidates using the dashboard below.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
                {/* Column 1: Generic Email Preview */}
                <Card className="flex flex-col overflow-hidden border-slate-200 shadow-sm bg-white">
                    <CardHeader className="bg-slate-50 border-b py-3">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Email Preview</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-8 font-sans text-sm leading-relaxed text-slate-700">
                        <div className="mb-6 pb-4 border-b border-slate-100">
                            <div className="grid grid-cols-[60px_1fr] gap-2 mb-2">
                                <span className="text-slate-400 font-medium font-sans">Subject:</span>
                                <span className="font-semibold text-slate-900 font-sans">{subject}</span>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <p>Hi [Candidate Name],</p>
                            <p>I&apos;d like to invite you to a preliminary interview practice session for the <strong>{role}</strong> role. This interactive session will help us understand your experience better.</p>
                            <p>Please click the button below to start whenever you&apos;re ready:</p>

                            <div className="py-4">
                                <Button className="bg-primary text-white hover:bg-primary/90 pointer-events-none px-6">
                                    Start Interview Session
                                </Button>
                                <div className="text-[10px] text-muted-foreground mt-2 font-mono italic">
                                    Link: https://ready2work.ai/s/example-token
                                </div>
                            </div>

                            <div className="text-slate-600 space-y-1 pt-6 border-t mt-8">
                                <div>Best regards,</div>
                                <div className="font-bold text-slate-800 pt-3">{recruiterProfile.name}</div>
                                <div className="text-slate-500">{recruiterProfile.title || 'Recruiter'}</div>
                                <div className="font-semibold text-primary">{recruiterProfile.company || 'Rangam Consultants Inc.'}</div>
                                <div className="py-2">
                                    <Image
                                        src="/rangam-logo.webp"
                                        alt="Rangam"
                                        width={100}
                                        height={40}
                                        className="h-10 w-auto object-contain"
                                    />
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    <div>M: {recruiterProfile.phone}</div>
                                    <div>E: {recruiterProfile.email}</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Column 2: Action List */}
                <Card className="flex flex-col overflow-hidden border-slate-200 shadow-sm bg-slate-50/50">
                    <CardHeader className="bg-white border-b py-3">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Candidate Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {results.map((result, idx) => {
                            const mailtoLink = `mailto:${result.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getBody(result.firstName, result.link))}`;

                            return (
                                <Card key={idx} className="bg-white hover:shadow-md transition-shadow border-slate-200 shadow-sm overflow-hidden group">
                                    <div className="p-5 flex items-center justify-between bg-white border-b border-slate-50">
                                        <div>
                                            <div className="font-bold text-slate-900 text-base">{result.firstName} {result.lastName}</div>
                                            <div className="text-xs text-slate-500 font-medium">{result.email}</div>
                                        </div>
                                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all active:scale-95 px-4 font-semibold uppercase text-[10px] tracking-widest h-9">
                                                <Mail className="w-3.5 h-3.5" />
                                                Send Invite
                                            </Button>
                                        </a>
                                    </div>
                                    <div className="px-5 py-3 flex items-center gap-3 bg-slate-50/30">
                                        <div className="text-[10px] text-slate-400 font-mono bg-white px-3 py-1.5 rounded border border-slate-100 flex-1 truncate shadow-inner">
                                            {result.link}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
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

            <div className="flex justify-between items-center pt-4 border-t">
                {!isSubmitted ? (
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full md:w-auto">
                        <span className="text-sm font-bold text-slate-500">How easy was sending these invites?</span>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => handleRating(val)}
                                    className={cn(
                                        "w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-sm transition-all",
                                        rating === val
                                            ? "bg-blue-600 border-blue-600 text-white"
                                            : "bg-white border-slate-200 text-slate-400 hover:border-blue-300"
                                    )}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-left-2">
                        Thanks for your feedback!
                    </div>
                )}

                <div className="flex gap-4">
                    <Button variant="outline" onClick={onBack}>
                        <ArrowRight className="w-4 h-4 mr-2 rotate-180" /> Back
                    </Button>
                    <Button onClick={resetWizard} variant="outline" className="text-slate-600">
                        Start New Batch
                    </Button>
                </div>
            </div>
        </div>
    );
}
