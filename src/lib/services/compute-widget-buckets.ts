/**
 * Recruiter Dashboard — Widget Bucketing Logic
 *
 * Transforms SessionSummary[] into 4 action-oriented buckets:
 *   1. Ready to Review  (completed sessions)
 *   2. Needs Follow-Up  (engaged but stale > 48h)
 *   3. Recently Active   (engaged and not stale)
 *   4. Awaiting Action   (first-attempt, never engaged)
 *
 * This is a Layer 2 derived computation (dashboard constitution §4).
 * Computed at render time, never persisted.
 */

import { SessionSummary } from '@/lib/domain/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WidgetBucketKey =
    | 'ready_to_review'
    | 'needs_followup'
    | 'recently_active'
    | 'awaiting_action';

export interface WidgetSession extends SessionSummary {
    /** Milliseconds since last activity. Computed at render time. */
    idleDurationMs: number;
    /** Human-readable idle label: "2d ago", "Just now", etc. */
    idleLabel: string;
    /** Whether this session has any evidence of candidate engagement. */
    hasEngagement: boolean;
}

export interface WidgetBucket {
    key: WidgetBucketKey;
    label: string;
    sessions: WidgetSession[];
    count: number;
    /** Bucket 4 only: count of never-engaged initial invites. */
    neverEngagedCount?: number;
    /** Bucket 4 only: oldest invite age label. */
    oldestNeverEngagedLabel?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Format an idle duration in milliseconds into a human-readable label.
 */
export function formatIdleLabel(ms: number): string {
    if (ms < HOUR_MS) return 'Just now';

    const hours = Math.floor(ms / HOUR_MS);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(ms / DAY_MS);
    if (days <= 6) return `${days}d ago`;
    if (days <= 13) return '1w ago';
    if (days <= 20) return '2w ago';
    if (days <= 27) return '3w ago';
    return '1mo+ ago';
}

/**
 * Check whether a session is completed.
 */
function isCompleted(s: SessionSummary): boolean {
    return (
        s.status === 'COMPLETED' ||
        (s.submittedCount === s.questionCount && s.questionCount > 0)
    );
}

/**
 * Check whether a session shows evidence of candidate engagement.
 */
function hasEngagementEvidence(s: SessionSummary): boolean {
    return !!(
        s.viewedAt ||
        s.enteredInitials ||
        s.status === 'IN_SESSION' ||
        s.answerCount > 0 ||
        s.submittedCount > 0
    );
}

/**
 * Check whether a session is a retry attempt (attempt >= 2).
 */
function isRetry(s: SessionSummary): boolean {
    return (s.attemptNumber ?? 1) >= 2;
}

/**
 * Get the last-activity timestamp for staleness computation.
 */
function lastActivity(s: SessionSummary): number {
    return s.updatedAt || s.createdAt;
}

/**
 * Enrich a SessionSummary with computed widget fields.
 */
function toWidgetSession(s: SessionSummary, now: number): WidgetSession {
    const idleDurationMs = Math.max(0, now - lastActivity(s));
    return {
        ...s,
        idleDurationMs,
        idleLabel: formatIdleLabel(idleDurationMs),
        hasEngagement: hasEngagementEvidence(s),
    };
}

// ---------------------------------------------------------------------------
// Main Function
// ---------------------------------------------------------------------------

/**
 * Compute the 4 action-oriented widget buckets from a list of session summaries.
 *
 * @param sessions  – The recruiter's session summaries (from listByRecruiter)
 * @param now       – Injectable current time in epoch ms (defaults to Date.now())
 * @returns           Array of 4 WidgetBucket objects, always in bucket order
 */
export function computeWidgetBuckets(
    sessions: SessionSummary[],
    now: number = Date.now()
): WidgetBucket[] {
    const readyToReview: WidgetSession[] = [];
    const needsFollowup: WidgetSession[] = [];
    const recentlyActive: WidgetSession[] = [];
    const awaitingAction: WidgetSession[] = [];

    for (const session of sessions) {
        const ws = toWidgetSession(session, now);

        // Bucket 1: Completed
        if (isCompleted(session)) {
            readyToReview.push(ws);
            continue;
        }

        // Has engagement evidence?
        if (ws.hasEngagement) {
            // Stale check
            if (ws.idleDurationMs > STALE_THRESHOLD_MS) {
                // Bucket 2: Stale + engaged
                needsFollowup.push(ws);
            } else {
                // Bucket 3: Active + engaged
                recentlyActive.push(ws);
            }
            continue;
        }

        // No engagement
        if (isRetry(session)) {
            // Safety net: retries never go to Awaiting Action
            recentlyActive.push(ws);
        } else {
            // Bucket 4: First attempt, no engagement
            awaitingAction.push(ws);
        }
    }

    // Sort each bucket per spec
    readyToReview.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    needsFollowup.sort((a, b) => b.idleDurationMs - a.idleDurationMs);
    recentlyActive.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    awaitingAction.sort((a, b) => a.createdAt - b.createdAt); // oldest first

    // Compute Bucket 4 aggregate metadata
    const oldestAwaiting = awaitingAction.length > 0 ? awaitingAction[0] : null;
    const oldestNeverEngagedLabel = oldestAwaiting
        ? formatIdleLabel(now - oldestAwaiting.createdAt)
        : undefined;

    return [
        {
            key: 'ready_to_review',
            label: 'Ready to Review',
            sessions: readyToReview,
            count: readyToReview.length,
        },
        {
            key: 'needs_followup',
            label: 'Needs Follow-Up',
            sessions: needsFollowup,
            count: needsFollowup.length,
        },
        {
            key: 'recently_active',
            label: 'Recently Active',
            sessions: recentlyActive,
            count: recentlyActive.length,
        },
        {
            key: 'awaiting_action',
            label: 'Awaiting Action',
            sessions: awaitingAction,
            count: awaitingAction.length,
            neverEngagedCount: awaitingAction.length,
            oldestNeverEngagedLabel: oldestNeverEngagedLabel,
        },
    ];
}
