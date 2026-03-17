"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, Mail, Trash2, ExternalLink } from "lucide-react";
import { SessionSummary } from "@/lib/domain/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteSession } from "../actions";
import { StatusBadge, AttemptBadge, InitialsMatchBadge } from "./session-badges";
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


export function RecruiterSessionsTable({ initialSessions, recruiterTimezone, recruiterProfile, isAdmin = false }: RecruiterSessionsTableProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleSort = (key: keyof SessionSummary | 'delivered' | 'updatedAt') => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const buildResendMailto = (session: SessionSummary) => {
        if (!session.inviteToken) return null;
        const link = `${window.location.origin}/s/${session.inviteToken}`;
        const subject = `Interview Invitation: ${session.role}`;
        const body = `Hi ${session.candidateName},

I'd like to invite you to a preliminary interview practice session for the ${session.role} role. This interactive session will help us understand your experience better.

Please click the link below to start whenever you're ready:
${link}

Best regards,

${recruiterProfile?.name || ''}
${recruiterProfile?.title || 'Recruiter'}
${recruiterProfile?.company || 'Rangam Consultants Inc.'}

M: ${recruiterProfile?.phone || ''}
E: ${recruiterProfile?.email || ''}`;
        return `mailto:${session.candidateEmail || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    // Re-fetch data whenever the tab regains focus (covers back-navigation, tab switching, etc.)
    useEffect(() => {
        const onFocus = () => router.refresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [router]);

    const handleDelete = async (sessionId: string) => {
        if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
            return;
        }

        setIsDeleting(sessionId);
        try {
            await deleteSession(sessionId);
            router.refresh();
        } catch {
            alert("Failed to delete session.");
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
                    placeholder="Search candidates or roles..."
                    className="pl-9 bg-surface-base border-border rounded-2xl focus-visible:ring-primary/20 focus-visible:ring-offset-0 focus-visible:border-primary/50"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
            </div>

            <DataTable<SessionSummary>
                columns={[
                    {
                        header: (
                            <button onClick={() => handleSort('candidateName')} className="flex items-center gap-1 hover:text-text-primary transition-colors">
                                Candidate <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <div className="flex flex-col text-sm">
                                <div className="flex items-center gap-2 max-w-full">
                                    <span className="truncate font-semibold text-text-primary">{session.candidateName}</span>
                                    <AttemptBadge attemptNumber={session.attemptNumber} />
                                </div>
                            </div>
                        ),
                        className: "w-[220px]"
                    },
                    {
                        header: "Initials Match?",
                        cell: (session) => <InitialsMatchBadge session={session} />,
                        className: "w-[140px] text-center normal-case"
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('role')} className="flex items-center gap-1 hover:text-text-primary transition-colors">
                                Role <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <span className="text-xs text-text-muted font-medium truncate max-w-[140px] block">
                                {session.role}
                            </span>
                        ),
                        className: "min-w-[160px]"
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-text-primary transition-colors">
                                Status <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => <StatusBadge session={session} />,
                        className: "w-[180px]"
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('engagedTimeSeconds')} className="flex items-center gap-1 hover:text-text-primary transition-colors">
                                Active <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <span className="text-text-secondary whitespace-nowrap text-sm font-medium">
                                {formatDuration(session.engagedTimeSeconds)}
                            </span>
                        )
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('updatedAt')} className="flex items-center gap-1 hover:text-text-primary transition-colors">
                                Last Activity <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <span className="text-text-secondary whitespace-nowrap text-sm">
                                {formatTimestamp(session.updatedAt || session.createdAt, recruiterTimezone)}
                            </span>
                        )
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('delivered')} className="flex items-center gap-1 hover:text-text-primary transition-colors">
                                Delivered <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <span className="text-text-secondary whitespace-nowrap text-sm">
                                {formatTimestamp(session.invitationSentAt || session.createdAt, recruiterTimezone)}
                            </span>
                        )
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
                                >
                                    <Link href={`/recruiter/sessions/${session.id}`} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                    </Link>
                                </Button>

                                <div className="w-8 h-8 flex items-center justify-center">
                                    {session.inviteToken ? (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            asChild
                                            className="h-8 w-8 text-text-muted hover:text-state-info hover:bg-state-info/5 transition-colors rounded-2xl"
                                            title="Resend Invite Email"
                                        >
                                            <a href={buildResendMailto(session) || '#'} target="_blank" rel="noopener noreferrer">
                                                <Mail className="h-4 w-4" />
                                            </a>
                                        </Button>
                                    ) : null}
                                </div>

                                {isAdmin && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-text-muted hover:text-state-critical hover:bg-state-critical/5 transition-colors rounded-2xl"
                                        title="Delete Session"
                                        disabled={isDeleting === session.id}
                                        onClick={() => handleDelete(session.id)}
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
