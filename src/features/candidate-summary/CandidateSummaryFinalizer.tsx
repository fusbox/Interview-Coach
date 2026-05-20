"use client";

import { useEffect } from "react";

type CandidateSummaryFinalizerProps = {
    sessionId: string;
    enabled: boolean;
};

export function CandidateSummaryFinalizer({ sessionId, enabled }: CandidateSummaryFinalizerProps) {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const storageKey = `candidate-summary-finalized:${sessionId}`;
        if (window.sessionStorage.getItem(storageKey) === "true") {
            return;
        }

        let cancelled = false;
        window.sessionStorage.setItem(storageKey, "true");

        fetch(`/api/candidate/sessions/${sessionId}/summary/finalize`, {
            method: "POST",
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("Candidate summary finalization failed.");
                }
                return response.json() as Promise<{ ok: boolean }>;
            })
            .then((result) => {
                if (result.ok) {
                    if (process.env.NODE_ENV === "test") {
                        return;
                    }

                    window.setTimeout(() => {
                        window.location.reload();
                    }, 100);
                    return;
                }

                if (!cancelled) {
                    window.sessionStorage.removeItem(storageKey);
                }
            })
            .catch(() => {
                window.sessionStorage.removeItem(storageKey);
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, sessionId]);

    return null;
}
