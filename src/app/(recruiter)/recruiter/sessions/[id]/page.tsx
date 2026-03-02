
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCachedUser } from "@/lib/supabase/server";
import { InterviewSession } from "@/lib/domain/types";

const sessionRepo = new SupabaseSessionRepository();

export const dynamic = 'force-dynamic';

function getReadinessIndicator(session: InterviewSession) {
    const { status, answers, questions, viewedAt, enteredInitials } = session;
    const answerList = Object.values(answers || {});
    const answerCount = answerList.length;
    const submittedCount = answerList.filter(a => !!a.submittedAt).length;
    const questionCount = questions.length;

    const commonClasses = "w-[145px] justify-center text-center";

    // 1. Completed
    if (status === 'COMPLETED' || (submittedCount === questionCount && questionCount > 0)) {
        return <Badge variant="default" className={`${commonClasses} bg-green-600 hover:bg-green-700`}>Completed</Badge>;
    }

    // 2. In Progress (X/Y submitted)
    if (submittedCount > 0) {
        return <Badge variant="secondary" className={`${commonClasses} bg-blue-100 text-blue-800`}>
            In Progress ({submittedCount}/{questionCount})
        </Badge>;
    }

    // 3. Drafting Answer
    if (status === 'IN_SESSION' && answerCount > 0) {
        return <Badge variant="secondary" className={`${commonClasses} bg-indigo-100 text-indigo-800 border-indigo-200`}>
            Drafting Answer
        </Badge>;
    }

    // 4. Session Started
    if (status === 'IN_SESSION') {
        return <Badge variant="secondary" className={`${commonClasses} bg-blue-50 text-blue-700 border-blue-100`}>
            Session Started
        </Badge>;
    }

    // 5. Initials Entered
    if (enteredInitials) {
        return <Badge variant="outline" className={`${commonClasses} text-amber-600 border-amber-200 bg-amber-50`}>
            Initials Entered
        </Badge>;
    }

    // 6. Link Viewed
    if (viewedAt) {
        return <Badge variant="outline" className={`${commonClasses} text-indigo-500 border-indigo-200`}>
            Link Viewed
        </Badge>;
    }

    // 7. Invite Sent
    return <Badge variant="outline" className={`${commonClasses} text-slate-400 border-slate-200 uppercase text-[10px]`}>
        Invite Sent
    </Badge>;
}

function getReadinessBadge(session: InterviewSession) {
    const rl = session.readinessBand;
    if (!rl) return null;

    const commonClasses = "w-[145px] justify-center text-center text-[10px] uppercase font-bold tracking-tight";

    switch (rl) {
        case 'RL1':
            return <Badge variant="outline" className={`${commonClasses} text-emerald-700 border-emerald-200 bg-emerald-50`}>Ready</Badge>;
        case 'RL2':
            return <Badge variant="outline" className={`${commonClasses} text-blue-700 border-blue-200 bg-blue-50`}>Strong Potential</Badge>;
        case 'RL3':
            return <Badge variant="outline" className={`${commonClasses} text-amber-700 border-amber-200 bg-amber-50`}>Practice Recommended</Badge>;
        case 'RL4':
            return <Badge variant="outline" className={`${commonClasses} text-slate-500 border-slate-200 bg-slate-50`}>Incomplete</Badge>;
        default:
            return <Badge variant="outline" className={`${commonClasses} text-slate-400 border-slate-200`}>Analyzing...</Badge>;
    }
}

