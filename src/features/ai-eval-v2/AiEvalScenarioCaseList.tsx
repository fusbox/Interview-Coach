"use client";

import { useMemo, useState, type CSSProperties } from "react";

import {
    createAiEvalScenarioDraftAction,
    runAiEvalScenariosAction,
} from "@/app/qa/ai-eval/actions";

export type AiEvalScenarioCaseOption = {
    scenarioVersionId: string;
    scenarioKey: string;
    title: string;
    sourceKind: string;
    versionNumber: number;
    kindLabel: string;
    audienceLabel: string;
    rationale: string;
    baselineOrdinal: number | null;
};

type ScenarioPickerRow = {
    scenarioKey: string;
    title: string;
    sourceKind: string;
    kindLabel: string;
    audienceLabel: string;
    rationale: string;
    baselineOrdinal: number | null;
    versions: Map<number, AiEvalScenarioCaseOption>;
    customVersion: AiEvalScenarioCaseOption | null;
};

function groupScenarioRows(versions: AiEvalScenarioCaseOption[]): ScenarioPickerRow[] {
    const byKey = new Map<string, AiEvalScenarioCaseOption[]>();
    for (const version of versions) {
        const existing = byKey.get(version.scenarioKey) ?? [];
        existing.push(version);
        byKey.set(version.scenarioKey, existing);
    }

    return Array.from(byKey.entries()).map(([scenarioKey, group]) => {
        const ordered = [...group].sort((left, right) => right.versionNumber - left.versionNumber);
        const baselineVersions = ordered.filter((item) => item.sourceKind === "baseline");
        const customVersion = ordered.find((item) => item.sourceKind === "operator") ?? null;
        const preferred = customVersion ?? baselineVersions[0] ?? ordered[0]!;
        return {
            scenarioKey,
            title: preferred.title,
            sourceKind: preferred.sourceKind,
            kindLabel: preferred.kindLabel,
            audienceLabel: preferred.audienceLabel,
            rationale: preferred.rationale,
            baselineOrdinal: ordered.find((item) => item.baselineOrdinal !== null)?.baselineOrdinal ?? null,
            versions: new Map(baselineVersions.map((item) => [item.versionNumber, item])),
            customVersion,
        };
    }).sort((left, right) => {
        if (left.baselineOrdinal !== null && right.baselineOrdinal !== null) {
            return left.baselineOrdinal - right.baselineOrdinal;
        }
        if (left.baselineOrdinal !== null) return -1;
        if (right.baselineOrdinal !== null) return 1;
        return left.title.localeCompare(right.title);
    });
}

function VersionActions({
    version,
    label,
    selected,
    onToggle,
}: {
    version: AiEvalScenarioCaseOption | null;
    label: string;
    selected: boolean;
    onToggle: (id: string) => void;
}) {
    if (!version) {
        return <span className="ai-eval-scenario-table__version-empty">&mdash;</span>;
    }

    return (
        <div className="ai-eval-scenario-table__version">
            <label className="ai-eval-scenario-table__select">
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggle(version.scenarioVersionId)}
                />
                <span className="sr-only">Select {version.title} {label}</span>
            </label>
            <form action={createAiEvalScenarioDraftAction}>
                <input type="hidden" name="creationRequestKey" value={crypto.randomUUID()} />
                <input type="hidden" name="sourceVersionId" value={version.scenarioVersionId} />
                <button type="submit" className="button button--quiet" aria-label={`Clone ${label}`}>
                    Clone
                </button>
            </form>
            <form action={runAiEvalScenariosAction}>
                <input type="hidden" name="creationRequestKey" value={crypto.randomUUID()} />
                <input type="hidden" name="runScope" value="selected" />
                <input type="hidden" name="scenarioVersionId" value={version.scenarioVersionId} />
                <button type="submit" className="button button--quiet" aria-label={`Run one ${label}`}>
                    Run one
                </button>
            </form>
        </div>
    );
}

export function AiEvalScenarioCaseList({
    versions,
    fixtureFormId,
    liveFormId,
}: {
    versions: AiEvalScenarioCaseOption[];
    fixtureFormId: string;
    liveFormId: string;
}) {
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const selectedIds = useMemo(() => Array.from(selected), [selected]);
    const rows = useMemo(() => groupScenarioRows(versions), [versions]);
    const versionNumbers = useMemo(() => Array.from(new Set(
        versions
            .filter((version) => version.sourceKind === "baseline")
            .map((version) => version.versionNumber),
    )).sort((left, right) => right - left), [versions]);
    const hasCustomVersions = versions.some((version) => version.sourceKind === "operator");
    const visibleVersionColumnCount = versionNumbers.length + (hasCustomVersions ? 1 : 0);

    function toggle(id: string) {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    return (
        <>
            {selectedIds.map((id) => (
                <span key={`fixture-${id}`}>
                    <input type="hidden" name="scenarioVersionId" value={id} form={fixtureFormId} />
                    <input type="hidden" name="scenarioVersionId" value={id} form={liveFormId} />
                </span>
            ))}
            <div
                className="ai-eval-scenario-table"
                role="table"
                aria-label="Scenario cases"
                style={{ "--ai-eval-scenario-version-count": visibleVersionColumnCount } as CSSProperties}
            >
                <div className="ai-eval-scenario-table__header" role="row">
                    <span role="columnheader">Scenario</span>
                    {versionNumbers.map((versionNumber) => (
                        <span key={versionNumber} role="columnheader">v{versionNumber}</span>
                    ))}
                    {hasCustomVersions ? <span role="columnheader">Custom</span> : null}
                </div>
                <ol className="ai-eval-scenario-table__body-list">
                    {rows.map((row) => {
                        const rowSelected = Array.from(row.versions.values())
                            .some((version) => selected.has(version.scenarioVersionId))
                            || Boolean(row.customVersion && selected.has(row.customVersion.scenarioVersionId));
                        return (
                            <li
                                key={row.scenarioKey}
                                className={rowSelected ? "is-selected" : undefined}
                                role="row"
                            >
                                <div className="ai-eval-scenario-table__body" role="cell">
                                    <div className="ai-eval-scenario-table__title-row">
                                        {row.baselineOrdinal !== null ? (
                                            <span className="ai-eval-scenario-table__case-number">#{row.baselineOrdinal}</span>
                                        ) : null}
                                        <h3>{row.title}</h3>
                                        <span className={`ai-eval-chip is-${row.sourceKind}`}>{row.sourceKind}</span>
                                    </div>
                                    <p className="ai-eval-scenario-table__meta">
                                        {row.kindLabel} &middot; {row.audienceLabel}
                                    </p>
                                </div>
                                {versionNumbers.map((versionNumber) => {
                                    const version = row.versions.get(versionNumber) ?? null;
                                    const label = `v${versionNumber}`;
                                    return (
                                        <div
                                            key={versionNumber}
                                            className="ai-eval-scenario-table__actions"
                                            role="cell"
                                            data-version={label}
                                        >
                                            <VersionActions
                                                version={version}
                                                label={label}
                                                selected={version ? selected.has(version.scenarioVersionId) : false}
                                                onToggle={toggle}
                                            />
                                        </div>
                                    );
                                })}
                                {hasCustomVersions ? (
                                    <div
                                        className="ai-eval-scenario-table__actions"
                                        role="cell"
                                        data-version="Custom"
                                    >
                                        <VersionActions
                                            version={row.customVersion}
                                            label="custom"
                                            selected={row.customVersion
                                                ? selected.has(row.customVersion.scenarioVersionId)
                                                : false}
                                            onToggle={toggle}
                                        />
                                    </div>
                                ) : null}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </>
    );
}
