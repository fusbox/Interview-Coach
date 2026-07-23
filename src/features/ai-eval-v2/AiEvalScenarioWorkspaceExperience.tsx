import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
    Beaker,
    CheckCircle2,
    ClipboardCheck,
    Copy,
    FileJson,
    Inbox,
    Play,
    Plus,
    Save,
    Wrench,
} from "lucide-react";

import {
    createAiEvalScenarioDraftAction,
    mutateAiEvalScenarioDraftAction,
    runAiEvalLiveScenariosAction,
    runAiEvalScenariosAction,
} from "@/app/qa/ai-eval/actions";

import type {
    AiEvalLiveCostPreview,
    AiEvalLiveExecutionPolicy,
} from "./ai-eval-live-run-contract";
import {
    readAiEvalScenarioRunMetrics,
    type AiEvalScenarioRunComparison,
} from "./ai-eval-scenario-run-comparison";

import type {
    AiEvalScenarioDraft,
    AiEvalScenarioRunLayer,
    AiEvalScenarioRunDetail,
    AiEvalScenarioRunSummary,
    AiEvalScenarioVersion,
} from "./ai-eval-scenario-repository";

export type AiEvalScenarioWorkspaceView = "scenarios" | "runs";

export type AiEvalScenarioWorkspaceFilters = {
    view: AiEvalScenarioWorkspaceView;
    selectedDraftId?: string;
    selectedRunId?: string;
    compareRunId?: string;
    liveScope?: "selected" | "tag" | "full_corpus";
    liveScenarioVersionIds?: string[];
    liveTag?: string;
    notice?: string;
};

export type AiEvalLiveSelectionPreview = {
    scope: "selected" | "tag" | "full_corpus";
    tag: string | null;
    requestedVersionIds: string[];
    requestedTitles: string[];
    expandedVersionIds: string[];
    dependencyTitles: string[];
    preview: AiEvalLiveCostPreview;
};

export type AiEvalScenarioWorkspaceData = {
    versions: AiEvalScenarioVersion[];
    drafts: AiEvalScenarioDraft[];
    runs: AiEvalScenarioRunSummary[];
    selectedRun: AiEvalScenarioRunDetail | null;
    livePolicy?: AiEvalLiveExecutionPolicy;
    livePreview?: AiEvalLiveSelectionPreview | null;
    comparison?: AiEvalScenarioRunComparison | null;
};

export function AiEvalScenarioWorkspaceExperience({
    filters,
    versions,
    drafts,
    runs,
    selectedRun,
    livePolicy,
    livePreview,
    comparison,
    unavailable,
}: AiEvalScenarioWorkspaceData & {
    filters: AiEvalScenarioWorkspaceFilters;
    unavailable?: boolean;
}) {
    const selectedDraft = filters.selectedDraftId
        ? drafts.find((draft) => draft.draftId === filters.selectedDraftId) ?? null
        : null;
    const baselineCount = new Set(versions
        .filter((version) => version.sourceKind === "baseline")
        .map((version) => version.scenario.scenarioKey)).size;

    return (
        <main className="ai-eval-workbench ai-eval-scenario-workspace">
            <header className="ai-eval-workbench__intro">
                <div>
                    <p className="type-eyebrow">Synthetic scenario lab</p>
                    <h1>{filters.view === "scenarios" ? "Exercise the coaching system." : "Inspect every delivered layer."}</h1>
                    <p>
                        {filters.view === "scenarios"
                            ? "Stage reproducible candidate situations and run them through the same projections used by the app."
                            : "Compare the persisted evaluator, session, transcript, summary, and dashboard outputs case by case."}
                    </p>
                </div>
                <dl aria-label="Scenario workspace count">
                    <div>
                        <dt>{filters.view === "scenarios" ? "Baseline cases" : "Runs"}</dt>
                        <dd>{filters.view === "scenarios" ? baselineCount : runs.length}</dd>
                    </div>
                </dl>
            </header>

            <WorkspaceNavigation active={filters.view} />
            {noticeText(filters.notice) ? (
                <p className={`ai-eval-notice ${filters.notice === "conflict" || filters.notice === "invalid" ? "is-warning" : ""}`} role="status">
                    {noticeText(filters.notice)}
                </p>
            ) : null}

            {unavailable ? <UnavailableState /> : filters.view === "scenarios" ? (
                <ScenarioWorkspace
                    versions={versions}
                    drafts={drafts}
                    selectedDraft={selectedDraft}
                    livePolicy={livePolicy}
                    livePreview={livePreview}
                />
            ) : (
                <RunWorkspace runs={runs} selectedRun={selectedRun} comparison={comparison} />
            )}
        </main>
    );
}

