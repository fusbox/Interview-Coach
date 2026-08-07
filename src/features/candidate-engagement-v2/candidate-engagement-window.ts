import type {
    CandidateEngagementActivityReason,
    CandidateEngagementOpenReason,
} from "./candidate-engagement-contract";

export const CANDIDATE_ENGAGEMENT_TIER_2_WINDOW_MS = 30_000;
export const CANDIDATE_ENGAGEMENT_TIER_3_WINDOW_MS = 60_000;

export type CandidateEngagementWindowState = {
    isOpen: boolean;
    expiresAt: number;
    openedBy: CandidateEngagementOpenReason;
    lastActivity: CandidateEngagementActivityReason;
};

export function createClosedCandidateEngagementWindow(): CandidateEngagementWindowState {
    return {
        isOpen: false,
        expiresAt: 0,
        openedBy: "session_view",
        lastActivity: "session_view",
    };
}

export function applyCandidateEngagementEvent(input: {
    state: CandidateEngagementWindowState;
    tier: "tier2" | "tier3";
    activity: CandidateEngagementActivityReason;
    now: number;
}): { state: CandidateEngagementWindowState; transition: "open" | "extend" } {
    const wasOpen = input.state.isOpen && input.state.expiresAt > input.now;
    const openedBy: CandidateEngagementOpenReason = input.tier === "tier3"
        ? "task_progress"
        : input.activity === "session_view"
            ? "session_view"
            : "interaction";
    return {
        state: {
            isOpen: true,
            expiresAt: input.now + (input.tier === "tier3"
                ? CANDIDATE_ENGAGEMENT_TIER_3_WINDOW_MS
                : CANDIDATE_ENGAGEMENT_TIER_2_WINDOW_MS),
            openedBy: wasOpen ? input.state.openedBy : openedBy,
            lastActivity: input.activity,
        },
        transition: wasOpen ? "extend" : "open",
    };
}

export function sustainCandidateEngagementRecording(
    state: CandidateEngagementWindowState,
    now: number,
): CandidateEngagementWindowState {
    return {
        isOpen: true,
        expiresAt: now + CANDIDATE_ENGAGEMENT_TIER_2_WINDOW_MS,
        openedBy: state.isOpen && state.expiresAt > now ? state.openedBy : "continuous_activity",
        lastActivity: "recording",
    };
}

export function readCandidateEngagementAccrual(input: {
    state: CandidateEngagementWindowState;
    from: number;
    to: number;
    isVisible: boolean;
    isLeader: boolean;
    maxTickMilliseconds?: number;
}) {
    if (!input.isVisible || !input.isLeader || !input.state.isOpen || input.to <= input.from) return 0;
    const eligibleUntil = Math.min(input.to, input.state.expiresAt);
    if (eligibleUntil <= input.from) return 0;
    return Math.min(
        eligibleUntil - input.from,
        input.maxTickMilliseconds ?? 5_000,
    );
}

export function closeCandidateEngagementWindow(
    state: CandidateEngagementWindowState,
): CandidateEngagementWindowState {
    return { ...state, isOpen: false, expiresAt: 0 };
}
