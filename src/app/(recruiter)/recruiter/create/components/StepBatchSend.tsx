"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ChevronLeft, Copy, CheckCircle2 } from "lucide-react";
import { RecruiterProfile, InviteResult } from "../constants";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { FeedbackCard } from "@/components/patterns/FeedbackCard";
import { FeedbackPill } from "@/components/patterns/FeedbackPill";
import { useState } from "react";

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
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const firstName = recruiterProfile.name ? recruiterProfile.name.split(' ')[0] : "Recruiter";

    const handleCopy = (link: string, id: string) => {
        const performCopy = () => {
            if (navigator?.clipboard?.writeText) {
                return navigator.clipboard.writeText(link);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = link;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback copy failed', err);
                }
                document.body.removeChild(textArea);
                return Promise.resolve();
            }
        };

        performCopy().then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        }).catch(console.error);
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
        <div className="space-y-6 md:space-y-10 animate-in fade-in duration-slow">
            <SectionHeader
                title={
                    <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-8 h-8 text-state-success" />
                        <span className="text-state-success">Invites Generated!</span>
                    </div>
                }
                description="Send the invites to your candidates using the dashboard below."
            />

            <FeedbackCard
                title={`${firstName}, how easy was it to set up the invite?`}
                type="recruiter_friction_invite"
                metadata={{
                    recruiter_email: recruiterProfile.email,
                    role: role,
                    invite_count: results.length
                }}
                className="w-full"
                scaleType="numeric"
                successText=""
                lowLabel="Very difficult"
                highLabel="Very easy"
            />

            <div>
                {/* Action List */}
                <Card className="flex flex-col overflow-hidden border-border/50 shadow-raised-1 bg-surface-subtle/30">
                    <CardHeader className="bg-surface-base border-b border-border/30 py-4 px-6 md:py-5">
                        <CardTitle className="text-xl font-bold text-slate-800 tracking-tight font-display">Send Invites</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                        {results.map((result, idx) => {
                            const mailtoLink = `mailto:${result.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(getBody(result.firstName, result.link))}`;

                            return (
                                <Card key={idx} className="bg-surface-base hover:shadow-raised-2 transition-all duration-base border-border/50 shadow-raised-1 overflow-hidden group animate-in slide-in-from-right-4 ease-emphasized" style={{ animationDelay: `${idx * 100}ms` }}>
                                    <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-base border-b border-border/10">
                                        <div>
                                            <div className="font-bold text-text-primary text-lg tracking-tight">{result.firstName} {result.lastName}</div>
                                            <div className="text-[11px] text-text-disabled font-bold uppercase tracking-wider mt-0.5">{result.email}</div>
                                        </div>
                                        <a href={mailtoLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                                            <Button size="sm" className="w-full sm:w-auto gap-2 shadow-raised-1 transition-all active:scale-95 px-5 font-bold uppercase text-micro tracking-widest h-10 border-b-2 border-primary/20 rounded-2xl !text-white">
                                                <Mail className="w-3.5 h-3.5 font-bold !text-white" />
                                                Send Invite
                                            </Button>
                                        </a>
                                    </div>
                                    <div className="px-5 py-4 flex items-center gap-3 bg-surface-subtle/50">
                                        <div className="text-micro text-text-secondary font-mono bg-surface-base px-3 py-2 rounded-lg border border-border/20 flex-1 truncate shadow-flat group-hover:bg-primary/5 transition-colors">
                                            {result.link}
                                        </div>
                                        <div className="relative">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-text-disabled hover:text-primary hover:bg-primary/10 transition-all rounded-2xl shadow-flat bg-surface-base border border-border/20 shrink-0"
                                                onClick={() => handleCopy(result.link, result.email)}
                                                title="Copy Link"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </Button>
                                            <FeedbackPill isVisible={copiedId === result.email} text="Copied" />
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-4 pt-8 mt-8 border-t border-border/50">
                <div>
                    <Button
                        variant="outline"
                        onClick={onBack}
                        className="w-full sm:w-auto h-12 sm:h-11 shadow-flat rounded-2xl"
                    >
                        <ChevronLeft className="w-4 h-4 mr-2" /> Back
                    </Button>
                </div>
                <Button
                    onClick={resetWizard}
                    className="w-full sm:w-auto h-12 sm:h-11 text-base sm:text-sm font-semibold shadow-raised-1 rounded-2xl"
                >
                    Start New Batch
                </Button>
            </div>
        </div>
    );
}