function WorkspaceNavigation({ active }: { active: AiEvalScenarioWorkspaceView }) {
    return (
        <nav className="ai-eval-view-tabs" aria-label="AI quality workbench views">
            <Link href="/qa/ai-eval?view=queue"><ClipboardCheck size={17} />Review queue</Link>
            <Link href="/qa/ai-eval?view=inbox"><Inbox size={17} />Source inbox</Link>
            <Link href="/qa/ai-eval?view=remediation"><Wrench size={17} />Remediation</Link>
            <Link href="/qa/ai-eval?view=scenarios" aria-current={active === "scenarios" ? "page" : undefined}>
                <Beaker size={17} />Scenarios
            </Link>
            <Link href="/qa/ai-eval?view=runs" aria-current={active === "runs" ? "page" : undefined}>
                <Play size={17} />Runs
            </Link>
        </nav>
    );
}

function ScenarioWorkspace({
    versions,
    drafts,
    selectedDraft,
    livePolicy,
    livePreview,
}: {
    versions: AiEvalScenarioVersion[];
    drafts: AiEvalScenarioDraft[];
    selectedDraft: AiEvalScenarioDraft | null;
    livePolicy?: AiEvalLiveExecutionPolicy;
    livePreview?: AiEvalLiveSelectionPreview | null;
}) {
    const tags = Array.from(new Set(versions.flatMap((version) => version.scenario.tags))).sort();
    return (
        <div className={`ai-eval-scenario-layout ${selectedDraft ? "has-editor" : ""}`}>
            <aside className="ai-eval-scenario-drafts" aria-label="Scenario drafts">
                <header>
                    <div>
                        <p className="type-eyebrow">Working copies</p>
                        <h2>Drafts</h2>
                    </div>
                    <form action={createAiEvalScenarioDraftAction}>
                        <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                        <button type="submit" className="icon-button" title="Create scenario" aria-label="Create scenario">
                            <Plus size={17} />
                        </button>
                    </form>
                </header>
                {drafts.length ? (
                    <ol>
                        {drafts.map((draft) => (
                            <li key={draft.draftId}>
                                <Link
                                    href={`/qa/ai-eval?view=scenarios&draft=${encodeURIComponent(draft.draftId)}`}
                                    className={selectedDraft?.draftId === draft.draftId ? "is-selected" : ""}
                                >
                                    <strong>{draft.scenario.title}</strong>
                                    <span>{humanize(draft.scenario.kind)} | Revision {draft.revision}</span>
                                    <span>Updated {formatDate(draft.updatedAt)}</span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                ) : <p className="ai-eval-scenario-empty">Create a scenario or clone a baseline case to begin.</p>}
            </aside>

            <section className="ai-eval-scenario-library" aria-label="Staged scenario library">
                <header className="ai-eval-scenario-section-heading">
                    <div>
                        <p className="type-eyebrow">Reproducible inputs</p>
                        <h2>Scenario library</h2>
                    </div>
                    <form id="ai-eval-selected-run" action={runAiEvalScenariosAction}>
                        <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                        <input type="hidden" name="runScope" value="selected" />
                        <button type="submit" className="button button--secondary"><Play size={16} />Run selected</button>
                    </form>
                    <form action={runAiEvalScenariosAction}>
                        <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                        <input type="hidden" name="runScope" value="full_baseline" />
                        <button type="submit" className="button button--primary"><Play size={16} />Run baseline</button>
                    </form>
                </header>
                <section className="ai-eval-live-run-control" aria-labelledby="live-run-title">
                    <div>
                        <p className="type-eyebrow">Credentialed provider run</p>
                        <h3 id="live-run-title">Preview cost before queuing live work.</h3>
                        <p>The browser can queue a reviewed request. Only the separately confirmed worker can make provider calls.</p>
                    </div>
                    <div className="ai-eval-live-run-control__actions">
                        <button type="submit" className="button button--secondary" form="ai-eval-live-selected-preview">
                            Preview selected live
                        </button>
                        <form action="/qa/ai-eval" method="get">
                            <input type="hidden" name="view" value="scenarios" />
                            <input type="hidden" name="liveScope" value="tag" />
                            <label htmlFor="ai-eval-live-tag">Tag</label>
                            <select id="ai-eval-live-tag" name="liveTag" required defaultValue="">
                                <option value="" disabled>Select tag</option>
                                {tags.map((tag) => <option key={tag} value={tag}>{humanize(tag)}</option>)}
                            </select>
                            <button type="submit" className="button button--secondary">Preview tag</button>
                        </form>
                        <form action="/qa/ai-eval" method="get">
                            <input type="hidden" name="view" value="scenarios" />
                            <button type="submit" name="liveScope" value="full_corpus" className="button button--secondary">
                                Preview full corpus
                            </button>
                        </form>
                    </div>
                    {!livePolicy?.ready ? (
                        <p className="ai-eval-live-run-control__status is-blocked">
                            Live execution is unavailable: {(livePolicy?.reasons ?? ["LIVE_POLICY_UNAVAILABLE"]).map(humanize).join(", ")}.
                        </p>
                    ) : <p className="ai-eval-live-run-control__status">Live gate is configured. No provider call has been made.</p>}
                </section>
                {livePreview ? <LiveRunPreview selection={livePreview} /> : null}
                <form id="ai-eval-live-selected-preview" action="/qa/ai-eval" method="get">
                    <input type="hidden" name="view" value="scenarios" />
                    <input type="hidden" name="liveScope" value="selected" />
                </form>
                <ol className="ai-eval-scenario-grid">
                    {versions.map((version) => (
                        <li key={version.scenarioVersionId} className="ai-eval-scenario-card">
                            <label className="ai-eval-scenario-card__select">
                                <input
                                    type="checkbox"
                                    name="scenarioVersionId"
                                    value={version.scenarioVersionId}
                                    form="ai-eval-selected-run"
                                />
                                <span>Select</span>
                            </label>
                            <label className="ai-eval-scenario-card__select ai-eval-scenario-card__select--live">
                                <input
                                    type="checkbox"
                                    name="scenarioVersionId"
                                    value={version.scenarioVersionId}
                                    form="ai-eval-live-selected-preview"
                                />
                                <span>Live</span>
                            </label>
                            <div className="ai-eval-scenario-card__heading">
                                <span className={`ai-eval-chip is-${version.sourceKind}`}>{version.sourceKind}</span>
                                <span>v{version.versionNumber}</span>
                            </div>
                            <h3>{version.scenario.title}</h3>
                            <p>{version.scenario.rationale}</p>
                            <dl>
                                <div><dt>Kind</dt><dd>{humanize(version.scenario.kind)}</dd></div>
                                <div><dt>Audience</dt><dd>{version.scenario.audiences.map(humanize).join(", ")}</dd></div>
                                <div><dt>Layers</dt><dd>{version.scenario.intendedOutputLayers.length}</dd></div>
                            </dl>
                            <div className="ai-eval-scenario-card__actions">
                                <form action={createAiEvalScenarioDraftAction}>
                                    <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                                    <input type="hidden" name="sourceVersionId" value={version.scenarioVersionId} />
                                    <button type="submit" className="button button--quiet"><Copy size={15} />Clone</button>
                                </form>
                                <form action={runAiEvalScenariosAction}>
                                    <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                                    <input type="hidden" name="runScope" value="selected" />
                                    <input type="hidden" name="scenarioVersionId" value={version.scenarioVersionId} />
                                    <button type="submit" className="button button--quiet"><Play size={15} />Run one</button>
                                </form>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            {selectedDraft ? <ScenarioEditor draft={selectedDraft} /> : null}
        </div>
    );
}

function ScenarioEditor({ draft }: { draft: AiEvalScenarioDraft }) {
    return (
        <aside className="ai-eval-scenario-editor" aria-label="Scenario editor">
            <header>
                <div>
                    <p className="type-eyebrow">Editable draft</p>
                    <h2>{draft.scenario.title}</h2>
                </div>
                <FileJson size={22} aria-hidden="true" />
            </header>
            <p>Scenario identity is fixed after creation. Save changes before or while staging this revision.</p>
            <form action={mutateAiEvalScenarioDraftAction}>
                <input type="hidden" name="draftId" value={draft.draftId} />
                <input type="hidden" name="revision" value={draft.revision} />
                <label htmlFor="scenario-json">Validated scenario JSON</label>
                <textarea
                    id="scenario-json"
                    name="scenarioJson"
                    defaultValue={JSON.stringify(draft.scenario, null, 2)}
                    spellCheck={false}
                    required
                />
                <div className="ai-eval-scenario-editor__actions">
                    <button type="submit" name="intent" value="save" className="button button--secondary">
                        <Save size={16} />Save draft
                    </button>
                    <button type="submit" name="intent" value="stage" className="button button--primary">
                        <CheckCircle2 size={16} />Stage revision
                    </button>
                </div>
            </form>
        </aside>
    );
}

function LiveRunPreview({ selection }: { selection: AiEvalLiveSelectionPreview }) {
    const preview = selection.preview;
    return (
        <section className="ai-eval-live-preview" aria-labelledby="live-preview-title">
            <header>
                <div>
                    <p className="type-eyebrow">Server-derived live preview</p>
                    <h3 id="live-preview-title">{preview.expandedCaseCount} cases, up to {preview.calls.maximum} provider calls</h3>
                </div>
                <strong>{formatUsd(preview.maximumEstimatedCostUsd)} maximum estimate</strong>
            </header>
            <dl>
                <div><dt>Requested</dt><dd>{preview.requestedCaseCount}</dd></div>
                <div><dt>Added dependencies</dt><dd>{preview.dependencyCaseCount}</dd></div>
                <div><dt>Call envelope</dt><dd>{preview.calls.minimum}-{preview.calls.maximum}</dd></div>
                <div><dt>Token envelope</dt><dd>{formatInteger(preview.tokens.maximumInput + preview.tokens.maximumOutput)}</dd></div>
                <div><dt>Input rate</dt><dd>{formatUsd(preview.pricing.inputUsdPerMillionTokens)}/1M</dd></div>
                <div><dt>Output rate</dt><dd>{formatUsd(preview.pricing.outputUsdPerMillionTokens)}/1M</dd></div>
            </dl>
            <p><strong>Requested:</strong> {selection.requestedTitles.join(", ")}</p>
            {selection.dependencyTitles.length ? <p><strong>Required journey dependencies:</strong> {selection.dependencyTitles.join(", ")}</p> : null}
            <p className={preview.withinLimits ? "" : "is-warning"}>
                Configured ceilings: {preview.limits.maxCalls} calls and {formatUsd(preview.limits.maxEstimatedCostUsd)} per run.
            </p>
            <form action={runAiEvalLiveScenariosAction}>
                <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                <input type="hidden" name="selectionFingerprint" value={preview.selectionFingerprint} />
                {selection.requestedVersionIds.map((id) => (
                    <input key={id} type="hidden" name="requestedScenarioVersionId" value={id} />
                ))}
                <label className="ai-eval-live-preview__acknowledgement">
                    <input type="checkbox" name="liveAcknowledgement" value="confirmed" required />
                    <span>I reviewed this estimate and understand that the confirmed worker will spend credentialed provider calls.</span>
                </label>
                <button type="submit" className="button button--primary" disabled={!preview.withinLimits}>
                    Queue credentialed run
                </button>
            </form>
        </section>
    );
}

function RunWorkspace({
    runs,
    selectedRun,
    comparison,
}: {
    runs: AiEvalScenarioRunSummary[];
    selectedRun: AiEvalScenarioRunDetail | null;
    comparison?: AiEvalScenarioRunComparison | null;
}) {
    return (
        <div className={`ai-eval-scenario-run-layout ${selectedRun ? "has-selection" : ""}`}>
            <aside className="ai-eval-scenario-runs" aria-label="Scenario runs">
                <header><p className="type-eyebrow">Durable history</p><h2>Runs</h2></header>
                {runs.length ? <ol>{runs.map((run) => (
                    <li key={run.runId}>
                        <Link href={`/qa/ai-eval?view=runs&run=${encodeURIComponent(run.runId)}`} className={selectedRun?.runId === run.runId ? "is-selected" : ""}>
                            <span className="ai-eval-list__topline"><strong>{run.caseCount} cases</strong><span className={`ai-eval-chip is-${run.lifecycleState}`}>{humanize(run.lifecycleState)}</span></span>
                            <span>{run.completedCaseCount} complete | {run.failedCaseCount} failed</span>
                            <span>{formatDate(run.requestedAt)}</span>
                        </Link>
                    </li>
                ))}</ol> : <p className="ai-eval-scenario-empty">No scenario runs have been submitted.</p>}
            </aside>
            <section className="ai-eval-scenario-run-detail" aria-label="Selected scenario run">
                {selectedRun ? <RunDetail run={selectedRun} runs={runs} comparison={comparison} /> : (
                    <div className="ai-eval-case-empty"><Beaker size={24} /><h2>Select a run to inspect its outputs.</h2></div>
                )}
            </section>
        </div>
    );
}

function RunDetail({
    run,
    runs,
    comparison,
}: {
    run: AiEvalScenarioRunDetail;
    runs: AiEvalScenarioRunSummary[];
    comparison?: AiEvalScenarioRunComparison | null;
}) {
    const comparableRuns = runs.filter((candidate) => candidate.runId !== run.runId
        && candidate.executionMode === "credentialed_live"
        && candidate.profileId === run.profileId
        && candidate.configurationFingerprint === run.configurationFingerprint);
    return (
        <>
            <header className="ai-eval-scenario-run-detail__header">
                <div>
                    <p className="type-eyebrow">{run.executionMode === "credentialed_live" ? "Credentialed live run" : "Contract fixture run"}</p>
                    <h2>{run.caseCount} scenario cases</h2>
                </div>
                <span className={`ai-eval-chip is-${run.lifecycleState}`}>{humanize(run.lifecycleState)}</span>
            </header>
            <p className="ai-eval-scenario-run-detail__meta">
                Profile {run.profileId} | Retained until {formatDate(run.retentionExpiresAt)}
            </p>
            {run.costPreview ? <RunCostSummary run={run} /> : null}
            {run.executionMode === "credentialed_live" && comparableRuns.length ? (
                <form className="ai-eval-run-comparison-picker" action="/qa/ai-eval" method="get">
                    <input type="hidden" name="view" value="runs" />
                    <input type="hidden" name="run" value={run.runId} />
                    <label htmlFor="ai-eval-compare-run">Compare with prior same-profile run</label>
                    <select id="ai-eval-compare-run" name="compare" required defaultValue="">
                        <option value="" disabled>Select prior run</option>
                        {comparableRuns.map((candidate) => (
                            <option key={candidate.runId} value={candidate.runId}>
                                {formatDate(candidate.requestedAt)} ({candidate.caseCount} cases)
                            </option>
                        ))}
                    </select>
                    <button type="submit" className="button button--secondary">Compare</button>
                </form>
            ) : null}
            {comparison ? <RunComparison comparison={comparison} /> : null}
            <ol className="ai-eval-scenario-results">
                {run.cases.map((runCase) => (
                    <li key={runCase.runCaseId}>
                        <header>
                            <div><span>Case {runCase.ordinal}</span><h3>{runCase.scenario.title}</h3></div>
                            <span className={`ai-eval-chip is-${runCase.assertionResult ?? runCase.lifecycleState}`}>
                                {humanize(runCase.assertionResult ?? runCase.lifecycleState)}
                            </span>
                        </header>
                        {runCase.assertionReasons.map((reason) => <p key={reason}>{reason}</p>)}
                        <div className="ai-eval-scenario-layers">
                            <p className="type-eyebrow">Candidate-visible outputs</p>
                            {runCase.layers.filter((layer) => layer.candidateVisible).map((layer) => (
                                <RunLayerDetail key={layer.runLayerId} layer={layer} />
                            ))}
                        </div>
                        {runCase.layers.some((layer) => !layer.candidateVisible) ? (
                            <details className="ai-eval-scenario-diagnostics">
                                <summary>Internal evaluator diagnostics</summary>
                                {runCase.layers.filter((layer) => !layer.candidateVisible).map((layer) => (
                                    <RunLayerDetail key={layer.runLayerId} layer={layer} />
                                ))}
                            </details>
                        ) : null}
                    </li>
                ))}
            </ol>
        </>
    );
}

function RunCostSummary({ run }: { run: AiEvalScenarioRunDetail }) {
    const preview = run.costPreview!;
    const actual = readAiEvalScenarioRunMetrics(run);
    return (
        <section className="ai-eval-run-cost-summary" aria-label="Live run execution metrics">
            <dl>
                <div><dt>Estimated maximum</dt><dd>{formatUsd(preview.maximumEstimatedCostUsd)}</dd></div>
                <div><dt>Actual calls</dt><dd>{actual.calls}</dd></div>
                <div><dt>Actual tokens</dt><dd>{formatInteger(actual.totalTokens)}</dd></div>
                <div><dt>Provider latency</dt><dd>{formatDuration(actual.latencyMs)}</dd></div>
            </dl>
            <p>Actual metrics come from accepted runtime metadata and are diagnostic, not billing records.</p>
        </section>
    );
}

function RunComparison({ comparison }: { comparison: AiEvalScenarioRunComparison }) {
    const changed = comparison.cases.filter((item) => (
        item.assertionChanged || item.changedCandidateVisibleLayers.length || item.changedDiagnosticLayers.length
    ));
    return (
        <section className="ai-eval-run-comparison" aria-label="Same-profile sequential comparison">
            <header>
                <div>
                    <p className="type-eyebrow">Same-profile sequential comparison</p>
                    <h3>{comparison.compatible ? `${comparison.changedCaseCount} cases changed` : "Runs cannot be compared"}</h3>
                </div>
            </header>
            {comparison.reasons.map((reason) => <p key={reason} className="is-warning">{reason}</p>)}
            {comparison.compatible ? (
                <>
                    <dl>
                        <div><dt>Candidate-visible layers changed</dt><dd>{comparison.changedCandidateVisibleLayerCount}</dd></div>
                        <div><dt>Diagnostic layers changed</dt><dd>{comparison.changedDiagnosticLayerCount}</dd></div>
                        <div><dt>Token delta</dt><dd>{signedInteger(comparison.metrics.delta.totalTokens)}</dd></div>
                        <div><dt>Latency delta</dt><dd>{signedDuration(comparison.metrics.delta.latencyMs)}</dd></div>
                    </dl>
                    <ol>{changed.map((item) => (
                        <li key={item.inputFingerprint}>
                            <strong>{item.title}</strong>
                            <span>
                                {item.changedCandidateVisibleLayers.length} visible, {item.changedDiagnosticLayers.length} diagnostic layer changes
                                {item.assertionChanged ? ", assertion changed" : ""}
                            </span>
                        </li>
                    ))}</ol>
                </>
            ) : null}
        </section>
    );
}

function RunLayerDetail({ layer }: { layer: AiEvalScenarioRunLayer }) {
    return (
        <details open={layer.outputLayer === "session_coaching" || layer.outputLayer === "coach_update"}>
            <summary>
                <span>{humanize(layer.outputLayer)}</span>
                <span className={`ai-eval-chip is-${layer.assertionResult ?? layer.lifecycleState}`}>
                    {humanize(layer.assertionResult ?? layer.lifecycleState)}
                </span>
            </summary>
            {layer.assertionReasons.map((reason) => <p key={reason}>{reason}</p>)}
            {layer.output ? <pre>{JSON.stringify(layer.output, null, 2)}</pre> : <p>No output was produced.</p>}
        </details>
    );
}

function UnavailableState() {
    return (
        <section className="ai-eval-unavailable" role="alert">
            <div><h2>The scenario workspace is temporarily unavailable.</h2><p>No scenario changes were made.</p></div>
        </section>
    );
}

function noticeText(notice?: string) {
    return ({
        draft_created: "Scenario draft created.",
        draft_saved: "Scenario draft saved.",
        staged: "Immutable scenario version staged.",
        run_completed: "Scenario run completed and its output layers are ready for review.",
        run_queued: "Scenario run queued. Refresh the Runs view after a worker processes it.",
        live_run_queued: "Credentialed run queued. No provider call occurs until a separately confirmed live worker claims it.",
        run_incomplete: "The run is incomplete. Its accepted layers were preserved and a worker can retry the remaining work.",
        conflict: "This draft changed elsewhere. Reload it before saving again.",
        invalid: "The scenario input was not valid. No changes were made.",
        unavailable: "The scenario workspace could not complete that operation.",
    } as Record<string, string>)[notice ?? ""];
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function humanize(value: string) {
    return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUsd(value: number) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value);
}

function formatInteger(value: number) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatDuration(value: number) {
    return value >= 1_000 ? `${(value / 1_000).toFixed(1)}s` : `${value}ms`;
}

function signedInteger(value: number) {
    return `${value > 0 ? "+" : ""}${formatInteger(value)}`;
}

function signedDuration(value: number) {
    return `${value > 0 ? "+" : ""}${formatDuration(value)}`;
}
