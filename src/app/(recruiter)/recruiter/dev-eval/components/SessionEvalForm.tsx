"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Save, CheckCircle2 } from 'lucide-react';
import { InterviewSession } from '@/lib/domain/types';
import { EVAL_RUBRIC_DIMENSIONS, SessionEval, EvalRubricScore, EvalDimensionId } from '../types';

interface SessionEvalFormProps {
    session: InterviewSession;
}

function createEmptyEval(session: InterviewSession): SessionEval {
    return {
        sessionId: session.id,
        evaluatedAt: Date.now(),
        overallScore: 0,
        overallNotes: '',
        questionEvals: session.questions.map(q => ({
            questionId: q.id,
            scores: EVAL_RUBRIC_DIMENSIONS.map(d => ({
                dimension: d.id,
                score: 0,
                comment: '',
            })),
            notes: '',
        })),
    };
}

function loadEval(sessionId: string): SessionEval | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(`dev-eval-${sessionId}`);
        return stored ? JSON.parse(stored) : null;
    } catch { return null; }
}

function saveEval(eval_: SessionEval) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`dev-eval-${eval_.sessionId}`, JSON.stringify({
        ...eval_,
        evaluatedAt: Date.now(),
    }));
}

// ─── Star Rating Widget ────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(n => (
                <button
                    key={n}
                    onClick={() => onChange(n === value ? 0 : n)}
                    className={`w-6 h-6 text-sm font-bold rounded transition-colors ${n <= value
                        ? 'bg-amber-400 text-white'
                        : 'bg-slate-100 text-slate-400 hover:bg-amber-100'
                        }`}
                >
                    {n}
                </button>
            ))}
        </div>
    );
}

// ─── Main Form ─────────────────────────────────────────────────

