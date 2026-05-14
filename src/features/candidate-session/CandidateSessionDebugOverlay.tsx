"use client";

import { useEffect, useState } from "react";

import { EngagementDebugOverlay } from "@/components/debug/EngagementDebugOverlay";
import { useEngagementTracker } from "@/features/analytics/hooks/useEngagementTracker";
import { showDemoTools } from "@/lib/feature-flags";

type CandidateSessionDebugOverlayProps = {
    initialEngagedSeconds?: number;
    analysisPrompt?: string;
};

export function CandidateSessionDebugOverlay({
    initialEngagedSeconds = 0,
    analysisPrompt,
}: CandidateSessionDebugOverlayProps) {
    const [showDebug, setShowDebug] = useState(false);
    const tracker = useEngagementTracker({
        isEnabled: showDemoTools(),
        initialSeconds: initialEngagedSeconds,
        onUpdate: () => {
            // Candidate persistence is still owned by server actions in this slice.
        },
    });
    const { trackEvent } = tracker;

    useEffect(() => {
        trackEvent("tier2", "candidate_session_view", 30);
    }, [trackEvent]);

    if (!showDemoTools()) {
        return null;
    }

    return (
        <>
            <EngagementDebugOverlay
                isVisible={showDebug}
                onClose={() => setShowDebug(false)}
                tracker={tracker}
                aiContexts={{
                    analysisPrompt,
                }}
            />
            <button
                type="button"
                onClick={() => {
                    trackEvent("tier3", "debug_open");
                    setShowDebug(true);
                }}
                className="fixed bottom-0 left-0 z-50 h-16 w-16 cursor-default opacity-0"
                aria-label="Open engagement debug inspector"
                title="Debug"
            />
        </>
    );
}
