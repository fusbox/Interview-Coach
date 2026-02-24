"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { SessionSummary } from "@/lib/domain/types";
import { ReadinessTooltip } from "./ReadinessTooltip";

// ---------------------------------------------------------------------------
// Status Badge — 7-state session status taxonomy
// ---------------------------------------------------------------------------

const STATUS_CLASSES = "w-[145px] justify-center text-center";

export function StatusBadge({ session }: { session: SessionSummary }) {
    const { status, answerCount, questionCount, submittedCount, viewedAt, enteredInitials } = session;

    // 1. Completed
    if (status === 'COMPLETED' || (submittedCount === questionCount && questionCount > 0)) {
        return <Badge variant="default" className={`${STATUS_CLASSES} bg-green-600 hover:bg-green-700`}>Completed</Badge>;
    }

    // 2. In Progress (X/Y submitted)
    if (submittedCount > 0) {
        return <Badge variant="secondary" className={`${STATUS_CLASSES} bg-blue-100 text-blue-800 hover:bg-blue-200`}>
            In Progress ({submittedCount}/{questionCount})
        </Badge>;
    }

    // 3. Drafting Answer
    if (status === 'IN_SESSION' && answerCount > 0) {
        return <Badge variant="secondary" className={`${STATUS_CLASSES} bg-indigo-100 text-indigo-800 border-indigo-200`}>
            Drafting Answer
        </Badge>;
    }

    // 4. Session Started
    if (status === 'IN_SESSION') {
        return <Badge variant="secondary" className={`${STATUS_CLASSES} bg-blue-50 text-blue-700 border-blue-100`}>
            Session Started
        </Badge>;
    }

    // 5. Initials Entered
    if (enteredInitials) {
        return <Badge variant="outline" className={`${STATUS_CLASSES} text-amber-600 border-amber-200 bg-amber-50`}>
            Initials Entered
        </Badge>;
    }

    // 6. Link Viewed
    if (viewedAt) {
        return <Badge variant="outline" className={`${STATUS_CLASSES} text-indigo-500 border-indigo-200`}>
            Link Viewed
        </Badge>;
    }

    // 7. Invite Sent
    return <Badge variant="outline" className={`${STATUS_CLASSES} text-slate-400 border-slate-200 text-[10px]`}>
        Invite Sent
    </Badge>;
}

// ---------------------------------------------------------------------------
// Readiness Badge — RL1-RL4 readiness band with tooltip
// ---------------------------------------------------------------------------

const READINESS_CLASSES = "w-[125px] justify-center text-center text-[10px] uppercase font-bold tracking-tight";

const READINESS_CONFIG: Record<string, { label: string; className: string }> = {
    RL1: { label: 'Ready', className: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
    RL2: { label: 'Strong Potential', className: 'text-blue-700 border-blue-200 bg-blue-50' },
    RL3: { label: 'Practice Recommended', className: 'text-amber-700 border-amber-200 bg-amber-50' },
    RL4: { label: 'Incomplete', className: 'text-slate-500 border-slate-200 bg-slate-50' },
};

export function ReadinessBadge({ session }: { session: SessionSummary }) {
    const rl = session.readinessBand;
    if (!rl && !session.summaryNarrative) return <span className="text-slate-300 text-xs">—</span>;

    const config = rl ? READINESS_CONFIG[rl] : null;
    const badge = config
        ? <Badge variant="outline" className={`${READINESS_CLASSES} ${config.className}`}>{config.label}</Badge>
        : <Badge variant="outline" className={`${READINESS_CLASSES} text-slate-400 border-slate-200`}>Analyzing...</Badge>;

    return (
        <ReadinessTooltip narrative={session.summaryNarrative}>
            {badge}
        </ReadinessTooltip>
    );
}

// ---------------------------------------------------------------------------
// Attempt Badge — shows attempt number for retries
// ---------------------------------------------------------------------------

export function AttemptBadge({ attemptNumber }: { attemptNumber?: number }) {
    if (!attemptNumber || attemptNumber <= 1) return null;
    return (
        <Badge variant="outline" className="text-[9px] font-bold text-slate-500 border-slate-200 bg-slate-50 px-1.5 py-0">
            Attempt {attemptNumber}
        </Badge>
    );
}
