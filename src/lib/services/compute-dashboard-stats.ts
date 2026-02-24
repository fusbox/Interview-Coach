/**
 * Compute basic dashboard statistics from session summaries.
 *
 * This is a Layer 2 derived computation. By computing these client-side
 * from the already-fetched SessionSummary[], we eliminate a redundant
 * Supabase round-trip that previously duplicated the sessions query.
 *
 * For eval-derived insights (coaching focus, observations), use
 * getRecruiterInsights() which fetches only eval_results.
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
    readinessDistribution: Record<'RL1' | 'RL2' | 'RL3' | 'RL4', number>;
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
    const readinessDistribution: Record<'RL1' | 'RL2' | 'RL3' | 'RL4', number> = {
        RL1: 0, RL2: 0, RL3: 0, RL4: 0,
    };

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

        if (s.readinessBand && s.readinessBand in readinessDistribution) {
            readinessDistribution[s.readinessBand]++;
        }
    }

    return {
        totalInvites,
        activeSessions,
        completedSessions,
        stalledSessions,
        averageEngagementTimeSeconds: totalInvites > 0 ? totalEngagedTime / totalInvites : 0,
        readinessDistribution,
    };
}
