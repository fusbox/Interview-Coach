import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    Beaker,
    CheckCircle2,
    ClipboardCheck,
    GitCommitHorizontal,
    Inbox,
    ListFilter,
    Plus,
    Play,
    Save,
    Search,
    Send,
    ShieldCheck,
    Trash2,
    Wrench,
} from "lucide-react";
import { randomUUID } from "node:crypto";
import type { ReactNode } from "react";

import {
    createCandidateAnswerAnalysisProjectionFromAcceptedFeedback,
} from "@/features/candidate-session-v2/candidate-answer-analysis-adapter";
import { createCandidateFeedbackInteraction } from "@/features/candidate-session-v2/candidate-feedback-interaction";
import { CandidateTranscriptCanvas } from "@/features/candidate-dashboard-v2/CandidateTranscriptCanvas";
import { normalizeCandidateTranscriptCanvasProjection } from "@/features/candidate-dashboard-v2/candidate-transcript-canvas";
import {
    candidateSafeFeedbackProjectionSchema,
    feedbackCompositionOutputSchema,
} from "@/features/evaluation-v2/evidence-first-evaluator-contract";

import {
    AI_EVAL_CHANGE_KINDS,
    AI_EVAL_RECHECK_OUTCOMES,
    AI_EVAL_REMEDIATION_TARGETS,
} from "./ai-eval-workbench-contract";
import type {
    AiEvalEligibleSource,
    AiEvalFailureLabel,
    AiEvalFinding,
    AiEvalFindingLayer,
    AiEvalRecheck,
    AiEvalRecheckCandidate,
    AiEvalRegressionCase,
    AiEvalRemediation,
    AiEvalRemediationFinding,
    AiEvalRemediationLifecycle,
    AiEvalReview,
    AiEvalSourceKind,
    AiEvalSurface,
    AiEvalWorkItem,
    AiEvalWorkItemDetail,
} from "./ai-eval-workbench-contract";
import {
    createAiEvalRemediationAction,
    linkAiEvalRemediationFindingsAction,
    mutateAiEvalReviewAction,
    promoteAiEvalRegressionCaseAction,
    promoteAiEvalSourceAction,
    recordAiEvalRecheckAction,
    startAiEvalReviewAction,
    updateAiEvalRemediationAction,
} from "@/app/qa/ai-eval/actions";

export type AiEvalWorkbenchView = "queue" | "inbox" | "remediation";

export type AiEvalWorkbenchFilters = {
    view: AiEvalWorkbenchView;
    surface?: AiEvalSurface;
    sourceKind?: AiEvalSourceKind;
    lifecycleState?: string;
    sourceLifecycleState?: string;
    selectedWorkItemId?: string;
    selectedRemediationId?: string;
    notice?: string;
};

export function AiEvalWorkbenchExperience({
    filters,
    workItems,
    eligibleSources,
    selectedDetail,
    review,
    findings,
    failureLabels,
    remediations,
    selectedRemediation,
    availableRemediationFindings,
    linkedRemediationFindings,
    regressionCases,
    recheckCandidates,
    rechecks,
    unavailable,
}: {
    filters: AiEvalWorkbenchFilters;
    workItems: AiEvalWorkItem[];
    eligibleSources: AiEvalEligibleSource[];
    selectedDetail: AiEvalWorkItemDetail | null;
    review: AiEvalReview | null;
    findings: AiEvalFinding[];
    failureLabels: AiEvalFailureLabel[];
    remediations: AiEvalRemediation[];
    selectedRemediation: AiEvalRemediation | null;
    availableRemediationFindings: AiEvalRemediationFinding[];
    linkedRemediationFindings: AiEvalRemediationFinding[];
    regressionCases: AiEvalRegressionCase[];
    recheckCandidates: Array<AiEvalRecheckCandidate & { regressionCaseId: string }>;
    rechecks: AiEvalRecheck[];
    unavailable?: boolean;
}) {
    const returnTarget = buildWorkbenchHref(filters);
    const displayedCount = filters.view === "queue"
        ? workItems.length
        : filters.view === "inbox" ? eligibleSources.length : remediations.length;

    return (
        <main className="ai-eval-workbench">
            <header className="ai-eval-workbench__intro">
                <div>
                    <p className="type-eyebrow">AI quality operations</p>
                    <h1>Review what the coach delivered.</h1>
                    <p>Inspect candidate-visible output first, trace it to accepted evidence, and record reusable findings.</p>
                </div>
                <dl aria-label="Current workbench count">
                    <div>
                        <dt>{filters.view === "queue" ? "Cases shown" : filters.view === "inbox" ? "Sources ready" : "Remediations"}</dt>
                        <dd>{displayedCount}</dd>
                    </div>
                </dl>
            </header>

            <nav className="ai-eval-view-tabs" aria-label="Workbench views">
                <Link
                    href={buildWorkbenchHref({ ...filters, view: "queue", selectedWorkItemId: undefined })}
                    aria-current={filters.view === "queue" ? "page" : undefined}
                >
                    <ClipboardCheck size={17} aria-hidden="true" />
                    Review queue
                </Link>
                <Link
                    href={buildWorkbenchHref({ ...filters, view: "inbox", selectedWorkItemId: undefined })}
                    aria-current={filters.view === "inbox" ? "page" : undefined}
                >
                    <Inbox size={17} aria-hidden="true" />
                    Source inbox
                </Link>
                <Link
                    href={buildWorkbenchHref({ ...filters, view: "remediation", selectedWorkItemId: undefined })}
                    aria-current={filters.view === "remediation" ? "page" : undefined}
                >
                    <Wrench size={17} aria-hidden="true" />
                    Remediation
                </Link>
                <Link href="/qa/ai-eval?view=scenarios">
                    <Beaker size={17} aria-hidden="true" />
                    Scenarios
                </Link>
                <Link href="/qa/ai-eval?view=runs">
                    <Play size={17} aria-hidden="true" />
                    Runs
                </Link>
            </nav>

            {noticeText(filters.notice) ? (
                <p className={`ai-eval-notice ${filters.notice === "conflict" ? "is-warning" : ""}`} role="status">
                    {noticeText(filters.notice)}
                </p>
            ) : null}

            {filters.view === "remediation" ? (
                unavailable ? (
                    <UnavailableState />
                ) : (
                    <RemediationWorkspace
                        filters={filters}
                        remediations={remediations}
                        selectedRemediation={selectedRemediation}
                        availableFindings={availableRemediationFindings}
                        linkedFindings={linkedRemediationFindings}
                        regressionCases={regressionCases}
                        recheckCandidates={recheckCandidates}
                        rechecks={rechecks}
                        returnTarget={returnTarget}
                    />
                )
            ) : <>
                <FilterBar filters={filters} />
                {unavailable ? <UnavailableState /> : (
                <div className={`ai-eval-layout ${selectedDetail ? "has-selection" : ""}`}>
                    <aside className="ai-eval-list" aria-label={filters.view === "queue" ? "Review queue" : "Source inbox"}>
                        {filters.view === "queue" ? (
                            <QueueList items={workItems} filters={filters} />
                        ) : (
                            <SourceInbox sources={eligibleSources} returnTarget={returnTarget} />
                        )}
                    </aside>

                    <section className="ai-eval-case" aria-label="Selected evaluation case">
                        {selectedDetail ? <CaseDetail detail={selectedDetail} /> : <CaseEmpty view={filters.view} />}
                    </section>

                    {selectedDetail ? (
                        <aside className="ai-eval-review" aria-label="Evaluation review">
                            <ReviewPanel
                                detail={selectedDetail}
                                review={review}
                                findings={findings}
                                failureLabels={failureLabels}
                                returnTarget={returnTarget}
                            />
                        </aside>
                    ) : null}
                </div>
                )}
            </>}
        </main>
    );
}

