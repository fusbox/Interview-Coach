"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Eye, CheckSquare, Square, ChevronDown, ChevronRight, History } from 'lucide-react';
import { SessionSummary } from '@/lib/domain/types';
import { SessionEval, ExportSessionPayload } from '../types';
import { buildBatchPayload, downloadJson } from '../export-utils';

interface DevEvalTableProps {
    sessions: SessionSummary[];
}

function getStatusBadge(session: SessionSummary) {
    const { status, answerCount, questionCount, submittedCount } = session;
    const commonClasses = "w-[120px] justify-center text-center text-[11px]";

    if (status === 'COMPLETED' || (submittedCount === questionCount && questionCount > 0)) {
        return <Badge variant="default" className={`${commonClasses} bg-green-600`}>Completed</Badge>;
    }
    if (submittedCount > 0) {
        return <Badge variant="secondary" className={`${commonClasses} bg-blue-100 text-blue-800`}>
            In Progress ({submittedCount}/{questionCount})
        </Badge>;
    }
    if (answerCount > 0) {
        return <Badge variant="secondary" className={`${commonClasses} bg-indigo-100 text-indigo-800`}>Drafting</Badge>;
    }
    if (status === 'IN_SESSION') {
        return <Badge variant="secondary" className={`${commonClasses} bg-blue-50 text-blue-700`}>Started</Badge>;
    }
    return <Badge variant="outline" className={`${commonClasses} text-slate-400`}>Not Started</Badge>;
}

function getEvalIndicator(sessionId: string): { hasEval: boolean; score: number | null } {
    if (typeof window === 'undefined') return { hasEval: false, score: null };
    try {
        const stored = localStorage.getItem(`dev-eval-${sessionId}`);
        if (stored) {
            const eval_: SessionEval = JSON.parse(stored);
            return { hasEval: true, score: eval_.overallScore };
        }
    } catch { /* ignore */ }
    return { hasEval: false, score: null };
}

