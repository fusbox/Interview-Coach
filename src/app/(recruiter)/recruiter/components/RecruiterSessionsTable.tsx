"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowUpDown, Copy, Trash2, CheckCircle2, ExternalLink } from "lucide-react";
import { SessionSummary } from "@/lib/domain/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteSession } from "../actions";
import { StatusBadge, ReadinessBadge, AttemptBadge } from "./session-badges";
import { DataTable } from "@/components/patterns/DataTable";

interface RecruiterSessionsTableProps {
    initialSessions: SessionSummary[];
    recruiterTimezone?: string;
}

type SortConfig = {
    key: keyof SessionSummary | 'created' | 'updatedAt' | 'engagedTimeSeconds';
    direction: 'asc' | 'desc';
} | null;


export function RecruiterSessionsTable({ initialSessions, recruiterTimezone }: RecruiterSessionsTableProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const handleSort = (key: keyof SessionSummary | 'created' | 'updatedAt') => {
        setSortConfig(prev => {
            if (prev?.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const handleCopyLink = async (token: string, sessionId: string) => {
        const link = `${window.location.origin}/s/${token}`;

        try {
            // Navigator clipboard api needs a secure context (https)
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(link);
            } else {
                // Fallback for non-secure contexts (http/local network)
                const textArea = document.createElement("textarea");
                textArea.value = link;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Fallback: Oops, unable to copy', err);
                }
                document.body.removeChild(textArea);
            }
            setCopiedId(sessionId);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Async: Could not copy text: ', err);
        }
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

    const formatDuration = (seconds?: number) => {
        if (!seconds || seconds <= 0) return "0s";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    const formatTimestamp = (timestamp: number) => {
        const date = new Date(timestamp);
        try {
            const timeStr = date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: recruiterTimezone || undefined
            });

            const tzName = new Intl.DateTimeFormat('en-US', {
                timeZoneName: 'short',
                timeZone: recruiterTimezone || undefined
            }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value || "";

            return `${date.toLocaleDateString()} ${timeStr} ${tzName}`;
        } catch {
            return date.toLocaleString();
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

                if (sortConfig.key === 'created') {
                    aVal = a.createdAt;
                    bVal = b.createdAt;
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Search candidates or roles..."
                    className="pl-9 bg-slate-50 border-slate-200"
                    value={searchQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                />
            </div>

            <DataTable<SessionSummary>
                columns={[
                    {
                        header: (
                            <button onClick={() => handleSort('candidateName')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                                Candidate <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2 max-w-full">
                                    <span className="truncate font-semibold text-slate-900">{session.candidateName}</span>
                                    <AttemptBadge attemptNumber={session.attemptNumber} />
                                </div>
                            </div>
                        ),
                        className: "w-[250px]"
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('role')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                                Role <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        accessorKey: "role",
                        className: "text-slate-600"
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('status')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                                Status <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => <StatusBadge session={session} />,
                        className: "w-[180px]"
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('readinessBand')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                                Readiness <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => <ReadinessBadge session={session} />,
                        className: "w-[180px] bg-gradient-to-br from-blue-50/50 to-blue-100/30"
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('engagedTimeSeconds')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                                Active <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <span className="text-slate-500 whitespace-nowrap text-sm font-medium">
                                {formatDuration(session.engagedTimeSeconds)}
                            </span>
                        )
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('updatedAt')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                                Last Activity <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <span className="text-slate-500 whitespace-nowrap text-sm">
                                {formatTimestamp(session.updatedAt || session.createdAt)}
                            </span>
                        )
                    },
                    {
                        header: (
                            <button onClick={() => handleSort('created')} className="flex items-center gap-1 hover:text-slate-900 transition-colors">
                                Created <ArrowUpDown className="w-3 h-3" />
                            </button>
                        ),
                        cell: (session) => (
                            <span className="text-slate-500 whitespace-nowrap text-sm">
                                {formatTimestamp(session.createdAt)}
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
                                    className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/5 transition-colors"
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
                                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                            title="Copy Invite Link"
                                            onClick={() => handleCopyLink(session.inviteToken!, session.id)}
                                        >
                                            {copiedId === session.id ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600 animate-in zoom-in-50" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    ) : null}
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete Session"
                                    disabled={isDeleting === session.id}
                                    onClick={() => handleDelete(session.id)}
                                >
                                    <Trash2 className={isDeleting === session.id ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
                                </Button>
                            </div>
                        )
                    }
                ]}
                data={filteredAndSortedSessions}
                onRowClick={(session) => router.push(`/recruiter/sessions/${session.id}`)}
                emptyState={
                    <div className="text-center py-12 text-slate-400 italic">
                        No sessions found.
                    </div>
                }
            />
            <p className="text-[11px] text-slate-400 px-1">
                Tip: Invite links are securely encrypted at rest to maintain SOC 2 compliance.
            </p>
        </div>
    );
}
