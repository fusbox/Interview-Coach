export const CANDIDATE_ENGAGEMENT_OPEN_REASONS = [
    "session_view",
    "interaction",
    "task_progress",
    "continuous_activity",
] as const;

export const CANDIDATE_ENGAGEMENT_ACTIVITY_REASONS = [
    "session_view",
    "answer_input",
    "question_audio",
    "question_assistance",
    "answer_mode",
    "voice_control",
    "interface_control",
    "page_navigation",
    "feedback_action",
    "answer_submit",
    "practice_start",
    "question_advance",
    "session_finish",
    "recording",
] as const;

export const CANDIDATE_ENGAGEMENT_FLUSH_REASONS = [
    "periodic",
    "window_expired",
    "page_hidden",
    "page_exit",
    "session_transition",
    "tracker_unmount",
] as const;

export type CandidateEngagementOpenReason = typeof CANDIDATE_ENGAGEMENT_OPEN_REASONS[number];
export type CandidateEngagementActivityReason = typeof CANDIDATE_ENGAGEMENT_ACTIVITY_REASONS[number];
export type CandidateEngagementFlushReason = typeof CANDIDATE_ENGAGEMENT_FLUSH_REASONS[number];

export type CandidateEngagementSlice = {
    engagementSliceId: string;
    trackerInstanceId: string;
    sequenceNumber: number;
    activeMilliseconds: number;
    clientStartedAt: string;
    clientEndedAt: string;
    openedBy: CandidateEngagementOpenReason;
    lastActivity: CandidateEngagementActivityReason;
    flushReason: CandidateEngagementFlushReason;
};

export type CandidateEngagementSessionSummary = {
    activeMilliseconds: number;
    sliceCount: number;
    firstReceivedAt: string | null;
    lastReceivedAt: string | null;
};

export type CandidateEngagementReportRow = CandidateEngagementSessionSummary & {
    candidatePracticeSessionId: string;
    candidateLabel: string;
    maskedEmail: string;
    targetRole: string;
    sessionStatus: "planned" | "in_progress" | "completed" | "abandoned";
    sessionCreatedAt: string;
};

export type CandidateEngagementDebugEventType =
    | "window_open"
    | "window_extend"
    | "window_close"
    | "presence_lost"
    | "presence_regained"
    | "leader_acquired"
    | "leader_released"
    | "slice_queued"
    | "persist_succeeded"
    | "persist_failed";

export type CandidateEngagementDebugEvent = {
    id: string;
    timestamp: number;
    type: CandidateEngagementDebugEventType;
    tier?: "tier1" | "tier2" | "tier3";
    detail: string;
};

export function isCandidateEngagementOpenReason(value: unknown): value is CandidateEngagementOpenReason {
    return CANDIDATE_ENGAGEMENT_OPEN_REASONS.includes(value as CandidateEngagementOpenReason);
}

export function isCandidateEngagementActivityReason(value: unknown): value is CandidateEngagementActivityReason {
    return CANDIDATE_ENGAGEMENT_ACTIVITY_REASONS.includes(value as CandidateEngagementActivityReason);
}

export function isCandidateEngagementFlushReason(value: unknown): value is CandidateEngagementFlushReason {
    return CANDIDATE_ENGAGEMENT_FLUSH_REASONS.includes(value as CandidateEngagementFlushReason);
}
