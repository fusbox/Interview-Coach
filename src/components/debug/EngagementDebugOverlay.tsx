import React, { useRef, useEffect, useState } from 'react';
import { useEngagementTracker } from '@/features/analytics/hooks/useEngagementTracker';
import { X, Trash2, Activity, Cpu, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

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
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
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
            <div className="flex flex-col max-h-[500px] border border-slate-200 shadow-xl bg-white rounded-lg overflow-hidden text-slate-800">
                {/* Header */}
                <div className="flex flex-col shrink-0 bg-slate-50 border-b border-slate-100">
                    <div className="flex items-center justify-between p-3 pb-2">
                        <span className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <Activity size={16} className={isWindowOpen ? 'text-emerald-500' : 'text-amber-500'} />
                            Debug Inspector
                        </span>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-900 transition-colors p-1 hover:bg-slate-200 rounded"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex px-2 gap-2">
                        <button
                            onClick={() => setActiveTab('engagement')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors",
                                activeTab === 'engagement' ? "bg-white text-emerald-600 border border-t border-x border-slate-200 translate-y-px" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <Activity size={14} /> Engagement
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-t-md transition-colors",
                                activeTab === 'ai' ? "bg-white text-purple-600 border border-t border-x border-slate-200 translate-y-px" : "text-slate-500 hover:text-slate-700"
                            )}
                        >
                            <Cpu size={14} /> AI Context
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-white">
                    {activeTab === 'engagement' && (
                        <>
                            {/* Metrics */}
                            <div className="grid grid-cols-2 gap-px bg-slate-100 border-b border-slate-100 shrink-0">
                                <div className="flex flex-col p-3 bg-white">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                                        Status
                                    </span>
                                    <span
                                        className={cn(
                                            'text-lg font-bold font-mono tracking-tight',
                                            isWindowOpen ? 'text-emerald-600' : 'text-amber-600'
                                        )}
                                    >
                                        {isWindowOpen ? 'ACTIVE' : 'IDLE'}
                                    </span>
                                </div>
                                <div className="flex flex-col p-3 bg-white">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
                                        Window Time
                                    </span>
                                    <span
                                        className={cn(
                                            'text-lg font-bold font-mono tracking-tight',
                                            windowTimeRemaining > 0 ? 'text-blue-600' : 'text-slate-300'
                                        )}
                                    >
                                        {windowTimeRemaining}s
                                    </span>
                                </div>
                                <div className="col-span-2 flex items-center justify-between p-2 bg-slate-50">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium pl-1">
                                        Session Total
                                    </span>
                                    <span className="font-mono text-blue-600 font-bold pr-1">
                                        {totalEngagedSeconds}s
                                    </span>
                                </div>
                            </div>

                            {/* Event Log */}
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 shrink-0 border-b border-slate-100">
                                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                                    Event Log
                                </span>
                                <button
                                    onClick={clearDebugEvents}
                                    className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-red-500 transition-colors uppercase font-medium"
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
                                                    'font-bold uppercase text-[10px] tracking-wide',
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
                                            <span className="text-[10px] text-slate-400 font-mono group-hover:text-slate-500 transition-colors">
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
                        <div className="flex-1 overflow-y-auto flex flex-col min-h-[300px] bg-white p-4 space-y-6">
                            {[
                                { key: 'tipsPrompt', label: 'Tips & Hints Generator', content: aiContexts?.tipsPrompt },
                                { key: 'strongResponsePrompt', label: 'Strong Response Generator', content: aiContexts?.strongResponsePrompt },
                                { key: 'analysisPrompt', label: 'Core Analysis Evaluator', content: aiContexts?.analysisPrompt }
                            ].map((item) => (
                                <div key={item.key} className="flex flex-col gap-2 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{item.label}</h3>
                                        <button
                                            disabled={!item.content}
                                            onClick={() => item.content && handleCopy(item.content, item.key)}
                                            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors bg-slate-100 px-2 py-1 rounded"
                                        >
                                            {copiedKey === item.key ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                            {copiedKey === item.key ? 'COPIED' : 'COPY RAW'}
                                        </button>
                                    </div>
                                    {item.content ? (
                                        <div className="bg-slate-900 rounded-md p-3 max-h-64 overflow-y-auto font-mono text-[10px] text-emerald-400 whitespace-pre-wrap leading-relaxed shadow-inner">
                                            {item.content}
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 text-slate-400 text-xs italic p-4 text-center rounded-md border border-slate-100">
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
