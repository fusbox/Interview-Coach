"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionSummary } from "@/lib/domain/types";
import { computeWidgetBuckets, WidgetBucket, WidgetSession } from "@/lib/services/compute-widget-buckets";
import { StatusBadge, AttemptBadge, InitialsMatchBadge } from "./session-badges";
import { RecruiterProfile } from "./RecruiterSessionsTable";
import {
    CheckCircle2,
    Clock,
    Activity,
    Inbox,
    ChevronDown,
    ChevronUp,
    Mail,
    ExternalLink,
} from "lucide-react";
import { formatTimestamp } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const BUCKET_CONFIG: Record<string, {
    icon: React.ElementType;
    accentColor: string;
    bgGradient: string;
    badgeBg: string;
    badgeText: string;
    emptyMessage: string;
}> = {
    ready_to_review: {
        icon: CheckCircle2,
        accentColor: "text-emerald-800 dark:text-emerald-200",
        bgGradient: "from-state-success/10 to-state-success/5",
        badgeBg: "bg-state-success/10",
        badgeText: "text-emerald-800 dark:text-emerald-200",
        emptyMessage: "No completed sessions yet",
    },
    needs_followup: {
        icon: Clock,
        accentColor: "text-amber-900 dark:text-amber-200",
        bgGradient: "from-state-warning/10 to-state-warning/5",
        badgeBg: "bg-state-warning/10",
        badgeText: "text-amber-900 dark:text-amber-200",
        emptyMessage: "No stale sessions — candidates are staying active",
    },
    recently_active: {
        icon: Activity,
        accentColor: "text-state-info",
        bgGradient: "from-state-info/10 to-state-info/5",
        badgeBg: "bg-state-info/10",
        badgeText: "text-state-info",
        emptyMessage: "No active sessions right now",
    },
    awaiting_action: {
        icon: Inbox,
        accentColor: "text-text-muted",
        bgGradient: "from-surface-subtle to-surface-subtle/50",
        badgeBg: "bg-surface-subtle",
        badgeText: "text-text-muted",
        emptyMessage: "No invites waiting to be started",
    },
};

