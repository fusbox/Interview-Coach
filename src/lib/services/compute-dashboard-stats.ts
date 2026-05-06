/**
 * Compute basic dashboard statistics from session summaries.
 *
 * This is a Layer 2 derived computation. By computing these client-side
 * from the already-fetched SessionSummary[], we eliminate a redundant
 * database round-trip that previously duplicated the sessions query.
 */

import { SessionSummary } from '@/lib/domain/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardBasicStats {
    totalInvites: number;
    activeSessions: number;
    completedSessions: number;
    stalledSessions: number;
    averageEngagementTimeSeconds: number;
}

// ---------------------------------------------------------------------------
// Main Function
// ---------------------------------------------------------------------------

export function computeDashboardStats(sessions: SessionSummary[]): DashboardBasicStats {
    const totalInvites = sessions.length;
    let activeSessions = 0;
    let completedSessions = 0;
    let stalledSessions = 0;
    let totalEngagedTime = 0;

    for (const s of sessions) {
        // Completed
        if (s.status === 'COMPLETED' || (s.submittedCount === s.questionCount && s.questionCount > 0)) {
            completedSessions++;
        } else if (['IN_SESSION', 'AWAITING_EVALUATION', 'REVIEWING'].includes(s.status)) {
            activeSessions++;
        }

        // Stalled: viewed but never progressed past NOT_STARTED
        if (s.viewedAt && s.status === 'NOT_STARTED') {
            stalledSessions++;
        }

        totalEngagedTime += (s.engagedTimeSeconds || 0);
    }

    return {
        totalInvites,
        activeSessions,
        completedSessions,
        stalledSessions,
        averageEngagementTimeSeconds: totalInvites > 0 ? totalEngagedTime / totalInvites : 0,
    };
}
