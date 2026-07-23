"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import {
    AI_EVAL_CHANGE_KINDS,
    AI_EVAL_RECHECK_OUTCOMES,
    AI_EVAL_REMEDIATION_LIFECYCLES,
    AI_EVAL_REMEDIATION_TARGETS,
    AI_EVAL_SOURCE_KINDS,
    type AiEvalChangeKind,
    type AiEvalFindingLayer,
    type AiEvalLayerJudgment,
    type AiEvalReviewDisposition,
    type AiEvalSeverity,
    type AiEvalConfidence,
    type AiEvalSelectionReason,
    type AiEvalRecheckOutcome,
    type AiEvalRemediationLifecycle,
    type AiEvalRemediationTarget,
} from "@/features/ai-eval-v2/ai-eval-workbench-contract";
import { createAiEvalOperatorAccessRepository, getCurrentAiEvalOperatorAccess } from "@/features/ai-eval-v2/ai-eval-operator-access";
import { createAiEvalRemediationRepository } from "@/features/ai-eval-v2/ai-eval-remediation-repository";
import { createAiEvalReviewRepository } from "@/features/ai-eval-v2/ai-eval-review-repository";
import {
    createAiEvalScenarioFingerprint,
    parseAiEvalScenario,
} from "@/features/ai-eval-v2/ai-eval-scenario-contract";
import { aiEvalScenarioBaselineManifest } from "@/features/ai-eval-v2/ai-eval-scenario-baseline";
import {
    cloneAiEvalScenario,
    createBlankAiEvalScenario,
} from "@/features/ai-eval-v2/ai-eval-scenario-draft-factory";
import { createAiEvalScenarioRepository } from "@/features/ai-eval-v2/ai-eval-scenario-repository";
import { runAiEvalScenarioFixtureJobById } from "@/features/ai-eval-v2/ai-eval-scenario-worker";
import {
    createAiEvalLiveCostPreview,
    readAiEvalLiveExecutionPolicy,
    resolveAiEvalScenarioSelection,
} from "@/features/ai-eval-v2/ai-eval-live-run-contract";
import { createAiEvalWorkbenchRepository } from "@/features/ai-eval-v2/ai-eval-workbench-repository";
import { candidateAnswerAnalysisFixtureRunMetadata } from "@/features/candidate-session-v2/candidate-answer-analysis-fixture";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";

const DISPOSITIONS = new Set<AiEvalReviewDisposition>([
    "acceptable", "acceptable_with_observation", "needs_improvement", "unsafe_or_blocking", "unable_to_assess",
]);
const SEVERITIES = new Set<AiEvalSeverity>(["informational", "minor", "major", "blocking"]);
const CONFIDENCES = new Set<AiEvalConfidence>(["low", "medium", "high"]);
const JUDGMENTS = new Set<AiEvalLayerJudgment>(["correct", "partly_correct", "incorrect", "not_applicable", "unable_to_assess"]);
const SELECTION_REASONS = new Set<AiEvalSelectionReason>(["production_sample", "provider_failure", "manual", "golden", "incident"]);
const POINTER_KINDS = new Set(["spanId", "slotId", "questionIndex", "criterionId", "markerId", "signalId", "fieldPath"]);
const REMEDIATION_TARGETS = new Set<AiEvalRemediationTarget>(AI_EVAL_REMEDIATION_TARGETS);
const REMEDIATION_LIFECYCLES = new Set<AiEvalRemediationLifecycle>(AI_EVAL_REMEDIATION_LIFECYCLES);
const CHANGE_KINDS = new Set<AiEvalChangeKind>(AI_EVAL_CHANGE_KINDS);
const RECHECK_OUTCOMES = new Set<AiEvalRecheckOutcome>(AI_EVAL_RECHECK_OUTCOMES);

