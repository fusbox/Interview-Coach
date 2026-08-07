"use client";

import { forwardRef, memo, useImperativeHandle } from "react";

import type {
    CandidateEngagementActivityReason,
    CandidateEngagementFlushReason,
    CandidateEngagementSessionSummary,
} from "./candidate-engagement-contract";
import { CandidateEngagementInspector } from "./CandidateEngagementInspector";
import { useCandidateEngagementTracker } from "./useCandidateEngagementTracker";

export type CandidateEngagementActions = {
    trackEvent: (tier: "tier2" | "tier3", activity: CandidateEngagementActivityReason) => void;
    flush: (reason?: CandidateEngagementFlushReason) => Promise<boolean>;
};

type CandidateEngagementRuntimeProps = {
    enabled: boolean;
    inspectorEnabled: boolean;
    sessionId: string;
    endpoint: string;
    initialSummary?: CandidateEngagementSessionSummary;
    isContinuousActive?: boolean;
};

const CandidateEngagementRuntimeComponent = forwardRef<
    CandidateEngagementActions,
    CandidateEngagementRuntimeProps
>(function CandidateEngagementRuntime({
    enabled,
    inspectorEnabled,
    sessionId,
    endpoint,
    initialSummary,
    isContinuousActive,
}, ref) {
    const tracker = useCandidateEngagementTracker({
        enabled,
        sessionId,
        endpoint,
        initialSummary,
        isContinuousActive,
    });

    useImperativeHandle(ref, () => ({
        trackEvent: tracker.trackEvent,
        flush: tracker.flush,
    }), [tracker.flush, tracker.trackEvent]);

    return (
        <CandidateEngagementInspector
            enabled={inspectorEnabled}
            tracker={tracker}
        />
    );
});

export const CandidateEngagementRuntime = memo(CandidateEngagementRuntimeComponent);
