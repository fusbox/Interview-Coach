import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
    Beaker,
    CheckCircle2,
    ClipboardCheck,
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
import {
    PendingServerActionForm,
    PendingSubmitButton,
} from "@/components/ui/pending-server-action-form";

import { AiEvalScenarioCaseList } from "./AiEvalScenarioCaseList";
import type {
    AiEvalLiveCostPreview,
    AiEvalLiveExecutionPolicy,
} from "./ai-eval-live-run-contract";
import {
    readAiEvalScenarioRunMetrics,
    type AiEvalScenarioRunComparison,
} from "./ai-eval-scenario-run-comparison";
import {
    aiEvalScenarioBaselineCases,
    aiEvalScenarioBaselineManifest,
} from "./ai-eval-scenario-baseline";

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
            <div className="ai-eval-scenario-pagehead">
                <WorkspaceNavigation active={filters.view} />
                <p className="ai-eval-scenario-pagehead__count" aria-live="polite">
                    {filters.view === "scenarios"
                        ? `${baselineCount} baseline case${baselineCount === 1 ? "" : "s"}`
                        : `${runs.length} run${runs.length === 1 ? "" : "s"}`}
                </p>
            </div>
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
    const baselineOrdinals = new Map(
        aiEvalScenarioBaselineManifest.members.map((member) => [member.scenarioKey, member.ordinal]),
    );
    const caseOptions = versions.map((version) => ({
        scenarioVersionId: version.scenarioVersionId,
        scenarioKey: version.scenario.scenarioKey,
        title: version.scenario.title,
        sourceKind: version.sourceKind,
        versionNumber: version.versionNumber,
        kindLabel: humanize(version.scenario.kind),
        audienceLabel: version.scenario.audiences.map(humanize).join(", "),
        rationale: version.scenario.rationale,
        baselineOrdinal: version.sourceKind === "baseline"
            ? baselineOrdinals.get(version.scenario.scenarioKey) ?? null
            : null,
    }));

    return (
        <div className={`ai-eval-scenario-layout ${selectedDraft ? "has-editor" : ""} ${drafts.length || selectedDraft ? "has-rail" : ""}`}>
            <section className="ai-eval-scenario-workflow" aria-label="Scenario run setup">
                <div className="ai-eval-scenario-toolbar" aria-label="Run actions">
                    <div className="ai-eval-scenario-toolbar__group">
                        <span className="ai-eval-scenario-toolbar__label">1. Select cases</span>
                        <span className="ai-eval-scenario-toolbar__hint">Select one or more case versions from the scenario list, then choose a run path.</span>
                    </div>
                    <div className="ai-eval-scenario-toolbar__group">
                        <span className="ai-eval-scenario-toolbar__label">2. Fixture run</span>
                        <div className="ai-eval-scenario-toolbar__actions">
                            <PendingServerActionForm id="ai-eval-selected-run" action={runAiEvalScenariosAction}>
                                <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                                <input type="hidden" name="runScope" value="selected" />
                                <PendingSubmitButton className="button button--secondary">Run selected</PendingSubmitButton>
                            </PendingServerActionForm>
                            <PendingServerActionForm action={runAiEvalScenariosAction}>
                                <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                                <input type="hidden" name="runScope" value="full_baseline" />
                                <PendingSubmitButton className="button button--secondary">Run all baseline</PendingSubmitButton>
                            </PendingServerActionForm>
                        </div>
                    </div>
                    <div className="ai-eval-scenario-toolbar__group ai-eval-scenario-toolbar__group--live">
                        <span className="ai-eval-scenario-toolbar__label">3. Live Gemini</span>
                        <div className="ai-eval-scenario-toolbar__actions">
                            <button type="submit" className="button button--primary" form="ai-eval-live-selected-preview">
                                Preview selected
                            </button>
                            <form className="ai-eval-scenario-toolbar__tag" action="/qa/ai-eval" method="get">
                                <input type="hidden" name="view" value="scenarios" />
                                <input type="hidden" name="liveScope" value="tag" />
                                <label className="sr-only" htmlFor="ai-eval-live-tag">Tag</label>
                                <select id="ai-eval-live-tag" name="liveTag" required defaultValue="">
                                    <option value="" disabled>Tag…</option>
                                    {tags.map((tag) => <option key={tag} value={tag}>{humanize(tag)}</option>)}
                                </select>
                                <button type="submit" className="button button--secondary">Preview tag</button>
                            </form>
                            <form action="/qa/ai-eval" method="get">
                                <input type="hidden" name="view" value="scenarios" />
                                <button type="submit" name="liveScope" value="full_corpus" className="button button--secondary">
                                    Preview all
                                </button>
                            </form>
                        </div>
                        <p className={`ai-eval-scenario-toolbar__status ${livePolicy?.ready ? "" : "is-blocked"}`}>
                            {livePolicy?.ready
                                ? "Live ready · queuing only; worker makes the call"
                                : `Live blocked · ${(livePolicy?.reasons ?? ["LIVE_POLICY_UNAVAILABLE"]).map(humanize).join(", ")}`}
                        </p>
                    </div>
                </div>

                {livePreview ? <LiveRunPreview selection={livePreview} /> : null}

                <form id="ai-eval-live-selected-preview" action="/qa/ai-eval" method="get">
                    <input type="hidden" name="view" value="scenarios" />
                    <input type="hidden" name="liveScope" value="selected" />
                </form>
            </section>

            <section className="ai-eval-scenario-library" aria-label="Scenario cases">
                <AiEvalScenarioCaseList
                    versions={caseOptions}
                    fixtureFormId="ai-eval-selected-run"
                    liveFormId="ai-eval-live-selected-preview"
                />
            </section>

            {(drafts.length > 0 || selectedDraft) ? (
                <aside className="ai-eval-scenario-rail" aria-label="Drafts and editor">
                    <div className="ai-eval-scenario-drafts">
                        <header>
                            <h2>Drafts</h2>
                            <PendingServerActionForm action={createAiEvalScenarioDraftAction}>
                                <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                                <PendingSubmitButton className="icon-button" title="Blank draft" aria-label="Create blank draft">
                                    <Plus size={17} />
                                </PendingSubmitButton>
                            </PendingServerActionForm>
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
                                            <span>r{draft.revision} · {formatDate(draft.updatedAt)}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="ai-eval-scenario-empty">Clone a case to edit it.</p>
                        )}
                    </div>
                    {selectedDraft ? <ScenarioEditor draft={selectedDraft} /> : null}
                </aside>
            ) : null}
        </div>
    );
}