export async function createAiEvalScenarioDraftAction(formData: FormData) {
    const returnTarget = "/qa/ai-eval?view=scenarios";
    const context = await loadActionContext(returnTarget);
    const creationRequestKey = text(formData, "creationRequestKey");
    const sourceVersionId = text(formData, "sourceVersionId");
    if (!isUuid(creationRequestKey) || (sourceVersionId && !isUuid(sourceVersionId))) {
        redirect(withNotice(returnTarget, "invalid"));
    }

    const result = await safelyMutate(async () => {
        await context.scenarios.synchronizeBaseline(context.operatorUserId);
        const versions = await context.scenarios.listScenarioVersions(context.operatorUserId);
        const source = sourceVersionId
            ? versions.find((version) => version.scenarioVersionId === sourceVersionId)
            : null;
        if (sourceVersionId && !source) return null;
        const suffix = creationRequestKey.replaceAll("-", "");
        const scenario = source
            ? cloneAiEvalScenario(source.scenario, suffix)
            : createBlankAiEvalScenario(suffix);
        return context.scenarios.createDraft({
            operatorUserId: context.operatorUserId,
            creationRequestKey,
            scenario,
        });
    }, returnTarget);
    if (!result?.draft || result.outcome === "idempotency_conflict") {
        redirect(withNotice(returnTarget, result?.outcome === "idempotency_conflict" ? "conflict" : "invalid"));
    }
    redirect(withNotice(`${returnTarget}&draft=${encodeURIComponent(result.draft.draftId)}`, "draft_created"));
}

export async function mutateAiEvalScenarioDraftAction(formData: FormData) {
    const baseTarget = "/qa/ai-eval?view=scenarios";
    const draftId = text(formData, "draftId");
    const revision = positiveInteger(text(formData, "revision"));
    const intent = text(formData, "intent");
    const scenarioJson = rawText(formData, "scenarioJson");
    const returnTarget = isUuid(draftId) ? `${baseTarget}&draft=${encodeURIComponent(draftId)}` : baseTarget;
    if (!isUuid(draftId) || revision === null || !["save", "stage"].includes(intent) || scenarioJson.length > 64_000) {
        redirect(withNotice(returnTarget, "invalid"));
    }

    let scenario;
    try {
        scenario = parseAiEvalScenario(JSON.parse(scenarioJson));
    } catch {
        redirect(withNotice(returnTarget, "invalid"));
    }
    const context = await loadActionContext(returnTarget);
    const result = await safelyMutate(async () => {
        const current = await context.scenarios.findDraft(context.operatorUserId, draftId);
        if (!current || current.revision !== revision) return null;
        const currentFingerprint = createAiEvalScenarioFingerprint(current.scenario);
        const nextFingerprint = createAiEvalScenarioFingerprint(scenario);
        const updated = currentFingerprint === nextFingerprint
            ? current
            : await context.scenarios.updateDraft({
                operatorUserId: context.operatorUserId,
                draftId,
                expectedRevision: revision,
                scenario,
            });
        if (!updated) return null;
        if (intent === "stage") {
            const staged = await context.scenarios.stageDraft({
                operatorUserId: context.operatorUserId,
                draftId,
                expectedRevision: updated.revision,
                inputFingerprint: createAiEvalScenarioFingerprint(updated.scenario),
            });
            return staged ? { updated, staged } : null;
        }
        return { updated, staged: null };
    }, returnTarget);
    if (!result) redirect(withNotice(returnTarget, "conflict"));
    redirect(withNotice(returnTarget, result.staged ? "staged" : "draft_saved"));
}

