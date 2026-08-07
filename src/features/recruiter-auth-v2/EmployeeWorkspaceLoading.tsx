import { InterviewCoachBrandMark } from "@/features/brand-v2/InterviewCoachBrandMark";

export function EmployeeWorkspaceLoading({
    accessibleLabel,
    statusText,
    includeShellPlaceholder = false,
}: {
    accessibleLabel: string;
    statusText: string;
    includeShellPlaceholder?: boolean;
}) {
    const workspace = (
        <main
            className="recruiter-workspace employee-workspace-loading"
            aria-busy="true"
            aria-label={accessibleLabel}
        >
            <div className="employee-workspace-loading__intro" aria-hidden="true">
                <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--label" />
                <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--title" />
                <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--copy" />
            </div>

            <section className="employee-workspace-loading__summary" aria-hidden="true">
                <span className="employee-workspace-loading__summary-item" />
                <span className="employee-workspace-loading__summary-item" />
                <span className="employee-workspace-loading__summary-item" />
            </section>

            <section className="employee-workspace-loading__panel" aria-hidden="true">
                <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--panel-title" />
                <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--row" />
                <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--row" />
                <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--row-short" />
            </section>

            <p className="sr-only" role="status">{statusText}</p>
        </main>
    );

    if (!includeShellPlaceholder) return workspace;

    return (
        <div className="recruiter-shell">
            <header className="recruiter-shell__header employee-workspace-loading__shell-header" aria-hidden="true">
                <InterviewCoachBrandMark className="recruiter-shell__logo" priority />
                <div className="employee-workspace-loading__shell-actions">
                    <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--identity" />
                    <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--control" />
                    <span className="ui-route-loading-skeleton employee-workspace-loading__skeleton--control" />
                </div>
            </header>
            {workspace}
        </div>
    );
}
