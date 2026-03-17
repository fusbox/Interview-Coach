import React, { useRef, useEffect, useState } from 'react';
import { useEngagementTracker } from '@/features/analytics/hooks/useEngagementTracker';
import { Trash2, X, Check, Activity, Cpu, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { FeedbackPill } from '../patterns/FeedbackPill';

interface EngagementDebugOverlayProps {
    isVisible: boolean;
    onClose: () => void;
    tracker: ReturnType<typeof useEngagementTracker>;
    aiContexts?: {
        tipsPrompt?: string;
        strongResponsePrompt?: string;
        analysisPrompt?: string;
    };
}

export const EngagementDebugOverlay: React.FC<EngagementDebugOverlayProps> = ({
    isVisible,
    onClose,
    tracker,
    aiContexts
}) => {
    const { isWindowOpen, totalEngagedSeconds, windowTimeRemaining, debugEvents, clearDebugEvents } =
        tracker;
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'engagement' | 'ai'>('engagement');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    // Auto-scroll to top of list (newest first)
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0;
        }
    }, [debugEvents, activeTab]);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 w-80 md:w-96 font-sans animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex flex-col max-h-[500px] border border-border shadow-floating bg-surface-base rounded-lg overflow-hidden text-text-primary">
                {/* Header */}
                <div className="flex flex-col shrink-0 bg-surface-subtle border-b border-border">
                    <div className="flex items-center justify-between p-3 pb-2">
                        <span className="font-bold text-sm text-text-primary flex items-center gap-2">
                            <Activity size={16} className={isWindowOpen ? 'text-state-success' : 'text-state-warning'} />
                            Debug Inspector
                        </span>
                        <button
                            onClick={onClose}
                            className="text-text-muted hover:text-text-primary transition-colors p-1 hover:bg-surface-raised rounded"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex px-2 gap-2">
                        <button
                            onClick={() => setActiveTab('engagement')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors",
                                activeTab === 'engagement' ? "bg-surface-base text-state-success border border-t border-x border-border translate-y-px" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <Activity size={14} /> Engagement
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors",
                                activeTab === 'ai' ? "bg-surface-base text-accent-alt border border-t border-x border-border translate-y-px" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <Cpu size={14} /> AI Context
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-surface-base">
                    {activeTab === 'engagement' && (
                        <>
                            {/* Metrics */}
                            <div className="grid grid-cols-2 gap-px bg-border border-b border-border shrink-0">
                                <div className="flex flex-col p-3 bg-surface-base">
                                    <span className="text-micro uppercase tracking-wider text-text-muted font-medium">
                                        Status
                                    </span>
                                    <span
                                        className={cn(
                                            'text-lg font-bold font-mono',
                                            isWindowOpen ? 'text-state-success' : 'text-state-warning'
                                        )}
                                    >
                                        {isWindowOpen ? 'ACTIVE' : 'IDLE'}
                                    </span>
                                </div>
                                <div className="flex flex-col p-3 bg-surface-base">
                                    <span className="text-micro uppercase tracking-wider text-text-muted font-medium">
                                        Window Time
                                    </span>
                                    <span
                                        className={cn(
                                            'text-lg font-bold font-mono',
                                            windowTimeRemaining > 0 ? 'text-state-info' : 'text-text-muted'
                                        )}
                                    >
                                        {windowTimeRemaining}s
                                    </span>
                                </div>
                                <div className="col-span-2 flex items-center justify-between p-2 bg-surface-subtle">
                                    <span className="text-micro uppercase tracking-wider text-text-muted font-medium pl-1">
                                        Session Total
                                    </span>
                                    <span className="font-mono text-state-info font-bold pr-1">
                                        {totalEngagedSeconds}s
                                    </span>
                                </div>
                            </div>

                            {/* Event Log */}
                            <div className="flex items-center justify-between px-3 py-2 bg-surface-subtle shrink-0 border-b border-border">
                                <span className="text-micro uppercase text-text-muted font-bold tracking-wider">
                                    Event Log
                                </span>
                                <button
                                    onClick={clearDebugEvents}
                                    className="text-micro flex items-center gap-1 text-text-muted hover:text-state-critical transition-colors uppercase font-medium"
                                >
                                    <Trash2 size={10} /> Clear
                                </button>
                            </div>

                            <div
                                ref={scrollRef}
                                className="overflow-y-auto p-2 space-y-1 flex-1 min-h-[200px]"
                            >
                                {debugEvents.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                                        <Activity size={24} className="opacity-20" />
                                        <span className="text-xs italic">Waiting for events...</span>
                                    </div>
                                )}
                                {debugEvents.map((ev) => (
                                    <div
                                        key={ev.id}
                                        className="text-xs p-2 rounded bg-slate-50 border border-slate-100 flex flex-col gap-1 hover:bg-slate-100 transition-colors group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span
                                                className={cn(
                                                    'font-bold uppercase text-micro tracking-wide',
                                                    ev.type === 'WINDOW_OPEN'
                                                        ? 'text-emerald-600'
                                                        : ev.type === 'WINDOW_EXTEND'
                                                            ? 'text-blue-600'
                                                            : ev.type === 'WINDOW_CLOSE'
                                                                ? 'text-red-500'
                                                                : ev.type === 'TRACK_EVENT'
                                                                    ? 'text-cyan-600'
                                                                    : 'text-amber-600'
                                                )}
                                            >
                                                {ev.type.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-micro text-slate-400 font-mono group-hover:text-slate-500 transition-colors">
                                                {new Date(ev.timestamp).toLocaleTimeString().split(' ')[0]}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-slate-600 truncate">{ev.details}</span>
                                            {ev.tier && (
                                                <span
                                                    className={cn(
                                                        'text-[9px] px-1.5 py-0.5 rounded-full uppercase font-medium shrink-0',
                                                        ev.tier === 'tier3'
                                                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                                            : ev.tier === 'tier2'
                                                                ? 'bg-cyan-100 text-cyan-700 border border-cyan-200'
                                                                : 'bg-slate-100 text-slate-500'
                                                    )}
                                                >
                                                    {ev.tier}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {activeTab === 'ai' && (
                        <div className="flex-1 overflow-y-auto flex flex-col min-h-[300px] bg-surface-base p-4 space-y-6">
                            {[
                                { key: 'tipsPrompt', label: 'Tips & Hints Generator', content: aiContexts?.tipsPrompt },
                                { key: 'strongResponsePrompt', label: 'Strong Response Generator', content: aiContexts?.strongResponsePrompt },
                                { key: 'analysisPrompt', label: 'Core Analysis Evaluator', content: aiContexts?.analysisPrompt }
                            ].map((item) => (
                                <div key={item.key} className="flex flex-col gap-2 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{item.label}</h3>
                                        <div className="relative">
                                            <button
                                                disabled={!item.content}
                                                onClick={() => item.content && handleCopy(item.content, item.key)}
                                                className="flex items-center gap-1 text-micro font-bold text-text-muted hover:text-text-primary disabled:opacity-30 disabled:hover:text-text-muted transition-colors bg-surface-subtle px-2 py-1 rounded"
                                            >
                                                {copiedKey === item.key ? <Check size={12} className="text-state-success" /> : <Copy size={12} />}
                                                {copiedKey === item.key ? 'COPIED' : 'COPY RAW'}
                                            </button>
                                            <FeedbackPill isVisible={copiedKey === item.key} text="Copied" />
                                        </div>
                                    </div>
                                    {item.content ? (
                                        <div className="bg-slate-900 rounded-md p-3 max-h-64 overflow-y-auto font-mono text-micro text-emerald-400 whitespace-pre-wrap leading-relaxed shadow-inner">
                                            {item.content}
                                        </div>
                                    ) : (
                                        <div className="bg-surface-subtle text-text-muted text-xs italic p-4 text-center rounded-md border border-border">
                                            Prompt snapshot not yet captured for this session stage.
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
