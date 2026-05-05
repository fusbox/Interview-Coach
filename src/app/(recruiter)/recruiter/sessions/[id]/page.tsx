import { createSessionRepository } from "@/lib/server/infrastructure/session-repository";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getCachedUser } from "@/lib/supabase/server";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { StatusBadge as SessionStatusBadge } from "../../components/session-badges";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { InterviewSession } from "@/lib/domain/types";
import { E2E_RECRUITER_ID, getE2EInterviewSession, isServerE2EMode } from "@/lib/e2e/test-mode";

export const dynamic = 'force-dynamic';

export default async function SessionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getCachedUser();
    if (!user) redirect("/login");

    const session: InterviewSession | null = isServerE2EMode() && user.id === E2E_RECRUITER_ID
        ? getE2EInterviewSession(id)
        : await (await createSessionRepository()).get(id);

    if (!session) {
        notFound();
    }

    // Verify Ownership
    if (session.recruiterId !== user.id) {
        notFound();
    }

    return (
        <div className="space-y-8">
            <SectionHeader
                title="Session Details"
                description="Review candidate transcripts and session progress."
                actions={
                    <Button emphasis="secondary" density="compact" shape="app" label="strong" asChild>
                        <Link href="/recruiter">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Link>
                    </Button>
                }
            />

            {/* Summary Card */}
            <Card className="border-none shadow-flat bg-surface-base rounded-2xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-text-muted uppercase tracking-widest">Candidate Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <div className="text-micro uppercase font-bold text-text-disabled tracking-wider">Candidate</div>
                            <div className="text-lg font-bold text-text-primary leading-tight">{session.candidateName || "Anonymous"}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-micro uppercase font-bold text-text-disabled tracking-wider">Target Role</div>
                            <div className="text-lg font-bold text-text-primary leading-tight">{session.role}</div>
                        </div>
                        <div className="space-y-1">
                            <div className="text-micro uppercase font-bold text-text-disabled tracking-wider">Active Engagement</div>
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
                            <div className="text-micro uppercase font-bold text-text-disabled tracking-wider">Completion Status</div>
                            <div className="mt-1">
                                <SessionStatusBadge session={session} />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Question Set */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-text-primary">Question Set</h2>

                {session.questions.map((question, index) => {
                    const answer = session.answers[question.id];
                    const hasAnswer = !!answer;

                    return (
                        <Card key={question.id} className="overflow-hidden border-border shadow-flat bg-surface-base rounded-2xl">
                            <CardHeader className="bg-surface-subtle/50 border-b border-border py-4">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                        <span className="text-micro font-bold text-text-muted uppercase tracking-widest">
                                            Question {index + 1}
                                        </span>
                                        <h3 className="text-base font-bold text-text-primary leading-tight">
                                            {question.text}
                                        </h3>
                                    </div>
                                    <div className="shrink-0">
                                        {hasAnswer ? (
                                            <StatusBadge variant="progressActive" icon={false}>Submitted</StatusBadge>
                                        ) : (
                                            <StatusBadge variant="progressIdle" icon={false}>Pending</StatusBadge>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>

                            {hasAnswer && (
                                <CardContent className="p-6">
                                    <div className="space-y-4">
                                        <h4 className="text-micro font-bold text-text-muted uppercase tracking-widest">Candidate Response</h4>
                                        <div className="bg-surface-subtle p-4 rounded-2xl border border-border text-text-secondary text-sm leading-relaxed">
                                            {answer.transcript ? (
                                                <p className="whitespace-pre-wrap">{answer.transcript}</p>
                                            ) : (
                                                <span className="italic text-text-disabled">No transcript available.</span>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            )}

                            {!hasAnswer && (
                                <CardContent className="p-8 text-center text-text-disabled italic text-sm">
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
