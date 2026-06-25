"use client";

import Link from "next/link";
import { useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { ArrowRight, Briefcase, CheckCircle2, ChevronDown, ChevronRight, Circle, FileText, MessageSquare, Mic, Sparkles, X } from "lucide-react";
import { Cell, Pie, PieChart } from "recharts";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CandidateDashboardItem, CandidateDashboardTargetInterview } from "@/lib/server/candidate";
import type { PrepEvidenceRef, PrepQuestionCategoryCard, PrepSignal, PrepSignalLane, ReleasePrepSignalLane } from "@/lib/server/candidate/prep-profile-read-model";

export type PreparednessState = "not_practiced" | "emerging" | "clear" | "strong";

export type PreparednessSkill = {
    id: string;
    label: string;
    state: PreparednessState;
    evidenceCounts: Record<PreparednessState, number>;
    dimensionStates?: PreparednessDimensionState[];
    whyItMatters: string;
    evidence: PreparednessEvidence[];
    nextPracticeAction: string;
    href: string;
    fillPercent?: number;
};

export type PreparednessDimensionState = {
    dimension: string;
    label: string;
    evidenceState: PreparednessState;
    averageScore?: number;
    scoreCount: number;
    fillPercent?: number;
};

export type PreparednessEvidence = {
    type: "practice" | "resume" | "job-description";
    content: string;
    questionText?: string;
    answerTranscript?: string;
    answerModality?: "text" | "voice";
    answerSubmittedAt?: number;
    sessionId?: string;
    sessionTitle?: string;
    sessionStatusLabel?: string;
    sessionActivityLabel?: string;
    sessionSortAt?: number;
    evaluation?: string;
};

export type QuestionCategoryDrilldownModel = {
    id: string;
    label: string;
    state: PreparednessState;
    questionCount: number;
    practicedQuestionCount?: number;
    upcomingQuestionCount?: number;
    questionStatuses?: Array<{
        questionId: string;
        questionNumber: number;
        status: "practiced" | "upcoming";
    }>;
    whyItMatters: string;
    evidence: PreparednessEvidence[];
};

export type PreparednessMatrixModel = {
    categories: PrepQuestionCategoryCard[];
    rows: PreparednessMatrixRow[];
    cells: PreparednessMatrixCell[];
};

export type PreparednessMatrixRow = {
    skill: PreparednessSkill;
    cells: PreparednessMatrixCell[];
};

export type PreparednessMatrixCell = QuestionCategoryDrilldownModel & {
    laneId: string;
    laneLabel: string;
    categoryId: PrepQuestionCategoryCard["categoryId"];
    categoryLabel: string;
};

export type InstantReadEvidenceLevel = "none" | "thin" | "enough" | "strong";

export type InstantReadPreparednessModel = {
    overallRead: {
        label: string;
        state: PreparednessState;
        summary: string;
    };
    lanes: Array<{
        id: string;
        label: string;
        state: PreparednessState;
        evidenceLevel: InstantReadEvidenceLevel;
        fillPercent?: number;
        dimensionStates?: PreparednessDimensionState[];
    }>;
    categoryCoverage: Array<{
        categoryId: PrepQuestionCategoryCard["categoryId"];
        label: string;
        plannedCount: number;
        practicedCount: number;
        upcomingCount: number;
        state: PreparednessState;
    }>;
};

export type PracticeNextListItem = {
    id: string;
    label: string;
    detail: string;
    state: PreparednessState;
};

type InstantReadSelection =
    | { type: "lane"; id: string }
    | { type: "dimension"; id: string; laneId: string }
    | { type: "category"; id: string }
    | null;

type InstantReadFocusRead = {
    kicker: string;
    label: string;
    state: PreparednessState;
    summary: string;
};

type PreparednessMapExperienceView = "snapshot" | "matrix";

export function PreparednessMapExperience({
    snapshot,
    matrix,
    onLaneClick,
    onCategoryClick,
    onCellClick,
}: {
    snapshot: InstantReadPreparednessModel;
    matrix: PreparednessMatrixModel;
    onLaneClick: (skillId: string) => void;
    onCategoryClick: (categoryId: string) => void;
    onCellClick: (cellId: string) => void;
}) {
    const [view, setView] = useState<PreparednessMapExperienceView>("snapshot");
    const isSnapshot = view === "snapshot";

    return (
        <section aria-label="Preparedness map" className="min-w-0 space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">Preparedness map</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                        How your answers are shaping up. Switch to Details when you want to dig into your answers.
                    </p>
                </div>
                <div
                    role="tablist"
                    aria-label="Preparedness map view"
                    className="inline-flex w-full rounded-2xl border border-[rgb(var(--candidate-border)/0.78)] bg-white p-1 shadow-flat sm:w-auto"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={isSnapshot}
                        aria-controls="preparedness-snapshot-view"
                        onClick={() => setView("snapshot")}
                        className={cn(
                            "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:flex-none",
                            isSnapshot
                                ? "bg-primary text-white shadow-flat"
                                : "text-text-secondary hover:bg-surface-base hover:text-text-primary",
                        )}
                    >
                        Quick View
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={!isSnapshot}
                        aria-controls="preparedness-matrix-view"
                        onClick={() => setView("matrix")}
                        className={cn(
                            "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors duration-base ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 sm:flex-none",
                            !isSnapshot
                                ? "bg-primary text-white shadow-flat"
                                : "text-text-secondary hover:bg-surface-base hover:text-text-primary",
                        )}
                    >
                        Details
                    </button>
                </div>
            </div>

            {isSnapshot ? (
                <div id="preparedness-snapshot-view" role="tabpanel" aria-label="Quick preparedness view">
                    <PreparednessInstantRead
                        snapshot={snapshot}
                        onLaneClick={onLaneClick}
                        onCategoryClick={onCategoryClick}
                        showHeader={false}
                    />
                </div>
            ) : (
                <div id="preparedness-matrix-view" role="tabpanel" aria-label="Detailed practice map">
                    <PreparednessMatrix
                        matrix={matrix}
                        onLaneClick={onLaneClick}
                        onCategoryClick={onCategoryClick}
                        onCellClick={onCellClick}
                        showHeader={false}
                    />
                </div>
            )}
        </section>
    );
}

type PreparednessLaneConfig = {
    id: PrepSignalLane;
    label: string;
    whyItMatters: string;
    nextPracticeAction: Record<PreparednessState, string>;
};

const PREPAREDNESS_LANES: PreparednessLaneConfig[] = [
    {
        id: "answer_substance",
        label: "Answer Substance",
        whyItMatters: "Interviewers need answers with relevant examples, concrete actions, role-specific detail, and outcomes they can remember.",
        nextPracticeAction: {
            not_practiced: "Answer a question with one specific example, your action, and what changed.",
            emerging: "Use the next round to add clearer details, rationale, or outcomes.",
            clear: "Practice turning clear content into a sharper and more memorable answer.",
            strong: "Keep using specific, outcome-oriented examples across different question types.",
        },
    },
    {
        id: "interview_structure",
        label: "Interview Structure",
        whyItMatters: "A clear structure helps the interviewer follow the setup, action, result, and reasoning without working to organize the answer for you.",
        nextPracticeAction: {
            not_practiced: "Practice one answer with a clear beginning, middle, and ending.",
            emerging: "Use the next round to make the answer easier to follow from setup to result.",
            clear: "Practice adding stronger signposts while keeping the answer natural.",
            strong: "Keep the structure steady while practicing more complex prompts.",
        },
    },
    {
        id: "communication_delivery",
        label: "Communication Delivery",
        whyItMatters: "Clear delivery helps the answer land, especially when you are speaking through details, tradeoffs, or a longer example.",
        nextPracticeAction: {
            not_practiced: "Record or type an answer so the coach can evaluate clarity and concision.",
            emerging: "Use the next round to make the answer tighter, calmer, or easier to hear.",
            clear: "Practice keeping the same clarity with a harder question.",
            strong: "Keep this delivery strength consistent across the full interview range.",
        },
    },
];

export function TargetInterviewSwitcher({ targetInterviews }: { targetInterviews: CandidateDashboardTargetInterview[] }) {
    if (targetInterviews.length <= 1) {
        return null;
    }

    return (
        <nav aria-label="Target interviews" className="-mx-1 w-full max-w-full overflow-x-auto pb-1">
            <div className="flex w-max max-w-none gap-2 px-1">
                {targetInterviews.map((targetInterview) => (
                    <Link
                        key={targetInterview.id}
                        href={targetInterview.href}
                        aria-current={targetInterview.isSelected ? "page" : undefined}
                        className={cn(
                            "group w-[min(18rem,calc(100vw-3.5rem))] shrink-0 rounded-2xl border px-4 py-3 text-left shadow-flat transition-colors sm:w-64",
                            targetInterview.isSelected
                                ? "border-primary/25 bg-primary/10 text-text-primary"
                                : "border-[rgb(var(--candidate-border)/0.78)] bg-white text-text-secondary hover:border-primary/20 hover:bg-surface-base hover:text-text-primary",
                        )}
                    >
                        <span className="block truncate text-sm font-bold leading-5">{targetInterview.label}</span>
                    </Link>
                ))}
            </div>
        </nav>
    );
}

