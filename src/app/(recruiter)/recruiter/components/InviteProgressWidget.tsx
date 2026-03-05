"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionSummary } from "@/lib/domain/types";
import { computeWidgetBuckets, WidgetBucket, WidgetSession } from "@/lib/services/compute-widget-buckets";
import { StatusBadge, ReadinessBadge, AttemptBadge } from "./session-badges";
import {
    CheckCircle2,
    Clock,
    Activity,
    Inbox,
    ChevronDown,
    ChevronUp,
    Copy,
    ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Bucket visual config
// ---------------------------------------------------------------------------

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
        accentColor: "text-state-success",
        bgGradient: "from-state-success/10 to-state-success/5",
        badgeBg: "bg-state-success/10",
        badgeText: "text-state-success",
        emptyMessage: "No completed sessions yet",
    },
    needs_followup: {
        icon: Clock,
        accentColor: "text-state-warning",
        bgGradient: "from-state-warning/10 to-state-warning/5",
        badgeBg: "bg-state-warning/10",
        badgeText: "text-state-warning",
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
        emptyMessage: "All invites have been opened",
    },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BucketHeader({ bucket }: { bucket: WidgetBucket }) {
    const config = BUCKET_CONFIG[bucket.key];
    const Icon = config.icon;

    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${config.bgGradient}`}>
                    <Icon className={`w-4 h-4 ${config.accentColor}`} />
                </div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
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

function SessionRow({ session, bucketKey }: { session: WidgetSession; bucketKey: string }) {
    const router = useRouter();
    const [copiedLink, setCopiedLink] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session.inviteToken) return;
        const link = `${window.location.origin}/s/${session.inviteToken}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 1500);
        } catch {
            // Silent fail for non-secure contexts
        }
    };

    const handleRowClick = () => {
        router.push(`/recruiter/sessions/${session.id}`);
    };

    return (
        <div
            className="group flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-lg hover:bg-surface-subtle transition-all duration-base ease-standard cursor-pointer"
            onClick={handleRowClick}
        >
            {/* Candidate info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">
                        {session.candidateName}
                    </span>
                    <AttemptBadge attemptNumber={session.attemptNumber} />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400 truncate">{session.role}</span>
                    {bucketKey !== 'ready_to_review' && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                            · {session.idleLabel}
                        </span>
                    )}
                </div>
            </div>

            {/* Badge area — context-dependent */}
            <div className="flex items-center flex-shrink-0">
                {bucketKey === 'ready_to_review' ? (
                    <ReadinessBadge session={session} />
                ) : (
                    <StatusBadge session={session} />
                )}
            </div>

            {/* Actions — fixed width so badge column stays aligned */}
            <div
                className="flex items-center gap-0.5 w-[60px] justify-end flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-7 h-7 flex items-center justify-center">
                    {session.inviteToken && bucketKey !== 'ready_to_review' ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy Invite Link"
                            onClick={handleCopy}
                        >
                            <Copy className={`h-3.5 w-3.5 ${copiedLink ? 'text-emerald-500' : ''}`} />
                        </Button>
                    ) : null}
                </div>
                <a
                    href={`/recruiter/sessions/${session.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all"
                    title="Open in New Tab"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>
            </div>
        </div>
    );
}

function AwaitingActionSummary({ bucket }: { bucket: WidgetBucket }) {
    const [expanded, setExpanded] = useState(true);

    if (bucket.count === 0) {
        return (
            <p className="text-xs text-slate-400 italic py-2">
                {BUCKET_CONFIG[bucket.key].emptyMessage}
            </p>
        );
    }

    return (
        <div>
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 w-full text-left py-2 group/expand"
            >
                <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{bucket.neverEngagedCount}</span>
                    {" "}invite{bucket.count !== 1 ? 's' : ''} sent, no views.
                    {bucket.oldestNeverEngagedLabel && (
                        <span className="text-slate-400"> Oldest: {bucket.oldestNeverEngagedLabel}</span>
                    )}
                </p>
                {expanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                )}
            </button>

            {expanded && (
                <div className="space-y-0.5 mt-1 animate-in slide-in-from-top-2 duration-200">
                    {bucket.sessions.map((s) => (
                        <SessionRow key={s.id} session={s} bucketKey={bucket.key} />
                    ))}
                </div>
            )}
        </div>
    );
}

function BucketSection({ bucket }: { bucket: WidgetBucket }) {
    const config = BUCKET_CONFIG[bucket.key];
    const MAX_VISIBLE = 5;
    const [showAll, setShowAll] = useState(false);

    // Awaiting Action has its own collapsed layout
    if (bucket.key === 'awaiting_action') {
        return (
            <div>
                <BucketHeader bucket={bucket} />
                <div className="mt-2">
                    <AwaitingActionSummary bucket={bucket} />
                </div>
            </div>
        );
    }

    const visibleSessions = showAll ? bucket.sessions : bucket.sessions.slice(0, MAX_VISIBLE);
    const hasMore = bucket.count > MAX_VISIBLE;

    return (
        <div>
            <BucketHeader bucket={bucket} />
            <div className="mt-2">
                {bucket.count === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">
                        {config.emptyMessage}
                    </p>
                ) : (
                    <>
                        <div className="space-y-0.5">
                            {visibleSessions.map((session) => (
                                <SessionRow
                                    key={session.id}
                                    session={session}
                                    bucketKey={bucket.key}
                                />
                            ))}
                        </div>
                        {hasMore && (
                            <button
                                onClick={() => setShowAll(!showAll)}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2 flex items-center gap-1"
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

// ---------------------------------------------------------------------------
// Main Widget
// ---------------------------------------------------------------------------

interface InviteProgressWidgetProps {
    sessions: SessionSummary[];
}

export function InviteProgressWidget({ sessions }: InviteProgressWidgetProps) {
    const buckets = useMemo(() => computeWidgetBuckets(sessions), [sessions]);

    const totalSessions = sessions.length;

    return (
        <div>
            {totalSessions === 0 ? (
                <Card className="border border-slate-200/80 shadow-sm bg-white">
                    <CardContent className="py-12 text-center">
                        <Inbox className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                        <p className="text-sm text-slate-500 font-medium">No invites yet</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Create your first invite to start tracking progress.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {buckets.map((bucket) => (
                        <Card
                            key={bucket.key}
                            className="border-none shadow-flat bg-surface-base overflow-hidden"
                        >
                            <CardContent className="p-5">
                                <BucketSection bucket={bucket} />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
