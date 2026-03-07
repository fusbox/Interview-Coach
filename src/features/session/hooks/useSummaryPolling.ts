import { useEffect } from 'react';

interface UseSummaryPollingProps {
    hasNarrative: boolean;
    isCreating: boolean;
    refresh: () => Promise<void>;
}

export function useSummaryPolling({ hasNarrative, isCreating, refresh }: UseSummaryPollingProps) {
    useEffect(() => {
        let isMounted = true;
        console.log(`[useSummaryPolling] Mounted. hasNarrative: ${hasNarrative}, isCreating: ${isCreating}`);

        if (hasNarrative || isCreating) {
            console.log(`[useSummaryPolling] Skipping/Stopping polling. Done or creating new.`);
            return;
        }

        console.log("[useSummaryPolling] Narrative missing, starting 3s interval...");
        const interval = setInterval(async () => {
            if (!isMounted) return;
            console.log("[useSummaryPolling] Tick - firing refresh()...");
            try {
                await refresh();
            } catch (err) {
                console.error("[useSummaryPolling] Tick - refresh failed:", err);
            }
        }, 3000);

        return () => {
            console.log("[useSummaryPolling] Unmounting - clearing interval.");
            isMounted = false;
            clearInterval(interval);
        };
    }, [hasNarrative, isCreating, refresh]);
}