export async function runAiEvalScenariosAction(formData: FormData) {
    const returnTarget = "/qa/ai-eval?view=scenarios";
    const context = await loadActionContext(returnTarget);
    const creationRequestKey = text(formData, "creationRequestKey");
    const runScope = text(formData, "runScope");
    const selectedIds = uniqueUuids(formData.getAll("scenarioVersionId"));
    if (!isUuid(creationRequestKey) || !["selected", "full_baseline"].includes(runScope)
        || (runScope === "selected" && (selectedIds.length === 0 || selectedIds.length > 64))) {
        redirect(withNotice(returnTarget, "invalid"));
    }

    const submittedRun = await safelyMutate(async () => {
        const baseline = await context.scenarios.synchronizeBaseline(context.operatorUserId);
        const versions = await context.scenarios.listScenarioVersions(context.operatorUserId);
        const selected = runScope === "full_baseline"
            ? aiEvalScenarioBaselineManifest.members.map((member) => versions.find((version) => (
                version.sourceKind === "baseline" && version.scenario.scenarioKey === member.scenarioKey
            ))).filter((version): version is NonNullable<typeof version> => Boolean(version))
            : selectedIds.map((id) => versions.find((version) => version.scenarioVersionId === id))
                .filter((version): version is NonNullable<typeof version> => Boolean(version));
        if (selected.length !== (runScope === "full_baseline" ? aiEvalScenarioBaselineManifest.members.length : selectedIds.length)) {
            return null;
        }
        const submitted = await context.scenarios.submitRun({
            operatorUserId: context.operatorUserId,
            creationRequestKey,
            suiteVersionId: runScope === "full_baseline" ? baseline.suiteId : null,
            scenarioVersions: selected,
            profileId: "deterministic_local_fixture_v1",
            configurationFingerprint: candidateAnswerAnalysisFixtureRunMetadata.configurationFingerprint,
        });
        if (!submitted.runId || submitted.outcome === "idempotency_conflict") return null;
        return { runId: submitted.runId };
    }, returnTarget);
    if (!submittedRun) redirect(withNotice(returnTarget, "conflict"));

    let lifecycleState = "queued";
    try {
        await runAiEvalScenarioFixtureJobById({
            repository: context.scenarios,
            runId: submittedRun.runId,
            workerId: `scenario-action:${context.operatorUserId}:${randomUUID()}`,
        });
        const detail = await context.scenarios.findRunDetail(context.operatorUserId, submittedRun.runId);
        lifecycleState = detail?.lifecycleState ?? "queued";
    } catch {
        lifecycleState = "queued";
    }
    const target = `/qa/ai-eval?view=runs&run=${encodeURIComponent(submittedRun.runId)}`;
    const notice = lifecycleState === "completed"
        ? "run_completed"
        : lifecycleState === "partial" || lifecycleState === "failed" ? "run_incomplete" : "run_queued";
    redirect(withNotice(target, notice));
}

export async function runAiEvalLiveScenariosAction(formData: FormData) {
    const returnTarget = "/qa/ai-eval?view=scenarios";
    const context = await loadActionContext(returnTarget);
    const creationRequestKey = text(formData, "creationRequestKey");
    const expectedSelectionFingerprint = text(formData, "selectionFingerprint");
    const acknowledgement = text(formData, "liveAcknowledgement");
    const requestedIds = uniqueUuids(formData.getAll("requestedScenarioVersionId"));
    if (!isUuid(creationRequestKey)
        || !/^[a-f0-9]{64}$/.test(expectedSelectionFingerprint)
        || acknowledgement !== "confirmed"
        || requestedIds.length === 0
        || requestedIds.length > 64) {
        redirect(withNotice(returnTarget, "invalid"));
    }

    const submittedRun = await safelyMutate(async () => {
        await context.scenarios.synchronizeBaseline(context.operatorUserId);
        const versions = await context.scenarios.listScenarioVersions(context.operatorUserId);
        const requested = requestedIds.map((id) => versions.find((version) => version.scenarioVersionId === id))
            .filter((version): version is NonNullable<typeof version> => Boolean(version));
        if (requested.length !== requestedIds.length) return null;
        const resolved = resolveAiEvalScenarioSelection({ requested, available: versions });
        if (resolved.missingDependencies.length) return null;
        const policy = readAiEvalLiveExecutionPolicy(process.env);
        if (!policy.ready) return null;
        const costPreview = createAiEvalLiveCostPreview({
            requestedCaseCount: requested.length,
            versions: resolved.versions,
            dependencyCaseCount: resolved.dependencyCaseCount,
            policy,
        });
        if (!costPreview.withinLimits || costPreview.selectionFingerprint !== expectedSelectionFingerprint) return null;
        const submitted = await context.scenarios.submitLiveRun({
            operatorUserId: context.operatorUserId,
            creationRequestKey,
            suiteVersionId: null,
            scenarioVersions: resolved.versions,
            profileId: policy.profileId,
            configurationFingerprint: policy.configurationFingerprint,
            costPreview,
        });
        return submitted.outcome === "idempotency_conflict" || !submitted.runId ? null : submitted;
    }, returnTarget);
    if (!submittedRun) redirect(withNotice(returnTarget, "conflict"));
    redirect(withNotice(`/qa/ai-eval?view=runs&run=${encodeURIComponent(submittedRun.runId)}`, "live_run_queued"));
}

