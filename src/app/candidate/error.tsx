"use client";

import { RefreshCw } from "lucide-react";

import { CandidateBrandHeader } from "@/features/candidate-v2/CandidateBrandHeader";

export default function CandidateError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="candidate-route-state">
            <CandidateBrandHeader />
            <section className="candidate-route-state__error app-grid" role="alert">
                <p className="type-eyebrow">Interview Coach unavailable</p>
                <h1>I couldn&apos;t load this practice view.</h1>
                <p>
                    Your saved practice has not been changed. Try loading the view again.
                </p>
                <button className="candidate-button candidate-button--primary" type="button" onClick={reset}>
                    <RefreshCw size={17} aria-hidden="true" />
                    Try again
                </button>
            </section>
        </main>
    );
}
