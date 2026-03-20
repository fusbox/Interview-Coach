import { AlertCircle, Mail, User } from "lucide-react";
import { SupabaseFeedbackRepository } from "@/lib/server/infrastructure/supabase-feedback-repository";
import { cn } from "@/lib/cn";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCachedUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { PageHeaderBlock } from "@/components/patterns/PageHeaderBlock";
import { CandidateEfficacyChart } from "./components/CandidateEfficacyChart";
import { AIFeedbackQualityChart } from "./components/AIFeedbackQualityChart";
import { PlatformTrustChart } from "./components/PlatformTrustChart";
import { RecruiterMetricsChart } from "./components/RecruiterMetricsChart";
import { RolePatternsChart } from "./components/RolePatternsChart";

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Question text map  — canonical source of truth for survey items
// ---------------------------------------------------------------------------

const QUESTION_TEXT: Record<string, string> = {
    // Candidate: LandingScreen baseline
    candidate_baseline: "How prepared do you feel for this interview?",
    baseline_confidence: "How prepared do you feel for this interview?",
    // Candidate: FeedbackDrawer helpfulness
    helpfulness_delivery: "Was this delivery feedback helpful?",
    helpfulness_content: "Was this content feedback helpful?",
    // Candidate: SummaryScreen survey
    session_completion_confidence_delta: "I feel more prepared after this session.",
    session_completion_psychological_safety: "I felt safe to focus on my growth during this session.",
    session_completion_repeat_intent: "I would use this again to prepare for a different role.",
    // Recruiter: StepBatchSend friction
    recruiter_friction_invite: "How easy was sending these invites?",
};

const FEEDBACK_LABELS: Record<string, string> = {
    candidate_baseline: 'Baseline Confidence',
    baseline_confidence: 'Baseline Confidence',
    helpfulness_delivery: 'Delivery Helpfulness',
    helpfulness_content: 'Content Helpfulness',
    session_completion_confidence_delta: 'Confidence Delta',
    session_completion_psychological_safety: 'Psychological Safety',
    session_completion_repeat_intent: 'Repeat Intent',
    recruiter_friction_invite: 'Invite Ease',
};

function getLabelForType(type: string) {
    return FEEDBACK_LABELS[type] || type.replace(/_/g, ' ');
}

function getIconForType(type: string) {
    if (type.startsWith('recruiter_')) return <Mail className="w-4 h-4 text-primary" />;
    return <User className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />;
}

/**
 * Render the user's response — could be a numeric rating, a string like
 * "yes"/"somewhat"/"no", or absent. Show whatever was stored.
 */
function renderResponse(f: Record<string, unknown>) {
    const rating = f.rating as number | null;
    const comment = f.comment as string | null;
    const val = rating ?? comment;

    if (val === null || val === undefined) return <span className="text-muted-foreground">—</span>;

    if (typeof val === 'number') {
        return (
            <span className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-lg font-black",
                val >= 4 ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" :
                    val <= 2 ? "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200" : "bg-muted text-muted-foreground"
            )}>
                {val}
            </span>
        );
    }

    // String response (yes/somewhat/no, etc.)
    const colorMap: Record<string, string> = {
        yes: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
        somewhat: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
        no: "bg-destructive/10 text-destructive",
    };
    return (
        <span className={cn(
            "inline-flex items-center justify-center px-2.5 py-1 rounded-lg font-bold text-xs capitalize",
            colorMap[val.toLowerCase()] || "bg-muted text-muted-foreground"
        )}>
            {val}
        </span>
    );
}

/**
 * Format timestamp to match RecruiterSessionsTable pattern:
 * "3/4/2026 10:47 AM CST"
 */
function formatTimestamp(dateStr: string, timezone?: string) {
    const date = new Date(dateStr);
    try {
        const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone || undefined
        });

        const tzName = new Intl.DateTimeFormat('en-US', {
            timeZoneName: 'short',
            timeZone: timezone || undefined
        }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value || "";

        return `${date.toLocaleDateString()} ${timeStr} ${tzName}`;
    } catch {
        return date.toLocaleString();
    }
}