export default async function SessionDetailsPage({ params }: { params: { id: string } }) {
    const user = await getCachedUser();
    if (!user) redirect("/login");

    const session = await sessionRepo.get(params.id);

    if (!session) {
        notFound();
    }

    // Verify Ownership
    if (session.recruiterId !== user.id) {
        // If the session exists but doesn't belong to this recruiter, return 404
        // to prevent leaking existence of sessions.
        notFound();
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                    <Link href="/recruiter">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">Session Details</h1>
                    <p className="text-slate-500">Review candidate performance and feedback.</p>
                </div>
            </div>

            {/* Summary Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Candidate Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Candidate</div>
                            <div className="text-lg font-semibold text-slate-900">{session.candidateName || "Anonymous"}</div>
                            <div className="text-sm text-slate-500">{session.candidate?.email || "No email provided"}</div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Target Role</div>
                            <div className="text-lg font-semibold text-slate-900">{session.role}</div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Active Engagement</div>
                            <div className="text-lg font-semibold text-blue-600">
                                {(() => {
                                    const seconds = session.engagedTimeSeconds || 0;
                                    const h = Math.floor(seconds / 3600);
                                    const m = Math.floor((seconds % 3600) / 60);
                                    const s = seconds % 60;
                                    if (h > 0) return `${h}h ${m}m`;
                                    if (m > 0) return `${m}m ${s}s`;
                                    return `${s}s`;
                                })()}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500 mb-1">Status & Readiness</div>
                            <div className="flex flex-col gap-2 mt-1">
                                <div className="flex items-center gap-2">
                                    {getReadinessIndicator(session)}
                                    {getReadinessBadge(session)}
                                </div>
                                {session.summaryNarrative && (
                                    <p className="text-xs text-slate-500 italic leading-relaxed max-w-xs">
                                        &ldquo;{session.summaryNarrative}&rdquo;
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Questions & Answers */}
            <div className="space-y-6">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">Question Analysis</h2>

                {session.questions.map((question, index) => {
                    const answer = session.answers[question.id];
                    const hasAnswer = !!answer;
                    const hasAnalysis = !!answer?.analysis;

                    // Safe access for analysis properties
                    const analysis = answer?.analysis;
                    const contentPulse = analysis?.contentPulse;
                    const deliveryPulse = analysis?.deliveryPulse;

                    return (
                        <Card key={question.id} className="overflow-hidden border-slate-200 shadow-sm">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Question {index + 1}
                                        </span>
                                        <h3 className="text-base font-medium text-slate-900 leading-snug">
                                            {question.text}
                                        </h3>
                                    </div>
                                    <div className="shrink-0">
                                        {hasAnswer ? (
                                            hasAnalysis ?
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Analyzed</Badge> :
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Submitted</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-slate-400 border-slate-200">Pending</Badge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            {hasAnswer && (
                                <CardContent className="p-6 space-y-6">
                                    {/* Transcript */}
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-slate-900">Candidate Response</h4>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 text-sm leading-relaxed">
                                            {answer.transcript ? (
                                                <p className="whitespace-pre-wrap">{answer.transcript}</p>
                                            ) : (
                                                <span className="italic text-slate-400">No transcript available.</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Analysis Grid */}
                                    {hasAnalysis && analysis && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                                            {/* Left: Content Feedback */}
                                            <div className="space-y-3">
                                                <h4 className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                                                    Content Pulse
                                                </h4>
                                                <div className="bg-emerald-50/50 p-4 rounded-lg border border-emerald-100/50 h-full">
                                                    <p className="font-medium text-emerald-900 mb-2">
                                                        {contentPulse?.headline || "Content Focus"}
                                                    </p>
                                                    <p className="text-sm text-emerald-800/90 leading-relaxed mb-3">
                                                        {contentPulse?.body || "No detailed feedback available."}
                                                    </p>
                                                    {contentPulse?.quote && (
                                                        <p className="text-xs text-emerald-700/80 italic border-l-2 border-emerald-300 pl-2">
                                                            &ldquo;{contentPulse.quote}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Delivery Feedback */}
                                            <div className="space-y-3">
                                                <h4 className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
                                                    Delivery Pulse
                                                </h4>
                                                <div className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100/50 h-full">
                                                    <p className="font-medium text-indigo-900 mb-2">
                                                        {deliveryPulse?.headline || "Delivery Focus"}
                                                    </p>
                                                    <p className="text-sm text-indigo-800/90 leading-relaxed">
                                                        {deliveryPulse?.body || "No detailed feedback available."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            )}

                            {!hasAnswer && (
                                <CardContent className="p-8 text-center text-slate-400 italic text-sm">
                                    The candidate has not answered this question yet.
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