export function QuestionCategoryCoverage({
    categories,
    onCategoryClick,
}: {
    categories: PrepQuestionCategoryCard[];
    onCategoryClick?: (categoryId: string) => void;
}) {
    if (categories.length === 0) {
        return null;
    }

    return (
        <section aria-label="Question coverage" className="space-y-3">
            <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">Question coverage</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                    See which kinds of interview questions you have practiced for this target interview.
                </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                {categories.map((category) => {
                    const styles = getPreparednessStateStyles(category.evidenceState);
                    return (
                        <button
                            key={category.categoryId}
                            type="button"
                            data-evidence-state={category.evidenceState}
                            onClick={() => onCategoryClick?.(category.categoryId)}
                            className={cn(
                                "rounded-2xl border p-4 text-left shadow-flat transition-all duration-base ease-standard active:scale-[0.99]",
                                onCategoryClick ? "hover:-translate-y-0.5" : "",
                                styles.wrapper,
                            )}
                        >
                            <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em]", styles.badge)}>
                                {formatPreparednessState(category.evidenceState)}
                            </span>
                            <h3 className="mt-3 text-base font-bold leading-5 text-text-primary">{category.label}</h3>
                            <p className="mt-2 text-sm font-semibold text-text-secondary">
                                {formatQuestionStatusSummary(category)}
                            </p>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export function PreparednessInstantRead({
    snapshot,
    onLaneClick,
    onCategoryClick,
    showHeader = true,
    preview = false,
}: {
    snapshot: InstantReadPreparednessModel;
    onLaneClick?: (skillId: string) => void;
    onCategoryClick?: (categoryId: string) => void;
    showHeader?: boolean;
    preview?: boolean;
}) {
    const [activeSelection, setActiveSelection] = useState<InstantReadSelection>(null);
    const handledTouchSelectionRef = useRef<InstantReadSelection>(null);
    const instantReadSurfaceRef = useRef<HTMLDivElement>(null);
    const activeRead = getInstantReadFocusRead(snapshot, activeSelection);
    const activeStyles = getPreparednessStateStyles(activeRead.state);
    const skillRing = toInstantReadSkillRing(snapshot.lanes);
    const categoryMix = toInstantReadCategoryMix(snapshot.categoryCoverage);
    const canOpenLanes = Boolean(onLaneClick);
    const canOpenCategories = Boolean(onCategoryClick);

    const selectLane = (laneId?: string) => {
        if (laneId) {
            setActiveSelection({ type: "lane", id: laneId });
        }
    };
    const selectDimension = (dimension?: InstantReadChartSlice) => {
        if (dimension?.id && dimension.laneId) {
            setActiveSelection({ type: "dimension", id: dimension.id, laneId: dimension.laneId });
        }
    };
    const openLane = (laneId?: string) => {
        if (laneId && canOpenLanes) {
            onLaneClick?.(laneId);
        }
    };
    const selectCategory = (categoryId?: string) => {
        if (categoryId) {
            setActiveSelection({ type: "category", id: categoryId });
        }
    };
    const openCategory = (categoryId?: string) => {
        if (categoryId && canOpenCategories) {
            onCategoryClick?.(categoryId);
        }
    };
    const resetInstantReadSelection = () => {
        setActiveSelection(null);
        handledTouchSelectionRef.current = null;
    };
    const handleInstantReadMouseLeave = () => {
        const focusedElement = document.activeElement;
        if (focusedElement instanceof Element && instantReadSurfaceRef.current?.contains(focusedElement)) {
            return;
        }
        resetInstantReadSelection();
    };
    const handleInstantReadBlur = (event: FocusEvent<HTMLDivElement>) => {
        const nextFocusedElement = event.relatedTarget;
        if (nextFocusedElement instanceof Node && event.currentTarget.contains(nextFocusedElement)) {
            return;
        }
        resetInstantReadSelection();
    };
    const handleInstantReadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            resetInstantReadSelection();
        }
    };
    const handleInstantReadPointerDown = (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === "mouse") {
            return;
        }
        const target = event.target;
        if (target instanceof Element && target.closest("[data-instant-read-slice='true']")) {
            return;
        }
        resetInstantReadSelection();
    };
    const handleSlicePointerDown = (
        event: PointerEvent<SVGElement>,
        selection: Exclude<InstantReadSelection, null>,
        open: () => void,
    ) => {
        if (event.pointerType !== "touch") {
            handledTouchSelectionRef.current = selection;
            open();
            return;
        }
        event.preventDefault();
        if (isInstantReadSameSelection(activeSelection, selection)) {
            handledTouchSelectionRef.current = selection;
            open();
            return;
        }
        handledTouchSelectionRef.current = selection;
        setActiveSelection(selection);
    };
    const handleSliceClick = (
        event: MouseEvent<SVGElement>,
        selection: Exclude<InstantReadSelection, null>,
        open: () => void,
    ) => {
        if (isInstantReadSameSelection(handledTouchSelectionRef.current, selection)) {
            handledTouchSelectionRef.current = null;
            return;
        }
        open();
    };
    const handleSliceMouseDown = (
        selection: Exclude<InstantReadSelection, null>,
        open: () => void,
    ) => {
        handledTouchSelectionRef.current = selection;
        open();
    };
    const handleSliceMouseLeave = (event: MouseEvent<SVGElement>) => {
        if (event.currentTarget === document.activeElement) {
            return;
        }
        resetInstantReadSelection();
    };
    const handleSliceKeyDown = (event: KeyboardEvent<SVGElement>, open: () => void) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
        }
    };

    return (
        <section aria-label="Preparedness snapshot" className="space-y-4">
            {showHeader ? (
                <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">Preparedness snapshot</h2>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                        How your answers are shaping up before you open the full practice breakdown.
                    </p>
                </div>
            ) : null}

            <div
                ref={instantReadSurfaceRef}
                className="relative overflow-hidden rounded-[1.75rem] border border-[rgb(var(--candidate-border)/0.78)] bg-white p-4 shadow-flat sm:p-5 lg:p-6"
                onBlur={handleInstantReadBlur}
                onKeyDown={handleInstantReadKeyDown}
                onMouseLeave={handleInstantReadMouseLeave}
                onPointerDown={handleInstantReadPointerDown}
            >
                <div className="grid gap-5">
                    <div className={cn("grid gap-4 sm:grid-cols-2", preview ? "opacity-90 grayscale-[0.12]" : "")}>
                        <div
                            aria-label="Answer skills chart"
                            className="rounded-[1.5rem] border border-[rgb(var(--candidate-border)/0.64)] bg-[rgb(var(--candidate-surface-subtle)/0.7)] p-3 transition-shadow duration-base ease-standard focus-within:ring-2 focus-within:ring-primary/30"
                        >
                            <p className="px-2 text-xs font-black uppercase tracking-[0.16em] text-text-muted">Answer skills</p>
                            <div className="mx-auto flex justify-center overflow-visible">
                                <PieChart width={260} height={230}>
                                    <Pie
                                        data={skillRing.lanes}
                                        dataKey="value"
                                        cx="50%"
                                        cy="50%"
                                        startAngle={90}
                                        endAngle={-270}
                                        innerRadius={38}
                                        outerRadius={72}
                                        paddingAngle={3}
                                        cornerRadius={9}
                                        stroke="white"
                                        strokeWidth={4}
                                        isAnimationActive={false}
                                        onMouseEnter={(entry: unknown) => selectLane((entry as InstantReadChartSlice).id)}
                                        onMouseDown={(entry: unknown) => openLane((entry as InstantReadChartSlice).id)}
                                    >
                                        {skillRing.lanes.map((entry) => {
                                            const selection: Exclude<InstantReadSelection, null> = { type: "lane", id: entry.id };
                                            const focusState = getInstantReadSliceFocusState(activeSelection, "lane", entry);
                                            const sliceStyle = getInstantReadSliceVisualStyle(entry, focusState);
                                            return (
                                                <Cell
                                                    key={entry.id}
                                                    fill={sliceStyle.fill}
                                                    opacity={sliceStyle.opacity}
                                                    stroke={sliceStyle.stroke}
                                                    strokeWidth={sliceStyle.strokeWidth}
                                                    role={canOpenLanes ? "button" : undefined}
                                                    tabIndex={canOpenLanes ? 0 : undefined}
                                                    aria-label={`Open ${entry.label} details`}
                                                    data-instant-read-slice="true"
                                                    className={getInstantReadSliceClassName(canOpenLanes, focusState, entry.state)}
                                                    onMouseEnter={() => selectLane(entry.id)}
                                                    onMouseLeave={handleSliceMouseLeave}
                                                    onMouseOut={handleSliceMouseLeave}
                                                    onFocus={() => selectLane(entry.id)}
                                                    onPointerDown={(event) => handleSlicePointerDown(event, selection, () => openLane(entry.id))}
                                                    onMouseDown={() => handleSliceMouseDown(selection, () => openLane(entry.id))}
                                                    onClick={(event) => handleSliceClick(event, selection, () => openLane(entry.id))}
                                                    onKeyDown={(event) => handleSliceKeyDown(event, () => openLane(entry.id))}
                                                />
                                            );
                                        })}
                                    </Pie>
                                    <Pie
                                        data={skillRing.dimensions}
                                        dataKey="value"
                                        cx="50%"
                                        cy="50%"
                                        startAngle={90}
                                        endAngle={-270}
                                        innerRadius={82}
                                        outerRadius={106}
                                        paddingAngle={2}
                                        cornerRadius={7}
                                        stroke="white"
                                        strokeWidth={3}
                                        isAnimationActive={false}
                                        onMouseEnter={(entry: unknown) => selectDimension(entry as InstantReadChartSlice)}
                                        onMouseDown={(entry: unknown) => openLane((entry as InstantReadChartSlice).laneId)}
                                    >
                                        {skillRing.dimensions.map((entry) => {
                                            const selection: Exclude<InstantReadSelection, null> = { type: "dimension", id: entry.id, laneId: entry.laneId || "" };
                                            const focusState = getInstantReadSliceFocusState(activeSelection, "dimension", entry);
                                            const sliceStyle = getInstantReadSliceVisualStyle(entry, focusState);
                                            return (
                                                <Cell
                                                    key={entry.id}
                                                    fill={sliceStyle.fill}
                                                    opacity={sliceStyle.opacity}
                                                    stroke={sliceStyle.stroke}
                                                    strokeWidth={sliceStyle.strokeWidth}
                                                    role={canOpenLanes ? "button" : undefined}
                                                    tabIndex={canOpenLanes ? 0 : undefined}
                                                    aria-label={`Open ${entry.label} details`}
                                                    data-instant-read-slice="true"
                                                    className={getInstantReadSliceClassName(canOpenLanes, focusState, entry.state)}
                                                    onMouseEnter={() => selectDimension(entry)}
                                                    onMouseLeave={handleSliceMouseLeave}
                                                    onMouseOut={handleSliceMouseLeave}
                                                    onFocus={() => selectDimension(entry)}
                                                    onPointerDown={(event) => handleSlicePointerDown(event, selection, () => openLane(entry.laneId))}
                                                    onMouseDown={() => handleSliceMouseDown(selection, () => openLane(entry.laneId))}
                                                    onClick={(event) => handleSliceClick(event, selection, () => openLane(entry.laneId))}
                                                    onKeyDown={(event) => handleSliceKeyDown(event, () => openLane(entry.laneId))}
                                                />
                                            );
                                        })}
                                    </Pie>
                                </PieChart>
                            </div>
                        </div>

                        <div
                            aria-label="Question mix chart"
                            className="rounded-[1.5rem] border border-[rgb(var(--candidate-border)/0.64)] bg-white p-3 transition-shadow duration-base ease-standard focus-within:ring-2 focus-within:ring-primary/30"
                        >
                            <p className="px-2 text-xs font-black uppercase tracking-[0.16em] text-text-muted">Question mix</p>
                            <div className="mx-auto flex justify-center overflow-visible">
                                <PieChart width={260} height={230}>
                                    <Pie
                                        data={categoryMix}
                                        dataKey="value"
                                        cx="50%"
                                        cy="50%"
                                        startAngle={90}
                                        endAngle={-270}
                                        innerRadius={54}
                                        outerRadius={100}
                                        paddingAngle={4}
                                        cornerRadius={10}
                                        stroke="white"
                                        strokeWidth={4}
                                        isAnimationActive={false}
                                        onMouseEnter={(entry: unknown) => selectCategory((entry as InstantReadChartSlice).categoryId)}
                                        onMouseDown={(entry: unknown) => openCategory((entry as InstantReadChartSlice).categoryId)}
                                    >
                                        {categoryMix.map((entry) => {
                                            const selection: Exclude<InstantReadSelection, null> = { type: "category", id: entry.categoryId || "" };
                                            const focusState = getInstantReadSliceFocusState(activeSelection, "category", entry);
                                            const sliceStyle = getInstantReadSliceVisualStyle(entry, focusState);
                                            return (
                                                <Cell
                                                    key={entry.id}
                                                    fill={sliceStyle.fill}
                                                    opacity={sliceStyle.opacity}
                                                    stroke={sliceStyle.stroke}
                                                    strokeWidth={sliceStyle.strokeWidth}
                                                    role={entry.categoryId && canOpenCategories ? "button" : undefined}
                                                    tabIndex={entry.categoryId && canOpenCategories ? 0 : undefined}
                                                    aria-label={entry.categoryId ? `Open ${entry.label} details` : entry.label}
                                                    data-instant-read-slice={entry.categoryId ? "true" : undefined}
                                                    className={getInstantReadSliceClassName(Boolean(entry.categoryId && canOpenCategories), focusState, entry.state)}
                                                    onMouseEnter={() => selectCategory(entry.categoryId)}
                                                    onMouseLeave={handleSliceMouseLeave}
                                                    onMouseOut={handleSliceMouseLeave}
                                                    onFocus={() => selectCategory(entry.categoryId)}
                                                    onPointerDown={(event) => handleSlicePointerDown(event, selection, () => openCategory(entry.categoryId))}
                                                    onMouseDown={() => handleSliceMouseDown(selection, () => openCategory(entry.categoryId))}
                                                    onClick={(event) => handleSliceClick(event, selection, () => openCategory(entry.categoryId))}
                                                    onKeyDown={(event) => handleSliceKeyDown(event, () => openCategory(entry.categoryId))}
                                                />
                                            );
                                        })}
                                    </Pie>
                                </PieChart>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-[rgb(var(--candidate-border)/0.64)] bg-[rgb(var(--candidate-surface-subtle)/0.76)] p-4 text-center shadow-flat lg:text-left">
                        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold shadow-flat", activeStyles.badge)}>
                            {activeRead.kicker}
                        </span>
                        <div aria-live="polite" className="space-y-2">
                            <h3 className="font-display text-3xl font-bold leading-tight text-text-primary sm:text-4xl">
                                {activeRead.label}
                            </h3>
                            <p className="mx-auto max-w-xl text-sm leading-6 text-text-secondary lg:mx-0">
                                {activeRead.summary}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function getInstantReadFocusRead(snapshot: InstantReadPreparednessModel, selection: InstantReadSelection): InstantReadFocusRead {
    if (selection?.type === "dimension") {
        const dimension = toInstantReadSkillRing(snapshot.lanes).dimensions.find((item) => item.id === selection.id);
        if (dimension) {
            return {
                kicker: "Answer skill component",
                label: dimension.label,
                state: dimension.state || "clear",
                summary: instantReadDimensionSummary(snapshot, dimension),
            };
        }
    }

    if (selection?.type === "lane") {
        const lane = snapshot.lanes.find((item) => item.id === selection.id);
        if (lane) {
            return {
                kicker: formatPreparednessState(lane.state),
                label: formatMatrixLaneLabel(lane.label),
                state: lane.state,
                summary: instantReadLaneSummary(lane),
            };
        }
    }

    if (selection?.type === "category") {
        const category = snapshot.categoryCoverage.find((item) => item.categoryId === selection.id);
        if (category) {
            return {
                kicker: "Question type",
                label: category.label,
                state: category.state,
                summary: instantReadCategorySummary(category),
            };
        }
    }

    return {
        kicker: formatPreparednessState(snapshot.overallRead.state),
        label: snapshot.overallRead.label,
        state: snapshot.overallRead.state,
        summary: snapshot.overallRead.summary,
    };
}

function instantReadLaneSummary(lane: InstantReadPreparednessModel["lanes"][number]): string {
    const laneLabel = formatMatrixLaneLabel(lane.label);
    switch (lane.state) {
        case "strong":
            return `${laneLabel} is carrying strong practice evidence. Open it to see which answers created that read and how to keep it sharp.`;
        case "clear":
            return `${laneLabel} is in a usable place. Open it to see what is already working and where a small lift could make it stronger.`;
        case "emerging":
            return `${laneLabel} is starting to show up, but the coach still needs clearer proof. Open it to see what to make more specific next time.`;
        case "not_practiced":
        default:
            return `${laneLabel} has not had enough practice yet. Open it to see what interviewers listen for in this area.`;
    }
}

function instantReadDimensionSummary(snapshot: InstantReadPreparednessModel, dimension: InstantReadChartSlice): string {
    const lane = snapshot.lanes.find((item) => item.id === dimension.laneId);
    const laneLabel = formatMatrixLaneLabel(lane?.label || "this answer skill");
    const siblingLabels = getInstantReadSiblingDimensions(snapshot, dimension)
        .map((item) => item.label)
        .filter((label) => label !== dimension.label);
    const siblingCopy = siblingLabels.length > 1
        ? `${siblingLabels.slice(0, -1).join(", ")}, and ${siblingLabels.at(-1)}`
        : siblingLabels[0];
    const definition = INSTANT_READ_DIMENSION_DEFINITIONS[getInstantReadDimensionKey(dimension)] ?? `${dimension.label} is one component of how this answer skill comes through in practice.`;
    if (!siblingCopy) {
        return `${definition} It is part of ${laneLabel}, and the lane detail shows the practice evidence behind this read.`;
    }
    return `${definition} It works with ${siblingCopy} to make up ${laneLabel}. Open the lane detail to see the practice evidence behind this read.`;
}

function getInstantReadSiblingDimensions(snapshot: InstantReadPreparednessModel, dimension: InstantReadChartSlice): Array<{ label: string }> {
    const lane = snapshot.lanes.find((item) => item.id === dimension.laneId);
    if (lane?.dimensionStates?.length) {
        return lane.dimensionStates.map((item) => ({ label: item.label }));
    }
    return (INSTANT_READ_DIMENSIONS_BY_LANE[dimension.laneId || ""] ?? [dimension.label]).map((label) => ({ label }));
}

function getInstantReadDimensionKey(dimension: InstantReadChartSlice): string {
    return dimension.dimensionId || dimension.label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function instantReadCategorySummary(category: InstantReadPreparednessModel["categoryCoverage"][number]): string {
    const planned = Math.max(category.plannedCount, 0);
    const practiced = Math.max(category.practicedCount, 0);
    if (planned === 0) {
        return `${category.label} is not part of this practice plan right now.`;
    }
    if (practiced === 0) {
        return `${category.label} is planned for this interview, but you have not answered that type yet.`;
    }
    if (practiced >= planned) {
        return `You have practiced all ${planned} ${planned === 1 ? "question" : "questions"} planned for ${category.label}. Open it to review what your answers showed.`;
    }
    return `You have practiced ${practiced} of ${planned} planned ${category.label} ${planned === 1 ? "question" : "questions"}. Open it to review the answered items and what is still ahead.`;
}

const INSTANT_READ_DIMENSIONS_BY_LANE: Record<string, string[]> = {
    answer_substance: ["Focus", "Specificity", "Outcome", "Rationale"],
    interview_structure: ["Flow", "Signposting"],
    communication_delivery: ["Filler control", "Conciseness", "Resilience"],
};

const INSTANT_READ_DIMENSION_DEFINITIONS: Record<string, string> = {
    focus_relevance: "Focus means your answer stays tied to the question and the role instead of drifting into extra background.",
    specificity_concreteness: "Specific detail means your answer gives concrete examples, actions, or facts the interviewer can picture.",
    outcome_impact: "Outcome means your answer makes the result or effect of your work clear.",
    rationale_judgment: "Rationale means your answer explains why you chose that action, not only what you did.",
    flow_sequence: "Flow means your answer is easy to follow from setup to action to result.",
    signposting_clarity: "Signposting means you give the interviewer clear verbal markers for where the answer is going.",
    filler_control: "Filler control means your delivery stays steady without extra phrases crowding the answer.",
    conciseness_pacing: "Conciseness means your answer gives enough context without burying the strongest point.",
    resilience_ownership: "Resilience means your answer shows ownership, learning, and steadiness when the situation is difficult.",
    focus: "Focus means your answer stays tied to the question and the role instead of drifting into extra background.",
    specificity: "Specificity means your answer gives concrete examples, actions, or facts the interviewer can picture.",
    outcome: "Outcome means your answer makes the result or effect of your work clear.",
    rationale: "Rationale means your answer explains why you chose that action, not only what you did.",
    flow: "Flow means your answer is easy to follow from setup to action to result.",
    signposting: "Signposting means you give the interviewer clear verbal markers for where the answer is going.",
    conciseness: "Conciseness means your answer gives enough context without burying the strongest point.",
    resilience: "Resilience means your answer shows ownership, learning, and steadiness when the situation is difficult.",
};

type InstantReadChartSlice = {
    id: string;
    label: string;
    value: number;
    fill: string;
    opacity?: number;
    laneId?: string;
    dimensionId?: string;
    categoryId?: PrepQuestionCategoryCard["categoryId"];
    coverageKind?: "practiced" | "upcoming" | "empty";
    state?: PreparednessState;
};

type InstantReadSliceFocusState = "idle" | "primary" | "secondary" | "dimmed";

function isInstantReadSameSelection(a: InstantReadSelection, b: InstantReadSelection): boolean {
    if (!a || !b || a.type !== b.type) {
        return false;
    }
    if (a.type === "dimension" && b.type === "dimension") {
        return a.id === b.id && a.laneId === b.laneId;
    }
    return a.id === b.id;
}

function getInstantReadSliceFocusState(
    selection: InstantReadSelection,
    sliceType: "lane" | "dimension" | "category",
    slice: InstantReadChartSlice,
): InstantReadSliceFocusState {
    if (!selection) {
        return "idle";
    }
    if (selection.type === "category") {
        if (sliceType !== "category" || !slice.categoryId) {
            return "idle";
        }
        return selection.id === slice.categoryId ? "primary" : "dimmed";
    }
    if (sliceType === "category") {
        return "idle";
    }
    if (selection.type === "lane") {
        if (sliceType === "lane") {
            return selection.id === slice.id ? "primary" : "dimmed";
        }
        return selection.id === slice.laneId ? "secondary" : "dimmed";
    }
    if (sliceType === "lane") {
        return selection.laneId === slice.id ? "secondary" : "dimmed";
    }
    if (selection.laneId !== slice.laneId) {
        return "dimmed";
    }
    return selection.id === slice.id ? "primary" : "secondary";
}

function getInstantReadSliceVisualStyle(
    slice: InstantReadChartSlice,
    focusState: InstantReadSliceFocusState,
): {
    fill: string;
    opacity: number;
    stroke: string;
    strokeWidth: number;
} {
    const baseOpacity = slice.opacity ?? 1;
    if (focusState === "primary") {
        return {
            fill: getInstantReadChartColor(slice.state || "clear", 1),
            opacity: 1,
            stroke: "white",
            strokeWidth: 4,
        };
    }
    if (focusState === "secondary") {
        return {
            fill: slice.fill,
            opacity: Math.min(1, Math.max(baseOpacity, 0.86)),
            stroke: "white",
            strokeWidth: 3,
        };
    }
    if (focusState === "dimmed") {
        return {
            fill: slice.fill,
            opacity: Math.min(baseOpacity, 0.32),
            stroke: "white",
            strokeWidth: 2,
        };
    }
    return {
        fill: slice.fill,
        opacity: baseOpacity,
        stroke: "white",
        strokeWidth: 3,
    };
}

function getInstantReadSliceClassName(canOpen: boolean, focusState: InstantReadSliceFocusState, state?: PreparednessState): string | undefined {
    if (!canOpen) {
        return undefined;
    }
    return cn(
        "cursor-pointer outline-none transition-[filter,opacity,transform] duration-base ease-standard",
        focusState === "primary" ? cn("-translate-x-px -translate-y-0.5 brightness-[1.08] saturate-[1.08]", getInstantReadGlowClassName(state)) : "",
    );
}

function getInstantReadGlowClassName(state: PreparednessState = "clear"): string {
    switch (state) {
        case "strong":
            return "drop-shadow-[0_5px_8px_rgb(var(--candidate-success)/0.28)]";
        case "emerging":
            return "drop-shadow-[0_5px_8px_rgb(var(--candidate-secondary-brand)/0.3)]";
        case "not_practiced":
            return "drop-shadow-[0_5px_8px_rgb(var(--candidate-border)/0.36)]";
        case "clear":
        default:
            return "drop-shadow-[0_5px_8px_rgb(var(--candidate-primary)/0.28)]";
    }
}

function toInstantReadSkillRing(lanes: InstantReadPreparednessModel["lanes"]): {
    lanes: InstantReadChartSlice[];
    dimensions: InstantReadChartSlice[];
} {
    const laneSlices = lanes.map((lane) => {
        const dimensions = INSTANT_READ_DIMENSIONS_BY_LANE[lane.id] ?? [formatMatrixLaneLabel(lane.label)];
        return {
            id: lane.id,
            label: formatMatrixLaneLabel(lane.label),
            value: dimensions.length,
            fill: getInstantReadChartColor(lane.state),
            state: lane.state,
        };
    });
    const dimensionSlices = lanes.flatMap((lane) => {
        const dimensions = lane.dimensionStates?.length
            ? lane.dimensionStates
            : (INSTANT_READ_DIMENSIONS_BY_LANE[lane.id] ?? [formatMatrixLaneLabel(lane.label)]).map((label) => ({
                dimension: label,
                label,
                evidenceState: lane.state,
                scoreCount: 0,
            }));
        return dimensions.map((dimension) => ({
            id: `${lane.id}:${dimension.dimension}`,
            label: dimension.label,
            value: 1,
            fill: getInstantReadChartColor(dimension.evidenceState, 0.72),
            laneId: lane.id,
            dimensionId: dimension.dimension,
            state: dimension.evidenceState,
        }));
    });

    return {
        lanes: laneSlices.length > 0 ? laneSlices : [{ id: "empty", label: "Practice", value: 1, fill: getInstantReadChartColor("not_practiced"), state: "not_practiced" }],
        dimensions: dimensionSlices.length > 0 ? dimensionSlices : [{ id: "empty:dimension", label: "Practice", value: 1, fill: getInstantReadChartColor("not_practiced", 0.72), laneId: "empty", dimensionId: "practice", state: "not_practiced" }],
    };
}

export function toInstantReadCategoryMix(categories: InstantReadPreparednessModel["categoryCoverage"]): InstantReadChartSlice[] {
    if (categories.length === 0) {
        return [{
            id: "empty",
            label: "Practice",
            value: 1,
            fill: getInstantReadChartColor("not_practiced", 0.5),
            categoryId: undefined,
            coverageKind: "empty",
            state: "not_practiced",
        }];
    }

    return categories.flatMap((category) => {
        const plannedCount = Math.max(category.plannedCount, category.practicedCount, 1);
        const practicedCount = Math.min(Math.max(category.practicedCount, 0), plannedCount);
        const upcomingCount = Math.max(category.upcomingCount, plannedCount - practicedCount, 0);
        const slices: InstantReadChartSlice[] = [];

        if (practicedCount > 0) {
            slices.push({
                id: `${category.categoryId}:practiced`,
                categoryId: category.categoryId,
                label: `${category.label} practiced`,
                value: practicedCount,
                fill: getInstantReadChartColor(category.state, 0.88),
                coverageKind: "practiced",
                state: category.state,
            });
        }

        if (upcomingCount > 0) {
            slices.push({
                id: `${category.categoryId}:upcoming`,
                categoryId: category.categoryId,
                label: `${category.label} upcoming`,
                value: upcomingCount,
                fill: getInstantReadChartColor("not_practiced", 0.58),
                coverageKind: "upcoming",
                state: "not_practiced",
            });
        }

        return slices;
    });
}

function getInstantReadChartColor(state: PreparednessState, opacity = 0.86): string {
    switch (state) {
        case "strong":
            return `rgb(var(--candidate-success) / ${opacity})`;
        case "clear":
            return `rgb(var(--candidate-primary) / ${opacity})`;
        case "emerging":
            return `rgb(var(--candidate-secondary-brand) / ${opacity})`;
        case "not_practiced":
        default:
            return `rgb(var(--candidate-border) / ${opacity})`;
    }
}

export function PreparednessMatrix({
    matrix,
    onLaneClick,
    onCategoryClick,
    onCellClick,
    showHeader = true,
}: {
    matrix: PreparednessMatrixModel;
    onLaneClick: (skillId: string) => void;
    onCategoryClick: (categoryId: string) => void;
    onCellClick: (cellId: string) => void;
    showHeader?: boolean;
}) {
    const [activeLaneId, setActiveLaneId] = useState<string | null>(null);
    const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

    if (matrix.categories.length === 0) {
        return <PreparednessMap skills={matrix.rows.map((row) => row.skill)} onSkillClick={onLaneClick} />;
    }

    const matrixColumns = matrix.rows;
    const dataColumnWidth = "calc((100% - var(--matrix-label-width) - var(--matrix-gap) - var(--matrix-gap) - var(--matrix-gap)) / 3)";
    const activeLaneIndex = matrixColumns.findIndex((column) => column.skill.id === activeLaneId);
    const activeCategoryIndex = matrix.categories.findIndex((category) => category.categoryId === activeCategoryId);
    const desktopGridStyle = {
        "--matrix-gap": "0.35rem",
        "--matrix-label-width": "34%",
        "--matrix-header-height": "3rem",
        "--matrix-row-height": "5rem",
        gridTemplateColumns: `var(--matrix-label-width) repeat(${matrixColumns.length}, ${dataColumnWidth})`,
    } as CSSProperties;

    return (
        <section aria-label="Preparedness map" className="space-y-4">
            {showHeader ? (
                <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">Preparedness map</h2>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                        See how your answer skills show up across the kinds of interview questions you have practiced.
                    </p>
                </div>
            ) : null}

            <div className="rounded-[1.35rem] border border-[rgb(var(--candidate-border)/0.78)] bg-white p-2.5 shadow-flat sm:p-3">
                <div className="relative grid w-full min-w-0 gap-[var(--matrix-gap)] overflow-visible" style={desktopGridStyle}>
                    {activeLaneIndex >= 0 ? (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute bottom-0 top-0 z-0 rounded-2xl bg-violet-100/55 transition-colors duration-base ease-standard"
                            style={{
                                left: matrixColumnLeft(activeLaneIndex, dataColumnWidth),
                                width: dataColumnWidth,
                            }}
                        />
                    ) : null}
                    {activeCategoryIndex >= 0 ? (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute left-0 right-0 z-0 rounded-2xl bg-violet-100/55 transition-colors duration-base ease-standard"
                            style={{
                                top: matrixRowTop(activeCategoryIndex),
                                height: "var(--matrix-row-height)",
                            }}
                        />
                    ) : null}
                    <div aria-hidden="true" />
                    {matrixColumns.map((column) => (
                        <button
                            key={column.skill.id}
                            type="button"
                            onClick={() => onLaneClick(column.skill.id)}
                            onMouseEnter={() => setActiveLaneId(column.skill.id)}
                            onMouseLeave={() => setActiveLaneId(null)}
                            onFocus={() => setActiveLaneId(column.skill.id)}
                            onBlur={() => setActiveLaneId(null)}
                            aria-label={column.skill.label}
                            className={cn(
                                "relative z-10 flex h-12 min-w-0 items-center justify-center rounded-2xl px-1.5 py-2 text-center transition-all duration-base ease-standard hover:bg-violet-100 focus-visible:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:px-3",
                                activeLaneId === column.skill.id
                                    ? "bg-violet-100"
                                    : "bg-surface-base",
                            )}
                        >
                            <span className="block max-w-full whitespace-nowrap text-[0.66rem] font-black uppercase leading-4 tracking-[0.04em] text-text-primary sm:text-[0.72rem]">
                                {formatMatrixLaneLabel(column.skill.label)}
                            </span>
                        </button>
                    ))}

                    {matrix.categories.flatMap((category) => [
                        <button
                            key={`${category.categoryId}-header`}
                            type="button"
                            onClick={() => onCategoryClick(category.categoryId)}
                            onMouseEnter={() => setActiveCategoryId(category.categoryId)}
                            onMouseLeave={() => setActiveCategoryId(null)}
                            onFocus={() => setActiveCategoryId(category.categoryId)}
                            onBlur={() => setActiveCategoryId(null)}
                            className={cn(
                                "relative z-10 h-20 min-w-0 overflow-hidden rounded-2xl px-2 py-2.5 text-left transition-all duration-base ease-standard hover:bg-violet-100 focus-visible:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:px-3 sm:py-3",
                                activeCategoryId === category.categoryId
                                    ? "bg-violet-100"
                                    : "bg-transparent",
                            )}
                        >
                            <span className="line-clamp-2 text-sm font-bold leading-5 text-text-primary">{category.label}</span>
                            <span className="mt-0.5 block text-[0.66rem] font-bold leading-4 text-text-muted">
                                {formatQuestionStatusSummary(category)}
                            </span>
                        </button>,
                        ...matrixColumns.map((column) => {
                            const cell = cellForCategoryAndLane(matrix, category.categoryId, column.skill.id);
                            return (
                                <MatrixCellButton
                                    key={cell.id}
                                    cell={cell}
                                    onClick={() => onCellClick(cell.id)}
                                />
                            );
                        }),
                    ])}
                </div>
            </div>
        </section>
    );
}

function matrixColumnLeft(columnIndex: number, dataColumnWidth: string): string {
    const priorColumns = Array.from({ length: columnIndex }, () => `${dataColumnWidth} + var(--matrix-gap)`);
    return `calc(var(--matrix-label-width) + var(--matrix-gap)${priorColumns.length ? ` + ${priorColumns.join(" + ")}` : ""})`;
}

function matrixRowTop(rowIndex: number): string {
    const priorRows = Array.from({ length: rowIndex }, () => "var(--matrix-row-height) + var(--matrix-gap)");
    return `calc(var(--matrix-header-height) + var(--matrix-gap)${priorRows.length ? ` + ${priorRows.join(" + ")}` : ""})`;
}

function MatrixCellButton({
    cell,
    onClick,
}: {
    cell: PreparednessMatrixCell;
    onClick: () => void;
}) {
    const styles = getPreparednessStateStyles(cell.state);

    return (
        <button
            type="button"
            data-evidence-state={cell.state}
            aria-label={`${cell.laneLabel} in ${cell.categoryLabel}: ${formatPreparednessState(cell.state)}`}
            onClick={onClick}
            className={cn(
                "group relative z-10 flex h-20 items-center justify-center rounded-2xl px-2 py-2 transition-all duration-base ease-standard hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-[0.99]",
                styles.wrapper,
                "!border-0 !border-transparent !shadow-none hover:!border-0 hover:!border-transparent",
                cell.state === "not_practiced" && "!bg-slate-50 hover:!bg-slate-50",
            )}
        >
            <span className="sr-only">
                {cell.laneLabel} in {cell.categoryLabel}: {formatPreparednessState(cell.state)}
            </span>
            <span
                aria-hidden="true"
                className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full border bg-white/60 transition-transform duration-base ease-standard group-hover:scale-105 sm:h-9 sm:w-9",
                    styles.iconShell,
                )}
            >
                <span className={cn("h-3 w-3 rounded-full", styles.dot)} />
            </span>
        </button>
    );
}

function cellForCategoryAndLane(
    matrix: PreparednessMatrixModel,
    categoryId: PrepQuestionCategoryCard["categoryId"],
    laneId: string,
): PreparednessMatrixCell {
    return matrix.cells.find((cell) => cell.categoryId === categoryId && cell.laneId === laneId) ?? matrix.cells[0];
}

function formatMatrixLaneLabel(label: string): string {
    switch (label) {
        case "Answer Substance":
            return "Substance";
        case "Interview Structure":
            return "Structure";
        case "Communication Delivery":
            return "Delivery";
        default:
            return label;
    }
}

export function PreparednessMap({
    skills,
    onSkillClick,
}: {
    skills: PreparednessSkill[];
    onSkillClick: (skillId: string) => void;
}) {
    return (
        <section aria-label="Preparedness map" className="space-y-4">
            <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">Preparedness map</h2>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Tap an area to see what your practice shows and what to work on next.
                </p>
            </div>
            <div className="grid gap-3">
                {skills.map((skill) => {
                    const styles = getPreparednessStateStyles(skill.state);
                    const fillPercent = getPreparednessFillPercent(skill);
                    const hasFill = fillPercent > 0;
                    const laneStyle = {
                        "--preparedness-fill": `${fillPercent}%`,
                    } as CSSProperties;

                    return (
                        <button
                            key={skill.id}
                            type="button"
                            data-evidence-state={skill.state}
                            style={laneStyle}
                            onClick={() => onSkillClick(skill.id)}
                            className={cn(
                                "group relative flex min-h-[5.25rem] w-full items-center justify-between gap-4 overflow-hidden rounded-2xl border px-4 py-3 text-left shadow-flat transition-all duration-base ease-standard active:scale-[0.99]",
                                styles.wrapper,
                            )}
                        >
                            {hasFill ? (
                                <span
                                    className={cn("pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-500 ease-standard", styles.fill)}
                                    style={{ width: "var(--preparedness-fill)" }}
                                    aria-hidden="true"
                                />
                            ) : null}
                            <span className="relative z-10 flex min-w-0 items-center gap-3">
                                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border bg-white/80", styles.iconShell)}>
                                    {skill.state === "not_practiced" ? (
                                        <Circle size={18} aria-hidden="true" />
                                    ) : (
                                        <CheckCircle2 size={18} aria-hidden="true" />
                                    )}
                                </span>
                                <span className="flex min-w-0 flex-col justify-center">
                                    <span className="mb-1.5 flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-muted">
                                        <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
                                        {formatPreparednessState(skill.state)}
                                    </span>
                                    <span className={cn("block text-sm font-bold leading-5", styles.title)}>{skill.label}</span>
                                </span>
                            </span>
                            <ArrowRight
                                size={18}
                                className="relative z-10 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                                aria-hidden="true"
                            />
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

export function PracticeNextCard({
    title,
    body,
    href,
    actionLabel,
    items = [],
}: {
    title: string;
    body: string;
    href: string;
    actionLabel: string;
    items?: PracticeNextListItem[];
}) {
    return (
        <section aria-label="Practice next" className="surface-sky border border-[rgb(var(--candidate-border)/0.78)] p-5 md:p-6">
            <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-flat">
                    <Sparkles size={20} aria-hidden="true" />
                </span>
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Practice next</p>
                    <h2 className="mt-2 text-xl font-bold leading-tight text-text-primary">{title}</h2>
                </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-text-secondary">{body}</p>
            {items.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-primary/12 bg-white/68 p-3 shadow-flat">
                    <p className="px-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-text-muted">
                        Upcoming practice items
                    </p>
                    <ul className="mt-2 space-y-2">
                        {items.map((item) => {
                            const styles = getPreparednessStateStyles(item.state);
                            return (
                                <li key={item.id} className="rounded-xl bg-white px-3 py-2 shadow-[0_1px_0_rgb(var(--candidate-border)/0.72)]">
                                    <div className="flex items-start gap-2.5">
                                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", styles.dot)} aria-hidden="true" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold leading-5 text-text-primary">{item.label}</p>
                                            <p className="mt-0.5 text-xs font-semibold leading-5 text-text-secondary">{item.detail}</p>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : null}
            <Button asChild emphasis="primary" density="comfortable" shape="app" label="strong" className="mt-5 w-full">
                <Link href={href}>
                    {actionLabel}
                    <ArrowRight size={17} className="ml-2" aria-hidden="true" />
                </Link>
            </Button>
        </section>
    );
}

export function SkillDrilldown({
    skill,
    onClose,
}: {
    skill: PreparednessSkill;
    onClose: () => void;
}) {
    const styles = getPreparednessStateStyles(skill.state);
    const [selectedEvidence, setSelectedEvidence] = useState<PreparednessEvidence | null>(null);

    return (
        <>
            <div
                data-testid="preparedness-drilldown-backdrop"
                className="fixed inset-0 z-50 flex items-start bg-slate-950/55 backdrop-blur-sm md:items-center md:justify-center"
                onPointerDown={(event) => {
                    if (event.target === event.currentTarget) {
                        onClose();
                    }
                }}
            >
                <section
                    role="dialog"
                    aria-modal="true"
                    aria-label={skill.label}
                    className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-b-[1.75rem] border border-[rgb(var(--candidate-border)/0.92)] bg-white shadow-[var(--candidate-shadow-panel)] md:w-[42rem] md:max-w-[calc(100vw-2rem)] md:rounded-[1.75rem]"
                >
                    <div className="sticky top-0 z-10 space-y-4 border-b border-[rgb(var(--candidate-border)/0.7)] bg-white p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", styles.badge)}>
                                    {formatPreparednessState(skill.state)}
                                </span>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <h2 className="min-w-0 text-2xl font-bold leading-tight text-text-primary">{skill.label}</h2>
                                    <p className="text-left text-xs font-bold leading-5 text-primary sm:ml-auto sm:max-w-[22rem] sm:text-right">
                                        Tap/click any card below to see coach guidance.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
                                aria-label="Close"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        </div>
                        <section className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-primary">Why this matters</h3>
                            <p className="mt-3 text-sm leading-6 text-text-secondary">{skill.whyItMatters}</p>
                        </section>
                    </div>
                    <div className="custom-scrollbar flex-1 overflow-y-auto p-5 md:p-6">
                        {skill.evidence.length > 0 ? (
                            <EvidenceSessionStack
                                evidence={skill.evidence}
                                onSelect={setSelectedEvidence}
                            />
                        ) : (
                            <p className="rounded-2xl bg-surface-base p-4 text-sm leading-6 text-text-secondary">
                                Complete a baseline practice round to add evidence here.
                            </p>
                        )}
                    </div>
                </section>
            </div>
            {selectedEvidence ? (
                <EvidenceEvaluationModal
                    evidence={selectedEvidence}
                    onClose={() => setSelectedEvidence(null)}
                />
            ) : null}
        </>
    );
}

export function QuestionCategoryDrilldown({
    category,
    onClose,
}: {
    category: QuestionCategoryDrilldownModel;
    onClose: () => void;
}) {
    const styles = getPreparednessStateStyles(category.state);
    const [selectedEvidence, setSelectedEvidence] = useState<PreparednessEvidence | null>(null);

    return (
        <>
            <div
                data-testid="question-category-drilldown-backdrop"
                className="fixed inset-0 z-50 flex items-start bg-slate-950/55 backdrop-blur-sm md:items-center md:justify-center"
                onPointerDown={(event) => {
                    if (event.target === event.currentTarget) {
                        onClose();
                    }
                }}
            >
                <section
                    role="dialog"
                    aria-modal="true"
                    aria-label={category.label}
                    className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-b-[1.75rem] border border-[rgb(var(--candidate-border)/0.92)] bg-white shadow-[var(--candidate-shadow-panel)] md:w-[42rem] md:max-w-[calc(100vw-2rem)] md:rounded-[1.75rem]"
                >
                    <div className="sticky top-0 z-10 space-y-4 border-b border-[rgb(var(--candidate-border)/0.7)] bg-white p-5 md:p-6">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", styles.badge)}>
                                    {formatPreparednessState(category.state)}
                                </span>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold leading-tight text-text-primary">{category.label}</h2>
                                        <p className="mt-2 text-sm font-semibold text-text-secondary">
                                            {formatQuestionStatusSummary(category)}
                                        </p>
                                    </div>
                                    <p className="text-left text-xs font-bold leading-5 text-primary sm:ml-auto sm:max-w-[22rem] sm:text-right">
                                        Tap/click any card below to see coach guidance.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
                                aria-label="Close"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        </div>
                        <p className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm leading-6 text-text-secondary">
                            {category.whyItMatters}
                        </p>
                    </div>
                    <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
                        {category.evidence.length > 0 ? (
                            <EvidenceSessionStack
                                evidence={category.evidence}
                                onSelect={setSelectedEvidence}
                            />
                        ) : (
                            <p className="rounded-2xl bg-surface-base p-4 text-sm leading-6 text-text-secondary">
                                Complete a practice question in this category to add evidence here.
                            </p>
                        )}
                    </div>
                </section>
            </div>
            {selectedEvidence ? (
                <EvidenceEvaluationModal
                    evidence={selectedEvidence}
                    onClose={() => setSelectedEvidence(null)}
                />
            ) : null}
        </>
    );
}

function EvidenceSessionStack({
    evidence,
    onSelect,
}: {
    evidence: PreparednessEvidence[];
    onSelect: (item: PreparednessEvidence) => void;
}) {
    const groups = groupEvidenceBySession(evidence);
    const [openGroups, setOpenGroups] = useState(() => new Set(groups.slice(0, 1).map((group) => group.id)));

    return (
        <div className="space-y-4">
            {groups.map((group) => {
                const isOpen = openGroups.has(group.id);

                return (
                    <section
                        key={group.id}
                        className="rounded-2xl border border-[rgb(var(--candidate-border)/0.56)] bg-surface-base/70 p-3"
                    >
                        <button
                            type="button"
                            className="flex w-full items-start justify-between gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white"
                            onClick={() => {
                                setOpenGroups((current) => {
                                    const next = new Set(current);
                                    if (next.has(group.id)) {
                                        next.delete(group.id);
                                    } else {
                                        next.add(group.id);
                                    }
                                    return next;
                                });
                            }}
                            aria-expanded={isOpen}
                        >
                            <span className="min-w-0">
                                <span className="block text-base font-bold leading-5 text-text-primary">{group.title}</span>
                                <span className="mt-1 block text-xs font-semibold leading-5 text-text-muted">{group.meta}</span>
                            </span>
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-primary shadow-[0_6px_18px_rgb(15_23_42/0.05)]">
                                {isOpen ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                            </span>
                        </button>
                        {isOpen ? (
                            <div className="mt-3 grid gap-4">
                                {group.items.map((item, index) => (
                                    <EvidenceCard
                                        key={`${item.type}-${item.questionText ?? item.content}-${item.answerSubmittedAt ?? index}`}
                                        item={item}
                                        onSelect={() => item.evaluation ? onSelect(item) : undefined}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </section>
                );
            })}
        </div>
    );
}

function EvidenceCard({
    item,
    onSelect,
}: {
    item: PreparednessEvidence;
    onSelect?: () => void;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const isQuestionAnswer = Boolean(item.questionText || item.answerTranscript);
    const content = isQuestionAnswer ? item.answerTranscript || "No answer transcript captured." : item.content;
    const mode = item.answerModality ? `${titleCase(item.answerModality)} response` : "Practice";
    const practiceDate = item.answerSubmittedAt ? formatPracticeDate(item.answerSubmittedAt) : null;
    const canExpand = content.length > 260;
    const className = "flex w-full gap-3 rounded-2xl border border-[rgb(var(--candidate-border)/0.58)] bg-white p-5 text-left shadow-[0_10px_28px_rgb(15_23_42/0.045)] transition-colors hover:border-primary/25 hover:shadow-[0_14px_34px_rgb(15_23_42/0.07)]";
    const body = (
        <>
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {getEvidenceIcon(item)}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <span className="text-[0.66rem] font-bold uppercase tracking-wider text-text-muted">{mode}</span>
                    {practiceDate ? (
                        <span className="text-[0.66rem] font-semibold leading-5 text-text-muted sm:text-right">
                            <span className="font-bold text-text-secondary">Practiced:</span> {practiceDate}
                        </span>
                    ) : null}
                </span>
                {item.questionText ? (
                    <span className="mt-1 block text-sm font-bold leading-6 text-text-primary">{item.questionText}</span>
                ) : null}
                <span
                    className={cn(
                        "mt-2 block overflow-hidden text-sm leading-6 text-text-secondary",
                        canExpand && !isExpanded ? "max-h-24" : "",
                    )}
                >
                    {content}
                </span>
                {canExpand ? (
                    <button
                        type="button"
                        className="-ml-3 mt-2 min-h-10 rounded-xl px-3 text-sm font-bold text-primary hover:bg-primary/5"
                        onClick={(event) => {
                            event.stopPropagation();
                            setIsExpanded((value) => !value);
                        }}
                    >
                        {isExpanded ? "Show less" : "Show more"}
                    </button>
                ) : null}
            </span>
        </>
    );

    if (onSelect && item.evaluation) {
        return (
            <div
                role="button"
                tabIndex={0}
                aria-label={`Open coach guidance for ${item.questionText || getEvidenceLabel(item.type)}`}
                className={className}
                onClick={onSelect}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect();
                    }
                }}
            >
                {body}
            </div>
        );
    }

    return <div className={className}>{body}</div>;
}

function EvidenceEvaluationModal({
    evidence,
    onClose,
}: {
    evidence: PreparednessEvidence;
    onClose: () => void;
}) {
    return (
        <div
            data-testid="evidence-evaluation-backdrop"
            className="fixed inset-0 z-[60] flex items-start bg-slate-950/55 backdrop-blur-sm md:items-center md:justify-center"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-label="Guidance"
                className="flex max-h-[84dvh] w-full flex-col overflow-hidden rounded-b-[1.5rem] border border-[rgb(var(--candidate-border)/0.92)] bg-white shadow-[var(--candidate-shadow-panel)] md:w-[42rem] md:max-w-[calc(100vw-2rem)] md:rounded-[1.5rem]"
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[rgb(var(--candidate-border)/0.7)] bg-white p-5">
                    <div>
                        <h3 className="text-xl font-bold leading-tight text-text-primary">{evidence.questionText || "Practice evidence"}</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
                        aria-label="Close guidance"
                    >
                        <X size={20} aria-hidden="true" />
                    </button>
                </div>
                <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
                    <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">My Read</p>
                        <MyReadContent evaluation={evidence.evaluation} />
                    </section>
                </div>
            </section>
        </div>
    );
}

type MyReadSection = {
    summary?: string;
    stoodOut: Array<{
        label: string;
        body: string;
    }>;
    biggestLift?: string;
    trySayingThis?: string;
    nextStep?: string;
    fallback?: string;
};

function MyReadContent({ evaluation }: { evaluation?: string }) {
    const read = parseMyRead(evaluation);

    if (read.fallback) {
        return <p className="mt-3 text-sm leading-7 text-text-secondary">{read.fallback}</p>;
    }

    return (
        <div className="mt-4 space-y-5">
            {read.summary ? (
                <section>
                    <h4 className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-text-muted">Overall read</h4>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">{read.summary}</p>
                </section>
            ) : null}

            {read.stoodOut.length > 0 ? (
                <section>
                    <h4 className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-text-muted">What stood out</h4>
                    <ul className="mt-2 space-y-3">
                        {read.stoodOut.map((item) => (
                            <li key={`${item.label}-${item.body}`} className="rounded-2xl border border-primary/10 bg-white/74 px-3 py-3">
                                <p className="text-xs font-black uppercase tracking-[0.12em] text-primary">{item.label}</p>
                                <p className="mt-1 text-sm leading-6 text-text-secondary">{item.body}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}

            {read.biggestLift || read.trySayingThis ? (
                <section className="rounded-2xl bg-white/80 px-3 py-3">
                    <h4 className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-text-muted">For the biggest lift</h4>
                    {read.biggestLift ? <p className="mt-2 text-sm leading-6 text-text-secondary">{read.biggestLift}</p> : null}
                    {read.trySayingThis ? (
                        <p className="mt-3 border-l-2 border-primary/30 pl-3 text-sm font-semibold leading-6 text-text-primary">
                            {read.trySayingThis}
                        </p>
                    ) : null}
                </section>
            ) : null}

            {read.nextStep ? (
                <section>
                    <h4 className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-text-muted">Next step</h4>
                    <p className="mt-2 text-sm leading-7 text-text-secondary">{read.nextStep}</p>
                </section>
            ) : null}
        </div>
    );
}

export function EmptyPreparednessDashboard({ href = "/practice" }: { href?: string }) {
    const previewSnapshot: InstantReadPreparednessModel = {
        overallRead: {
            label: "Your practice map starts here",
            state: "not_practiced",
            summary: "After your first round, these charts show how your answer skills and question types are taking shape.",
        },
        lanes: [
            {
                id: "answer_substance",
                label: "Answer Substance",
                state: "not_practiced",
                evidenceLevel: "none",
            },
            {
                id: "interview_structure",
                label: "Interview Structure",
                state: "not_practiced",
                evidenceLevel: "none",
            },
            {
                id: "communication_delivery",
                label: "Communication Delivery",
                state: "not_practiced",
                evidenceLevel: "none",
            },
        ],
        categoryCoverage: [
            {
                categoryId: "behavioral",
                label: "Behavioral",
                plannedCount: 1,
                practicedCount: 0,
                upcomingCount: 1,
                state: "not_practiced",
            },
            {
                categoryId: "culture_fit",
                label: "Culture / Fit",
                plannedCount: 1,
                practicedCount: 0,
                upcomingCount: 1,
                state: "not_practiced",
            },
            {
                categoryId: "technical_role_specific",
                label: "Technical / Role-Specific",
                plannedCount: 1,
                practicedCount: 0,
                upcomingCount: 1,
                state: "not_practiced",
            },
            {
                categoryId: "case_scenario",
                label: "Case / Scenario",
                plannedCount: 1,
                practicedCount: 0,
                upcomingCount: 1,
                state: "not_practiced",
            },
            {
                categoryId: "screening",
                label: "Screening",
                plannedCount: 1,
                practicedCount: 0,
                upcomingCount: 1,
                state: "not_practiced",
            },
        ],
    };

    return (
        <section aria-label="Empty preparedness dashboard" className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 md:px-8 md:py-10 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-10 xl:items-start">
            <div className="space-y-8">
                <div className="max-w-2xl">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-primary/10 text-primary shadow-flat">
                        <Sparkles size={28} aria-hidden="true" />
                    </div>
                    <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                        Start with the interview you want to prepare for.
                    </h2>
                    <p className="mt-3 max-w-xl text-base leading-7 text-text-secondary">
                        Create a practice round with a target role and job description. After your first completed round, this dashboard will show your preparedness areas, question coverage, and next coaching step.
                    </p>
                </div>

                <div
                    aria-label="Preview of your preparedness map"
                    className="space-y-4"
                >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h3 className="font-display text-2xl font-bold tracking-tight text-text-primary">Preparedness map preview</h3>
                            <p className="mt-1 text-sm leading-6 text-text-secondary">
                                Your first completed round fills in these two views.
                            </p>
                        </div>
                        <span className="inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                            Template view
                        </span>
                    </div>

                    <PreparednessInstantRead snapshot={previewSnapshot} showHeader={false} preview />
                </div>
            </div>

            <div className="rounded-[1.5rem] border border-[rgb(var(--candidate-border)/0.82)] bg-gradient-to-br from-surface-subtle to-surface-base p-5 shadow-[var(--candidate-shadow-card)] xl:sticky xl:top-8">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-flat">
                        <Sparkles size={22} aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Practice next</p>
                        <h3 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-text-primary">Create your first round</h3>
                    </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-text-secondary">
                    Start with the role and job description. Your first completed practice creates the evidence this dashboard uses.
                </p>
                <Button asChild emphasis="primary" density="hero" shape="app" label="strong" className="mt-5 w-full">
                    <Link href={href} className="gap-2">
                        Create practice
                        <ArrowRight size={18} aria-hidden="true" />
                    </Link>
                </Button>
            </div>
        </section>
    );
}

export function RecentActivityList({ items }: { items: CandidateDashboardItem[] }) {
    return (
        <section aria-label="Recent activity" className="space-y-3">
            <h2 className="text-lg font-bold text-text-primary">Recent activity</h2>
            {items.length > 0 ? (
                <div className="grid gap-3">
                    {items.map((item) => (
                        <article key={`${item.practiceDraftId}-${item.href}`} className="rounded-2xl border border-[rgb(var(--candidate-border)/0.78)] bg-white p-4 shadow-flat">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-text-primary">{item.title}</h3>
                                    <p className="mt-1 text-sm leading-6 text-text-secondary">{item.progressLabel}</p>
                                </div>
                                <Link href={item.href} className="shrink-0 text-sm font-bold text-primary hover:underline">
                                    {item.statusLabel === "Completed" ? "Summary" : "Open"}
                                </Link>
                            </div>
                            {item.coachingSnippet || item.summarySnippet ? (
                                <p className="mt-3 rounded-xl bg-surface-base px-3 py-2 text-sm leading-6 text-text-secondary">
                                    {item.coachingSnippetLabel ? <span className="font-bold text-text-primary">{item.coachingSnippetLabel}: </span> : null}
                                    {item.coachingSnippet || item.summarySnippet}
                                </p>
                            ) : null}
                        </article>
                    ))}
                </div>
            ) : (
                <p className="rounded-2xl border border-[rgb(var(--candidate-border)/0.78)] bg-white p-4 text-sm leading-6 text-text-secondary shadow-flat">
                    Practice activity will appear here after you create a round.
                </p>
            )}
        </section>
    );
}

export function toPreparednessSkills({
    latestItem,
    items,
    fallbackHref,
}: {
    latestItem: CandidateDashboardItem | null;
    items?: CandidateDashboardItem[];
    fallbackHref: string;
}): PreparednessSkill[] {
    const primary = latestItem?.prepProfile?.primarySignal;
    const recommendation = latestItem?.prepProfile?.recommendation;
    const scopedItems = items?.length ? items : latestItem ? [latestItem] : [];
    const evidenceOrderedItems = [...scopedItems].sort((a, b) => a.lastActivityAt - b.lastActivityAt);
    const readModelSignals = evidenceOrderedItems.flatMap((item) => (item.prepProfile?.signals ?? []).map((signal) => ({
        ...signal,
        sourceRefs: signal.sourceRefs.map((ref) => withSessionContext(ref, item)),
    })));
    if (readModelSignals.length > 0) {
        return PREPAREDNESS_LANES.map((lane) => toPreparednessSkillFromLane({
            lane,
            signals: readModelSignals.filter((signal) => signal.lane === lane.id),
            href: recommendation?.href || latestItem?.href || fallbackHref,
            recommendationReason: recommendation?.reason,
        }));
    }

    const firstLabel = primary?.label || "Answer structure";
    const firstState = primary?.state || (latestItem ? "emerging" : "not_practiced");
    const evidence = compactEvidence([
        latestItem?.progressLabel ? { type: "practice" as const, content: latestItem.progressLabel } : null,
        latestItem?.coachingSnippet ? { type: "practice" as const, content: latestItem.coachingSnippet } : null,
        latestItem?.summarySnippet ? { type: "practice" as const, content: latestItem.summarySnippet } : null,
        latestItem?.roleContextLabel ? { type: "job-description" as const, content: latestItem.roleContextLabel } : null,
    ]);
    const href = recommendation?.href || latestItem?.href || fallbackHref;

    return [
        {
            id: "primary",
            label: firstLabel,
            state: firstState,
            evidenceCounts: evidenceCountFor(firstState),
            whyItMatters: "Interviewers need an answer they can follow, remember, and connect back to the role.",
            evidence,
            nextPracticeAction: recommendation?.reason || "Practice this area in your next round so the dashboard can add clearer evidence.",
            href,
        },
        {
            id: "specific-examples",
            label: "Specific examples",
            state: inferState(latestItem, "specific"),
            evidenceCounts: evidenceCountFor(inferState(latestItem, "specific")),
            whyItMatters: "Concrete examples help the interviewer see what you personally did, not just what the team handled.",
            evidence,
            nextPracticeAction: "Use one story with details about the situation, your action, and what changed.",
            href: fallbackHref,
        },
        {
            id: "role-connection",
            label: "Role connection",
            state: latestItem?.roleContextLabel ? "clear" : "not_practiced",
            evidenceCounts: evidenceCountFor(latestItem?.roleContextLabel ? "clear" : "not_practiced"),
            whyItMatters: "Strong answers make it clear why your experience fits this specific interview.",
            evidence,
            nextPracticeAction: "Tie one answer directly to a responsibility or requirement from the job description.",
            href: fallbackHref,
        },
        {
            id: "impact-outcomes",
            label: "Impact and outcomes",
            state: inferState(latestItem, "outcome"),
            evidenceCounts: evidenceCountFor(inferState(latestItem, "outcome")),
            whyItMatters: "Outcomes show that your work made a difference and help interviewers judge the strength of your example.",
            evidence,
            nextPracticeAction: "Add the result, impact, or lesson learned to the end of your answer.",
            href: fallbackHref,
        },
        {
            id: "question-coverage",
            label: "Question coverage",
            state: latestItem ? "emerging" : "not_practiced",
            evidenceCounts: evidenceCountFor(latestItem ? "emerging" : "not_practiced"),
            whyItMatters: "A good practice path should cover enough interview moments to prepare you for different directions.",
            evidence,
            nextPracticeAction: "Complete another round to broaden the kinds of questions you have practiced.",
            href: fallbackHref,
        },
        {
            id: "delivery-clarity",
            label: "Delivery clarity",
            state: "not_practiced",
            evidenceCounts: evidenceCountFor("not_practiced"),
            whyItMatters: "Clear delivery helps the content land, especially when the answer includes several moving parts.",
            evidence: [],
            nextPracticeAction: "Record a voice answer and listen for pacing, pauses, and clarity.",
            href: fallbackHref,
        },
        {
            id: "confidence",
            label: "Confidence",
            state: "not_practiced",
            evidenceCounts: evidenceCountFor("not_practiced"),
            whyItMatters: "Confidence checks help you notice whether practice is making the interview feel more manageable.",
            evidence: [],
            nextPracticeAction: "Complete a before-and-after confidence check in your next practice round.",
            href: fallbackHref,
        },
    ];
}

export function toQuestionCategoryCards(items: CandidateDashboardItem[]): PrepQuestionCategoryCard[] {
    const merged = new Map<PrepQuestionCategoryCard["categoryId"], PrepQuestionCategoryCard>();

    for (const card of items.flatMap((item) => (item.prepProfile?.categoryCards ?? []).map((categoryCard) => ({
        ...categoryCard,
        sourceRefs: categoryCard.sourceRefs.map((ref) => withSessionContext(ref, item)),
    })))) {
        const current = merged.get(card.categoryId);
        if (!current) {
            merged.set(card.categoryId, { ...card, sourceRefs: [...card.sourceRefs] });
            continue;
        }

        const averageScore = mergeAverageScore(current, card);
        const evidenceState = averageScore === undefined
            ? strongerCategoryState(current.evidenceState, card.evidenceState)
            : scoreToPreparednessState(averageScore);
        const practicedQuestionCount = (current.practicedQuestionCount ?? practicedQuestionCountFor(current)) +
            (card.practicedQuestionCount ?? practicedQuestionCountFor(card));
        const upcomingQuestionCount = (current.upcomingQuestionCount ?? upcomingQuestionCountFor(current)) +
            (card.upcomingQuestionCount ?? upcomingQuestionCountFor(card));

        merged.set(card.categoryId, {
            ...current,
            questionCount: current.questionCount + card.questionCount,
            practicedQuestionCount,
            upcomingQuestionCount,
            questionStatuses: [...(current.questionStatuses ?? questionStatusesFor(current)), ...(card.questionStatuses ?? questionStatusesFor(card))]
                .sort((a, b) => a.questionNumber - b.questionNumber),
            evidenceState,
            averageScore,
            laneStates: mergeCategoryLaneStates(current.laneStates, card.laneStates),
            sourceRefs: [...current.sourceRefs, ...card.sourceRefs],
        });
    }

    return Array.from(merged.values()).sort(sortQuestionCategoryCards);
}

export function withPracticeCoverageBaselineCategories(
    categories: PrepQuestionCategoryCard[],
    items: CandidateDashboardItem[],
): PrepQuestionCategoryCard[] {
    const minimums = mergeCoverageMinimums(items);
    const merged = new Map<PrepQuestionCategoryCard["categoryId"], PrepQuestionCategoryCard>(
        categories.map((category) => [category.categoryId, { ...category }]),
    );

    for (const categoryId of CATEGORY_CARD_ORDER) {
        const required = minimums[categoryId] ?? 0;
        if (required <= 0) {
            continue;
        }

        const current = merged.get(categoryId);
        if (!current) {
            merged.set(categoryId, {
                categoryId,
                label: formatQuestionCategoryLabel(categoryId),
                questionCount: required,
                practicedQuestionCount: 0,
                upcomingQuestionCount: required,
                questionStatuses: [],
                evidenceState: "not_practiced",
                laneStates: createNotPracticedLaneStates(),
                sourceRefs: [],
            });
            continue;
        }

        const practicedQuestionCount = current.practicedQuestionCount ?? practicedQuestionCountFor(current);
        const plannedQuestionCount = Math.max(current.questionCount, required);
        merged.set(categoryId, {
            ...current,
            questionCount: plannedQuestionCount,
            practicedQuestionCount,
            upcomingQuestionCount: Math.max(current.upcomingQuestionCount ?? upcomingQuestionCountFor(current), plannedQuestionCount - practicedQuestionCount),
        });
    }

    return Array.from(merged.values()).sort(sortQuestionCategoryCards);
}

export function toQuestionCategoryDrilldowns(categories: PrepQuestionCategoryCard[]): QuestionCategoryDrilldownModel[] {
    return categories.map((category) => ({
        id: category.categoryId,
        label: category.label,
        state: category.evidenceState,
        questionCount: category.questionCount,
        practicedQuestionCount: category.practicedQuestionCount ?? practicedQuestionCountFor(category),
        upcomingQuestionCount: category.upcomingQuestionCount ?? upcomingQuestionCountFor(category),
        questionStatuses: category.questionStatuses ?? questionStatusesFor(category),
        whyItMatters: getCategoryWhyItMatters(category.categoryId),
        evidence: category.sourceRefs
            .map(toPreparednessEvidence)
            .filter((item): item is PreparednessEvidence => Boolean(item)),
    }));
}

export function toPreparednessMatrix(
    skills: PreparednessSkill[],
    categories: PrepQuestionCategoryCard[],
): PreparednessMatrixModel {
    const categoryEvidenceById = new Map<PrepQuestionCategoryCard["categoryId"], PreparednessEvidence[]>();
    for (const category of categories) {
        categoryEvidenceById.set(category.categoryId, category.sourceRefs
            .map(toPreparednessEvidence)
            .filter((item): item is PreparednessEvidence => Boolean(item)));
    }

    const rows = skills.map((skill) => {
        const cells = categories.map((category) => {
            const categoryEvidence = categoryEvidenceById.get(category.categoryId) ?? [];
            const categoryEvidenceKeys = new Set(categoryEvidence.map(evidenceIdentity));
            const cellEvidence = skill.evidence.filter((item) => categoryEvidenceKeys.has(evidenceIdentity(item)));
            const laneState = category.laneStates?.[skill.id as ReleasePrepSignalLane];
            const state = laneState?.evidenceState ?? (cellEvidence.length > 0 ? skill.state : "not_practiced");

            return {
                id: `${skill.id}:${category.categoryId}`,
                laneId: skill.id,
                laneLabel: skill.label,
                categoryId: category.categoryId,
                categoryLabel: category.label,
                label: `${category.label} - ${skill.label}`,
                state,
                questionCount: category.questionCount,
                practicedQuestionCount: category.practicedQuestionCount ?? practicedQuestionCountFor(category),
                upcomingQuestionCount: category.upcomingQuestionCount ?? upcomingQuestionCountFor(category),
                questionStatuses: category.questionStatuses ?? questionStatusesFor(category),
                whyItMatters: `${skill.whyItMatters} ${getCategoryWhyItMatters(category.categoryId)}`,
                evidence: cellEvidence,
            };
        });

        return { skill, cells };
    });

    return {
        categories,
        rows,
        cells: rows.flatMap((row) => row.cells),
    };
}

export function toPracticeNextItems({
    activeItems,
    completedItems = [],
    matrix,
    categories,
}: {
    activeItems: CandidateDashboardItem[];
    completedItems?: CandidateDashboardItem[];
    matrix: PreparednessMatrixModel;
    categories: PrepQuestionCategoryCard[];
}): PracticeNextListItem[] {
    if (activeItems.length > 0) {
        const activeItem = activeItems[0];
        return categories.flatMap((category) => {
            const statuses = category.questionStatuses ?? [];
            return statuses
                .filter((status) => status.status === "upcoming")
                .map((status) => ({
                    id: `${activeItem.practiceDraftId}:${category.categoryId}:${status.questionId}`,
                    label: `Q${status.questionNumber}: ${category.label}`,
                    detail: `Waiting in your active ${activeItem.title} practice round.`,
                    state: "not_practiced" as const,
                }));
        });
    }

    const baselineGaps = toPracticeCoverageGapItems(completedItems, categories);
    if (baselineGaps.length > 0) {
        return [
            ...baselineGaps,
            ...matrix.cells
                .filter((cell) => cell.state !== "strong")
                .sort(sortPracticeNextCells)
                .map((cell) => ({
                    id: cell.id,
                    label: `${cell.categoryLabel} - ${formatMatrixLaneLabel(cell.laneLabel)}`,
                    detail: practiceNextCellDetail(cell),
                    state: cell.state,
                })),
        ];
    }

    const plannedCells = matrix.cells
        .filter((cell) => cell.state !== "strong")
        .sort(sortPracticeNextCells);

    if (plannedCells.length > 0) {
        return plannedCells.map((cell) => ({
            id: cell.id,
            label: `${cell.categoryLabel} - ${formatMatrixLaneLabel(cell.laneLabel)}`,
            detail: practiceNextCellDetail(cell),
            state: cell.state,
        }));
    }

    return matrix.rows.map((row) => ({
        id: `keep-sharp:${row.skill.id}`,
        label: `Keep ${formatMatrixLaneLabel(row.skill.label).toLowerCase()} sharp`,
        detail: row.skill.nextPracticeAction,
        state: row.skill.state,
    }));
}

function toPracticeCoverageGapItems(
    completedItems: CandidateDashboardItem[],
    categories: PrepQuestionCategoryCard[],
): PracticeNextListItem[] {
    const categoryById = new Map(categories.map((category) => [category.categoryId, category]));
    const minimums = mergeCoverageMinimums(completedItems);

    return PRACTICE_COVERAGE_ORDER.flatMap((categoryId) => {
        const required = minimums[categoryId] ?? 0;
        if (required <= 0) {
            return [];
        }
        const category = categoryById.get(categoryId);
        const practiced = category
            ? category.practicedQuestionCount ?? practicedQuestionCountFor(category)
            : 0;
        const remaining = Math.max(required - practiced, 0);
        if (remaining <= 0) {
            return [];
        }

        return [{
            id: `coverage:${categoryId}`,
            label: `${formatQuestionCategoryLabel(categoryId)} coverage`,
            detail: `Practice ${remaining} more ${remaining === 1 ? "question" : "questions"} in this area for the planned interview scope.`,
            state: "not_practiced" as const,
        }];
    });
}

function mergeCoverageMinimums(
    items: CandidateDashboardItem[],
): Partial<Record<PrepQuestionCategoryCard["categoryId"], number>> {
    return items.reduce<Partial<Record<PrepQuestionCategoryCard["categoryId"], number>>>((minimums, item) => {
        const categoryMinimums = item.practiceCoverageBaseline?.categoryMinimums;
        if (!categoryMinimums) {
            return minimums;
        }

        for (const categoryId of CATEGORY_CARD_ORDER) {
            minimums[categoryId] = Math.max(minimums[categoryId] ?? 0, categoryMinimums[categoryId] ?? 0);
        }

        return minimums;
    }, {});
}

function createNotPracticedLaneStates(): NonNullable<PrepQuestionCategoryCard["laneStates"]> {
    return {
        answer_substance: { evidenceState: "not_practiced", scoreCount: 0 },
        interview_structure: { evidenceState: "not_practiced", scoreCount: 0 },
        communication_delivery: { evidenceState: "not_practiced", scoreCount: 0 },
    };
}

export function toInstantReadPreparednessModel(
    skills: PreparednessSkill[],
    categories: PrepQuestionCategoryCard[],
): InstantReadPreparednessModel {
    const lanes = skills.map((skill) => ({
        id: skill.id,
        label: skill.label,
        state: skill.state,
        evidenceLevel: evidenceLevelForSkill(skill),
        fillPercent: getPreparednessFillPercent(skill),
        dimensionStates: skill.dimensionStates,
    }));
    const practicedCategories = categories.filter((category) => (category.practicedQuestionCount ?? practicedQuestionCountFor(category)) > 0);
    const overallState = deriveOverallInstantReadState(lanes);

    return {
        overallRead: {
            label: overallReadLabel(overallState, lanes, practicedCategories.length),
            state: overallState,
            summary: overallReadSummary(overallState, lanes, categories),
        },
        lanes,
        categoryCoverage: categories.map((category) => ({
            categoryId: category.categoryId,
            label: category.label,
            plannedCount: category.questionCount,
            practicedCount: category.practicedQuestionCount ?? practicedQuestionCountFor(category),
            upcomingCount: category.upcomingQuestionCount ?? Math.max(
                category.questionCount - (category.practicedQuestionCount ?? practicedQuestionCountFor(category)),
                0,
            ),
            state: category.evidenceState,
        })),
    };
}

function sortPracticeNextCells(a: PreparednessMatrixCell, b: PreparednessMatrixCell): number {
    const stateRank: Record<PreparednessState, number> = {
        not_practiced: 0,
        emerging: 1,
        clear: 2,
        strong: 3,
    };
    const state = stateRank[a.state] - stateRank[b.state];
    if (state !== 0) {
        return state;
    }

    const category = CATEGORY_CARD_ORDER.indexOf(a.categoryId) - CATEGORY_CARD_ORDER.indexOf(b.categoryId);
    if (category !== 0) {
        return category;
    }

    return a.laneLabel.localeCompare(b.laneLabel);
}

function practiceNextCellDetail(cell: PreparednessMatrixCell): string {
    switch (cell.state) {
        case "not_practiced":
            return `Practice this question type with ${formatMatrixLaneLabel(cell.laneLabel).toLowerCase()} in mind.`;
        case "emerging":
            return `Build clearer evidence for ${formatMatrixLaneLabel(cell.laneLabel).toLowerCase()} in this question type.`;
        case "clear":
            return `Turn a clear answer pattern into a stronger one.`;
        case "strong":
        default:
            return `Keep this strength consistent in another round.`;
    }
}

const CATEGORY_CARD_ORDER: PrepQuestionCategoryCard["categoryId"][] = [
    "behavioral",
    "culture_fit",
    "technical_role_specific",
    "case_scenario",
    "screening",
];

const PRACTICE_COVERAGE_ORDER: PrepQuestionCategoryCard["categoryId"][] = [
    "screening",
    "behavioral",
    "culture_fit",
    "case_scenario",
    "technical_role_specific",
];

function formatQuestionCategoryLabel(categoryId: PrepQuestionCategoryCard["categoryId"]): string {
    switch (categoryId) {
        case "culture_fit":
            return "Culture / Fit";
        case "technical_role_specific":
            return "Technical / Role-Specific";
        case "case_scenario":
            return "Case / Scenario";
        case "screening":
            return "Screening";
        case "behavioral":
        default:
            return "Behavioral";
    }
}

function sortQuestionCategoryCards(a: PrepQuestionCategoryCard, b: PrepQuestionCategoryCard): number {
    const stateRank: Record<PreparednessState, number> = {
        not_practiced: 0,
        emerging: 1,
        clear: 2,
        strong: 3,
    };
    const state = stateRank[a.evidenceState] - stateRank[b.evidenceState];
    if (state !== 0) {
        return state;
    }

    return CATEGORY_CARD_ORDER.indexOf(a.categoryId) - CATEGORY_CARD_ORDER.indexOf(b.categoryId);
}

function mergeAverageScore(current: PrepQuestionCategoryCard, next: PrepQuestionCategoryCard): number | undefined {
    if (current.averageScore === undefined) {
        return next.averageScore;
    }
    if (next.averageScore === undefined) {
        return current.averageScore;
    }

    const currentWeight = current.practicedQuestionCount ?? practicedQuestionCountFor(current);
    const nextWeight = next.practicedQuestionCount ?? practicedQuestionCountFor(next);
    const weightTotal = currentWeight + nextWeight;
    if (weightTotal === 0) {
        return undefined;
    }

    const weighted = ((current.averageScore * currentWeight) + (next.averageScore * nextWeight)) / weightTotal;
    return Math.round(weighted * 100) / 100;
}

function mergeCategoryLaneStates(
    current: PrepQuestionCategoryCard["laneStates"],
    next: PrepQuestionCategoryCard["laneStates"],
): PrepQuestionCategoryCard["laneStates"] {
    if (!current) {
        return next;
    }
    if (!next) {
        return current;
    }

    const merged: NonNullable<PrepQuestionCategoryCard["laneStates"]> = { ...current };
    const laneIds: ReleasePrepSignalLane[] = ["answer_substance", "interview_structure", "communication_delivery"];
    for (const laneId of laneIds) {
        const currentState = current[laneId];
        const nextState = next[laneId];
        if (!currentState) {
            merged[laneId] = nextState;
            continue;
        }
        if (!nextState) {
            merged[laneId] = currentState;
            continue;
        }

        const totalWeight = currentState.scoreCount + nextState.scoreCount;
        if (totalWeight === 0 || currentState.averageScore === undefined || nextState.averageScore === undefined) {
            merged[laneId] = {
                evidenceState: strongerCategoryState(currentState.evidenceState, nextState.evidenceState),
                scoreCount: totalWeight,
            };
            continue;
        }

        const averageScore = Math.round(
            (((currentState.averageScore * currentState.scoreCount) + (nextState.averageScore * nextState.scoreCount)) / totalWeight) * 100,
        ) / 100;
        merged[laneId] = {
            evidenceState: scoreToPreparednessState(averageScore),
            averageScore,
            scoreCount: totalWeight,
        };
    }

    return merged;
}

function practicedQuestionCountFor(category: PrepQuestionCategoryCard): number {
    if (category.questionStatuses?.length) {
        return category.questionStatuses.filter((question) => question.status === "practiced").length;
    }
    if (typeof category.averageScore === "number" && category.sourceRefs.length === 0) {
        return category.questionCount;
    }
    return category.sourceRefs.filter((ref) => Boolean(ref.answerSubmittedAt)).length;
}

function upcomingQuestionCountFor(category: PrepQuestionCategoryCard): number {
    if (category.questionStatuses?.length) {
        return category.questionStatuses.filter((question) => question.status === "upcoming").length;
    }
    return Math.max(0, category.questionCount - practicedQuestionCountFor(category));
}

function questionStatusesFor(category: PrepQuestionCategoryCard): NonNullable<PrepQuestionCategoryCard["questionStatuses"]> {
    if (category.questionStatuses?.length) {
        return category.questionStatuses;
    }

    const practiced = practicedQuestionCountFor(category);
    return Array.from({ length: category.questionCount }, (_, index) => ({
        questionId: `${category.categoryId}-${index + 1}`,
        questionNumber: index + 1,
        status: index < practiced ? "practiced" as const : "upcoming" as const,
    }));
}

function formatQuestionStatusSummary(category: Pick<PrepQuestionCategoryCard, "questionCount" | "questionStatuses" | "practicedQuestionCount" | "upcomingQuestionCount">): string {
    const statuses = category.questionStatuses?.length ? category.questionStatuses : questionStatusesFor({
        categoryId: "behavioral",
        label: "Question coverage",
        questionCount: category.questionCount,
        practicedQuestionCount: category.practicedQuestionCount,
        upcomingQuestionCount: category.upcomingQuestionCount,
        evidenceState: "not_practiced",
        sourceRefs: [],
    });

    if (statuses.length > 0) {
        return statuses
            .sort((a, b) => a.questionNumber - b.questionNumber)
            .map((question) => `Q${question.questionNumber} ${question.status === "practiced" ? "Practiced" : "Upcoming"}`)
            .join(" • ");
    }

    const practiced = category.practicedQuestionCount ?? 0;
    const upcoming = category.upcomingQuestionCount ?? Math.max(0, category.questionCount - practiced);
    return [
        practiced > 0 ? `${practiced} practiced` : null,
        upcoming > 0 ? `${upcoming} upcoming` : null,
    ].filter((value): value is string => Boolean(value)).join(" • ") || "Not practiced yet";
}

function strongerCategoryState(current: PreparednessState, next: PreparednessState): PreparednessState {
    const rank: Record<PreparednessState, number> = {
        not_practiced: 0,
        emerging: 1,
        clear: 2,
        strong: 3,
    };

    return rank[next] > rank[current] ? next : current;
}

function evidenceLevelForSkill(skill: PreparednessSkill): InstantReadEvidenceLevel {
    const practiceCount = skill.evidence.filter((item) => item.type === "practice").length;
    if (practiceCount === 0) {
        return "none";
    }
    if (practiceCount === 1) {
        return "thin";
    }
    if (skill.state === "strong" && practiceCount >= 3) {
        return "strong";
    }
    return "enough";
}

function deriveOverallInstantReadState(lanes: InstantReadPreparednessModel["lanes"]): PreparednessState {
    if (lanes.length === 0 || lanes.every((lane) => lane.state === "not_practiced")) {
        return "not_practiced";
    }
    if (lanes.some((lane) => lane.state === "emerging" || lane.state === "not_practiced")) {
        return "emerging";
    }
    if (lanes.every((lane) => lane.state === "strong")) {
        return "strong";
    }
    return "clear";
}

function overallReadLabel(
    state: PreparednessState,
    lanes: InstantReadPreparednessModel["lanes"],
    practicedCategoryCount: number,
): string {
    if (state === "not_practiced") {
        return "Ready for your first practice read";
    }
    const thinnestLane = lanes
        .filter((lane) => lane.state === "emerging" || lane.state === "not_practiced")
        .sort((a, b) => evidenceLevelRank(a.evidenceLevel) - evidenceLevelRank(b.evidenceLevel))[0];
    if (thinnestLane) {
        return `Next focus: ${formatMatrixLaneLabel(thinnestLane.label)}`;
    }
    if (state === "strong" && practicedCategoryCount >= 3) {
        return "Strong practice across this interview";
    }
    return "Solid footing with room to broaden";
}

function overallReadSummary(
    state: PreparednessState,
    lanes: InstantReadPreparednessModel["lanes"],
    categories: PrepQuestionCategoryCard[],
): string {
    const practicedCount = categories.reduce((total, category) => total + (category.practicedQuestionCount ?? practicedQuestionCountFor(category)), 0);
    const plannedCount = categories.reduce((total, category) => total + category.questionCount, 0);
    if (state === "not_practiced") {
        return "Start one round to map your strengths and choose your next focus.";
    }
    const strongestLane = [...lanes].sort((a, b) => stateRankForSort(b.state) - stateRankForSort(a.state))[0];
    return `${formatMatrixLaneLabel(strongestLane?.label || "Practice")} looks strongest right now. You have practiced ${practicedCount} of ${plannedCount || practicedCount} planned questions for this interview.`;
}

function evidenceLevelRank(level: InstantReadEvidenceLevel): number {
    switch (level) {
        case "strong":
            return 3;
        case "enough":
            return 2;
        case "thin":
            return 1;
        case "none":
        default:
            return 0;
    }
}

function stateRankForSort(state: PreparednessState): number {
    switch (state) {
        case "strong":
            return 3;
        case "clear":
            return 2;
        case "emerging":
            return 1;
        case "not_practiced":
        default:
            return 0;
    }
}

function toPreparednessSkillFromLane({
    lane,
    signals,
    href,
    recommendationReason,
}: {
    lane: PreparednessLaneConfig;
    signals: PrepSignal[];
    href: string;
    recommendationReason?: string;
}): PreparednessSkill {
    const averageScore = averageSignalScore(signals);
    const state = averageScore === null ? deriveLaneState(signals) : scoreToPreparednessState(averageScore);
    const evidenceCounts = signals.length > 0
        ? signals.reduce(mergePreparednessCounts, { ...EMPTY_PREPAREDNESS_COUNTS })
        : evidenceCountFor("not_practiced");
    const evidence = signals.flatMap((signal) => signal.sourceRefs.map(toPreparednessEvidence))
        .filter((item): item is PreparednessEvidence => Boolean(item));

    return {
        id: lane.id,
        label: lane.label,
        state,
        evidenceCounts,
        dimensionStates: mergeDimensionStates(signals),
        fillPercent: averageScore === null
            ? signals.find((signal) => signal.fillPercent !== undefined)?.fillPercent
            : scoreToFillPercent(averageScore),
        whyItMatters: lane.whyItMatters,
        evidence,
        nextPracticeAction: recommendationReason || lane.nextPracticeAction[state],
        href,
    };
}

function mergeDimensionStates(signals: PrepSignal[]): PreparednessDimensionState[] | undefined {
    const grouped = new Map<string, {
        dimension: string;
        label: string;
        weightedTotal: number;
        scoreCount: number;
        fallbackState: PreparednessState;
    }>();

    for (const dimensionState of signals.flatMap((signal) => signal.dimensionStates ?? [])) {
        const scoreCount = typeof dimensionState.scoreCount === "number" && dimensionState.scoreCount > 0
            ? dimensionState.scoreCount
            : 0;
        const averageScore = typeof dimensionState.averageScore === "number"
            ? dimensionState.averageScore
            : undefined;
        const weightedTotal = averageScore === undefined ? 0 : averageScore * Math.max(scoreCount, 1);
        const existing = grouped.get(dimensionState.dimension);

        if (!existing) {
            grouped.set(dimensionState.dimension, {
                dimension: dimensionState.dimension,
                label: dimensionState.label,
                weightedTotal,
                scoreCount,
                fallbackState: dimensionState.evidenceState,
            });
            continue;
        }

        existing.weightedTotal += weightedTotal;
        existing.scoreCount += scoreCount;
        existing.fallbackState = strongerCategoryState(existing.fallbackState, dimensionState.evidenceState);
    }

    if (grouped.size === 0) {
        return undefined;
    }

    return Array.from(grouped.values()).map((dimension) => {
        const averageScore = dimension.scoreCount > 0
            ? dimension.weightedTotal / dimension.scoreCount
            : undefined;
        const evidenceState = averageScore === undefined
            ? dimension.fallbackState
            : scoreToPreparednessState(averageScore);

        return {
            dimension: dimension.dimension,
            label: dimension.label,
            evidenceState,
            averageScore: averageScore === undefined ? undefined : Math.round(averageScore * 100) / 100,
            scoreCount: dimension.scoreCount,
            fillPercent: averageScore === undefined ? undefined : scoreToFillPercent(averageScore),
        };
    });
}

function averageSignalScore(signals: PrepSignal[]): number | null {
    let weightedTotal = 0;
    let scoreCount = 0;

    for (const signal of signals) {
        if (typeof signal.averageScore !== "number") {
            continue;
        }
        const weight = typeof signal.scoreCount === "number" && signal.scoreCount > 0 ? signal.scoreCount : 1;
        weightedTotal += signal.averageScore * weight;
        scoreCount += weight;
    }

    return scoreCount > 0 ? weightedTotal / scoreCount : null;
}

function scoreToPreparednessState(score: number): PreparednessState {
    if (score >= 4) {
        return "strong";
    }
    if (score >= 3) {
        return "clear";
    }
    if (score >= 1) {
        return "emerging";
    }
    return "not_practiced";
}

function scoreToFillPercent(score: number): number {
    if (score < 2 || score >= 4) {
        return 0;
    }
    if (score < 3) {
        return Math.round((score - 2) * 100);
    }
    return Math.round((score - 3) * 100);
}

function toPreparednessEvidence(ref: PrepEvidenceRef): PreparednessEvidence | null {
    const content = ref.excerpt ? `${ref.label}: ${ref.excerpt}` : ref.label;
    switch (ref.type) {
        case "resume_context":
            return { type: "resume", content };
        case "job_description":
            return { type: "job-description", content };
        case "question":
        case "answer":
        case "feedback_plan":
        case "content_pulse":
        case "delivery_pulse":
        case "coach_signal":
        case "summary":
            return {
                type: "practice",
                content,
                questionText: ref.questionText,
                answerTranscript: ref.answerTranscript,
                answerModality: ref.answerModality,
                answerSubmittedAt: ref.answerSubmittedAt,
                sessionId: ref.sessionId,
                sessionTitle: ref.sessionTitle,
                sessionStatusLabel: ref.sessionStatusLabel,
                sessionActivityLabel: ref.sessionActivityLabel,
                sessionSortAt: ref.sessionSortAt,
                evaluation: ref.evaluation,
            };
        default:
            return null;
    }
}

function evidenceIdentity(item: PreparednessEvidence): string {
    return [
        item.sessionId ?? "session",
        item.questionText ?? "question",
        item.answerSubmittedAt ?? "time",
    ].join("|");
}

function inferState(item: CandidateDashboardItem | null, keyword: string): PreparednessState {
    const text = `${item?.coachingSnippet || ""} ${item?.summarySnippet || ""}`.toLowerCase();
    if (!item) return "not_practiced";
    if (text.includes(keyword)) return "emerging";
    return "not_practiced";
}

function compactEvidence(items: Array<PreparednessEvidence | null>): PreparednessEvidence[] {
    return items.filter((item): item is PreparednessEvidence => Boolean(item));
}

function withSessionContext(ref: PrepEvidenceRef, item: CandidateDashboardItem): PrepEvidenceRef {
    return {
        ...ref,
        sessionId: item.href,
        sessionTitle: item.title,
        sessionStatusLabel: item.statusLabel,
        sessionActivityLabel: item.lastActivityLabel,
        sessionSortAt: item.lastActivityAt,
    };
}

type EvidenceSessionGroup = {
    id: string;
    title: string;
    meta: string;
    sortAt: number;
    items: PreparednessEvidence[];
};

function groupEvidenceBySession(evidence: PreparednessEvidence[]): EvidenceSessionGroup[] {
    const groups = new Map<string, EvidenceSessionGroup>();

    for (const item of evidence) {
        const id = item.sessionId || "unscoped-practice";
        const group = groups.get(id) ?? {
            id,
            title: item.sessionTitle || "Practice round",
            meta: formatSessionGroupMeta(item),
            sortAt: item.sessionSortAt ?? item.answerSubmittedAt ?? 0,
            items: [],
        };

        group.sortAt = Math.max(group.sortAt, item.sessionSortAt ?? item.answerSubmittedAt ?? 0);
        group.items.push(item);
        groups.set(id, group);
    }

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            items: group.items.sort((a, b) => (a.answerSubmittedAt ?? 0) - (b.answerSubmittedAt ?? 0)),
        }))
        .sort((a, b) => b.sortAt - a.sortAt);
}

function formatSessionGroupMeta(item: PreparednessEvidence): string {
    return [item.sessionStatusLabel, item.sessionActivityLabel]
        .filter((value): value is string => Boolean(value))
        .join(" · ") || "Practice evidence";
}

function getPreparednessStateStyles(state: PreparednessState) {
    switch (state) {
        case "strong":
            return {
                wrapper: "border-[rgb(var(--candidate-success)/0.32)] bg-[rgb(var(--candidate-accent-soft)/0.62)] hover:border-[rgb(var(--candidate-success)/0.48)]",
                fill: "bg-[rgb(var(--candidate-success)/0.16)]",
                iconShell: "border-[rgb(var(--candidate-success)/0.22)] text-[rgb(var(--candidate-success))]",
                title: "text-text-primary",
                dot: "bg-[rgb(var(--candidate-success))]",
                badge: "bg-[rgb(var(--candidate-accent-soft))] text-[rgb(var(--candidate-success))]",
            };
        case "clear":
            return {
                wrapper: "border-primary/20 bg-[rgb(var(--candidate-primary-soft)/0.72)] hover:border-primary/35",
                fill: "bg-[rgb(var(--candidate-success)/0.14)]",
                iconShell: "border-primary/20 text-primary",
                title: "text-text-primary",
                dot: "bg-primary",
                badge: "bg-primary/10 text-primary",
            };
        case "emerging":
            return {
                wrapper: "border-[rgb(var(--candidate-secondary-brand)/0.24)] bg-[rgb(var(--candidate-secondary-soft)/0.68)] hover:border-[rgb(var(--candidate-secondary-brand)/0.38)]",
                fill: "bg-primary/10",
                iconShell: "border-[rgb(var(--candidate-secondary-brand)/0.2)] text-[rgb(var(--candidate-secondary-brand))]",
                title: "text-text-primary",
                dot: "bg-[rgb(var(--candidate-secondary-brand))]",
                badge: "bg-[rgb(var(--candidate-secondary-soft))] text-[rgb(var(--candidate-secondary-brand))]",
            };
        case "not_practiced":
        default:
            return {
                wrapper: "border-[rgb(var(--candidate-border)/0.78)] bg-white hover:bg-surface-base",
                fill: "bg-[rgb(var(--candidate-secondary-soft)/0.32)]",
                iconShell: "border-[rgb(var(--candidate-border)/0.78)] text-text-muted",
                title: "text-text-primary",
                dot: "border border-text-muted/40 bg-transparent",
                badge: "bg-surface-base text-text-muted",
            };
    }
}

function getPreparednessFillPercent(skill: PreparednessSkill): number {
    if (typeof skill.fillPercent === "number") {
        return skill.fillPercent;
    }

    const counts = skill.evidenceCounts;
    switch (skill.state) {
        case "strong":
            return 0;
        case "clear":
            if (counts.emerging > 0 && counts.strong > 0) return 55;
            if (counts.clear > 1 || counts.strong > 0) return 75;
            return 65;
        case "emerging":
            return counts.emerging > 1 ? 45 : 35;
        case "not_practiced":
        default:
            return 0;
    }
}

function evidenceCountFor(state: PreparednessState): Record<PreparednessState, number> {
    return {
        not_practiced: state === "not_practiced" ? 1 : 0,
        emerging: state === "emerging" ? 1 : 0,
        clear: state === "clear" ? 1 : 0,
        strong: state === "strong" ? 1 : 0,
    };
}

const EMPTY_PREPAREDNESS_COUNTS: Record<PreparednessState, number> = {
    not_practiced: 0,
    emerging: 0,
    clear: 0,
    strong: 0,
};

function mergePreparednessCounts(
    counts: Record<PreparednessState, number>,
    signal: PrepSignal,
): Record<PreparednessState, number> {
    return {
        not_practiced: counts.not_practiced + signal.evidenceCounts.not_practiced,
        emerging: counts.emerging + signal.evidenceCounts.emerging,
        clear: counts.clear + signal.evidenceCounts.clear,
        strong: counts.strong + signal.evidenceCounts.strong,
    };
}

function deriveLaneState(signals: PrepSignal[]): PreparednessState {
    if (signals.length === 0) {
        return "not_practiced";
    }

    const hasStrong = signals.some((signal) => signal.evidenceState === "strong");
    const hasClear = signals.some((signal) => signal.evidenceState === "clear");
    const hasEmerging = signals.some((signal) => signal.evidenceState === "emerging");
    const hasPracticed = hasStrong || hasClear || hasEmerging;

    if (!hasPracticed) {
        return "not_practiced";
    }
    if (hasEmerging && (hasStrong || hasClear)) {
        return "clear";
    }
    if (hasStrong) {
        return "strong";
    }
    if (hasClear) {
        return "clear";
    }
    return "emerging";
}

function formatPreparednessState(state: PreparednessState) {
    switch (state) {
        case "not_practiced":
            return "To practice";
        case "emerging":
            return "Emerging";
        case "clear":
            return "Clear";
        case "strong":
            return "Strong";
    }
}

function getEvidenceIcon(item: PreparednessEvidence) {
    if (item.type === "practice" && item.answerModality === "voice") {
        return <Mic size={18} aria-hidden="true" />;
    }

    switch (item.type) {
        case "practice":
            return <MessageSquare size={18} aria-hidden="true" />;
        case "resume":
            return <FileText size={18} aria-hidden="true" />;
        case "job-description":
            return <Briefcase size={18} aria-hidden="true" />;
    }
}

function getEvidenceLabel(type: PreparednessEvidence["type"]) {
    switch (type) {
        case "practice":
            return "Practice";
        case "resume":
            return "Resume content";
        case "job-description":
            return "Job description";
    }
}

function titleCase(value: string): string {
    return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function formatPracticeDate(value: number): string {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

function toCandidateVoice(value: string | undefined): string {
    if (!value) {
        return "This response gives the coach enough practice evidence to guide your next step.";
    }

    return value
        .replace(/\bThe candidate\b/g, "You")
        .replace(/\bthe candidate\b/g, "you")
        .replace(/\bCandidate\b/g, "You")
        .replace(/\bcandidate\b/g, "you")
        .replace(/\bThe answer\b/g, "Your answer")
        .replace(/\bthe answer\b/g, "your answer")
        .replace(/\btheir\b/g, "your")
        .replace(/\bTheir\b/g, "Your")
        .replace(/\bthey\b/g, "you")
        .replace(/\bThey\b/g, "You")
        .replace(/\bthem\b/g, "you");
}

function parseMyRead(value: string | undefined): MyReadSection {
    const normalized = toCandidateVoice(value).trim();
    if (!normalized) {
        return {
            stoodOut: [],
            fallback: "This response gives the coach enough practice evidence to guide your next step.",
        };
    }

    const nextStepSplit = splitAtLabel(normalized, "Next step:");
    const beforeNextStep = nextStepSplit.before;
    const nextStep = nextStepSplit.after;
    const biggestLiftSplit = splitAtLabel(beforeNextStep, "For the biggest lift:");
    const beforeBiggestLift = biggestLiftSplit.before;
    const biggestLiftRaw = biggestLiftSplit.after;
    const stoodOutSplit = splitAtLabel(beforeBiggestLift, "Coach signals:");
    const summary = stripKnownPrefix(stoodOutSplit.before);
    const stoodOut = parseSignalList(stoodOutSplit.after);
    const biggestLift = parseBiggestLift(biggestLiftRaw);

    if (!stoodOut.length && !biggestLift?.focus && !biggestLift?.trySayingThis && !nextStep) {
        return {
            stoodOut: [],
            fallback: stripKnownPrefix(normalized),
        };
    }

    return {
        summary: summary || undefined,
        stoodOut,
        biggestLift: biggestLift?.focus,
        trySayingThis: biggestLift?.trySayingThis,
        nextStep: nextStep || undefined,
    };
}

function splitAtLabel(value: string, label: string): { before: string; after?: string } {
    const index = value.indexOf(label);
    if (index === -1) {
        return { before: value.trim() };
    }

    return {
        before: value.slice(0, index).trim(),
        after: value.slice(index + label.length).trim(),
    };
}

function stripKnownPrefix(value: string): string {
    return value
        .replace(/^(Behavioral|Culture \/ Fit|Technical \/ Role-Specific|Case \/ Scenario|Screening) feedback:\s*/i, "")
        .trim();
}

function parseSignalList(value: string | undefined): Array<{ label: string; body: string }> {
    if (!value) {
        return [];
    }

    return value
        .split(";")
        .map((item) => item.trim())
        .map((item) => {
            const [label, ...bodyParts] = item.split(":");
            const body = bodyParts.join(":").trim();
            if (!label || !body) {
                return null;
            }
            return {
                label: label.trim(),
                body,
            };
        })
        .filter((item): item is { label: string; body: string } => Boolean(item));
}

function parseBiggestLift(value: string | undefined): { focus?: string; trySayingThis?: string } | undefined {
    if (!value) {
        return undefined;
    }

    const trySplit = splitAtLabel(value, "Try:");
    return {
        focus: trySplit.before.trim() || undefined,
        trySayingThis: trySplit.after?.trim(),
    };
}

function getCategoryWhyItMatters(categoryId: PrepQuestionCategoryCard["categoryId"]): string {
    switch (categoryId) {
        case "behavioral":
            return "Interviewers look for a clear situation, your specific action, and what changed because of it.";
        case "culture_fit":
            return "Interviewers look for values, work style, and motivation that fit the team and role.";
        case "technical_role_specific":
            return "Interviewers look for role-specific knowledge, tools, decisions, and practical judgment.";
        case "case_scenario":
            return "Interviewers look for how you reason through a situation, choose next steps, and explain tradeoffs.";
        case "screening":
            return "Interviewers look for basic fit, interest, availability, and a clear reason this role makes sense.";
    }
}