function BucketHeader({ bucket }: { bucket: WidgetBucket }) {
    const config = BUCKET_CONFIG[bucket.key];
    const Icon = config.icon;

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${config.bgGradient}`}>
                    <Icon className={`w-4 h-4 ${config.accentColor}`} />
                </div>
                <h3 className="text-base font-bold text-text-primary font-sans">
                    {bucket.label}
                </h3>
            </div>
            <Badge
                variant="secondary"
                className={`${config.badgeBg} ${config.badgeText} text-xs font-bold min-w-[24px] justify-center`}
            >
                {bucket.count}
            </Badge>
        </div>
    );
}

function SessionRow({ session, bucketKey, recruiterProfile, recruiterTimezone }: { session: WidgetSession; bucketKey: string; recruiterProfile?: RecruiterProfile; recruiterTimezone?: string }) {
    const router = useRouter();

    const buildResendMailto = () => {
        if (!session.inviteToken) return null;
        const origin = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || '');
        const link = `${origin}/s/${session.inviteToken}`;
        const subject = `Interview Invitation: ${session.role}`;
        const body = `Hi ${session.candidateName},\n\nI'd like to invite you to a preliminary interview practice session for the ${session.role} role. This interactive session will help us understand your experience better.\n\nPlease click the link below to start whenever you're ready:\n${link}\n\nBest regards,\n\n${recruiterProfile?.name || ''}\n${recruiterProfile?.title || 'Recruiter'}\n${recruiterProfile?.company || 'Rangam Consultants Inc.'}\n\nM: ${recruiterProfile?.phone || ''}\nE: ${recruiterProfile?.email || ''}`;
        return `mailto:${session.candidateEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const handleRowClick = () => {
        router.push(`/recruiter/sessions/${session.id}`);
    };

    return (
        <div
            className="group grid grid-cols-12 gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-subtle transition-all duration-base ease-standard cursor-pointer items-center"
            onClick={handleRowClick}
        >
            <div className="col-span-5 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary truncate">
                        {session.candidateName}
                    </span>
                    <InitialsMatchBadge session={session} />
                    <AttemptBadge attemptNumber={session.attemptNumber} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-text-muted truncate">{session.role}</span>
                </div>
            </div>

            <div className="col-span-3 flex items-center min-w-0">
                {(bucketKey === 'needs_followup' || bucketKey === 'recently_active') ? (
                    <StatusBadge session={session} />
                ) : null}
            </div>

            <div className="col-span-4 flex items-center justify-between min-w-0 gap-2">
                <span className="text-xs text-text-secondary truncate">
                    {bucketKey === 'ready_to_review' && formatTimestamp(session.updatedAt || session.createdAt, recruiterTimezone)}
                    {(bucketKey === 'needs_followup' || bucketKey === 'recently_active') && formatTimestamp(session.updatedAt || session.createdAt, recruiterTimezone)}
                    {bucketKey === 'awaiting_action' && formatTimestamp(session.invitationSentAt || session.createdAt, recruiterTimezone)}
                </span>

                <div
                    className="flex items-center gap-0.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-7 h-7 flex items-center justify-center">
                        {session.inviteToken && bucketKey !== 'ready_to_review' ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                className="h-7 w-7 text-text-muted hover:text-sky-800 opacity-0 group-hover:opacity-100 transition-opacity dark:hover:text-sky-200"
                                title="Resend Invite Email"
                            >
                                <a href={buildResendMailto() || '#'} target="_blank" rel="noopener noreferrer">
                                    <Mail className="h-3.5 w-3.5" />
                                </a>
                            </Button>
                        ) : null}
                    </div>
                    <a
                        href={`/recruiter/sessions/${session.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:text-sky-800 hover:bg-surface-subtle opacity-0 group-hover:opacity-100 transition-all dark:hover:text-sky-200"
                        title="Open in New Tab"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}

function BucketSection({ bucket, recruiterProfile, recruiterTimezone }: { bucket: WidgetBucket; recruiterProfile?: RecruiterProfile; recruiterTimezone?: string }) {
    const config = BUCKET_CONFIG[bucket.key];
    const MAX_VISIBLE = 5;
    const [showAll, setShowAll] = useState(false);

    const visibleSessions = showAll ? bucket.sessions : bucket.sessions.slice(0, MAX_VISIBLE);
    const hasMore = bucket.count > MAX_VISIBLE;

    const col2Header = (bucket.key === 'needs_followup' || bucket.key === 'recently_active') ? "Status" : "";
    const col3Header = bucket.key === 'ready_to_review' ? "Session Completed" :
                       bucket.key === 'awaiting_action' ? "Delivered" : "Last Activity";

    return (
        <div>
            <BucketHeader bucket={bucket} />
            <div className="mt-4">
                {bucket.count === 0 ? (
                    <p className="text-xs text-text-muted italic py-2">
                        {config.emptyMessage}
                    </p>
                ) : (
                    <>
                        <div className="grid grid-cols-12 gap-3 px-3 mb-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            <div className="col-span-5">Candidate</div>
                            <div className="col-span-3">{col2Header}</div>
                            <div className="col-span-4">{col3Header}</div>
                        </div>

                        <div className="space-y-0.5 overflow-x-auto custom-scrollbar pb-1">
                            {visibleSessions.map((session) => (
                                <SessionRow
                                    key={session.id}
                                    session={session}
                                    bucketKey={bucket.key}
                                    recruiterProfile={recruiterProfile}
                                    recruiterTimezone={recruiterTimezone}
                                />
                            ))}
                        </div>
                        {hasMore && (
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className="text-xs text-primary hover:text-primary/80 font-medium mt-2 flex items-center gap-1"
                            >
                                {showAll ? (
                                    <>Show less <ChevronUp className="w-3 h-3" /></>
                                ) : (
                                    <>+{bucket.count - MAX_VISIBLE} more <ChevronDown className="w-3 h-3" /></>
                                )}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

interface InviteProgressWidgetProps {
    sessions: SessionSummary[];
    recruiterProfile?: RecruiterProfile;
    recruiterTimezone?: string;
}

export function InviteProgressWidget({ sessions, recruiterProfile, recruiterTimezone }: InviteProgressWidgetProps) {
    const buckets = useMemo(() => computeWidgetBuckets(sessions), [sessions]);

    const totalSessions = sessions.length;

    return (
        <div>
            {totalSessions === 0 ? (
                <Card className="border border-border/80 shadow-sm bg-surface-base rounded-2xl">
                    <CardContent className="py-12 text-center">
                        <Inbox className="w-10 h-10 text-text-disabled mx-auto mb-3" />
                        <p className="text-sm text-text-secondary font-medium">No invites yet</p>
                        <p className="text-xs text-text-muted mt-1">
                            Create your first invite to start tracking progress.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {buckets.map((bucket) => (
                        <Card
                            key={bucket.key}
                            className="border-none shadow-flat bg-surface-base overflow-hidden rounded-2xl"
                        >
                            <CardContent className="p-5">
                                <BucketSection 
                                    bucket={bucket} 
                                    recruiterProfile={recruiterProfile}
                                    recruiterTimezone={recruiterTimezone}
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
