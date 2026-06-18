import { Clock, ListChecks, ShieldCheck } from "lucide-react";

import { CandidateSessionStartButton } from "./CandidateSessionStartButton";
import { getInterviewStageLabel, QUESTION_PLAN_CATEGORY_ORDER, type QuestionPlan } from "@/lib/server/services/question-plan-service";

const QUESTION_PLAN_CATEGORY_LABELS: Record<keyof QuestionPlan["categoryCounts"], string> = {
    screening: "Screening",
    behavioral: "Behavioral",
    culture_fit: "Culture / Fit",
    case_scenario: "Case / Scenario",
    technical_role_specific: "Technical / Role-Specific",
};

type CandidateSessionEntryScreenProps = {
    role: string;
    sessionId: string;
    firstQuestion: {
        id: string;
        text: string;
    } | null;
    questionPlanSnapshot?: QuestionPlan | null;
    startAction: () => Promise<void>;
};

export function CandidateSessionEntryScreen({
    role,
    sessionId,
    firstQuestion,
    questionPlanSnapshot,
    startAction,
}: CandidateSessionEntryScreenProps) {
    const plannedCategories = questionPlanSnapshot
        ? QUESTION_PLAN_CATEGORY_ORDER
            .map((category) => ({
                category,
                count: questionPlanSnapshot.categoryCounts[category] ?? 0,
                label: QUESTION_PLAN_CATEGORY_LABELS[category],
            }))
            .filter((item) => item.count > 0)
        : [];

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

                {questionPlanSnapshot ? (
                    <section className="rounded-2xl border border-state-info/20 bg-state-info/10 p-5 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-state-info/25 bg-surface-base text-state-info shadow-flat">
                                <ListChecks className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="space-y-1">
                                    <p className="text-xs font-black uppercase tracking-[0.18em] text-state-info">
                                        Your practice plan
                                    </p>
                                    <h2 className="font-bold text-text-primary">
                                        {questionPlanSnapshot.questionCount} questions - {getInterviewStageLabel(questionPlanSnapshot.interviewStage)}
                                    </h2>
                                </div>
                                {plannedCategories.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {plannedCategories.map((item) => (
                                            <span
                                                key={item.category}
                                                className="rounded-full border border-state-info/20 bg-surface-base px-3 py-1 text-xs font-bold text-text-secondary"
                                            >
                                                {item.label}: {item.count}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </section>
                ) : null}

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
                                Your answers are used to provide coaching and may be saved for session continuity,
                                summaries, and your own review. They are protected by access controls and are not
                                shared with recruiters or employers for hiring decisions.
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