function ScenarioEditor({ draft }: { draft: AiEvalScenarioDraft }) {
    return (
        <div className="ai-eval-scenario-editor" aria-label="Scenario editor">
            <header>
                <h2>{draft.scenario.title}</h2>
                <FileJson size={18} aria-hidden="true" />
            </header>
            <PendingServerActionForm action={mutateAiEvalScenarioDraftAction}>
                <input type="hidden" name="draftId" value={draft.draftId} />
                <input type="hidden" name="revision" value={draft.revision} />
                <label className="sr-only" htmlFor="scenario-json">Scenario JSON</label>
                <textarea
                    id="scenario-json"
                    name="scenarioJson"
                    defaultValue={JSON.stringify(draft.scenario, null, 2)}
                    spellCheck={false}
                    required
                />
                <div className="ai-eval-scenario-editor__actions">
                    <PendingSubmitButton name="intent" value="save" className="button button--secondary">
                        <Save size={16} />Save
                    </PendingSubmitButton>
                    <PendingSubmitButton name="intent" value="stage" className="button button--primary">
                        <CheckCircle2 size={16} />Stage
                    </PendingSubmitButton>
                </div>
            </PendingServerActionForm>
        </div>
    );
}

function LiveRunPreview({ selection }: { selection: AiEvalLiveSelectionPreview }) {
    const preview = selection.preview;
    return (
        <section className="ai-eval-live-preview" aria-labelledby="live-preview-title">
            <div className="ai-eval-live-preview__summary">
                <h2 id="live-preview-title">Live estimate</h2>
                <p>
                    <strong>{preview.expandedCaseCount}</strong> cases
                    {preview.dependencyCaseCount > 0 ? ` (+${preview.dependencyCaseCount} deps)` : ""}
                    {" · "}
                    <strong>{preview.calls.minimum}–{preview.calls.maximum}</strong> calls
                    {" · "}
                    <strong>{formatUsd(preview.maximumEstimatedCostUsd)}</strong> max
                </p>
                <p className="ai-eval-live-preview__titles">{selection.requestedTitles.join(" · ")}</p>
                {!preview.withinLimits ? (
                    <p className="is-warning">
                        Over ceiling ({preview.limits.maxCalls} calls / {formatUsd(preview.limits.maxEstimatedCostUsd)}). Raise limits or shrink selection.
                    </p>
                ) : null}
            </div>
            <PendingServerActionForm className="ai-eval-live-preview__queue" action={runAiEvalLiveScenariosAction} pendingAnnouncement="Queueing live run.">
                <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                <input type="hidden" name="selectionFingerprint" value={preview.selectionFingerprint} />
                {selection.requestedVersionIds.map((id) => (
                    <input key={id} type="hidden" name="requestedScenarioVersionId" value={id} />
                ))}
                <label className="ai-eval-live-preview__acknowledgement">
                    <input type="checkbox" name="liveAcknowledgement" value="confirmed" required />
                    <span>I reviewed the estimate. The worker will spend credentialed calls.</span>
                </label>
                <PendingSubmitButton className="button button--primary" disabled={!preview.withinLimits}>
                    Queue live run
                </PendingSubmitButton>
            </PendingServerActionForm>
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
                <header><h2>Runs</h2></header>
                {runs.length ? <ol>{runs.map((run) => (
                    <li key={run.runId}>
                        <Link href={`/qa/ai-eval?view=runs&run=${encodeURIComponent(run.runId)}`} className={selectedRun?.runId === run.runId ? "is-selected" : ""}>
                            <span className="ai-eval-list__topline"><strong>{run.caseCount} cases</strong><span className={`ai-eval-chip is-${run.lifecycleState}`}>{humanize(run.lifecycleState)}</span></span>
                            <span>{run.completedCaseCount}/{run.caseCount} done · {formatDate(run.requestedAt)}</span>
                        </Link>
                    </li>
                ))}</ol> : <p className="ai-eval-scenario-empty">No runs yet.</p>}
            </aside>
            <section className="ai-eval-scenario-run-detail" aria-label="Selected scenario run">
                {selectedRun ? <RunDetail run={selectedRun} runs={runs} comparison={comparison} /> : (
                    <div className="ai-eval-case-empty"><Beaker size={24} /><h2>Select a run</h2></div>
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
    const runScenariosByKey = new Map(
        [
            ...aiEvalScenarioBaselineCases,
            ...run.cases.map((runCase) => runCase.scenario),
        ].map((scenario) => [scenario.scenarioKey, scenario]),
    );
    return (
        <>
            <header className="ai-eval-scenario-run-detail__header">
                <div>
                    <h2>{run.caseCount} cases · {run.executionMode === "credentialed_live" ? "Live" : "Fixture"}</h2>
                    <p className="ai-eval-scenario-run-detail__meta">
                        Retained until {formatDate(run.retentionExpiresAt)}
                    </p>
                </div>
                <span className={`ai-eval-chip is-${run.lifecycleState}`}>{humanize(run.lifecycleState)}</span>
            </header>
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
                        <RunCaseInput
                            scenario={runCase.scenario}
                            runScenariosByKey={runScenariosByKey}
                        />
                        {runCase.assertionReasons.map((reason) => <p key={reason}>{reason}</p>)}
                        <div className="ai-eval-scenario-layers">
                            {runCase.layers.filter((layer) => layer.candidateVisible).map((layer) => (
                                <RunLayerDetail key={layer.runLayerId} layer={layer} />
                            ))}
                        </div>
                        {runCase.layers.some((layer) => !layer.candidateVisible) ? (
                            <details className="ai-eval-scenario-diagnostics">
                                <summary>Diagnostics</summary>
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

function RunCaseInput({
    scenario,
    runScenariosByKey,
}: {
    scenario: AiEvalScenarioRunDetail["cases"][number]["scenario"];
    runScenariosByKey: Map<string, AiEvalScenarioRunDetail["cases"][number]["scenario"]>;
}) {
    const atomicScenarios = scenario.kind === "atomic_answer"
        ? [scenario]
        : scenario.atomicCaseKeys.flatMap((scenarioKey) => {
            const dependency = runScenariosByKey.get(scenarioKey);
            return dependency?.kind === "atomic_answer" ? [dependency] : [];
        });

    return (
        <section className="ai-eval-run-case-input" aria-label="Case question and answer">
            {atomicScenarios.length ? atomicScenarios.map((atomicScenario, index) => (
                <article key={atomicScenario.scenarioKey}>
                    <div className="ai-eval-run-case-input__prompt">
                        <p className="type-eyebrow">
                            {atomicScenarios.length > 1 ? `Question ${index + 1}` : "Question"}
                        </p>
                        <h4>{atomicScenario.question.text}</h4>
                    </div>
                    <div className="ai-eval-run-case-input__answer">
                        <p className="type-eyebrow">
                            {atomicScenario.answer.mode === "voice" ? "Voice transcript" : "Answer"}
                        </p>
                        <blockquote>{atomicScenario.answer.text}</blockquote>
                        {atomicScenario.voiceMarkers ? (
                            <p className="ai-eval-run-case-input__voice-markers">
                                STT markers: {atomicScenario.voiceMarkers.fillerWordCount} filler words
                                {" / "}{atomicScenario.voiceMarkers.longPauseCount} long pauses
                                {" / "}{atomicScenario.voiceMarkers.wordsPerMinute ?? "unknown"} WPM
                            </p>
                        ) : null}
                    </div>
                </article>
            )) : (
                <p>Referenced question and answer inputs were not included in this run.</p>
            )}
        </section>
    );
}

function RunCostSummary({ run }: { run: AiEvalScenarioRunDetail }) {
    const preview = run.costPreview!;
    const actual = readAiEvalScenarioRunMetrics(run);
    return (
        <section className="ai-eval-run-cost-summary" aria-label="Live run metrics">
            <dl>
                <div><dt>Est. max</dt><dd>{formatUsd(preview.maximumEstimatedCostUsd)}</dd></div>
                <div><dt>Calls</dt><dd>{actual.calls}</dd></div>
                <div><dt>Tokens</dt><dd>{formatInteger(actual.totalTokens)}</dd></div>
                <div><dt>Latency</dt><dd>{formatDuration(actual.latencyMs)}</dd></div>
            </dl>
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