export async function promoteAiEvalSourceAction(formData: FormData) {
    const fallback = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(fallback);
    const sourceKind = text(formData, "sourceKind");
    const sourceId = text(formData, "sourceId");
    const selectionReason = text(formData, "selectionReason") as AiEvalSelectionReason;
    if (!AI_EVAL_SOURCE_KINDS.includes(sourceKind as never) || !isUuid(sourceId) || !SELECTION_REASONS.has(selectionReason)) {
        redirect(withNotice(fallback, "invalid"));
    }
    const item = await safelyMutate(() => context.workbench.createWorkItem({
        operatorUserId: context.operatorUserId,
        sourceKind: sourceKind as typeof AI_EVAL_SOURCE_KINDS[number],
        sourceId,
        selectionReason,
    }), fallback);
    if (!item) redirect(withNotice(fallback, "invalid"));
    redirect(withNotice(`/qa/ai-eval?view=queue&case=${encodeURIComponent(item.workItemId)}`, "promoted"));
}

export async function startAiEvalReviewAction(formData: FormData) {
    const workItemId = text(formData, "workItemId");
    const rubricVersion = text(formData, "rubricVersion");
    const returnTarget = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(returnTarget);
    if (!isUuid(workItemId) || !/^[a-z0-9_]{3,120}$/.test(rubricVersion)) {
        redirect(withNotice(returnTarget, "invalid"));
    }
    const review = await safelyMutate(() => context.reviews.createDraftReview({
        operatorUserId: context.operatorUserId,
        workItemId,
        rubricVersion,
    }), returnTarget);
    redirect(withNotice(returnTarget, review ? "review_started" : "conflict"));
}

