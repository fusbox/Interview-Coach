import React from 'react';
import { CheckCircle2, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { QuestionTips, StrongResponseResult } from '@/lib/domain/types';

interface CoachLensDropdownProps {
    mode: 'hints' | 'example';
    tips?: QuestionTips | null;
    strongResponse?: StrongResponseResult | null;
    isLoading: boolean;
    className?: string;
}

export function CoachLensDropdown({
    mode,
    tips,
    strongResponse,
    isLoading,
    className
}: CoachLensDropdownProps) {

    if (isLoading) {
        return (
            <div className={cn("w-full rounded-2xl border border-border p-8 bg-surface-base", className)}>
                <div className="flex flex-col items-center justify-center space-y-3 text-text-muted">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <p className="text-sm font-medium">
                        {mode === 'hints' ? 'Analyzing question...' : 'Generating example...'}
                    </p>
                </div>
            </div>
        );
    }

    if (mode === 'hints' && tips) {
        return (
            <div className={cn("w-full", className)}>
                {/* Desktop: 2-column layout */}
                <div className="hidden md:grid md:grid-cols-2 gap-3">
                    <HintCard
                        type="do"
                        title="What to Aim For"
                        text={tips.doThis}
                        icon={<CheckCircle2 size={16} />}
                    />
                    <HintCard
                        type="avoid"
                        title="What to Avoid"
                        text={tips.avoidThis}
                        icon={<AlertTriangle size={16} />}
                    />
                </div>

                {/* Mobile: stacked layout */}
                <div className="md:hidden space-y-3">
                    <HintCard
                        type="do"
                        title="What to Aim For"
                        text={tips.doThis}
                        icon={<CheckCircle2 size={16} />}
                    />
                    <HintCard
                        type="avoid"
                        title="What to Avoid"
                        text={tips.avoidThis}
                        icon={<AlertTriangle size={16} />}
                    />
                </div>
            </div>
        );
    }

    if (mode === 'example' && strongResponse) {
        return (
            <div className={cn("w-full space-y-3", className)}>
                {/* Strong Response Card */}
                <div className="rounded-2xl border border-purple-200/60 dark:border-purple-500/20 bg-purple-50/50 dark:bg-purple-900/10 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-purple-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                            Example Strong Response
                        </span>
                    </div>
                    <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                        {strongResponse.strongResponse}
                    </p>
                </div>

                {/* Why This Works */}
                {strongResponse.whyThisWorks && (
                    <div className="rounded-2xl border border-border/60 bg-surface-subtle p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={16} className="text-emerald-500" />
                            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                                Why This Works
                            </span>
                        </div>
                        <p className="text-text-secondary text-sm leading-relaxed">
                            {strongResponse.whyThisWorks}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    return null;
}

// --- Subcomponent ---

function HintCard({
    type,
    title,
    text,
    icon
}: {
    type: 'do' | 'avoid';
    title: string;
    text: string;
    icon: React.ReactNode;
}) {
    const isDo = type === 'do';
    return (
        <div className={cn(
            "rounded-2xl border p-5 transition-colors",
            isDo
                ? "border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/60 dark:bg-emerald-900/10"
                : "border-rose-200/60 dark:border-rose-500/20 bg-rose-50/60 dark:bg-rose-900/10"
        )}>
            <div className="flex items-center gap-2 mb-2.5">
                <span className={cn(isDo ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                    {icon}
                </span>
                <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    isDo ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
                )}>
                    {title}
                </span>
            </div>
            <p className={cn(
                "text-sm leading-relaxed",
                isDo ? "text-emerald-900 dark:text-emerald-100/90" : "text-rose-900 dark:text-rose-100/90"
            )}>
                {text}
            </p>
        </div>
    );
}
