"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, Trash2, ExternalLink } from "lucide-react";
import { SessionSummary } from "@/lib/domain/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteSession } from "../actions";
import { StatusBadge, AttemptBadge, InitialsMatchBadge } from "./session-badges";
import { ResendInviteButton } from "./ResendInviteButton";
import { AlertPanel } from "@/components/patterns/AlertPanel";
import { DataTable } from "@/components/patterns/DataTable";
import { formatTimestamp, formatDuration } from "@/lib/utils/format";

export interface RecruiterProfile {
    name: string;
    title: string;
    company: string;
    phone: string;
    email: string;
}

interface RecruiterSessionsTableProps {
    initialSessions: SessionSummary[];
    recruiterTimezone?: string;
    recruiterProfile?: RecruiterProfile;
    isAdmin?: boolean;
}

type SortConfig = {
    key: keyof SessionSummary | 'delivered' | 'updatedAt' | 'engagedTimeSeconds';
    direction: 'asc' | 'desc';
} | null;

type SortKey = NonNullable<SortConfig>["key"];

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


export function RecruiterSessionsTable({ initialSessions, recruiterTimezone, recruiterProfile, isAdmin = false }: RecruiterSessionsTableProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const getAriaSort = (key: SortKey) => {
        if (sortConfig?.key !== key) {
            return "none" as const;
        }

        return sortConfig.direction === "asc" ? "ascending" as const : "descending" as const;
    };

    const getSortButtonLabel = (label: string, key: SortKey) => {
        const currentSort = getAriaSort(key);
        if (currentSort === "none") {
            return `Sort by ${label}`;
        }

        return `Sort by ${label}, currently ${currentSort}`;
    };

    const handleSort = (key: keyof SessionSummary | 'delivered' | 'updatedAt' | 'engagedTimeSeconds') => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    // Re-fetch data whenever the tab regains focus (covers back-navigation, tab switching, etc.)
    useEffect(() => {
        const onFocus = () => router.refresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [router]);

    const handleDelete = async (session: SessionSummary) => {
        if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
            return;
        }

        setIsDeleting(session.id);
        setDeleteError(null);
        try {
            await deleteSession(session.id);
            router.refresh();
        } catch {
            setDeleteError(`We couldn't delete ${session.candidateName}'s session. Please try again.`);
        } finally {
            setIsDeleting(null);
        }
    };


    const filteredAndSortedSessions = useMemo(() => {
        let result = [...initialSessions];

        // Filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.candidateName.toLowerCase().includes(query) ||
                s.role.toLowerCase().includes(query)
            );
        }

        // Sort
        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: string | number;
                let bVal: string | number;

                if (sortConfig.key === 'delivered') {
                    aVal = a.invitationSentAt || 0;
                    bVal = b.invitationSentAt || 0;
                } else if (sortConfig.key === 'updatedAt') {
                    aVal = a.updatedAt || a.createdAt;
                    bVal = b.updatedAt || b.createdAt;
                } else {
                    const key = sortConfig.key as keyof SessionSummary;
                    aVal = a[key] as string | number;
                    bVal = b[key] as string | number;
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [initialSessions, searchQuery, sortConfig]);

    return (
        <div className="space-y-4">
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input
                    id="manage-invites-search"
                    name="manageInvitesSearch"
                    placeholder="Search candidates or roles..."
                    className="pl-9 bg-surface-base border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary/50"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    aria-label="Search candidates or roles"
                />
            </div>

            {deleteError && (
                <AlertPanel
                    tone="critical"
                    size="sm"
                    role="alert"
                    aria-live="assertive"
                    className="animate-in fade-in slide-in-from-top-1"
                >
                    {deleteError}
                </AlertPanel>
            )}

            <DataTable<SessionSummary>
                columns={[
                    {
                        header: (
                            <button
                                onClick={() => handleSort('candidateName')}
                                className="flex items-center gap-1 hover:text-text-primary transition-colors"
                                aria-label={getSortButtonLabel("candidate", "candidateName")}
                            >
                                Candidate <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        headerCellProps: { "aria-sort": getAriaSort("candidateName") },
                        cell: (session) => {
                            const hasAttempt = !!session.attemptNumber && session.attemptNumber > 1;

                            return (
                                <div className="flex flex-col text-sm">
                                    <span className="truncate font-semibold text-text-primary">{session.candidateName}</span>
                                    {hasAttempt ? (
                                        <div className="mt-1">
                                            <AttemptBadge attemptNumber={session.attemptNumber} />
                                        </div>
                                    ) : null}
                                </div>
                            );
                        },
                        className: "w-[200px]"
                    },
                    {
                        header: "Initials Match?",
                        cell: (session) => <InitialsMatchBadge session={session} />,
                        className: "w-[140px] text-center normal-case"
                    },
                    {
                        header: (
                            <button
                                onClick={() => handleSort('role')}
                                className="flex items-center gap-1 hover:text-text-primary transition-colors"
                                aria-label={getSortButtonLabel("role", "role")}
                            >
                                Role <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        headerCellProps: { "aria-sort": getAriaSort("role") },
                        cell: (session) => (
                            <span className="text-xs text-text-muted font-medium truncate max-w-[140px] block">
                                {session.role}
                            </span>
                        ),
                        className: "min-w-[160px]"
                    },
                    {
                        header: (
                            <button
                                onClick={() => handleSort('status')}
                                className="flex items-center gap-1 hover:text-text-primary transition-colors"
                                aria-label={getSortButtonLabel("status", "status")}
                            >
                                Status <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        headerCellProps: { "aria-sort": getAriaSort("status") },
                        cell: (session) => <StatusBadge session={session} />,
                        className: "w-[260px]"
                    },
                    {
                        header: (
                            <button
                                onClick={() => handleSort('engagedTimeSeconds')}
                                className="flex items-center gap-1 hover:text-text-primary transition-colors"
                                aria-label={getSortButtonLabel("active time", "engagedTimeSeconds")}
                            >
                                Active <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        headerCellProps: { "aria-sort": getAriaSort("engagedTimeSeconds") },
                        cell: (session) => (
                            <span className="text-text-secondary whitespace-nowrap text-sm font-medium">
                                {formatDuration(session.engagedTimeSeconds)}
                            </span>
                        )
                    },
                    {
                        header: (
                            <button
                                onClick={() => handleSort('updatedAt')}
                                className="flex items-center gap-1 hover:text-text-primary transition-colors"
                                aria-label={getSortButtonLabel("last activity", "updatedAt")}
                            >
                                Last Activity <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        headerCellProps: { "aria-sort": getAriaSort("updatedAt") },
                        cell: (session) => {
                            const timestamp = formatTimestampParts(session.updatedAt || session.createdAt, recruiterTimezone);

                            return (
                                <div className="flex flex-col leading-tight">
                                    <span className="whitespace-nowrap text-sm text-text-secondary">{timestamp.date}</span>
                                    <span className="mt-1 whitespace-nowrap text-[11px] text-text-muted">{timestamp.time}</span>
                                </div>
                            );
                        },
                        className: "w-[130px]"
                    },
                    {
                        header: (
                            <button
                                onClick={() => handleSort('delivered')}
                                className="flex items-center gap-1 hover:text-text-primary transition-colors"
                                aria-label={getSortButtonLabel("delivery date", "delivered")}
                            >
                                Delivered <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        headerCellProps: { "aria-sort": getAriaSort("delivered") },
                        cell: (session) => {
                            const timestamp = formatTimestampParts(session.invitationSentAt || session.createdAt, recruiterTimezone);

                            return (
                                <div className="flex flex-col leading-tight">
                                    <span className="whitespace-nowrap text-sm text-text-secondary">{timestamp.date}</span>
                                    <span className="mt-1 whitespace-nowrap text-[11px] text-text-muted">{timestamp.time}</span>
                                </div>
                            );
                        },
                        className: "w-[130px]"
                    },
                    {
                        header: <span className="px-6 block text-right">Actions</span>,
                        className: "text-right",
                        cell: (session) => (
                            <div className="flex items-center justify-end gap-1 px-6" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            asChild
                                            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5 transition-colors rounded-2xl"
                                            title="Open Results in New Tab"
                                            aria-label={`Open ${session.candidateName}'s session in a new tab`}
                                        >
                                    <Link href={`/recruiter/sessions/${session.id}`} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </Button>

                                <div className="w-8 h-8 flex items-center justify-center">
                                    <ResendInviteButton
                                        session={session}
                                        recruiterProfile={recruiterProfile}
                                        className="h-8 w-8 text-text-muted hover:text-sky-800 hover:bg-sky-50 transition-colors rounded-2xl dark:hover:text-sky-200 dark:hover:bg-sky-500/10"
                                    />
                                </div>

                                {isAdmin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-text-muted hover:text-rose-800 hover:bg-rose-50 transition-colors rounded-2xl dark:hover:text-rose-200 dark:hover:bg-rose-500/10"
                                        title="Delete Session"
                                        disabled={isDeleting === session.id}
                                        onClick={() => handleDelete(session)}
                                        aria-label={`Delete ${session.candidateName}'s session`}
                                    >
                                        <Trash2 className={isDeleting === session.id ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                                    </Button>
                                )}
                            </div>
                        )
                    }
                ]}
                data={filteredAndSortedSessions}
                onRowClick={(session) => router.push(`/recruiter/sessions/${session.id}`)}
                emptyState={
                    <div className="text-center py-12 text-text-muted italic">
                        No sessions found.
                    </div>
                }
            />
            <p className="text-[11px] text-text-muted px-1">
                Tip: Invite links are securely encrypted at rest to maintain SOC 2 compliance.
            </p>
        </div>
    );
}