export async function mutateAiEvalReviewAction(formData: FormData) {
    const returnTarget = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(returnTarget);
    const reviewId = text(formData, "reviewId");
    const revision = positiveInteger(text(formData, "revision"));
    const intent = text(formData, "intent");
    if (!isUuid(reviewId) || revision === null) redirect(withNotice(returnTarget, "invalid"));

    if (intent.startsWith("delete-finding:")) {
        const findingId = intent.slice("delete-finding:".length);
        const deleted = isUuid(findingId) && await safelyMutate(
            () => context.reviews.deleteDraftFinding({
                operatorUserId: context.operatorUserId,
                findingId,
            }),
            returnTarget,
        );
        redirect(withNotice(returnTarget, deleted ? "finding_deleted" : "conflict"));
    }

    const values = readReviewValues(formData);
    if (!values) redirect(withNotice(returnTarget, "invalid"));

    if (intent === "submit") {
        const { disposition, severity, confidence } = values;
        if (!disposition || !severity || !confidence || !Object.keys(values.layerJudgments).length) {
            redirect(withNotice(returnTarget, "invalid"));
        }
        const submitted = await safelyMutate(() => context.reviews.submitReview({
            operatorUserId: context.operatorUserId,
            reviewId,
            revision,
            disposition,
            severity,
            confidence,
            layerJudgments: values.layerJudgments,
            reviewSummary: values.reviewSummary,
        }), returnTarget);
        redirect(withNotice(returnTarget, submitted ? "submitted" : "conflict"));
    }

    if (intent === "add-finding") {
        const finding = readFindingValues(formData);
        const requestKey = text(formData, "findingRequestKey");
        if (!finding || !isUuid(requestKey)) redirect(withNotice(returnTarget, "invalid"));
        const result = await safelyMutate(() => context.reviews.saveDraftReviewWithFinding({
            operatorUserId: context.operatorUserId,
            reviewId,
            revision,
            ...values,
            creationRequestKey: requestKey,
            layer: finding.layer,
            failureLabel: finding.failureLabel,
            failureLabelVersion: finding.failureLabelVersion,
            findingSeverity: finding.severity,
            sourceReference: finding.sourceReference,
            rationale: finding.rationale,
        }), returnTarget);
        redirect(withNotice(returnTarget, result ? "finding_added" : "conflict"));
    }

    const saved = await safelyMutate(() => context.reviews.saveDraftReview({
        operatorUserId: context.operatorUserId,
        reviewId,
        revision,
        ...values,
    }), returnTarget);
    if (!saved) redirect(withNotice(returnTarget, "conflict"));

    redirect(withNotice(returnTarget, "saved"));
}

export async function createAiEvalRemediationAction(formData: FormData) {
    const returnTarget = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(returnTarget);
    const creationRequestKey = text(formData, "creationRequestKey");
    const targetComponent = text(formData, "targetComponent") as AiEvalRemediationTarget;
    const title = boundedRequiredText(text(formData, "title"), 180);
    const hypothesis = boundedRequiredText(text(formData, "hypothesis"), 4000);
    const expectedChange = boundedRequiredText(text(formData, "expectedChange"), 4000);
    const regressionRisks = boundedRequiredText(text(formData, "regressionRisks"), 4000);
    const findingIds = uniqueUuids(formData.getAll("findingId"));
    if (!isUuid(creationRequestKey) || !REMEDIATION_TARGETS.has(targetComponent)
        || !title || !hypothesis || !expectedChange || !regressionRisks
        || findingIds.length === 0 || findingIds.length > 50) {
        redirect(withNotice(returnTarget, "invalid"));
    }
    const remediationId = await safelyMutate(() => context.remediations.createRemediationWithFindings({
        operatorUserId: context.operatorUserId,
        creationRequestKey,
        targetComponent,
        title,
        hypothesis,
        expectedChange,
        regressionRisks,
        findingIds,
    }), returnTarget);
    if (!remediationId) redirect(withNotice(returnTarget, "conflict"));
    redirect(withNotice(`/qa/ai-eval?view=remediation&remediation=${encodeURIComponent(remediationId)}`, "remediation_created"));
}

export async function linkAiEvalRemediationFindingsAction(formData: FormData) {
    const returnTarget = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(returnTarget);
    const remediationId = text(formData, "remediationId");
    const findingIds = uniqueUuids(formData.getAll("findingId"));
    if (!isUuid(remediationId) || findingIds.length === 0 || findingIds.length > 50) {
        redirect(withNotice(returnTarget, "invalid"));
    }
    const linked = await safelyMutate(() => context.remediations.linkFindings({
        operatorUserId: context.operatorUserId,
        remediationId,
        findingIds,
    }), returnTarget);
    redirect(withNotice(returnTarget, linked ? "findings_linked" : "conflict"));
}

