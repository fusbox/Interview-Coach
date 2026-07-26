import { CandidateBrandHeader } from "@/features/candidate-v2/CandidateBrandHeader";

export default function CandidateLoading() {
    return (
        <main className="candidate-route-state" aria-busy="true" aria-label="Loading Interview Coach">
            <CandidateBrandHeader />
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
