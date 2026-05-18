import { Clock, ShieldCheck } from "lucide-react";

import { CandidateSessionStartButton } from "./CandidateSessionStartButton";

type CandidateSessionEntryScreenProps = {
    role: string;
    sessionId: string;
    firstQuestion: {
        id: string;
        text: string;
    } | null;
    startAction: () => Promise<void>;
};

export function CandidateSessionEntryScreen({
    role,
    sessionId,
    firstQuestion,
    startAction,
}: CandidateSessionEntryScreenProps) {
    return (
        <div className="relative flex w-full flex-1 flex-col bg-gradient-to-br from-brand-glass-start to-brand-glass-end text-foreground">
            <div className="pointer-events-none absolute inset-0 bg-surface-base/40 backdrop-blur-md" />
            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-1 flex-col space-y-6 px-6 py-6 md:min-h-full md:py-8">
                <div className="space-y-4 text-left">
                    <h1 className="font-display text-2xl font-bold leading-tight text-primary md:text-3xl">
                        Let&apos;s get you ready for your interview.
                    </h1>
                    <p className="text-lg leading-relaxed text-text-secondary">
                        You&apos;ll answer a series of interview-style questions tailored to your target role:{" "}
                        <strong className="font-bold text-text-primary">{role}</strong>.
                    </p>
                </div>

                <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-surface-base p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-state-info/20 bg-state-info/10 text-state-info shadow-flat">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="font-bold text-text-primary">No Time Limit</h2>
                            <p className="text-sm leading-relaxed text-text-secondary">
                                Take your time. Thoughtful answers lead to better feedback.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-purple-100 bg-purple-50 text-purple-600 shadow-flat">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="font-bold text-text-primary">Private Coaching Feedback</h2>
                            <p className="text-sm leading-relaxed text-text-secondary">
                                This space is for skill-building, not evaluation.
                            </p>
                        </div>
                    </div>
                </div>

                <form action={startAction} className="mt-auto pb-8 pt-4">
                    <CandidateSessionStartButton sessionId={sessionId} firstQuestion={firstQuestion} />
                </form>
            </div>
        </div>
    );
}