export async function updateAiEvalRemediationAction(formData: FormData) {
    const returnTarget = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(returnTarget);
    const remediationId = text(formData, "remediationId");
    const revision = positiveInteger(text(formData, "revision"));
    const lifecycleState = text(formData, "lifecycleState") as AiEvalRemediationLifecycle;
    const changeKind = optionalEnum(text(formData, "changeKind"), CHANGE_KINDS);
    const changedReference = boundedOptionalText(text(formData, "changedReference"), 500);
    const verificationNote = boundedOptionalText(text(formData, "verificationNote"), 4000);
    if (!isUuid(remediationId) || revision === null || !REMEDIATION_LIFECYCLES.has(lifecycleState)
        || changeKind === false || changedReference === false || verificationNote === false
        || (["changed", "ready_for_recheck", "verified"].includes(lifecycleState) && (!changeKind || !changedReference))
        || (lifecycleState === "verified" && !verificationNote)) {
        redirect(withNotice(returnTarget, "invalid"));
    }
    const updated = await safelyMutate(() => context.remediations.updateRemediation({
        operatorUserId: context.operatorUserId,
        remediationId,
        revision,
        lifecycleState,
        changeKind,
        changedReference,
        verificationNote,
    }), returnTarget);
    redirect(withNotice(returnTarget, updated ? "remediation_updated" : "conflict"));
}

export async function promoteAiEvalRegressionCaseAction(formData: FormData) {
    const returnTarget = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(returnTarget);
    const remediationId = text(formData, "remediationId");
    const findingId = text(formData, "findingId");
    if (!isUuid(remediationId) || !isUuid(findingId)) redirect(withNotice(returnTarget, "invalid"));
    const regressionCaseId = await safelyMutate(() => context.remediations.promoteRegressionCase({
        operatorUserId: context.operatorUserId,
        remediationId,
        findingId,
    }), returnTarget);
    redirect(withNotice(returnTarget, regressionCaseId ? "regression_promoted" : "conflict"));
}

export async function recordAiEvalRecheckAction(formData: FormData) {
    const returnTarget = safeReturnTarget(text(formData, "returnTarget"));
    const context = await loadActionContext(returnTarget);
    const remediationId = text(formData, "remediationId");
    const regressionCaseId = text(formData, "regressionCaseId");
    const verificationReviewId = text(formData, "verificationReviewId");
    const outcome = text(formData, "outcome") as AiEvalRecheckOutcome;
    const verificationNote = boundedRequiredText(text(formData, "verificationNote"), 4000);
    if (!isUuid(remediationId) || !isUuid(regressionCaseId) || !isUuid(verificationReviewId)
        || !RECHECK_OUTCOMES.has(outcome) || !verificationNote) {
        redirect(withNotice(returnTarget, "invalid"));
    }
    const recheckId = await safelyMutate(() => context.remediations.recordRecheck({
        operatorUserId: context.operatorUserId,
        remediationId,
        regressionCaseId,
        verificationReviewId,
        outcome,
        verificationNote,
    }), returnTarget);
    redirect(withNotice(returnTarget, recheckId ? "recheck_recorded" : "conflict"));
}

async function loadActionContext(returnTarget: string) {
    const client = createRecruiterAuthQueryClientFromEnv();
    const accessRepository = createAiEvalOperatorAccessRepository(client);
    let access;
    try {
        access = await getCurrentAiEvalOperatorAccess({ resolveGrant: accessRepository.findActiveGrant });
    } catch {
        redirect(withNotice(returnTarget, "unavailable"));
    }
    if (access.kind === "missing") redirect("/login?next=%2Fqa%2Fai-eval");
    if (access.kind === "forbidden") redirect("/qa/ai-eval");
    return {
        operatorUserId: access.user.id,
        workbench: createAiEvalWorkbenchRepository(client),
        reviews: createAiEvalReviewRepository(client),
        remediations: createAiEvalRemediationRepository(client),
        scenarios: createAiEvalScenarioRepository(client),
    };
}

async function safelyMutate<T>(operation: () => Promise<T>, returnTarget: string): Promise<T> {
    try {
        return await operation();
    } catch {
        redirect(withNotice(returnTarget, "unavailable"));
    }
}

