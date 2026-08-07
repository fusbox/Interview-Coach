import { InterviewCoachBrandMark } from "@/features/brand-v2/InterviewCoachBrandMark";

export function AiEvalWorkspaceLoading() {
    return (
        <div className="ai-eval-shell">
            <header className="ai-eval-shell__header ai-eval-workspace-loading__shell-header" aria-hidden="true">
                <div className="ai-eval-shell__brand">
                    <InterviewCoachBrandMark className="ai-eval-shell__logo" priority />
                    <div className="ai-eval-workspace-loading__brand-label">
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--brand" />
                    </div>
                </div>
                <div className="ai-eval-workspace-loading__shell-actions">
                    <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--identity" />
                    <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--control" />
                </div>
            </header>

            <main
                className="ai-eval-workbench ai-eval-workspace-loading"
                aria-busy="true"
                aria-label="Loading AI quality workspace"
            >
                <div className="ai-eval-workspace-loading__intro" aria-hidden="true">
                    <div className="ai-eval-workspace-loading__intro-copy">
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--label" />
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--title" />
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--copy" />
                    </div>
                    <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--metric" />
                </div>

                <div className="ai-eval-workspace-loading__tabs" aria-hidden="true">
                    <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--tab" />
                    <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--tab" />
                    <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--tab-short" />
                </div>

                <section className="ai-eval-workspace-loading__layout" aria-hidden="true">
                    <aside className="ai-eval-workspace-loading__list">
                        {[0, 1, 2, 3].map((row) => (
                            <div className="ai-eval-workspace-loading__list-row" key={row}>
                                <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--row-title" />
                                <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--row-copy" />
                            </div>
                        ))}
                    </aside>
                    <div className="ai-eval-workspace-loading__detail">
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--detail-title" />
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--detail-row" />
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--detail-row" />
                        <span className="ui-route-loading-skeleton ai-eval-workspace-loading__skeleton--detail-row-short" />
                    </div>
                </section>

                <p className="sr-only" role="status">Loading AI quality workspace.</p>
            </main>
        </div>
    );
}
