import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCachedUser } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { FeedbackPanel } from "@/components/patterns/FeedbackPanel";
import { StatusBadge, ReadinessBadge } from "../../components/session-badges";
import { InterviewSession } from "@/lib/domain/types";

const sessionRepo = new SupabaseSessionRepository();

export const dynamic = 'force-dynamic';

// REMOVED: Internal badge mapping, now using canonical StatusBadge/ReadinessBadge from session-badges.tsx

export default async function SessionDetailsPage({ params }: { params: { id: string } }) {
    const user = await getCachedUser();
    if (!user) redirect("/login");

    const session: InterviewSession | null = await sessionRepo.get(params.id);

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
            <SectionHeader
                title="Session Results"
                description="Review candidate performance and AI-driven feedback."
                actions={
                    <Button variant="outline" size="sm" asChild className="shadow-flat">
                        <Link href="/recruiter">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Link>
                    </Button>
                }
            />

            {/* Summary Card */}
            <Card className="border-none shadow-flat bg-surface-base">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-text-muted uppercase tracking-widest">Candidate Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-text-disabled tracking-wider">Candidate</div>
                            <div className="text-lg font-bold text-text-primary leading-tight">{session.candidateName || "Anonymous"}</div>
                            <div className="text-sm text-text-muted">{session.candidate?.email || "No email provided"}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-text-disabled tracking-wider">Target Role</div>
                            <div className="text-lg font-bold text-text-primary leading-tight">{session.role}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-text-disabled tracking-wider">Active Engagement</div>
                            <div className="text-lg font-bold text-primary leading-tight">
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
                        <div className="space-y-1">
                            <div className="text-[10px] uppercase font-bold text-text-disabled tracking-wider">Status & Readiness</div>
                            <div className="flex flex-col gap-2 mt-1">
                                <div className="flex items-center gap-2">
                                    <StatusBadge session={session} />
                                    <ReadinessBadge session={session} />
                                </div>
                                {session.summaryNarrative && (
                                    <p className="text-xs text-text-muted italic leading-relaxed max-w-xs border-l-2 border-primary/20 pl-2">
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border/50">
                                            <FeedbackPanel
                                                title={contentPulse?.headline || "Content Focus"}
                                                body={
                                                    <div className="space-y-3">
                                                        <p>{contentPulse?.body || "No detailed feedback available."}</p>
                                                        {contentPulse?.quote && (
                                                            <p className="text-xs italic border-l-2 border-primary/20 pl-2">
                                                                &ldquo;{contentPulse.quote}&rdquo;
                                                            </p>
                                                        )}
                                                    </div>
                                                }
                                                className="border-none shadow-none bg-surface-subtle"
                                            />

                                            <FeedbackPanel
                                                title={deliveryPulse?.headline || "Delivery Focus"}
                                                body={deliveryPulse?.body || "No detailed feedback available."}
                                                className="border-none shadow-none bg-surface-subtle"
                                            />
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
