import { createHash } from "node:crypto";

import type { AiEvalScenarioRunDetail } from "./ai-eval-scenario-repository";

export type AiEvalScenarioRunComparison = {
    compatible: boolean;
    reasons: string[];
    currentRunId: string;
    priorRunId: string;
    changedCaseCount: number;
    changedCandidateVisibleLayerCount: number;
    changedDiagnosticLayerCount: number;
    metrics: {
        current: AiEvalScenarioRunMetrics;
        prior: AiEvalScenarioRunMetrics;
        delta: AiEvalScenarioRunMetrics;
    };
    cases: Array<{
        inputFingerprint: string;
        title: string;
        assertionChanged: boolean;
        changedCandidateVisibleLayers: string[];
        changedDiagnosticLayers: string[];
    }>;
};

export type AiEvalScenarioRunMetrics = {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
};

export function compareAiEvalScenarioRuns(
    current: AiEvalScenarioRunDetail,
    prior: AiEvalScenarioRunDetail,
): AiEvalScenarioRunComparison {
    const reasons: string[] = [];
    if (current.executionMode !== "credentialed_live" || prior.executionMode !== "credentialed_live") {
        reasons.push("Both runs must use credentialed live execution.");
    }
    if (current.profileId !== prior.profileId) reasons.push("Profile identities differ.");
    if (current.configurationFingerprint !== prior.configurationFingerprint) {
        reasons.push("Configuration fingerprints differ.");
    }
    const currentFingerprints = current.cases.map((runCase) => runCase.inputFingerprint).sort();
    const priorFingerprints = prior.cases.map((runCase) => runCase.inputFingerprint).sort();
    if (JSON.stringify(currentFingerprints) !== JSON.stringify(priorFingerprints)) {
        reasons.push("Scenario input-fingerprint sets differ.");
    }

    const priorCases = new Map(prior.cases.map((runCase) => [runCase.inputFingerprint, runCase]));
    const cases = current.cases.map((runCase) => {
        const priorCase = priorCases.get(runCase.inputFingerprint);
        const changedCandidateVisibleLayers: string[] = [];
        const changedDiagnosticLayers: string[] = [];
        for (const layer of runCase.layers) {
            const priorLayer = priorCase?.layers.find((item) => item.outputLayer === layer.outputLayer);
            if (hash(layer.output) === hash(priorLayer?.output)) continue;
            (layer.candidateVisible ? changedCandidateVisibleLayers : changedDiagnosticLayers).push(layer.outputLayer);
        }
        return {
            inputFingerprint: runCase.inputFingerprint,
            title: runCase.scenario.title,
            assertionChanged: runCase.assertionResult !== priorCase?.assertionResult,
            changedCandidateVisibleLayers,
            changedDiagnosticLayers,
        };
    });
    const currentMetrics = readAiEvalScenarioRunMetrics(current);
    const priorMetrics = readAiEvalScenarioRunMetrics(prior);
    return {
        compatible: reasons.length === 0,
        reasons,
        currentRunId: current.runId,
        priorRunId: prior.runId,
        changedCaseCount: cases.filter((item) => (
            item.assertionChanged
            || item.changedCandidateVisibleLayers.length > 0
            || item.changedDiagnosticLayers.length > 0
        )).length,
        changedCandidateVisibleLayerCount: cases.reduce((total, item) => total + item.changedCandidateVisibleLayers.length, 0),
        changedDiagnosticLayerCount: cases.reduce((total, item) => total + item.changedDiagnosticLayers.length, 0),
        metrics: {
            current: currentMetrics,
            prior: priorMetrics,
            delta: subtractMetrics(currentMetrics, priorMetrics),
        },
        cases,
    };
}

export function readAiEvalScenarioRunMetrics(run: AiEvalScenarioRunDetail): AiEvalScenarioRunMetrics {
    const total: AiEvalScenarioRunMetrics = { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, latencyMs: 0 };
    for (const runCase of run.cases) {
        for (const layer of runCase.layers) {
            const evaluator = readRecord(layer.diagnostics?.evaluatorMetrics);
            if (evaluator) {
                const tokens = readRecord(evaluator.tokenUsage);
                total.calls += Array.isArray(layer.diagnostics?.stageOutcomes)
                    ? layer.diagnostics.stageOutcomes.length
                    : 0;
                total.inputTokens += readNumber(tokens?.inputTokens);
                total.outputTokens += readNumber(tokens?.outputTokens);
                total.totalTokens += readNumber(tokens?.totalTokens);
                total.latencyMs += readNumber(evaluator.latencyMs);
            }
            const coach = readRecord(layer.diagnostics?.coachUpdateMetrics);
            if (coach) {
                const tokens = readRecord(coach.tokenUsage);
                total.calls += readNumber(coach.transportAttemptCount);
                total.inputTokens += readNumber(tokens?.inputTokens);
                total.outputTokens += readNumber(tokens?.outputTokens);
                total.totalTokens += readNumber(tokens?.inputTokens) + readNumber(tokens?.outputTokens);
                total.latencyMs += readNumber(coach.latencyMs);
            }
        }
    }
    return total;
}

function subtractMetrics(current: AiEvalScenarioRunMetrics, prior: AiEvalScenarioRunMetrics): AiEvalScenarioRunMetrics {
    return {
        calls: current.calls - prior.calls,
        inputTokens: current.inputTokens - prior.inputTokens,
        outputTokens: current.outputTokens - prior.outputTokens,
        totalTokens: current.totalTokens - prior.totalTokens,
        latencyMs: current.latencyMs - prior.latencyMs,
    };
}

function hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(canonicalize(value)) ?? "undefined").digest("hex");
}

function canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]));
}

function readRecord(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function readNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