function UnavailableState() {
    return (
        <section className="ai-eval-unavailable" role="alert">
            <AlertTriangle size={21} aria-hidden="true" />
            <div>
                <h2>The workbench is temporarily unavailable.</h2>
                <p>No review changes were made. Try again after database access is restored.</p>
            </div>
        </section>
    );
}

function RemediationWorkspace({
    filters,
    remediations,
    selectedRemediation,
    availableFindings,
    linkedFindings,
    regressionCases,
    recheckCandidates,
    rechecks,
    returnTarget,
}: {
    filters: AiEvalWorkbenchFilters;
    remediations: AiEvalRemediation[];
    selectedRemediation: AiEvalRemediation | null;
    availableFindings: AiEvalRemediationFinding[];
    linkedFindings: AiEvalRemediationFinding[];
    regressionCases: AiEvalRegressionCase[];
    recheckCandidates: Array<AiEvalRecheckCandidate & { regressionCaseId: string }>;
    rechecks: AiEvalRecheck[];
    returnTarget: string;
}) {
    return (
        <div className="ai-eval-remediation-layout">
            <aside className="ai-eval-remediation-list" aria-label="Remediation hypotheses">
                <header>
                    <div>
                        <p className="type-eyebrow">Improvement loop</p>
                        <h2>Remediations</h2>
                    </div>
                    <Link href="/qa/ai-eval?view=remediation" aria-label="Create remediation"><Plus size={17} /></Link>
                </header>
                {remediations.length ? (
                    <ol>
                        {remediations.map((remediation) => (
                            <li key={remediation.remediationId}>
                                <Link
                                    className={filters.selectedRemediationId === remediation.remediationId ? "is-selected" : ""}
                                    href={`/qa/ai-eval?view=remediation&remediation=${encodeURIComponent(remediation.remediationId)}`}
                                >
                                    <span className="ai-eval-list__topline">
                                        <strong>{humanize(remediation.targetComponent)}</strong>
                                        <StatusChip value={remediation.lifecycleState} />
                                    </span>
                                    <span>{remediation.title}</span>
                                    <span>{remediation.findingCount} findings · {remediation.regressionCaseCount} regression cases</span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className="ai-eval-list__empty">
                        <Wrench size={20} aria-hidden="true" />
                        <h2>No remediation work yet.</h2>
                        <p>Start from one or more submitted findings.</p>
                    </div>
                )}
            </aside>

            <section className="ai-eval-remediation-main" aria-label="Remediation workspace">
                {selectedRemediation ? (
                    <RemediationDetail
                        remediation={selectedRemediation}
                        availableFindings={availableFindings}
                        linkedFindings={linkedFindings}
                        regressionCases={regressionCases}
                        recheckCandidates={recheckCandidates}
                        rechecks={rechecks}
                        returnTarget={returnTarget}
                    />
                ) : (
                    <CreateRemediationPanel findings={availableFindings} returnTarget={returnTarget} />
                )}
            </section>
        </div>
    );
}

function CreateRemediationPanel({ findings, returnTarget }: {
    findings: AiEvalRemediationFinding[];
    returnTarget: string;
}) {
    return (
        <div className="ai-eval-remediation-create">
            <header>
                <p className="type-eyebrow">New remediation</p>
                <h2>Group findings around one change hypothesis.</h2>
                <p>Choose findings that point to the same engine or product component. Source content remains in its original case.</p>
            </header>
            {findings.length ? (
                <form action={createAiEvalRemediationAction}>
                    <input type="hidden" name="creationRequestKey" value={randomUUID()} />
                    <input type="hidden" name="returnTarget" value={returnTarget} />
                    <div className="ai-eval-remediation-fields">
                        <label>
                            Target component
                            <select name="targetComponent" defaultValue="" required>
                                <option value="" disabled>Choose one component</option>
                                {AI_EVAL_REMEDIATION_TARGETS.map((target) => (
                                    <option key={target} value={target}>{humanize(target)}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Title
                            <input name="title" maxLength={180} required />
                        </label>
                        <label>
                            Hypothesis
                            <textarea name="hypothesis" rows={3} maxLength={4000} required />
                        </label>
                        <label>
                            Expected change
                            <textarea name="expectedChange" rows={3} maxLength={4000} required />
                        </label>
                        <label>
                            Regression risks
                            <textarea name="regressionRisks" rows={3} maxLength={4000} required />
                        </label>
                    </div>
                    <FindingChecklist findings={findings} legend="Findings addressed" />
                    <button className="is-primary" type="submit"><Wrench size={16} aria-hidden="true" />Create remediation</button>
                </form>
            ) : (
                <div className="ai-eval-remediation-empty">
                    <CheckCircle2 size={22} aria-hidden="true" />
                    <h3>No submitted findings are waiting.</h3>
                    <p>Submit a review with at least one finding before creating a remediation.</p>
                    <Link href="/qa/ai-eval?view=queue">Return to review queue</Link>
                </div>
            )}
        </div>
    );
}

function RemediationDetail({
    remediation,
    availableFindings,
    linkedFindings,
    regressionCases,
    recheckCandidates,
    rechecks,
    returnTarget,
}: {
    remediation: AiEvalRemediation;
    availableFindings: AiEvalRemediationFinding[];
    linkedFindings: AiEvalRemediationFinding[];
    regressionCases: AiEvalRegressionCase[];
    recheckCandidates: Array<AiEvalRecheckCandidate & { regressionCaseId: string }>;
    rechecks: AiEvalRecheck[];
    returnTarget: string;
}) {
    const terminal = ["verified", "wont_fix", "duplicate"].includes(remediation.lifecycleState);
    const canVerify = regressionCases.length > 0
        && regressionCases.every((regression) => regression.latestOutcome === "fixed");
    return (
        <div className="ai-eval-remediation-detail">
            <header className="ai-eval-remediation-detail__header">
                <div>
                    <p className="type-eyebrow">{humanize(remediation.targetComponent)}</p>
                    <h2>{remediation.title}</h2>
                </div>
                <StatusChip value={remediation.lifecycleState} />
            </header>

            <dl className="ai-eval-remediation-contract">
                <Metadata label="Hypothesis" value={remediation.hypothesis} />
                <Metadata label="Expected change" value={remediation.expectedChange} />
                <Metadata label="Regression risks" value={remediation.regressionRisks} />
            </dl>

            {!terminal ? (
                <form className="ai-eval-remediation-update" action={updateAiEvalRemediationAction}>
                    <input type="hidden" name="remediationId" value={remediation.remediationId} />
                    <input type="hidden" name="revision" value={remediation.revision} />
                    <input type="hidden" name="returnTarget" value={returnTarget} />
                    <label>
                        Workflow state
                        <select name="lifecycleState" defaultValue={remediation.lifecycleState}>
                            {allowedRemediationStates(remediation.lifecycleState, canVerify).map((state) => (
                                <option key={state} value={state}>{humanize(state)}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Change type
                        <select name="changeKind" defaultValue={remediation.changeKind ?? ""}>
                            <option value="">Not recorded yet</option>
                            {AI_EVAL_CHANGE_KINDS.map((kind) => <option key={kind} value={kind}>{humanize(kind)}</option>)}
                        </select>
                    </label>
                    <label>
                        Governed change reference
                        <input name="changedReference" maxLength={500} defaultValue={remediation.changedReference ?? ""} placeholder="Commit, PR, profile, migration, or spec reference" />
                    </label>
                    <label className="is-wide">
                        Verification note
                        <textarea name="verificationNote" rows={2} maxLength={4000} defaultValue={remediation.verificationNote ?? ""} />
                    </label>
                    <button type="submit"><Save size={16} aria-hidden="true" />Update workflow</button>
                </form>
            ) : remediation.verificationNote ? (
                <p className="ai-eval-remediation-verification"><ShieldCheck size={18} aria-hidden="true" />{remediation.verificationNote}</p>
            ) : null}

            <section className="ai-eval-remediation-section">
                <header>
                    <div><p className="type-eyebrow">Evidence set</p><h3>Linked findings</h3></div>
                    <span>{linkedFindings.length}</span>
                </header>
                <FindingRows findings={linkedFindings} remediation={remediation} returnTarget={returnTarget} />
                {!terminal && availableFindings.length ? (
                    <details className="ai-eval-remediation-add-findings">
                        <summary>Add findings</summary>
                        <form action={linkAiEvalRemediationFindingsAction}>
                            <input type="hidden" name="remediationId" value={remediation.remediationId} />
                            <input type="hidden" name="returnTarget" value={returnTarget} />
                            <FindingChecklist findings={availableFindings} legend="Additional submitted findings" />
                            <button type="submit"><Plus size={16} aria-hidden="true" />Link selected findings</button>
                        </form>
                    </details>
                ) : null}
            </section>

            <section className="ai-eval-remediation-section">
                <header>
                    <div><p className="type-eyebrow">Regression coverage</p><h3>Representative failures</h3></div>
                    <span>{regressionCases.length}</span>
                </header>
                {regressionCases.length ? (
                    <ol className="ai-eval-regression-list">
                        {regressionCases.map((regression) => (
                            <li key={regression.regressionCaseId}>
                                <div className="ai-eval-regression-list__header">
                                    <div>
                                        <strong>{humanize(regression.failureLabel)}</strong>
                                        <span>{surfaceLabel(regression.surface)} · {humanize(regression.layer)} · {shortId(regression.originalWorkItemId)}</span>
                                    </div>
                                    <StatusChip value={regression.latestOutcome ?? "not_rechecked"} />
                                </div>
                                {remediation.lifecycleState === "ready_for_recheck" ? (
                                    <RecheckForm
                                        remediation={remediation}
                                        regression={regression}
                                        candidates={recheckCandidates.filter((candidate) => candidate.regressionCaseId === regression.regressionCaseId)}
                                        returnTarget={returnTarget}
                                    />
                                ) : null}
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="ai-eval-remediation-hint">Promote the smallest representative set of linked findings before marking a change ready for recheck.</p>
                )}
            </section>

            {rechecks.length ? (
                <section className="ai-eval-remediation-section">
                    <header><div><p className="type-eyebrow">Verification history</p><h3>Sequential rechecks</h3></div><span>{rechecks.length}</span></header>
                    <ol className="ai-eval-recheck-history">
                        {rechecks.map((recheck) => (
                            <li key={recheck.recheckId}>
                                <StatusChip value={recheck.outcome} />
                                <div>
                                    <Link href={`/qa/ai-eval?view=queue&case=${encodeURIComponent(recheck.verificationWorkItemId)}`}>
                                        {shortId(recheck.verificationWorkItemId)}
                                    </Link>
                                    <p>{recheck.verificationNote}</p>
                                    <span>{formatDate(recheck.createdAt)}</span>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
            ) : null}
        </div>
    );
}

function FindingChecklist({ findings, legend }: { findings: AiEvalRemediationFinding[]; legend: string }) {
    return (
        <fieldset className="ai-eval-finding-checklist">
            <legend>{legend}</legend>
            {findings.map((finding) => (
                <label key={finding.findingId}>
                    <input type="checkbox" name="findingId" value={finding.findingId} />
                    <span>
                        <strong>{humanize(finding.failureLabel)}</strong>
                        <small>{surfaceLabel(finding.surface)} · {humanize(finding.layer)} · {shortId(finding.workItemId)}</small>
                        <span>{finding.rationale}</span>
                    </span>
                </label>
            ))}
        </fieldset>
    );
}

function FindingRows({ findings, remediation, returnTarget }: {
    findings: AiEvalRemediationFinding[];
    remediation: AiEvalRemediation;
    returnTarget: string;
}) {
    if (!findings.length) return <p>No findings are linked.</p>;
    return (
        <ol className="ai-eval-remediation-findings">
            {findings.map((finding) => (
                <li key={finding.findingId}>
                    <div>
                        <span className="ai-eval-list__topline">
                            <strong>{humanize(finding.failureLabel)}</strong>
                            <StatusChip value={finding.severity} />
                        </span>
                        <p>{finding.rationale}</p>
                        <span>{surfaceLabel(finding.surface)} · {humanize(finding.layer)} · {shortId(finding.workItemId)}</span>
                    </div>
                    <div className="ai-eval-remediation-findings__actions">
                        <Link href={`/qa/ai-eval?view=queue&case=${encodeURIComponent(finding.workItemId)}`}>Open case</Link>
                        {!finding.regressionCaseId && !["verified", "wont_fix", "duplicate"].includes(remediation.lifecycleState) ? (
                            <form action={promoteAiEvalRegressionCaseAction}>
                                <input type="hidden" name="remediationId" value={remediation.remediationId} />
                                <input type="hidden" name="findingId" value={finding.findingId} />
                                <input type="hidden" name="returnTarget" value={returnTarget} />
                                <button type="submit"><ShieldCheck size={15} aria-hidden="true" />Promote regression case</button>
                            </form>
                        ) : finding.regressionCaseId ? <span>Regression case</span> : null}
                    </div>
                </li>
            ))}
        </ol>
    );
}

function RecheckForm({ remediation, regression, candidates, returnTarget }: {
    remediation: AiEvalRemediation;
    regression: AiEvalRegressionCase;
    candidates: AiEvalRecheckCandidate[];
    returnTarget: string;
}) {
    if (!candidates.length) {
        return <p className="ai-eval-remediation-hint">Review and submit a later {surfaceLabel(regression.surface).toLowerCase()} case before recording this recheck.</p>;
    }
    return (
        <form className="ai-eval-recheck-form" action={recordAiEvalRecheckAction}>
            <input type="hidden" name="remediationId" value={remediation.remediationId} />
            <input type="hidden" name="regressionCaseId" value={regression.regressionCaseId} />
            <input type="hidden" name="returnTarget" value={returnTarget} />
            <label>
                Later reviewed output
                <select name="verificationReviewId" defaultValue="" required>
                    <option value="" disabled>Choose an exact reviewed case</option>
                    {candidates.map((candidate) => (
                        <option key={candidate.reviewId} value={candidate.reviewId}>
                            {shortId(candidate.workItemId)} · {sourceLabel(candidate.sourceKind)} · {candidate.profileId ?? "No profile"} · {shortFingerprint(candidate.configurationFingerprint)} · {formatDate(candidate.sourceOccurredAt)}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                Result against original failure
                <select name="outcome" defaultValue="" required>
                    <option value="" disabled>Choose</option>
                    {AI_EVAL_RECHECK_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{humanize(outcome)}</option>)}
                </select>
            </label>
            <label className="is-wide">
                Verification note
                <textarea name="verificationNote" rows={2} maxLength={4000} required />
            </label>
            <button type="submit"><GitCommitHorizontal size={16} aria-hidden="true" />Record recheck</button>
        </form>
    );
}

function allowedRemediationStates(
    current: AiEvalRemediationLifecycle,
    canVerify: boolean,
): AiEvalRemediationLifecycle[] {
    const next: Record<AiEvalRemediationLifecycle, AiEvalRemediationLifecycle[]> = {
        observed: ["observed", "triaged", "planned", "wont_fix", "duplicate"],
        triaged: ["triaged", "planned", "wont_fix", "duplicate"],
        planned: ["planned", "changed", "wont_fix", "duplicate"],
        changed: ["changed", "planned", "ready_for_recheck", "wont_fix", "duplicate"],
        ready_for_recheck: ["ready_for_recheck", "changed", "verified", "wont_fix", "duplicate"],
        verified: ["verified"],
        wont_fix: ["wont_fix"],
        duplicate: ["duplicate"],
    };
    return canVerify ? next[current] : next[current].filter((state) => state !== "verified");
}

function FilterBar({ filters }: { filters: AiEvalWorkbenchFilters }) {
    return (
        <form className="ai-eval-filters" method="get">
            <input type="hidden" name="view" value={filters.view} />
            <div>
                <label htmlFor="ai-eval-surface">Surface</label>
                <select id="ai-eval-surface" name="surface" defaultValue={filters.surface ?? ""}>
                    <option value="">All surfaces</option>
                    <option value="answer_coaching">Answer coaching</option>
                    <option value="coach_update">Coach Update</option>
                    <option value="question_wording">Question wording</option>
                </select>
            </div>
            <div>
                <label htmlFor="ai-eval-source-kind">Source</label>
                <select id="ai-eval-source-kind" name="sourceKind" defaultValue={filters.sourceKind ?? ""}>
                    <option value="">All sources</option>
                    <option value="candidate_answer_evaluation">Candidate answer</option>
                    <option value="invited_answer_evaluation">Invited answer</option>
                    <option value="candidate_coach_update">Coach Update</option>
                    <option value="candidate_question_wording">Candidate questions</option>
                    <option value="recruiter_question_wording">Recruiter questions</option>
                </select>
            </div>
            {filters.view === "queue" ? (
                <div>
                    <label htmlFor="ai-eval-lifecycle">Review state</label>
                    <select id="ai-eval-lifecycle" name="lifecycle" defaultValue={filters.lifecycleState ?? ""}>
                        <option value="">All states</option>
                        <option value="queued">Queued</option>
                        <option value="in_review">In review</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="remediation_in_progress">Remediation in progress</option>
                        <option value="verified">Verified</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
            ) : null}
            <div>
                <label htmlFor="ai-eval-source-state">Source state</label>
                <select id="ai-eval-source-state" name="sourceState" defaultValue={filters.sourceLifecycleState ?? ""}>
                    <option value="">All states</option>
                    <option value="completed">Completed</option>
                    <option value="ready">Ready</option>
                    <option value="failed">Failed</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>
            <button type="submit"><ListFilter size={16} aria-hidden="true" />Apply</button>
            <Link href={`/qa/ai-eval?view=${filters.view}`}>Clear</Link>
        </form>
    );
}

function QueueList({ items, filters }: { items: AiEvalWorkItem[]; filters: AiEvalWorkbenchFilters }) {
    if (items.length === 0) {
        return (
            <div className="ai-eval-list__empty">
                <Search size={20} aria-hidden="true" />
                <h2>No cases match these filters.</h2>
                <p>Open the source inbox to add an eligible output, or clear the current filters.</p>
            </div>
        );
    }
    return (
        <ol>
            {items.map((item) => (
                <li key={item.workItemId}>
                    <Link
                        className={filters.selectedWorkItemId === item.workItemId ? "is-selected" : ""}
                        href={buildWorkbenchHref({ ...filters, selectedWorkItemId: item.workItemId })}
                    >
                        <span className="ai-eval-list__topline">
                            <strong>{surfaceLabel(item.surface)}</strong>
                            <StatusChip value={item.lifecycleState} />
                        </span>
                        <span>{sourceLabel(item.sourceKind)} · {audienceLabel(item.audience)}</span>
                        <span>{formatDate(item.sourceOccurredAt)} · {shortId(item.workItemId)}</span>
                    </Link>
                </li>
            ))}
        </ol>
    );
}

function SourceInbox({ sources, returnTarget }: { sources: AiEvalEligibleSource[]; returnTarget: string }) {
    if (sources.length === 0) {
        return (
            <div className="ai-eval-list__empty">
                <CheckCircle2 size={20} aria-hidden="true" />
                <h2>No unqueued sources match.</h2>
                <p>New eligible serving outputs will appear here without exposing candidate identity.</p>
            </div>
        );
    }
    return (
        <ol>
            {sources.map((source) => (
                <li key={`${source.sourceKind}:${source.sourceId}`} className="ai-eval-source-row">
                    <div>
                        <span className="ai-eval-list__topline">
                            <strong>{surfaceLabel(source.surface)}</strong>
                            <StatusChip value={source.sourceLifecycleState} />
                        </span>
                        <span>{sourceLabel(source.sourceKind)} · {audienceLabel(source.audience)}</span>
                        <span>{formatDate(source.sourceOccurredAt)} · {shortId(source.sourceId)}</span>
                    </div>
                    <form action={promoteAiEvalSourceAction}>
                        <input type="hidden" name="sourceKind" value={source.sourceKind} />
                        <input type="hidden" name="sourceId" value={source.sourceId} />
                        <input type="hidden" name="selectionReason" value={source.sourceFailureCode ? "provider_failure" : "production_sample"} />
                        <input type="hidden" name="returnTarget" value={returnTarget} />
                        <button type="submit"><Plus size={15} aria-hidden="true" />Add to queue</button>
                    </form>
                </li>
            ))}
        </ol>
    );
}

function CaseEmpty({ view }: { view: AiEvalWorkbenchView }) {
    return (
        <div className="ai-eval-case__empty">
            <ArrowRight size={22} aria-hidden="true" />
            <h2>{view === "queue" ? "Choose a case to inspect." : "Promote a source when it needs review."}</h2>
            <p>{view === "queue"
                ? "The candidate-visible output opens first; evidence and configuration remain one level deeper."
                : "Source rows contain operational metadata only. Candidate content is not read until the queued case is opened."}</p>
        </div>
    );
}

function CaseDetail({ detail }: { detail: AiEvalWorkItemDetail }) {
    return (
        <div className="ai-eval-case__content">
            <header className="ai-eval-case__header">
                <div>
                    <p className="type-eyebrow">{surfaceLabel(detail.surface)}</p>
                    <h2>{sourceLabel(detail.sourceKind)}</h2>
                </div>
                <StatusChip value={detail.sourceLifecycleState} />
            </header>
            <dl className="ai-eval-case__metadata">
                <Metadata label="Audience" value={audienceLabel(detail.audience)} />
                <Metadata label="Stage" value={humanize(detail.interviewStage) || "Not recorded"} />
                <Metadata label="Category" value={humanize(detail.questionCategory) || "Not applicable"} />
                <Metadata label="Captured" value={formatDate(detail.sourceOccurredAt)} />
            </dl>

            {detail.sourceFailureCode ? (
                <div className="ai-eval-source-failure" role="status">
                    <AlertTriangle size={19} aria-hidden="true" />
                    <div>
                        <strong>No candidate-visible output was produced.</strong>
                        <p>The source ended as {humanize(detail.sourceLifecycleState)}. Failure code: {detail.sourceFailureCode}.</p>
                    </div>
                </div>
            ) : detail.surface === "answer_coaching" ? (
                <AnswerCoachingDetail payload={detail.sourcePayload} />
            ) : detail.surface === "coach_update" ? (
                <CoachUpdateDetail payload={detail.sourcePayload} />
            ) : (
                <QuestionWordingDetail payload={detail.sourcePayload} />
            )}

            <details className="ai-eval-drilldown">
                <summary>Evidence and configuration</summary>
                <div>
                    <dl className="ai-eval-config-grid">
                        <Metadata label="Provider" value={detail.provider ?? "Not recorded"} />
                        <Metadata label="Model" value={detail.modelName ?? "Not recorded"} />
                        <Metadata label="Profile" value={detail.profileId ?? "Not recorded"} />
                        <Metadata label="Prompt" value={detail.promptVersion ?? "Not recorded"} />
                        <Metadata label="Evaluator" value={detail.evaluatorVersion ?? "Not applicable"} />
                        <Metadata label="Configuration" value={detail.configurationFingerprint ? shortFingerprint(detail.configurationFingerprint) : "Not recorded"} />
                    </dl>
                    <StructuredFacts value={drilldownPayload(detail)} depth={0} />
                </div>
            </details>
        </div>
    );
}

function AnswerCoachingDetail({ payload }: { payload: Record<string, unknown> }) {
    const question = record(payload.question);
    const answer = record(payload.answer);
    const evaluation = record(payload.evaluation);
    const result = record(evaluation.result);
    const accepted = record(result.accepted);
    const projection = record(accepted.candidateProjection);
    const questionText = readText(question.questionText, question.text, question.prompt);
    const answerText = readText(answer.text);
    const interaction = createAcceptedFeedbackInteraction(payload);

    return (
        <div className="ai-eval-visible-output">
            <section>
                <p className="type-eyebrow">Question</p>
                <h3>{questionText || "Question wording is unavailable."}</h3>
            </section>
            <section>
                <p className="type-eyebrow">Submitted answer</p>
                <blockquote>{answerText || "Submitted answer text is unavailable."}</blockquote>
            </section>
            <section className="ai-eval-coaching-output">
                <p className="type-eyebrow">What the candidate saw</p>
                {interaction ? (
                    <div className="ai-eval-coaching-lines">
                        {interaction.stages.map((stage) => (
                            <section className="ai-eval-feedback-stage" key={stage.id}>
                                <p className="type-eyebrow">{stage.label}</p>
                                <h4>{stage.title}</h4>
                                <p>{stage.body}</p>
                                {stage.guidance?.map((guidance) => (
                                    <div className="ai-eval-feedback-guidance" key={`${stage.id}-${guidance.label}`}>
                                        <strong>{guidance.label}</strong>
                                        <p>{guidance.body}</p>
                                        {guidance.steps?.length ? (
                                            <ol>{guidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                                        ) : null}
                                    </div>
                                ))}
                                <p className="ai-eval-feedback-actions">
                                    <strong>Actions shown</strong>
                                    <span>{stage.actions.map((action) => action.label).join(" | ")}</span>
                                </p>
                            </section>
                        ))}
                        {interaction.globalActions.length ? (
                            <p className="ai-eval-feedback-actions">
                                <strong>Always available</strong>
                                <span>{interaction.globalActions.map((action) => action.label).join(" | ")}</span>
                            </p>
                        ) : null}
                    </div>
                ) : Object.keys(projection).length ? (
                    <p>Candidate-visible coaching could not be reconstructed from this source.</p>
                ) : <p>Candidate-visible coaching is unavailable for this completed source.</p>}
            </section>
        </div>
    );
}

function CoachUpdateDetail({ payload }: { payload: Record<string, unknown> }) {
    const update = record(payload.coachUpdate);
    const questions = array(update.questions);
    return (
        <div className="ai-eval-visible-output">
            <section className="ai-eval-coaching-output">
                <p className="type-eyebrow">What the candidate saw</p>
                <h3>{readText(update.title) || "Coach Update"}</h3>
                <p>{readText(update.summary) || "Summary text is unavailable."}</p>
                {readText(update.primaryFocus) ? <p><strong>Practice next:</strong> {readText(update.primaryFocus)}</p> : null}
            </section>
            {questions.length ? (
                <section>
                    <p className="type-eyebrow">Practiced questions</p>
                    <ol className="ai-eval-question-list">
                        {questions.map((value, index) => {
                            const question = record(value);
                            const coaching = record(question.coaching);
                            const answer = record(question.answer);
                            const comparison = record(question.comparison);
                            const answerText = readText(answer.text);
                            const candidateAnswerAttemptId = readText(answer.candidateAnswerAttemptId);
                            const transcriptCanvas = candidateAnswerAttemptId && answerText
                                ? normalizeCandidateTranscriptCanvasProjection(question.transcriptCanvas, {
                                    candidateAnswerAttemptId,
                                    text: answerText,
                                })
                                : null;
                            return (
                                <li key={readText(question.questionKey) || String(index)}>
                                    <strong>{readText(question.questionText) || `Question ${index + 1}`}</strong>
                                    {answerText ? (
                                        <CandidateTranscriptCanvas
                                            answerText={answerText}
                                            projection={transcriptCanvas}
                                            isCurrent
                                        />
                                    ) : <p>Answer unavailable.</p>}
                                    <div className="ai-eval-coaching-lines">
                                        <CoachingLine label="Coach read" value={readText(coaching.acknowledgement)} />
                                        <CoachingLine label="Observation" value={readText(coaching.observation)} />
                                        <CoachingLine label="Practice next" value={readText(coaching.nextPracticeFocus)} />
                                        {comparison.kind === "repeat_practice" ? (
                                            <CoachingLine label="Practice history" value={readText(comparison.message)} />
                                        ) : null}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            ) : null}
        </div>
    );
}

function createAcceptedFeedbackInteraction(payload: Record<string, unknown>) {
    const question = record(payload.question);
    const answer = record(payload.answer);
    const evaluation = record(payload.evaluation);
    const result = record(evaluation.result);
    const accepted = record(result.accepted);
    const candidateFeedback = candidateSafeFeedbackProjectionSchema.safeParse(accepted.candidateProjection);
    const feedback = feedbackCompositionOutputSchema.safeParse(accepted.feedback);
    const slotId = readText(answer.slotId, question.slotId);
    const questionIndex = readNonNegativeInteger(answer.questionIndex, question.index);
    const analyzedAt = readText(result.completedAt, answer.submittedAt);

    if (!candidateFeedback.success || !feedback.success || !slotId || questionIndex === null || !analyzedAt) {
        return null;
    }

    const answerAttemptId = readText(answer.answerAttemptId);
    const attemptNumber = readPositiveInteger(answer.attemptNumber);
    const trigger = answer.trigger === "initial_submit" || answer.trigger === "feedback_retry"
        ? answer.trigger
        : null;
    const hasCompleteAttemptIdentity = Boolean(answerAttemptId && attemptNumber && trigger);
    const context = record(payload.context);
    const questionPlan = record(context.questionPlan);
    const questionCount = readPositiveInteger(questionPlan.questionCount)
        ?? array(questionPlan.slots).length;

    return createCandidateFeedbackInteraction({
        analysisSnapshot: createCandidateAnswerAnalysisProjectionFromAcceptedFeedback({
            analyzedAt,
            answer: {
                slotId,
                questionIndex,
                ...(hasCompleteAttemptIdentity ? {
                    answerAttemptId,
                    attemptNumber: attemptNumber!,
                    trigger: trigger!,
                } : {}),
            },
            candidateFeedback: candidateFeedback.data,
            intervention: feedback.data.feedbackPlan.intervention,
        }),
        isLastQuestion: questionCount > 0 && questionIndex === questionCount - 1,
    });
}

function QuestionWordingDetail({ payload }: { payload: Record<string, unknown> }) {
    const wording = record(payload.questionWording);
    const plan = record(payload.questionPlan);
    const questions = array(wording.questions);
    const slots = array(plan.slots);
    const context = record(payload.context);
    return (
        <div className="ai-eval-visible-output">
            <section>
                <p className="type-eyebrow">Generated set</p>
                {questions.length ? (
                    <ol className="ai-eval-question-list">
                        {questions.map((value, index) => {
                            const question = record(value);
                            const slot = record(slots[index]);
                            return (
                                <li key={readText(question.slotId) || String(index)}>
                                    <span>{humanize(readText(question.category, slot.category)) || `Question ${index + 1}`}</span>
                                    <strong>{readText(question.questionText, question.text) || "Question wording unavailable."}</strong>
                                    {readText(slot.purpose) ? <p>{readText(slot.purpose)}</p> : null}
                                </li>
                            );
                        })}
                    </ol>
                ) : <p>No question wording was produced.</p>}
            </section>
            <details className="ai-eval-context-details">
                <summary>Allowed generation context</summary>
                <dl>
                    <Metadata label="Target role" value={readText(context.targetRole) || "Not recorded"} />
                    <Metadata label="Job description" value={readText(context.jobDescription) || "Not recorded"} />
                    <Metadata label="Processed resume" value={resumePreview(context.resume)} />
                </dl>
            </details>
        </div>
    );
}

function ReviewPanel({ detail, review, findings, failureLabels, returnTarget }: {
    detail: AiEvalWorkItemDetail;
    review: AiEvalReview | null;
    findings: AiEvalFinding[];
    failureLabels: AiEvalFailureLabel[];
    returnTarget: string;
}) {
    if (!review) {
        return (
            <div className="ai-eval-review__start">
                <p className="type-eyebrow">Operator review</p>
                <h2>Record a quality judgment</h2>
                <p>Starting creates a private draft assigned to you. The source output remains unchanged.</p>
                <form action={startAiEvalReviewAction}>
                    <input type="hidden" name="workItemId" value={detail.workItemId} />
                    <input type="hidden" name="rubricVersion" value={`${detail.surface}_rubric_v1`} />
                    <input type="hidden" name="returnTarget" value={returnTarget} />
                    <button type="submit"><ClipboardCheck size={16} aria-hidden="true" />Start review</button>
                </form>
            </div>
        );
    }

    const submitted = review.lifecycleState === "submitted";
    return (
        <form className="ai-eval-review-form" action={mutateAiEvalReviewAction}>
            <input type="hidden" name="workItemId" value={detail.workItemId} />
            <input type="hidden" name="reviewId" value={review.reviewId} />
            <input type="hidden" name="revision" value={review.revision} />
            <input type="hidden" name="returnTarget" value={returnTarget} />
            <input type="hidden" name="findingRequestKey" value={randomUUID()} />

            <header>
                <div>
                    <p className="type-eyebrow">Operator review</p>
                    <h2>{submitted ? "Submitted review" : "Draft review"}</h2>
                </div>
                <StatusChip value={review.lifecycleState} />
            </header>

            <div className="ai-eval-review-form__row">
                <ReviewSelect name="disposition" label="Disposition" value={review.disposition ?? ""} disabled={submitted}>
                    <option value="">Choose</option>
                    <option value="acceptable">Acceptable</option>
                    <option value="acceptable_with_observation">Acceptable with observation</option>
                    <option value="needs_improvement">Needs improvement</option>
                    <option value="unsafe_or_blocking">Unsafe or blocking</option>
                    <option value="unable_to_assess">Unable to assess</option>
                </ReviewSelect>
                <ReviewSelect name="severity" label="Severity" value={review.severity ?? ""} disabled={submitted}>
                    <option value="">Choose</option>
                    <option value="informational">Informational</option>
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="blocking">Blocking</option>
                </ReviewSelect>
                <ReviewSelect name="confidence" label="Confidence" value={review.confidence ?? ""} disabled={submitted}>
                    <option value="">Choose</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </ReviewSelect>
            </div>

            <fieldset className="ai-eval-layer-judgments" disabled={submitted}>
                <legend>Layer judgments</legend>
                {reviewLayers(detail.surface).map((layer) => (
                    <ReviewSelect
                        key={layer}
                        name={`judgment:${layer}`}
                        label={humanize(layer)}
                        value={review.layerJudgments[layer] ?? ""}
                        disabled={submitted}
                    >
                        <option value="">Choose</option>
                        <option value="correct">Correct</option>
                        <option value="partly_correct">Partly correct</option>
                        <option value="incorrect">Incorrect</option>
                        <option value="not_applicable">Not applicable</option>
                        <option value="unable_to_assess">Unable to assess</option>
                    </ReviewSelect>
                ))}
            </fieldset>

            <label className="ai-eval-review-form__summary">
                Review summary
                <textarea
                    name="reviewSummary"
                    maxLength={4000}
                    rows={4}
                    defaultValue={review.reviewSummary ?? ""}
                    disabled={submitted}
                    placeholder="State the quality decision and why it matters."
                />
            </label>

            <section className="ai-eval-findings">
                <div>
                    <p className="type-eyebrow">Reusable findings</p>
                    <span>{findings.length}</span>
                </div>
                {findings.length ? (
                    <ol>
                        {findings.map((finding) => (
                            <li key={finding.findingId}>
                                <div>
                                    <strong>{humanize(finding.failureLabel)}</strong>
                                    <span>{humanize(finding.layer)} · {humanize(finding.severity)}</span>
                                    <p>{finding.rationale}</p>
                                </div>
                                {!submitted ? (
                                    <button type="submit" name="intent" value={`delete-finding:${finding.findingId}`} aria-label={`Delete ${humanize(finding.failureLabel)} finding`}>
                                        <Trash2 size={15} aria-hidden="true" />
                                    </button>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                ) : <p>No findings recorded.</p>}

                {!submitted ? (
                    <div className="ai-eval-finding-entry">
                        <ReviewSelect name="failureLabel" label="Failure label" value="" disabled={false}>
                            <option value="">Choose a reusable label</option>
                            {failureLabels.map((label) => (
                                <option key={`${label.version}:${label.layer}:${label.label}`} value={`${label.version}|${label.layer}|${label.label}`}>
                                    {humanize(label.layer)} · {humanize(label.label)}
                                </option>
                            ))}
                        </ReviewSelect>
                        <ReviewSelect name="findingSeverity" label="Finding severity" value="" disabled={false}>
                            <option value="">Choose</option>
                            <option value="informational">Informational</option>
                            <option value="minor">Minor</option>
                            <option value="major">Major</option>
                            <option value="blocking">Blocking</option>
                        </ReviewSelect>
                        <label>
                            Source pointer
                            <span className="ai-eval-inline-fields">
                                <select name="sourcePointerKind" defaultValue="">
                                    <option value="">None</option>
                                    <option value="spanId">Span ID</option>
                                    <option value="slotId">Slot ID</option>
                                    <option value="questionIndex">Question number</option>
                                    <option value="criterionId">Criterion ID</option>
                                    <option value="markerId">Marker ID</option>
                                    <option value="signalId">Signal ID</option>
                                    <option value="fieldPath">Field path</option>
                                </select>
                                <input name="sourcePointerValue" maxLength={200} aria-label="Source pointer value" />
                            </span>
                        </label>
                        <label>
                            Rationale
                            <textarea name="findingRationale" rows={3} maxLength={4000} placeholder="Describe the failure without copying source content." />
                        </label>
                        <button type="submit" name="intent" value="add-finding"><Plus size={15} aria-hidden="true" />Save draft and add finding</button>
                    </div>
                ) : null}
            </section>

            {!submitted ? (
                <footer>
                    <button type="submit" name="intent" value="save"><Save size={16} aria-hidden="true" />Save draft</button>
                    <button className="is-primary" type="submit" name="intent" value="submit"><Send size={16} aria-hidden="true" />Submit review</button>
                </footer>
            ) : null}
        </form>
    );
}

function ReviewSelect({ name, label, value, disabled, children }: {
    name: string;
    label: string;
    value: string;
    disabled: boolean;
    children: ReactNode;
}) {
    return (
        <label>
            {label}
            <select name={name} defaultValue={value} disabled={disabled}>{children}</select>
        </label>
    );
}

function CoachingLine({ label, value }: { label: string; value: string }) {
    if (!value) return null;
    return <p><strong>{label}</strong><span>{value}</span></p>;
}

function Metadata({ label, value }: { label: string; value: string }) {
    return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function StatusChip({ value }: { value: string }) {
    return <span className={`ai-eval-status is-${value.replace(/[^a-z0-9]+/g, "-")}`}>{humanize(value)}</span>;
}

function StructuredFacts({ value, depth }: { value: unknown; depth: number }) {
    if (depth > 3) return <span>Additional structured detail available.</span>;
    if (Array.isArray(value)) {
        if (!value.length) return <span>None</span>;
        return (
            <ol className="ai-eval-structured-list">
                {value.map((item, index) => <li key={index}><StructuredFacts value={item} depth={depth + 1} /></li>)}
            </ol>
        );
    }
    if (value && typeof value === "object") {
        return (
            <dl className="ai-eval-structured-facts">
                {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
                    <div key={key}>
                        <dt>{humanize(key)}</dt>
                        <dd><StructuredFacts value={item} depth={depth + 1} /></dd>
                    </div>
                ))}
            </dl>
        );
    }
    if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
    if (value === null || value === undefined || value === "") return <span>Not recorded</span>;
    return <span>{String(value)}</span>;
}

function drilldownPayload(detail: AiEvalWorkItemDetail) {
    const payload = detail.sourcePayload;
    if (detail.surface === "answer_coaching") {
        const evaluation = record(payload.evaluation);
        const result = record(evaluation.result);
        const accepted = record(result.accepted);
        return {
            extraction: accepted.extraction ?? null,
            criteria: accepted.criteria ?? [],
            patternGap: accepted.patternGap ?? null,
            verification: accepted.verification ?? null,
            feedbackPlan: record(accepted.feedback).feedbackPlan ?? null,
            validation: evaluation.validation ?? null,
            configuration: evaluation.configuration ?? null,
        };
    }
    if (detail.surface === "coach_update") {
        return {
            validation: payload.validation ?? null,
            acceptedEvaluationRunIds: payload.acceptedEvaluationRunIds ?? [],
            sourceContext: payload.context ?? null,
        };
    }
    return {
        questionPlan: payload.questionPlan ?? null,
        generation: record(record(payload.questionWording).generation),
    };
}

function reviewLayers(surface: AiEvalSurface): AiEvalFindingLayer[] {
    if (surface === "answer_coaching") return [
        "answer_usability", "evidence_span", "observable_marker", "category_signal",
        "criterion_appraisal", "technical_accuracy", "pattern_gap", "verification",
        "feedback_composition", "candidate_projection",
    ];
    if (surface === "coach_update") return ["coach_update", "feedback_composition", "candidate_projection", "safety"];
    return ["source_context", "question_wording", "question_set", "safety"];
}

function buildWorkbenchHref(filters: AiEvalWorkbenchFilters) {
    const params = new URLSearchParams({ view: filters.view });
    if (filters.surface) params.set("surface", filters.surface);
    if (filters.sourceKind) params.set("sourceKind", filters.sourceKind);
    if (filters.lifecycleState && filters.view === "queue") params.set("lifecycle", filters.lifecycleState);
    if (filters.sourceLifecycleState) params.set("sourceState", filters.sourceLifecycleState);
    if (filters.selectedWorkItemId && filters.view === "queue") params.set("case", filters.selectedWorkItemId);
    return `/qa/ai-eval?${params.toString()}`;
}

function surfaceLabel(value: AiEvalSurface) {
    return value === "answer_coaching" ? "Answer coaching" : value === "coach_update" ? "Coach Update" : "Question wording";
}

function sourceLabel(value: AiEvalSourceKind) {
    const labels: Record<AiEvalSourceKind, string> = {
        candidate_answer_evaluation: "Candidate answer evaluation",
        invited_answer_evaluation: "Invited answer evaluation",
        candidate_coach_update: "Candidate Coach Update",
        candidate_question_wording: "Candidate question set",
        recruiter_question_wording: "Recruiter question set",
    };
    return labels[value];
}

function audienceLabel(value: string) {
    return value === "candidate_led" ? "Candidate-led" : value === "invited" ? "Invited candidate" : "Recruiter invitation";
}

function humanize(value: string | null | undefined) {
    if (!value) return "";
    return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortId(value: string) {
    return `Case ${value.slice(0, 8)}`;
}

function shortFingerprint(value: string | null) {
    if (!value) return "No fingerprint";
    return `${value.slice(0, 12)}…${value.slice(-6)}`;
}

function formatDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date unavailable";
    return new Intl.DateTimeFormat("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
        timeZone: "UTC", timeZoneName: "short",
    }).format(date);
}

function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function readText(...values: unknown[]) {
    for (const value of values) if (typeof value === "string" && value.trim()) return value.trim();
    return "";
}

function readNonNegativeInteger(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
    }
    return null;
}

function readPositiveInteger(...values: unknown[]) {
    for (const value of values) {
        if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
    }
    return null;
}

function resumePreview(value: unknown) {
    const resume = record(value);
    return readText(resume.processedText, resume.text, resume.label) || (Object.keys(resume).length ? "Processed resume context available" : "Not included");
}

function noticeText(value: string | undefined) {
    const notices: Record<string, string> = {
        promoted: "Source added to the review queue.",
        review_started: "Draft review started.",
        saved: "Draft review saved.",
        finding_added: "Draft saved and finding added.",
        finding_deleted: "Finding removed from the draft.",
        submitted: "Review submitted. It is now immutable.",
        remediation_created: "Remediation created from the selected findings.",
        findings_linked: "Findings linked to this remediation.",
        remediation_updated: "Remediation workflow updated.",
        regression_promoted: "Finding promoted to regression coverage.",
        recheck_recorded: "Sequential recheck recorded.",
        conflict: "This work changed in another request. Reloaded values are shown; review before trying again.",
        invalid: "The requested change was not valid. Review the required fields and try again.",
        unavailable: "The workbench could not save that change. No review changes were made; try again after database access is restored.",
    };
    return value ? notices[value] : undefined;
}
