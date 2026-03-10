"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Plus } from "lucide-react";
import Image from "next/image";

interface StepEmailProps {
    emailDraft: {
        toFirstName: string;
        toLastName: string;
        toEmail: string;
        cc: string;
        subject: string;
        bodyMessage: string;
    };
    setEmailDraft: React.Dispatch<React.SetStateAction<StepEmailProps['emailDraft']>>;
    recruiterProfile: {
        name: string;
        title: string;
        company: string;
        phone: string;
        email: string;
    };
    editingField: string | null;
    toggleEdit: (field: string) => void;
    inviteLink: string | null;
    onBack: () => void;
    resetWizard: () => void;
}

export function StepEmail({
    emailDraft, setEmailDraft,
    recruiterProfile,
    editingField, toggleEdit,
    inviteLink,
    onBack, resetWizard
}: StepEmailProps) {
    return (
        <div className="space-y-6 font-sans">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold font-display">Step 4: Send Invitation</h2>
                    <p className="text-muted-foreground">Review and customize the invite email.</p>
                </div>
            </div>

            <Card className="overflow-hidden border-t-4 border-t-primary shadow-md">
                <CardContent className="p-0 text-sm">
                    {/* Row 1: Candidate Name */}
                    <div className="grid grid-cols-[80px_1fr_auto] items-center gap-4 p-4 border-b hover:bg-slate-50/50 transition-colors">
                        <span className="font-semibold text-muted-foreground">Name:</span>
                        <div className="flex flex-col md:flex-row gap-2 w-full">
                            {editingField === 'name' ? (
                                <>
                                    <input
                                        className="border rounded px-2 py-1 flex-1 max-w-[150px]"
                                        value={emailDraft.toFirstName}
                                        onChange={e => setEmailDraft({ ...emailDraft, toFirstName: e.target.value })}
                                        placeholder="First"
                                    />
                                    <input
                                        className="border rounded px-2 py-1 flex-1 max-w-[150px]"
                                        value={emailDraft.toLastName}
                                        onChange={e => setEmailDraft({ ...emailDraft, toLastName: e.target.value })}
                                        placeholder="Last"
                                    />
                                </>
                            ) : (
                                <span className="font-medium text-slate-900">{emailDraft.toFirstName} {emailDraft.toLastName}</span>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEdit('name')}
                            className="text-primary h-8 hover:bg-transparent hover:text-primary active:scale-95 transition-all"
                        >
                            {editingField === 'name' ? "Save" : "Edit"}
                        </Button>
                    </div>

                    {/* Row 2: From */}
                    <div className="grid grid-cols-[80px_1fr] items-center gap-4 p-4 border-b bg-slate-50/30">
                        <span className="font-semibold text-muted-foreground">From:</span>
                        <span className="text-slate-700">{recruiterProfile.email}</span>
                    </div>

                    {/* Row 3: To */}
                    <div className="grid grid-cols-[80px_1fr_auto] items-center gap-4 p-4 border-b hover:bg-slate-50/50 transition-colors">
                        <span className="font-semibold text-muted-foreground">To:</span>
                        <div>
                            {editingField === 'to' ? (
                                <input
                                    className="border rounded px-2 py-1 w-full max-w-md"
                                    value={emailDraft.toEmail}
                                    onChange={e => setEmailDraft({ ...emailDraft, toEmail: e.target.value })}
                                />
                            ) : (
                                <span className="text-slate-900">{emailDraft.toEmail}</span>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEdit('to')}
                            className="text-primary h-8 hover:bg-transparent hover:text-primary active:scale-95 transition-all"
                        >
                            {editingField === 'to' ? "Save" : "Edit"}
                        </Button>
                    </div>

                    {/* Row 4: Cc */}
                    <div className="grid grid-cols-[80px_1fr] items-center gap-4 p-4 border-b hover:bg-slate-50/50 transition-colors">
                        <span className="font-semibold text-muted-foreground">Cc:</span>
                        <input
                            className="border-none bg-transparent w-full focus:ring-0 px-0 placeholder:text-muted-foreground/50"
                            value={emailDraft.cc}
                            onChange={e => setEmailDraft({ ...emailDraft, cc: e.target.value })}
                            placeholder="Add Cc..."
                        />
                    </div>

                    {/* Row 5: Subject */}
                    <div className="grid grid-cols-[80px_1fr] items-center gap-4 p-4 border-b hover:bg-slate-50/50 transition-colors">
                        <span className="font-semibold text-muted-foreground">Subject:</span>
                        <input
                            className="font-medium border-none bg-transparent w-full focus:ring-0 px-0"
                            value={emailDraft.subject}
                            onChange={e => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                        />
                    </div>

                    {/* Row 6: Body */}
                    <div className="p-6 bg-white min-h-[400px] flex flex-col gap-6">
                        <textarea
                            className="w-full min-h-[150px] resize-none border-none focus:ring-0 p-0 text-base leading-relaxed text-slate-800"
                            value={emailDraft.bodyMessage}
                            onChange={e => setEmailDraft({ ...emailDraft, bodyMessage: e.target.value })}
                        />

                        <div className="py-2">
                            <a
                                href={inviteLink || "#"}
                                target="_blank"
                                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                                onClick={(e) => e.preventDefault()}
                            >
                                Start Interview Session
                            </a>
                            <div className="text-xs text-muted-foreground mt-2 font-mono bg-slate-50 p-1 rounded inline-block break-all whitespace-normal max-w-full">
                                Link: {inviteLink}
                            </div>
                        </div>

                        <div className="text-slate-600 space-y-1 pt-4 border-t mt-auto">
                            <div>Best regards,</div>
                            <br />
                            <div className="font-bold text-slate-800">{recruiterProfile.name}</div>
                            <div>{recruiterProfile.title}</div>
                            <div className="font-semibold text-primary">{recruiterProfile.company}</div>
                            <div className="py-2">
                                <Image
                                    src="/rangam-logo.webp"
                                    alt="Rangam"
                                    width={120}
                                    height={48}
                                    className="h-12 w-auto object-contain"
                                    style={{ width: 'auto', height: 'auto' }}
                                />
                            </div>
                            <div className="text-xs">
                                <div>M: {recruiterProfile.phone}</div>
                                <div>E: {recruiterProfile.email}</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-4">
                <Button variant="outline" onClick={onBack} className="flex-1">Back</Button>
                <Button
                    className="flex-[2] gap-2"
                    onClick={() => {
                        window.location.href = `mailto:${emailDraft.toEmail}?cc=${emailDraft.cc}&subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.bodyMessage + `\n\nLink: ${inviteLink}\n\nBest regards,\n${recruiterProfile.name}`)}`;
                    }}
                >
                    <Send className="w-4 h-4" /> Open in Email Client
                </Button>
            </div>
            <Button variant="outline" onClick={resetWizard} className="w-full mt-4">
                <Plus className="w-4 h-4 mr-2" /> Create Another
            </Button>
        </div>
    );
}
