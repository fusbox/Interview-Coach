import { redirect } from "next/navigation";

import { AiEvalAccessDenied } from "@/features/ai-eval-v2/AiEvalAccessDenied";
import {
    AiEvalScenarioWorkspaceExperience,
    type AiEvalScenarioWorkspaceData,
    type AiEvalScenarioWorkspaceFilters,
    type AiEvalLiveSelectionPreview,
} from "@/features/ai-eval-v2/AiEvalScenarioWorkspaceExperience";
import { AiEvalShell } from "@/features/ai-eval-v2/AiEvalShell";
import {
    AiEvalWorkbenchExperience,
    type AiEvalWorkbenchFilters,
} from "@/features/ai-eval-v2/AiEvalWorkbenchExperience";
import {
    AI_EVAL_SOURCE_KINDS,
    AI_EVAL_SURFACES,
    type AiEvalEligibleSource,
    type AiEvalFailureLabel,
    type AiEvalFinding,
    type AiEvalRecheck,
    type AiEvalRecheckCandidate,
    type AiEvalRegressionCase,
    type AiEvalRemediation,
    type AiEvalRemediationFinding,
    type AiEvalReview,
    type AiEvalSourceKind,
    type AiEvalSurface,
    type AiEvalWorkItem,
    type AiEvalWorkItemDetail,
    type AiEvalWorkItemLifecycle,
} from "@/features/ai-eval-v2/ai-eval-workbench-contract";
import { createAiEvalOperatorAccessRepository, getCurrentAiEvalOperatorAccess } from "@/features/ai-eval-v2/ai-eval-operator-access";
import type { AiEvalOperatorAccess } from "@/features/ai-eval-v2/ai-eval-operator-access";
import { createAiEvalRemediationRepository } from "@/features/ai-eval-v2/ai-eval-remediation-repository";
import { createAiEvalReviewRepository } from "@/features/ai-eval-v2/ai-eval-review-repository";
import {
    createAiEvalScenarioRepository,
    type AiEvalScenarioVersion,
} from "@/features/ai-eval-v2/ai-eval-scenario-repository";
import {
    createAiEvalLiveCostPreview,
    readAiEvalLiveExecutionPolicy,
    resolveAiEvalScenarioSelection,
    type AiEvalLiveExecutionPolicy,
} from "@/features/ai-eval-v2/ai-eval-live-run-contract";
import { compareAiEvalScenarioRuns } from "@/features/ai-eval-v2/ai-eval-scenario-run-comparison";
import { createAiEvalWorkbenchRepository } from "@/features/ai-eval-v2/ai-eval-workbench-repository";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";

type SearchParams = Record<string, string | string[] | undefined>;

type WorkbenchData = {
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
};

export async function renderAiEvalWorkbenchRoute(
    searchParams: SearchParams,
    dependencies: {
        resolveAccess?: () => Promise<AiEvalOperatorAccess>;
        loadData?: (operatorUserId: string, filters: AiEvalWorkbenchFilters) => Promise<WorkbenchData>;
        loadScenarioData?: (operatorUserId: string, filters: AiEvalScenarioWorkspaceFilters) => Promise<AiEvalScenarioWorkspaceData>;
    } = {},
) {
    const resolveAccess = dependencies.resolveAccess ?? resolveOperatorAccess;
    const access = await resolveAccess();
    if (access.kind === "missing") redirect("/login?next=%2Fqa%2Fai-eval");
    if (access.kind === "forbidden") return <AiEvalAccessDenied />;

    const scenarioFilters = parseScenarioFilters(searchParams);
    if (scenarioFilters) {
        let scenarioData = emptyScenarioData();
        let unavailable = false;
        try {
            scenarioData = await (dependencies.loadScenarioData ?? loadScenarioWorkspaceData)(access.user.id, scenarioFilters);
        } catch {
            unavailable = true;
        }
        return (
            <AiEvalShell user={access.user}>
                <AiEvalScenarioWorkspaceExperience
                    {...scenarioData}
                    filters={scenarioFilters}
                    unavailable={unavailable}
                />
            </AiEvalShell>
        );
    }

    const filters = parseFilters(searchParams);
    let data = emptyData();
    let unavailable = false;
    try {
        data = await (dependencies.loadData ?? loadWorkbenchData)(access.user.id, filters);
    } catch {
        unavailable = true;
    }

    return (
        <AiEvalShell user={access.user}>
            <AiEvalWorkbenchExperience {...data} filters={filters} unavailable={unavailable} />
        </AiEvalShell>
    );
}