export function DevEvalTable({ sessions }: DevEvalTableProps) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isExporting, setIsExporting] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const completedSessions = useMemo(
        () => sessions.filter(s => s.status === 'COMPLETED' || s.submittedCount > 0 || s.answerCount > 0),
        [sessions]
    );

    const toggleSelect = useCallback((id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        if (selected.size === completedSessions.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(completedSessions.map(s => s.id)));
        }
    }, [selected.size, completedSessions]);

    const handleExport = async () => {
        if (selected.size === 0) return;
        setIsExporting(true);

        try {
            // Fetch full session data for each selected session
            const sessionPayloads: ExportSessionPayload[] = [];

            for (const sessionId of Array.from(selected)) {
                const res = await fetch(`/api/dev/export-session/${sessionId}`);
                if (!res.ok) continue;
                const payload: ExportSessionPayload = await res.json();

                // Merge localStorage eval data
                try {
                    const stored = localStorage.getItem(`dev-eval-${sessionId}`);
                    if (stored) {
                        const eval_: SessionEval = JSON.parse(stored);
                        payload.overallEvaluation = {
                            score: eval_.overallScore,
                            notes: eval_.overallNotes,
                        };
                        // Merge per-question evals
                        for (const qEval of eval_.questionEvals) {
                            const qPayload = payload.questions.find(
                                (q, idx) => {
                                    // Match by index since questionId comes from client
                                    return idx === eval_.questionEvals.indexOf(qEval);
                                }
                            );
                            if (qPayload) {
                                qPayload.evaluation = {
                                    scores: qEval.scores,
                                    notes: qEval.notes,
                                };
                            }
                        }
                    }
                } catch { /* ignore localStorage parse errors */ }

                sessionPayloads.push(payload);
            }

            const batch = buildBatchPayload(sessionPayloads);
            const timestamp = new Date().toISOString().slice(0, 10);
            downloadJson(batch, `interview-coach-eval-${timestamp}.json`);
        } catch (e) {
            console.error('Export failed:', e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                    <CardTitle className="text-lg font-display">Test Sessions</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        {completedSessions.length} sessions with answers · {selected.size} selected
                    </p>
                </div>
                <Button
                    onClick={handleExport}
                    disabled={selected.size === 0 || isExporting}
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700"
                >
                    <Download className="w-4 h-4 mr-2" />
                    {isExporting ? 'Exporting...' : `Export ${selected.size > 0 ? `(${selected.size})` : ''}`}
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50">
                            <TableHead className="w-10 text-center">
                                <button onClick={toggleAll} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                    {selected.size === completedSessions.length && completedSessions.length > 0
                                        ? <CheckSquare className="w-4 h-4 text-violet-600" />
                                        : <Square className="w-4 h-4 text-slate-400" />
                                    }
                                </button>
                            </TableHead>
                            <TableHead>Candidate</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-center">Eval</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {completedSessions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-slate-400 italic">
                                    No sessions with answers yet. Create test sessions using the invite flow.
                                </TableCell>
                            </TableRow>
                        )}
                        {completedSessions.map(session => {
                            const isSelected = selected.has(session.id);
                            const { hasEval, score } = getEvalIndicator(session.id);
                            const hasAttempts = session.attempts && session.attempts.length > 0;
                            const isExpanded = expandedIds.has(session.id);

                            return (
                                <React.Fragment key={session.id}>
                                    <TableRow
                                        className={`${isSelected ? 'bg-violet-50/50' : ''} hover:bg-slate-50 transition-colors cursor-pointer`}
                                        onClick={() => router.push(`/recruiter/dev-eval/${session.id}`)}
                                    >
                                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => toggleSelect(session.id)} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                                {isSelected
                                                    ? <CheckSquare className="w-4 h-4 text-violet-600" />
                                                    : <Square className="w-4 h-4 text-slate-300" />
                                                }
                                            </button>
                                        </TableCell>
                                        <TableCell className="font-medium text-slate-900">
                                            <div className="flex items-center gap-2">
                                                {hasAttempts && (
                                                    <button
                                                        onClick={(e) => toggleExpand(session.id, e)}
                                                        className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400"
                                                    >
                                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                    </button>
                                                )}
                                                <div className="flex flex-col">
                                                    <span>{session.candidateName}</span>
                                                    {session.attemptNumber && session.attemptNumber > 1 && (
                                                        <span className="text-[10px] font-bold text-violet-500 uppercase">
                                                            Attempt #{session.attemptNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-600 text-sm">
                                            {session.role}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {getStatusBadge(session)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {hasEval ? (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    ★ {score}/5
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => router.push(`/recruiter/dev-eval/${session.id}`)}
                                                className="text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                                            >
                                                <Eye className="w-4 h-4 mr-1" /> Evaluate
                                            </Button>
                                        </TableCell>
                                    </TableRow>

                                    {/* Nested Attempts */}
                                    {isExpanded && session.attempts?.map((attempt) => (
                                        <TableRow
                                            key={attempt.id}
                                            className="bg-slate-50/30 hover:bg-violet-50/30 transition-colors border-b border-slate-100 cursor-pointer"
                                            onClick={() => router.push(`/recruiter/dev-eval/${attempt.id}`)}
                                        >
                                            <TableCell />
                                            <TableCell className="py-2 pl-10">
                                                <div className="flex items-center gap-2">
                                                    <History className="w-3 h-3 text-slate-400" />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-600">Attempt #{attempt.attemptNumber}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(attempt.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-400 italic">Lineage split</TableCell>
                                            <TableCell className="text-center">{getStatusBadge(attempt)}</TableCell>
                                            <TableCell className="text-center">
                                                {getEvalIndicator(attempt.id).hasEval ? '★' : '—'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs text-violet-500"
                                                    onClick={() => router.push(`/recruiter/dev-eval/${attempt.id}`)}
                                                >
                                                    Evaluate
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
