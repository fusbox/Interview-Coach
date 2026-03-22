import { useEffect } from 'react';

interface UseSummaryPollingProps {
    hasNarrative: boolean;
    isCreating: boolean;
    isExpired?: boolean;
    refresh: () => Promise<void>;
}

export function useSummaryPolling({ hasNarrative, isCreating, isExpired = false, refresh }: UseSummaryPollingProps) {
    useEffect(() => {
        let isMounted = true;

        if (hasNarrative || isCreating || isExpired) {
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
    }, [hasNarrative, isCreating, isExpired, refresh]);
}
