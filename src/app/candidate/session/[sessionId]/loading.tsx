"use client";

import { useSearchParams } from "next/navigation";

import { CandidatePracticeEntryTransitionOverlay } from "@/features/candidate-session-v2/CandidatePreSessionLanding";
import { CandidateBrandHeader } from "@/features/candidate-v2/CandidateBrandHeader";
import { CandidateThemeSwitcher } from "@/features/candidate-v2/CandidateThemeSwitcher";

export default function CandidateSessionLoading() {
    const searchParams = useSearchParams();

    if (searchParams.get("entry") === "1") {
        return <CandidatePracticeEntryTransitionOverlay isReleasing={false} />;
    }

    return (
        <main className="candidate-route-state" aria-busy="true" aria-label="Loading Interview Coach">
            <CandidateBrandHeader actions={<CandidateThemeSwitcher />} />
            <section className="candidate-route-state__content app-grid">
                <div className="candidate-route-state__heading">
                    <span className="candidate-route-state__skeleton candidate-route-state__skeleton--label" />
                    <span className="candidate-route-state__skeleton candidate-route-state__skeleton--title" />
                    <span className="candidate-route-state__skeleton candidate-route-state__skeleton--copy" />
                </div>
                <div className="candidate-route-state__panel">
                    <span className="candidate-route-state__skeleton candidate-route-state__skeleton--label" />
                    <span className="candidate-route-state__skeleton candidate-route-state__skeleton--row" />
                    <span className="candidate-route-state__skeleton candidate-route-state__skeleton--row" />
                    <span className="candidate-route-state__skeleton candidate-route-state__skeleton--row-short" />
                </div>
                <p className="sr-only" role="status">Loading your practice space.</p>
            </section>
        </main>
    );
}
