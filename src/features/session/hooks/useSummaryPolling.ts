import { useEffect } from 'react';

interface UseSummaryPollingProps {
    hasNarrative: boolean;
    isCreating: boolean;
    refresh: () => Promise<void>;
}

export function useSummaryPolling({ hasNarrative, isCreating, refresh }: UseSummaryPollingProps) {
    useEffect(() => {
        let isMounted = true;

        if (hasNarrative || isCreating) {
            return;
        }

        const interval = setInterval(async () => {
            if (!isMounted) return;
            try {
                await refresh();
            } catch (err) {
                console.error("[useSummaryPolling] Tick - refresh failed:", err);
            }
        }, 3000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [hasNarrative, isCreating, refresh]);
}