function readReviewValues(formData: FormData) {
    const disposition = optionalEnum(text(formData, "disposition"), DISPOSITIONS);
    const severity = optionalEnum(text(formData, "severity"), SEVERITIES);
    const confidence = optionalEnum(text(formData, "confidence"), CONFIDENCES);
    if (disposition === false || severity === false || confidence === false) return null;
    const layerJudgments: Record<string, AiEvalLayerJudgment> = {};
    let invalidJudgment = false;
    formData.forEach((value, key) => {
        if (!key.startsWith("judgment:") || typeof value !== "string" || !value) return;
        const layer = key.slice("judgment:".length);
        if (!/^[a-z_]{3,120}$/.test(layer) || !JUDGMENTS.has(value as AiEvalLayerJudgment)) {
            invalidJudgment = true;
            return;
        }
        layerJudgments[layer] = value as AiEvalLayerJudgment;
    });
    if (invalidJudgment) return null;
    const reviewSummary = boundedOptionalText(text(formData, "reviewSummary"), 4000);
    if (reviewSummary === false) return null;
    return { disposition, severity, confidence, layerJudgments, reviewSummary };
}

function readFindingValues(formData: FormData) {
    const [failureLabelVersion, layer, failureLabel, extra] = text(formData, "failureLabel").split("|");
    const severity = optionalEnum(text(formData, "findingSeverity"), SEVERITIES);
    const rationale = boundedRequiredText(text(formData, "findingRationale"), 4000);
    if (extra || !failureLabelVersion || !/^[a-z_]{3,120}$/.test(layer ?? "")
        || !/^[a-z0-9_]{3,120}$/.test(failureLabel ?? "") || !severity || !rationale) return null;
    const sourceReference: Record<string, string | number> = {};
    const pointerKind = text(formData, "sourcePointerKind");
    const pointerValue = text(formData, "sourcePointerValue");
    if (pointerKind || pointerValue) {
        if (!POINTER_KINDS.has(pointerKind) || !pointerValue || pointerValue.length > 200) return null;
        if (pointerKind === "questionIndex") {
            const parsed = positiveInteger(pointerValue);
            if (parsed === null) return null;
            sourceReference[pointerKind] = parsed;
        } else {
            sourceReference[pointerKind] = pointerValue;
        }
    }
    return {
        layer: layer as AiEvalFindingLayer,
        failureLabel,
        failureLabelVersion,
        severity,
        sourceReference,
        rationale,
    };
}

function safeReturnTarget(value: string) {
    try {
        const url = new URL(value, "https://interview-coach.invalid");
        if (url.origin !== "https://interview-coach.invalid" || url.pathname !== "/qa/ai-eval") return "/qa/ai-eval";
        url.searchParams.delete("notice");
        return `${url.pathname}${url.search}`;
    } catch {
        return "/qa/ai-eval";
    }
}

function withNotice(target: string, notice: string) {
    const url = new URL(target, "https://interview-coach.invalid");
    url.searchParams.set("notice", notice);
    return `${url.pathname}${url.search}`;
}

function text(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
}

function rawText(formData: FormData, key: string) {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
}

function optionalEnum<T extends string>(value: string, allowed: Set<T>): T | null | false {
    if (!value) return null;
    return allowed.has(value as T) ? value as T : false;
}

function boundedOptionalText(value: string, max: number): string | null | false {
    if (!value) return null;
    return value.length <= max ? value : false;
}

function boundedRequiredText(value: string, max: number): string | false {
    return value && value.length <= max ? value : false;
}

function positiveInteger(value: string) {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function uniqueUuids(values: FormDataEntryValue[]) {
    const strings = values.filter((value): value is string => typeof value === "string").map((value) => value.trim());
    if (strings.some((value) => !isUuid(value))) return [];
    return Array.from(new Set(strings));
}