export function SessionEvalForm({ session }: SessionEvalFormProps) {
    const [eval_, setEval] = useState<SessionEval>(() => loadEval(session.id) || createEmptyEval(session));
    const [saved, setSaved] = useState(false);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-save debounce
    const debouncedSave = useCallback((e: SessionEval) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            saveEval(e);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 800);
    }, []);

    useEffect(() => {
        return () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); };
    }, []);

    const updateQuestionScore = (qIdx: number, dimension: EvalDimensionId, score: number) => {
        setEval(prev => {
            const next = { ...prev };
            next.questionEvals = [...prev.questionEvals];
            const qEval = { ...next.questionEvals[qIdx] };
            qEval.scores = qEval.scores.map(s =>
                s.dimension === dimension ? { ...s, score } : s
            );
            next.questionEvals[qIdx] = qEval;
            debouncedSave(next);
            return next;
        });
    };

    const updateQuestionComment = (qIdx: number, dimension: EvalDimensionId, comment: string) => {
        setEval(prev => {
            const next = { ...prev };
            next.questionEvals = [...prev.questionEvals];
            const qEval = { ...next.questionEvals[qIdx] };
            qEval.scores = qEval.scores.map(s =>
                s.dimension === dimension ? { ...s, comment } : s
            );
            next.questionEvals[qIdx] = qEval;
            debouncedSave(next);
            return next;
        });
    };

    const updateQuestionNotes = (qIdx: number, notes: string) => {
        setEval(prev => {
            const next = { ...prev };
            next.questionEvals = [...prev.questionEvals];
            next.questionEvals[qIdx] = { ...next.questionEvals[qIdx], notes };
            debouncedSave(next);
            return next;
        });
    };

    const handleManualSave = () => {
        saveEval(eval_);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-8">
            {/* Overall Session Eval */}
            <Card className="border-violet-200 bg-violet-50/30">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-display">Overall Session Evaluation</CardTitle>
                        <div className="flex items-center gap-2">
                            {saved && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 animate-in fade-in">
                                    <CheckCircle2 className="w-3 h-3" />
                                </Badge>
                            )}
                            <Button size="sm" variant="outline" onClick={handleManualSave}>
                                <Save className="w-4 h-4 mr-1" /> Save
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-700">Overall Quality:</span>
                        <StarRating
                            value={eval_.overallScore}
                            onChange={(n) => {
                                const next = { ...eval_, overallScore: n };
                                setEval(next);
                                debouncedSave(next);
                            }}
                        />
                        <div className="ml-auto">
                            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-micro font-bold">
                                AGGREGATE READINESS: {session.readinessBand || 'N/A'}
                            </Badge>
                        </div>
                    </div>
                    <textarea
                        className="flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-300"
                        placeholder="Overall notes about this session (strengths, patterns, areas for improvement)..."
                        value={eval_.overallNotes}
                        onChange={e => {
                            const next = { ...eval_, overallNotes: e.target.value };
                            setEval(next);
                            debouncedSave(next);
                        }}
                    />

                    {session.summaryNarrative && (
                        <div className="pt-2">
                            <h4 className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">AI Generated Summary Narrative</h4>
                            <div className="bg-white/60 p-3 rounded border border-violet-100 text-xs text-slate-600 leading-relaxed italic">
                                &ldquo;{session.summaryNarrative}&rdquo;
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Per-Question Evaluation */}
            {session.questions.map((question, qIdx) => {
                const answer = session.answers[question.id];
                const hasAnswer = !!answer;
                const qEval = eval_.questionEvals[qIdx];

                return (
                    <Card key={question.id} className="overflow-hidden border-slate-200 shadow-sm">
                        {/* Question Header */}
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Question {qIdx + 1} · {question.category}
                                    </span>
                                    <h3 className="text-base font-medium text-slate-900 leading-snug">
                                        {question.text}
                                    </h3>
                                </div>
                                {hasAnswer ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shrink-0">Answered</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-slate-400 border-slate-200 shrink-0">Pending</Badge>
                                )}
                            </div>
                        </CardHeader>

                        <CardContent className="p-6 space-y-6">
                            {/* Candidate Response */}
                            {hasAnswer && (
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
                            )}

                            {/* AI Analysis Summary */}
                            {answer?.analysis && (
                                <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100/50 space-y-2">
                                    <h4 className="text-sm font-semibold text-blue-700">AI Feedback Summary</h4>
                                    {answer.analysis.ack && (
                                        <p className="text-sm text-blue-900"><strong>Ack:</strong> {answer.analysis.ack}</p>
                                    )}
                                    {answer.analysis.contentPulse && (
                                        <p className="text-sm text-blue-900">
                                            <strong>Content:</strong> {answer.analysis.contentPulse.headline}
                                        </p>
                                    )}
                                    {answer.analysis.deliveryPulse && (
                                        <p className="text-sm text-blue-900">
                                            <strong>Delivery:</strong> {answer.analysis.deliveryPulse.headline}
                                        </p>
                                    )}
                                    {answer.analysis.nextAction && (
                                        <p className="text-sm text-blue-900">
                                            <strong>Next Action:</strong> {answer.analysis.nextAction.label} ({answer.analysis.nextAction.actionType})
                                        </p>
                                    )}
                                    {answer.analysis.readinessBand && (
                                        <div className="pt-1">
                                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-micro font-bold">
                                                AI READINESS: {answer.analysis.readinessBand}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Evaluation Inputs */}
                            <div className="border-t border-slate-100 pt-6">
                                <h4 className="text-sm font-bold text-violet-700 mb-4">📋 Evaluation</h4>
                                <div className="space-y-4">
                                    {EVAL_RUBRIC_DIMENSIONS.map(dim => {
                                        const scoreObj = qEval?.scores.find(
                                            (s: EvalRubricScore) => s.dimension === dim.id
                                        );

                                        return (
                                            <div key={dim.id} className="grid grid-cols-1 md:grid-cols-[200px_auto_1fr] gap-2 md:gap-4 items-start">
                                                <div>
                                                    <span className="text-sm font-medium text-slate-700">{dim.label}</span>
                                                    <p className="text-[11px] text-slate-400 leading-tight">{dim.description}</p>
                                                </div>
                                                <StarRating
                                                    value={scoreObj?.score || 0}
                                                    onChange={(n) => updateQuestionScore(qIdx, dim.id, n)}
                                                />
                                                <input
                                                    className="h-8 w-full rounded border bg-white px-2 text-xs placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-200"
                                                    placeholder="Comment..."
                                                    value={scoreObj?.comment || ''}
                                                    onChange={e => updateQuestionComment(qIdx, dim.id, e.target.value)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Question-level notes */}
                                <textarea
                                    className="mt-4 flex min-h-[60px] w-full rounded-md border bg-white px-3 py-2 text-xs placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-violet-200"
                                    placeholder="Additional notes for this question..."
                                    value={qEval?.notes || ''}
                                    onChange={e => updateQuestionNotes(qIdx, e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
