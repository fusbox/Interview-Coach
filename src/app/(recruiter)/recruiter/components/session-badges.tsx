"use client";

import React from "react";
import { SessionSummary, InterviewSession } from "@/lib/domain/types";
import { StatusBadge as CanonicalStatusBadge } from "@/components/patterns/StatusBadge";

const STATUS_WIDTH = "w-[160px] justify-center text-center";

type BadgeSession = SessionSummary | InterviewSession;

function getSessionProgress(session: BadgeSession) {
    if ('questions' in session) {
        const answerList = Object.values(session.answers || {});
        return {
            questionCount: session.questions.length,
            submittedCount: answerList.filter(a => !!a.submittedAt).length,
            answerCount: answerList.length
        };
    }
    return {
        questionCount: session.questionCount,
        submittedCount: session.submittedCount,
        answerCount: session.answerCount
    };
}

export function StatusBadge({ session }: { session: BadgeSession }) {
    const { status, viewedAt, enteredInitials } = session;
    const { questionCount, submittedCount, answerCount } = getSessionProgress(session);

    if (status === 'COMPLETED' || (submittedCount === questionCount && questionCount > 0)) {
        return <CanonicalStatusBadge variant="progressComplete" icon={false} className={STATUS_WIDTH} fullWidth={false}>Completed</CanonicalStatusBadge>;
    }

    if (submittedCount > 0) {
        return <CanonicalStatusBadge variant="progressSolid" icon={false} className={STATUS_WIDTH} fullWidth={false}>In Progress ({submittedCount}/{questionCount})</CanonicalStatusBadge>;
    }

    if (status === 'IN_SESSION' && answerCount > 0) {
        return <CanonicalStatusBadge variant="progressActive" icon={false} className={STATUS_WIDTH} fullWidth={false}>Drafting Answer</CanonicalStatusBadge>;
    }

    if (status === 'IN_SESSION') {
        return <CanonicalStatusBadge variant="progressStarted" icon={false} className={STATUS_WIDTH} fullWidth={false}>Session Started</CanonicalStatusBadge>;
    }

    if (enteredInitials) {
        return <CanonicalStatusBadge variant="progressStarted" icon={false} className={STATUS_WIDTH} fullWidth={false}>Initials Entered</CanonicalStatusBadge>;
    }

    if (viewedAt) {
        return <CanonicalStatusBadge variant="progressViewed" icon={false} className={STATUS_WIDTH} fullWidth={false}>Link Viewed</CanonicalStatusBadge>;
    }

    return <CanonicalStatusBadge variant="progressIdle" icon={false} size="sm" className={STATUS_WIDTH} fullWidth={false}>Invite Sent</CanonicalStatusBadge>;
}

export function AttemptBadge({ attemptNumber }: { attemptNumber?: number }) {
    if (!attemptNumber || attemptNumber <= 1) return null;
    return (
        <CanonicalStatusBadge variant="neutral" icon={false} size="sm" className="text-[9px] whitespace-nowrap shrink-0 px-1.5 h-4 min-w-fit">
            Attempt {attemptNumber}
        </CanonicalStatusBadge>
    );
}

export function InitialsMatchBadge({ session }: { session: SessionSummary }) {
    const { enteredInitials, candidateFirstName, candidateLastName } = session;

    if (!enteredInitials) {
        return (
            <div className="flex items-center justify-center w-5 h-5" title="No initials entered yet">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
            </div>
        );
    }

    const first = candidateFirstName?.trim()[0] || "";
    const last = candidateLastName?.trim()[0] || "";
    const expected = (first + last).toUpperCase();

    const isMatch = enteredInitials.trim().toUpperCase() === expected;

    if (isMatch) {
        return (
            <div className="flex items-center justify-center w-5 h-5" title={`Initials Match (${expected})`}>
                <div className="w-2 h-2 rounded-full bg-green-500/60" />
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center w-5 h-5" title={`Initials Mismatch (Expected: ${expected}, Entered: ${enteredInitials})`}>
            <div className="w-2 h-2 rounded-full bg-red-400/60" />
        </div>
    );
}