async function loadScenarioWorkspaceData(
    operatorUserId: string,
    filters: AiEvalScenarioWorkspaceFilters,
): Promise<AiEvalScenarioWorkspaceData> {
    const client = createRecruiterAuthQueryClientFromEnv();
    const repository = createAiEvalScenarioRepository(client);
    await repository.synchronizeBaseline(operatorUserId);
    const versions = await repository.listScenarioVersions(operatorUserId);
    const [drafts, runs, selectedRun] = await Promise.all([
        repository.listDrafts(operatorUserId),
        repository.listRuns(operatorUserId),
        filters.selectedRunId
            ? repository.findRunDetail(operatorUserId, filters.selectedRunId)
            : Promise.resolve(null),
    ]);
    const livePolicy = readAiEvalLiveExecutionPolicy(process.env);
    const livePreview = createLiveSelectionPreview(versions, filters, livePolicy);
    const priorRun = filters.compareRunId
        ? await repository.findRunDetail(operatorUserId, filters.compareRunId)
        : null;
    const comparison = selectedRun && priorRun ? compareAiEvalScenarioRuns(selectedRun, priorRun) : null;
    return { versions, drafts, runs, selectedRun, livePolicy, livePreview, comparison };
}

async function resolveOperatorAccess() {
    const client = createRecruiterAuthQueryClientFromEnv();
    const repository = createAiEvalOperatorAccessRepository(client);
    return getCurrentAiEvalOperatorAccess({ resolveGrant: repository.findActiveGrant });
}

function createLiveSelectionPreview(
    versions: AiEvalScenarioVersion[],
    filters: AiEvalScenarioWorkspaceFilters,
    policy: AiEvalLiveExecutionPolicy,
): AiEvalLiveSelectionPreview | null {
    if (!filters.liveScope || !policy.ready) return null;
    const latest = latestScenarioVersions(versions);
    const requested = filters.liveScope === "selected"
        ? (filters.liveScenarioVersionIds ?? []).map((id) => versions.find((version) => version.scenarioVersionId === id))
            .filter((version): version is AiEvalScenarioVersion => Boolean(version))
        : filters.liveScope === "tag"
            ? latest.filter((version) => filters.liveTag && version.scenario.tags.includes(filters.liveTag))
            : latest;
    if (!requested.length || (filters.liveScope === "selected" && requested.length !== filters.liveScenarioVersionIds?.length)) {
        return null;
    }
    const resolved = resolveAiEvalScenarioSelection({ requested, available: versions });
    if (resolved.missingDependencies.length) return null;
    const preview = createAiEvalLiveCostPreview({
        requestedCaseCount: requested.length,
        versions: resolved.versions,
        dependencyCaseCount: resolved.dependencyCaseCount,
        policy,
    });
    const requestedIds = new Set(requested.map((version) => version.scenarioVersionId));
    return {
        scope: filters.liveScope,
        tag: filters.liveTag ?? null,
        requestedVersionIds: requested.map((version) => version.scenarioVersionId),
        requestedTitles: requested.map((version) => version.scenario.title),
        expandedVersionIds: resolved.versions.map((version) => version.scenarioVersionId),
        dependencyTitles: resolved.versions
            .filter((version) => !requestedIds.has(version.scenarioVersionId))
            .map((version) => version.scenario.title),
        preview,
    };
}

function latestScenarioVersions(versions: AiEvalScenarioVersion[]) {
    const latest = new Map<string, AiEvalScenarioVersion>();
    for (const version of versions) {
        const current = latest.get(version.scenario.scenarioKey);
        if (!current || version.versionNumber > current.versionNumber) latest.set(version.scenario.scenarioKey, version);
    }
    return Array.from(latest.values());
}

async function loadWorkbenchData(operatorUserId: string, filters: AiEvalWorkbenchFilters): Promise<WorkbenchData> {
    const client = createRecruiterAuthQueryClientFromEnv();
    const workbench = createAiEvalWorkbenchRepository(client);
    const reviews = createAiEvalReviewRepository(client);
    const remediationRepository = createAiEvalRemediationRepository(client);
    const workItems = filters.view === "queue" ? await workbench.listWorkItems(operatorUserId, {
        surface: filters.surface,
        sourceKind: filters.sourceKind,
        lifecycleState: filters.lifecycleState as AiEvalWorkItemLifecycle | undefined,
        sourceLifecycleState: filters.sourceLifecycleState,
    }) : [];
    const eligibleSources = filters.view === "inbox" ? await workbench.listEligibleSources(operatorUserId, {
        surface: filters.surface,
        sourceKind: filters.sourceKind,
        sourceLifecycleState: filters.sourceLifecycleState,
    }) : [];
    const selectedDetail = filters.selectedWorkItemId
        ? await workbench.findWorkItemDetail(operatorUserId, filters.selectedWorkItemId)
        : null;
    const review = selectedDetail
        ? await reviews.findLatestReview(operatorUserId, selectedDetail.workItemId)
        : null;
    const findings = review ? await reviews.listFindings(operatorUserId, review.reviewId) : [];
    const failureLabels = review?.lifecycleState === "draft" ? await reviews.listFailureLabels(operatorUserId) : [];
    const remediations = filters.view === "remediation"
        ? await remediationRepository.listRemediations(operatorUserId)
        : [];
    const selectedRemediation = filters.view === "remediation" && filters.selectedRemediationId
        ? await remediationRepository.findRemediation(operatorUserId, filters.selectedRemediationId)
        : null;
    const [availableRemediationFindings, linkedRemediationFindings, regressionCases, recheckCandidates, rechecks]
        = filters.view === "remediation"
            ? await Promise.all([
                remediationRepository.listAvailableFindings(operatorUserId),
                selectedRemediation
                    ? remediationRepository.listLinkedFindings(operatorUserId, selectedRemediation.remediationId)
                    : Promise.resolve([]),
                selectedRemediation
                    ? remediationRepository.listRegressionCases(operatorUserId, selectedRemediation.remediationId)
                    : Promise.resolve([]),
                selectedRemediation
                    ? remediationRepository.listRecheckCandidates(operatorUserId, selectedRemediation.remediationId)
                    : Promise.resolve([]),
                selectedRemediation
                    ? remediationRepository.listRechecks(operatorUserId, selectedRemediation.remediationId)
                    : Promise.resolve([]),
            ])
            : [[], [], [], [], []];
    return {
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
    };
}

