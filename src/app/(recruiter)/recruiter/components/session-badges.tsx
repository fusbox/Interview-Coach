"use client";

import React from "react";
import { SessionSummary, InterviewSession } from "@/lib/domain/types";
import { ReadinessTooltip } from "./ReadinessTooltip";
import { StatusBadge as CanonicalStatusBadge } from "@/components/patterns/StatusBadge";

// ---------------------------------------------------------------------------
// Status Badge — 7-state session status taxonomy
// Uses canonical StatusBadge for rendering, maps session state to variants.
// ---------------------------------------------------------------------------

const STATUS_WIDTH = "w-[160px] justify-center text-center";

type BadgeSession = SessionSummary | InterviewSession;

function getSessionProgress(session: BadgeSession) {
    if ('questions' in session) {
        // Full InterviewSession
        const answerList = Object.values(session.answers || {});
        return {
            questionCount: session.questions.length,
            submittedCount: answerList.filter(a => !!a.submittedAt).length,
            answerCount: answerList.length
        };
    }
    // SessionSummary
    return {
        questionCount: session.questionCount,
        submittedCount: session.submittedCount,
        answerCount: session.answerCount
    };
}

export function StatusBadge({ session }: { session: BadgeSession }) {
    const { status, viewedAt, enteredInitials } = session;
    const { questionCount, submittedCount, answerCount } = getSessionProgress(session);

    // 1. Completed
    if (status === 'COMPLETED' || (submittedCount === questionCount && questionCount > 0)) {
        return <CanonicalStatusBadge variant="progressComplete" icon={false} className={STATUS_WIDTH} fullWidth={false}>Completed</CanonicalStatusBadge>;
    }

    // 2. In Progress (X/Y submitted)
    if (submittedCount > 0) {
        return <CanonicalStatusBadge variant="progressSolid" icon={false} className={STATUS_WIDTH} fullWidth={false}>In Progress ({submittedCount}/{questionCount})</CanonicalStatusBadge>;
    }

    // 3. Drafting Answer
    if (status === 'IN_SESSION' && answerCount > 0) {
        return <CanonicalStatusBadge variant="progressActive" icon={false} className={STATUS_WIDTH} fullWidth={false}>Drafting Answer</CanonicalStatusBadge>;
    }

    // 4. Session Started
    if (status === 'IN_SESSION') {
        return <CanonicalStatusBadge variant="progressStarted" icon={false} className={STATUS_WIDTH} fullWidth={false}>Session Started</CanonicalStatusBadge>;
    }

    // 5. Initials Entered
    if (enteredInitials) {
        return <CanonicalStatusBadge variant="progressStarted" icon={false} className={STATUS_WIDTH} fullWidth={false}>Initials Entered</CanonicalStatusBadge>;
    }

    // 6. Link Viewed
    if (viewedAt) {
        return <CanonicalStatusBadge variant="progressViewed" icon={false} className={STATUS_WIDTH} fullWidth={false}>Link Viewed</CanonicalStatusBadge>;
    }

    // 7. Invite Sent
    return <CanonicalStatusBadge variant="progressIdle" icon={false} size="sm" className={STATUS_WIDTH} fullWidth={false}>Invite Sent</CanonicalStatusBadge>;
}

// ---------------------------------------------------------------------------
// Readiness Badge — RL1-RL4 readiness band with tooltip
// ---------------------------------------------------------------------------

const READINESS_WIDTH = "w-[160px] justify-center text-center";

const READINESS_MAP: Record<string, { label: string; variant: "readinessHigh" | "readinessPotential" | "readinessMedium" | "readinessLow" | "readinessUnknown" }> = {
    RL1: { label: 'Ready', variant: 'readinessHigh' },
    RL2: { label: 'Strong Potential', variant: 'readinessPotential' },
    RL3: { label: 'Practice Recommended', variant: 'readinessMedium' },
    RL4: { label: 'Incomplete', variant: 'readinessUnknown' },
};

export function ReadinessBadge({ session }: { session: BadgeSession }) {
    const rl = session.readinessBand;
    if (!rl && !session.summaryNarrative) return <span className="text-slate-300 text-xs">—</span>;

    const mapped = rl ? READINESS_MAP[rl] : null;
    const badge = mapped
        ? <CanonicalStatusBadge variant={mapped.variant} icon={false} size="sm" className={READINESS_WIDTH}>{mapped.label}</CanonicalStatusBadge>
        : <CanonicalStatusBadge variant="neutral" icon={false} size="sm" className={READINESS_WIDTH}>Analyzing...</CanonicalStatusBadge>;

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
        <CanonicalStatusBadge variant="neutral" icon={false} size="sm">
            Attempt {attemptNumber}
        </CanonicalStatusBadge>
    );
}
