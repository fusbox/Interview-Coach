import { describe, it, expect } from 'vitest';
import {
    computeWidgetBuckets,
    formatIdleLabel,
    STALE_THRESHOLD_MS,
    WidgetBucket,
} from '@/lib/services/compute-widget-buckets';
import { SessionSummary } from '@/lib/domain/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const NOW = Date.UTC(2026, 1, 24, 14, 0, 0); // 2026-02-24T14:00:00Z

/** Minimal valid SessionSummary factory. Override fields as needed. */
function makeSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
    return {
        id: `sess-${Math.random().toString(36).slice(2, 8)}`,
        candidateName: 'Test Candidate',
        role: 'Customer Service Rep',
        status: 'NOT_STARTED',
        createdAt: NOW - 7 * DAY, // 7 days ago by default
        questionCount: 4,
        answerCount: 0,
        submittedCount: 0,
        ...overrides,
    };
}

/** Find a bucket by key from the result array. */
function bucket(buckets: WidgetBucket[], key: string): WidgetBucket {
    return buckets.find(b => b.key === key)!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeWidgetBuckets', () => {
    // 1. Empty input → 4 empty buckets
    it('returns 4 empty buckets for empty input', () => {
        const result = computeWidgetBuckets([], NOW);
        expect(result).toHaveLength(4);
        expect(result.map(b => b.key)).toEqual([
            'ready_to_review',
            'needs_followup',
            'recently_active',
            'awaiting_action',
        ]);
        result.forEach(b => {
            expect(b.count).toBe(0);
            expect(b.sessions).toHaveLength(0);
        });
    });

    // 2. All completed → everything in Bucket 1
    it('places all completed sessions in Ready to Review', () => {
        const sessions = [
            makeSession({ status: 'COMPLETED', updatedAt: NOW - 1 * HOUR }),
            makeSession({ status: 'COMPLETED', updatedAt: NOW - 5 * HOUR }),
            makeSession({ submittedCount: 4, questionCount: 4, updatedAt: NOW - 2 * HOUR }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        expect(bucket(result, 'ready_to_review').count).toBe(3);
        expect(bucket(result, 'needs_followup').count).toBe(0);
        expect(bucket(result, 'recently_active').count).toBe(0);
        expect(bucket(result, 'awaiting_action').count).toBe(0);
    });

    // 3. Mixed — 1 per bucket
    it('routes mixed sessions to correct buckets', () => {
        const sessions = [
            // Completed → Bucket 1
            makeSession({ id: 'completed', status: 'COMPLETED', updatedAt: NOW - 1 * HOUR }),
            // Engaged + stale → Bucket 2 (viewed 3 days ago)
            makeSession({
                id: 'stale',
                viewedAt: NOW - 5 * DAY,
                updatedAt: NOW - 3 * DAY,
                status: 'IN_SESSION',
                submittedCount: 2,
            }),
            // Engaged + fresh → Bucket 3 (active 1h ago)
            makeSession({
                id: 'active',
                viewedAt: NOW - 2 * HOUR,
                updatedAt: NOW - 1 * HOUR,
                status: 'IN_SESSION',
                answerCount: 1,
            }),
            // No engagement, first attempt → Bucket 4
            makeSession({ id: 'waiting', status: 'NOT_STARTED' }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        expect(bucket(result, 'ready_to_review').sessions[0].id).toBe('completed');
        expect(bucket(result, 'needs_followup').sessions[0].id).toBe('stale');
        expect(bucket(result, 'recently_active').sessions[0].id).toBe('active');
        expect(bucket(result, 'awaiting_action').sessions[0].id).toBe('waiting');
    });

    // 4. Threshold boundary: viewed exactly at 48h → Recently Active (≤)
    it('keeps session at exactly 48h idle in Recently Active', () => {
        const sessions = [
            makeSession({
                viewedAt: NOW - STALE_THRESHOLD_MS,
                updatedAt: NOW - STALE_THRESHOLD_MS,
                status: 'NOT_STARTED',
            }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        // Exactly at threshold = NOT stale (uses > not >=)
        expect(bucket(result, 'recently_active').count).toBe(1);
        expect(bucket(result, 'needs_followup').count).toBe(0);
    });

    // 4b. Threshold boundary: 48h + 1ms → Needs Follow-Up
    it('moves session 1ms past 48h threshold to Needs Follow-Up', () => {
        const sessions = [
            makeSession({
                viewedAt: NOW - STALE_THRESHOLD_MS - 1,
                updatedAt: NOW - STALE_THRESHOLD_MS - 1,
                status: 'NOT_STARTED',
            }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        expect(bucket(result, 'needs_followup').count).toBe(1);
        expect(bucket(result, 'recently_active').count).toBe(0);
    });

    // 5. Never viewed invite → Awaiting Action
    it('places never-viewed first-attempt invites in Awaiting Action', () => {
        const sessions = [
            makeSession({ status: 'NOT_STARTED' }),
            makeSession({ status: 'NOT_STARTED', createdAt: NOW - 10 * DAY }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        expect(bucket(result, 'awaiting_action').count).toBe(2);
        expect(bucket(result, 'awaiting_action').neverEngagedCount).toBe(2);
    });

    // 6. ERROR status → always Follow-Up (engagement implied by status transition)
    it('routes ERROR status sessions to appropriate bucket based on engagement', () => {
        // ERROR with engagement evidence (updatedAt implies some activity happened)
        const sessions = [
            makeSession({
                status: 'ERROR',
                updatedAt: NOW - 3 * DAY,
                answerCount: 1,
            }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        // Has engagement (answerCount > 0) + stale = Follow-Up
        expect(bucket(result, 'needs_followup').count).toBe(1);
    });

    // 7. Retry (attempt 2), not stale → Recently Active with attemptNumber preserved
    it('routes non-stale retry to Recently Active with attempt label', () => {
        const sessions = [
            makeSession({
                id: 'retry-active',
                attemptNumber: 2,
                status: 'IN_SESSION',
                updatedAt: NOW - 1 * HOUR,
                answerCount: 1,
            }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        expect(bucket(result, 'recently_active').count).toBe(1);
        expect(bucket(result, 'recently_active').sessions[0].attemptNumber).toBe(2);
        expect(bucket(result, 'awaiting_action').count).toBe(0);
    });

    // 8. Retry (attempt 2), never viewed → safety net → Recently Active
    it('routes zero-engagement retry to Recently Active (not Awaiting Action)', () => {
        const sessions = [
            makeSession({
                attemptNumber: 2,
                status: 'NOT_STARTED',
                updatedAt: NOW - 1 * HOUR,
                // No viewedAt, no initials, no answers
            }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);

        // Retry excluded from Awaiting Action → safety net to Recently Active
        expect(bucket(result, 'recently_active').count).toBe(1);
        expect(bucket(result, 'awaiting_action').count).toBe(0);
    });

    // 9. Sort: Bucket 1 → updatedAt DESC (most recent first)
    it('sorts Ready to Review by most recently completed first', () => {
        const sessions = [
            makeSession({ id: 'older', status: 'COMPLETED', updatedAt: NOW - 5 * HOUR }),
            makeSession({ id: 'newer', status: 'COMPLETED', updatedAt: NOW - 1 * HOUR }),
            makeSession({ id: 'middle', status: 'COMPLETED', updatedAt: NOW - 3 * HOUR }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);
        const ids = bucket(result, 'ready_to_review').sessions.map(s => s.id);
        expect(ids).toEqual(['newer', 'middle', 'older']);
    });

    // 10. Sort: Bucket 2 → idleDurationMs DESC (most stale first)
    it('sorts Needs Follow-Up by most stale first', () => {
        const sessions = [
            makeSession({
                id: 'slightly-stale',
                viewedAt: NOW - 3 * DAY,
                updatedAt: NOW - 3 * DAY,
                status: 'IN_SESSION',
            }),
            makeSession({
                id: 'very-stale',
                viewedAt: NOW - 10 * DAY,
                updatedAt: NOW - 10 * DAY,
                status: 'IN_SESSION',
            }),
        ];
        const result = computeWidgetBuckets(sessions, NOW);
        const ids = bucket(result, 'needs_followup').sessions.map(s => s.id);
        expect(ids).toEqual(['very-stale', 'slightly-stale']);
    });
});

// ---------------------------------------------------------------------------
// formatIdleLabel
// ---------------------------------------------------------------------------

describe('formatIdleLabel', () => {
    it('returns "Just now" for < 1 hour', () => {
        expect(formatIdleLabel(0)).toBe('Just now');
        expect(formatIdleLabel(30 * 60 * 1000)).toBe('Just now');
        expect(formatIdleLabel(59 * 60 * 1000)).toBe('Just now');
    });

    it('returns hours for 1-23h', () => {
        expect(formatIdleLabel(1 * HOUR)).toBe('1h ago');
        expect(formatIdleLabel(23 * HOUR)).toBe('23h ago');
    });

    it('returns days for 1-6 days', () => {
        expect(formatIdleLabel(1 * DAY)).toBe('1d ago');
        expect(formatIdleLabel(6 * DAY)).toBe('6d ago');
    });

    it('returns weeks for 7-27 days', () => {
        expect(formatIdleLabel(7 * DAY)).toBe('1w ago');
        expect(formatIdleLabel(13 * DAY)).toBe('1w ago');
        expect(formatIdleLabel(14 * DAY)).toBe('2w ago');
        expect(formatIdleLabel(21 * DAY)).toBe('3w ago');
    });

    it('returns "1mo+ ago" for 28+ days', () => {
        expect(formatIdleLabel(28 * DAY)).toBe('1mo+ ago');
        expect(formatIdleLabel(90 * DAY)).toBe('1mo+ ago');
    });
});