/**
 * Extract candidate name from the sessions join.
 * intake_json shape: { candidate: { firstName, lastName, email, ... } }
 */
function getCandidateName(f: Record<string, unknown>): string {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = f.sessions as any;
    if (sessions?.intake_json?.candidate) {
        const c = sessions.intake_json.candidate;
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
        if (name) return name;
    }
    // Recruiter signals store email in metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = f.metadata as any;
    if (meta?.recruiter_email) return meta.recruiter_email;
    return '—';
}

export default async function AdminFeedbackPage() {
    const repo = new SupabaseFeedbackRepository();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let feedback: any[] = [];
    let error: string | null = null;

    // Get recruiter timezone for consistent formatting
    const user = await getCachedUser();
    let recruiterTimezone: string | undefined;
    if (user) {
        const supabase = createClient();
        const { data: profile } = await supabase
            .from('recruiter_profiles')
            .select('timezone')
            .eq('recruiter_id', user.id)
            .single();
        recruiterTimezone = profile?.timezone || undefined;
    }

    try {
        feedback = await repo.listAdminView();
    } catch (e) {
        console.error('Failed to fetch admin feedback', e);
        error = "Failed to load feedback records. Please contact system support if this persists.";
    }

    const internalCount = feedback.filter(f => f.type.startsWith('recruiter_')).length;
    const externalCount = feedback.filter(f => !f.type.startsWith('recruiter_')).length;

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <PageHeaderBlock
                title="User Feedback"
                description="Aggregated insights from candidates and recruiters."
            />

            {error && (
                <AlertPanel tone="critical" size="sm" icon={<AlertCircle className="w-5 h-5 shrink-0" />}>
                    <span className="font-medium text-sm">{error}</span>
                </AlertPanel>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Total Signals</p>
                        <p className="text-3xl font-black text-foreground">{feedback.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Internal (Recruiter)</p>
                        <p className="text-3xl font-black text-primary">{internalCount}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest mb-2">External (Candidate)</p>
                        <p className="text-3xl font-black text-emerald-800 dark:text-emerald-300">{externalCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Candidate Efficacy Chart (Metric 1) */}
            <CandidateEfficacyChart feedback={feedback} />

            {/* AI Feedback Quality (Metric 2) */}
            <AIFeedbackQualityChart feedback={feedback} />

            {/* Platform Trust & Virality (Metric 3) */}
            <PlatformTrustChart feedback={feedback} />

            {/* Cross-Dimensional Role Patterns (Metric 5) */}
            <RolePatternsChart feedback={feedback} />

            {/* Recruiter ROI & Friction (Metric 4) */}
            <RecruiterMetricsChart feedback={feedback} />

            {/* Signals Table */}
            <Card>
                <CardHeader className="pb-0">
                    <SectionHeader title="Recent Signals Log" size="sm" />
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="rounded-xl border border-border overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground">Type</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground">User</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground">Question</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground text-center">Response</TableHead>
                                    <TableHead className="uppercase text-[11px] font-bold tracking-wider text-muted-foreground text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {feedback.map((f) => (
                                    <TableRow key={f.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {getIconForType(f.type)}
                                                <span className="font-bold text-foreground whitespace-nowrap">
                                                    {getLabelForType(f.type)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-foreground">
                                                    {getCandidateName(f)}
                                                </span>
                                                {f.sessions?.target_role && (
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase">
                                                        {f.sessions.target_role}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm text-muted-foreground italic">
                                                {QUESTION_TEXT[f.type] || '—'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {renderResponse(f)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground font-medium whitespace-nowrap text-sm">
                                            {formatTimestamp(f.created_at, recruiterTimezone)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {feedback.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="p-12 text-center text-muted-foreground italic">
                                            No feedback signals recorded yet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