function parseFilters(params: SearchParams): AiEvalWorkbenchFilters {
    const viewValue = one(params.view);
    const view = viewValue === "inbox" || viewValue === "remediation" ? viewValue : "queue";
    const surfaceValue = one(params.surface);
    const sourceKindValue = one(params.sourceKind);
    const lifecycleValue = one(params.lifecycle);
    const sourceStateValue = boundedFilter(one(params.sourceState));
    const selected = one(params.case);
    const selectedRemediation = one(params.remediation);
    const notice = boundedFilter(one(params.notice));
    return {
        view,
        surface: AI_EVAL_SURFACES.includes(surfaceValue as AiEvalSurface) ? surfaceValue as AiEvalSurface : undefined,
        sourceKind: AI_EVAL_SOURCE_KINDS.includes(sourceKindValue as AiEvalSourceKind) ? sourceKindValue as AiEvalSourceKind : undefined,
        lifecycleState: view === "queue" && [
            "queued",
            "in_review",
            "reviewed",
            "remediation_in_progress",
            "verified",
            "closed",
        ].includes(lifecycleValue) ? lifecycleValue : undefined,
        sourceLifecycleState: sourceStateValue,
        selectedWorkItemId: view === "queue" && isUuid(selected) ? selected : undefined,
        selectedRemediationId: view === "remediation" && isUuid(selectedRemediation) ? selectedRemediation : undefined,
        notice,
    };
}

function parseScenarioFilters(params: SearchParams): AiEvalScenarioWorkspaceFilters | null {
    const view = one(params.view);
    if (view !== "scenarios" && view !== "runs") return null;
    const selectedDraft = one(params.draft);
    const selectedRun = one(params.run);
    const compareRun = one(params.compare);
    const liveScopeValue = one(params.liveScope);
    const liveScope = ["selected", "tag", "full_corpus"].includes(liveScopeValue)
        ? liveScopeValue as "selected" | "tag" | "full_corpus"
        : undefined;
    const liveScenarioVersionIds = many(params.scenarioVersionId).filter(isUuid).slice(0, 64);
    const liveTag = stableKey(one(params.liveTag));
    return {
        view,
        selectedDraftId: view === "scenarios" && isUuid(selectedDraft) ? selectedDraft : undefined,
        selectedRunId: view === "runs" && isUuid(selectedRun) ? selectedRun : undefined,
        compareRunId: view === "runs" && isUuid(compareRun) ? compareRun : undefined,
        liveScope: view === "scenarios" ? liveScope : undefined,
        liveScenarioVersionIds: view === "scenarios" ? liveScenarioVersionIds : undefined,
        liveTag: view === "scenarios" ? liveTag : undefined,
        notice: boundedFilter(one(params.notice)),
    };
}

function emptyData(): WorkbenchData {
    return {
        workItems: [],
        eligibleSources: [],
        selectedDetail: null,
        review: null,
        findings: [],
        failureLabels: [],
        remediations: [],
        selectedRemediation: null,
        availableRemediationFindings: [],
        linkedRemediationFindings: [],
        regressionCases: [],
        recheckCandidates: [],
        rechecks: [],
    };
}

function emptyScenarioData(): AiEvalScenarioWorkspaceData {
    return { versions: [], drafts: [], runs: [], selectedRun: null, livePreview: null, comparison: null };
}

function one(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function many(value: string | string[] | undefined) {
    return Array.isArray(value) ? value : value ? [value] : [];
}

function stableKey(value: string) {
    return /^[a-z][a-z0-9_]{2,79}$/.test(value) ? value : undefined;
}

function boundedFilter(value: string) {
    return /^[a-z_]{1,80}$/.test(value) ? value : undefined;
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
