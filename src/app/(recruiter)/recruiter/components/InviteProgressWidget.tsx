"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionSummary } from "@/lib/domain/types";
import { computeWidgetBuckets, WidgetBucket, WidgetSession } from "@/lib/services/compute-widget-buckets";
import { StatusBadge, AttemptBadge, InitialsMatchBadge } from "./session-badges";
import { RecruiterProfile } from "./RecruiterSessionsTable";
import { ResendInviteButton } from "./ResendInviteButton";
import {
    CheckCircle2,
    Clock,
    Activity,
    Inbox,
    ChevronDown,
    ChevronUp,
    ExternalLink,
} from "lucide-react";
import { formatTimestamp } from "@/lib/utils/format";
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

function formatTimestampParts(timestamp?: number, timezone?: string) {
    if (!timestamp) {
        return { date: "-", time: "" };
    }

    const formatted = formatTimestamp(timestamp, timezone);
    const match = formatted.match(/^(.*)\s(\d{1,2}:\d{2}\s(?:AM|PM))(?:\s(.*))?$/);

    if (!match) {
        return { date: formatted, time: "" };
    }

    const [, date, time, tzName] = match;
    return {
        date,
        time: [time, tzName].filter(Boolean).join(" "),
    };
}

function SessionRow({ session, bucketKey, recruiterProfile, recruiterTimezone }: { session: WidgetSession; bucketKey: string; recruiterProfile?: RecruiterProfile; recruiterTimezone?: string }) {
    const router = useRouter();
    const showStatus = bucketKey === 'needs_followup' || bucketKey === 'recently_active';
    const timestamp = formatTimestampParts(
        bucketKey === 'awaiting_action'
            ? (session.invitationSentAt || session.createdAt)
            : (session.updatedAt || session.createdAt),
        recruiterTimezone
    );

    const handleRowClick = () => {
        router.push(`/recruiter/sessions/${session.id}`);
    };

    return (
        <>
            <div
                className="group cursor-pointer rounded-xl px-2 py-2 transition-all duration-base ease-standard hover:bg-surface-subtle md:hidden"
                onClick={handleRowClick}
            >
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-text-primary">
                                {session.candidateName}
                            </span>
                            <InitialsMatchBadge session={session} />
                            <AttemptBadge attemptNumber={session.attemptNumber} />
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-text-muted">
                            {session.role}
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="text-[11px] font-medium leading-tight text-text-secondary">
                            {timestamp.date}
                        </div>
                        <div className="mt-0.5 text-[10px] leading-tight text-text-muted">
                            {timestamp.time}
                        </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-1" onClick={(e) => e.stopPropagation()}>
                        <ResendInviteButton
                            session={session}
                            recruiterProfile={recruiterProfile}
                            className="h-7 w-7 rounded-md text-text-muted hover:bg-sky-50 hover:text-sky-800 dark:hover:bg-sky-500/10 dark:hover:text-sky-200"
                        />
                    </div>
                </div>

                {showStatus ? (
                    <div className="mt-2 flex items-center justify-start">
                        <StatusBadge session={session} />
                    </div>
                ) : null}
            </div>

            <div
                className="group hidden cursor-pointer items-center rounded-lg px-3 py-2.5 transition-all duration-base ease-standard hover:bg-surface-subtle md:grid md:grid-cols-12 md:gap-3"
                onClick={handleRowClick}
            >
                <div className="col-span-5 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-text-primary">
                            {session.candidateName}
                        </span>
                        <InitialsMatchBadge session={session} />
                        <AttemptBadge attemptNumber={session.attemptNumber} />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                        <span className="truncate text-xs text-text-muted">{session.role}</span>
                    </div>
                </div>

                <div className="col-span-3 flex min-w-0 items-center">
                    {showStatus ? <StatusBadge session={session} /> : null}
                </div>

                <div className="col-span-4 flex min-w-0 items-center justify-between gap-2">
                    <span className="text-xs text-text-secondary">
                        {bucketKey === 'ready_to_review' && formatTimestamp(session.updatedAt || session.createdAt, recruiterTimezone)}
                        {showStatus && formatTimestamp(session.updatedAt || session.createdAt, recruiterTimezone)}
                        {bucketKey === 'awaiting_action' && formatTimestamp(session.invitationSentAt || session.createdAt, recruiterTimezone)}
                    </span>

                    <div
                        className="flex shrink-0 items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex h-7 w-7 items-center justify-center">
                            <ResendInviteButton
                                session={session}
                                recruiterProfile={recruiterProfile}
                                className="h-7 w-7 text-text-muted transition-colors hover:text-sky-800 dark:hover:text-sky-200"
                            />
                        </div>
                        <a
                            href={`/recruiter/sessions/${session.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-all hover:bg-surface-subtle hover:text-sky-800 dark:hover:text-sky-200"
                            title="Open in New Tab"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                </div>
            </div>
        </>
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
                        <div className="mb-1 hidden grid-cols-12 gap-3 px-3 text-[10px] font-bold uppercase tracking-wider text-text-muted md:grid">
                            <div className="col-span-5">Candidate</div>
                            <div className="col-span-3">{col2Header}</div>
                            <div className="col-span-4">{col3Header}</div>
                        </div>

                        <div className="space-y-1 pb-1 md:space-y-0.5">
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
                            <CardContent className="p-4 md:p-5">
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
