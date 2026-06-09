"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ArrowRight, Briefcase, CheckCircle2, ChevronDown, ChevronRight, Circle, FileText, MessageSquare, Mic, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { CandidateDashboardItem, CandidateDashboardTargetInterview } from "@/lib/server/candidate";
import type { PrepEvidenceRef, PrepQuestionCategoryCard, PrepSignal, PrepSignalLane } from "@/lib/server/candidate/prep-profile-read-model";

export type PreparednessState = "not_practiced" | "emerging" | "clear" | "strong";

export type PreparednessSkill = {
    id: string;
    label: string;
    state: PreparednessState;
    evidenceCounts: Record<PreparednessState, number>;
    whyItMatters: string;
    evidence: PreparednessEvidence[];
    nextPracticeAction: string;
    href: string;
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
        <nav aria-label="Target interviews" className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2 px-1">
                {targetInterviews.map((targetInterview) => (
                    <Link
                        key={targetInterview.id}
                        href={targetInterview.href}
                        aria-current={targetInterview.isSelected ? "page" : undefined}
                        className={cn(
                            "group rounded-2xl border px-4 py-3 text-left shadow-flat transition-colors",
                            targetInterview.isSelected
                                ? "border-primary/25 bg-primary/10 text-text-primary"
                                : "border-[rgb(var(--candidate-border)/0.78)] bg-white text-text-secondary hover:border-primary/20 hover:bg-surface-base hover:text-text-primary",
                        )}
                    >
                        <span className="block text-sm font-bold leading-5">{targetInterview.label}</span>
                        <span className="mt-1 block text-xs font-semibold text-text-muted">
                            {formatTargetInterviewMeta(targetInterview)}
                        </span>
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

function formatTargetInterviewMeta(targetInterview: CandidateDashboardTargetInterview): string {
    if (targetInterview.activeCount > 0) {
        return `${targetInterview.activeCount} active`;
    }
    if (targetInterview.completedCount === 1) {
        return "1 completed";
    }
    return `${targetInterview.completedCount} completed`;
}

export function PracticeNextCard({
    title,
    body,
    href,
    actionLabel,
}: {
    title: string;
    body: string;
    href: string;
    actionLabel: string;
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
    const previewLanes = ["Answer Substance", "Interview Structure", "Communication Delivery"];
    const previewCategories = ["Behavioral", "Culture / Fit", "Technical / Role-Specific"];

    return (
        <section aria-label="Empty preparedness dashboard" className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 md:grid-cols-[minmax(0,1fr)_22rem] md:items-start">
            <div className="space-y-6">
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

                <div className="space-y-3" aria-label="Preview of your preparedness map">
                    <div>
                        <h3 className="font-display text-2xl font-bold tracking-tight text-text-primary">Preparedness map</h3>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">Your practice evidence will appear here after you answer questions.</p>
                    </div>
                    {previewLanes.map((label) => (
                        <div key={label} className="flex items-center gap-4 rounded-[1.25rem] border border-dashed border-[rgb(var(--candidate-border)/0.9)] bg-white/75 px-4 py-4 shadow-flat">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5 text-text-muted">
                                <Circle size={18} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs font-black uppercase tracking-[0.16em] text-text-muted">Not practiced yet</span>
                                <span className="mt-1 block font-bold text-text-primary">{label}</span>
                            </span>
                        </div>
                    ))}
                </div>

                <div className="space-y-3" aria-label="Preview of question coverage">
                    <div>
                        <h3 className="font-display text-2xl font-bold tracking-tight text-text-primary">Question coverage</h3>
                        <p className="mt-1 text-sm leading-6 text-text-secondary">You will see which kinds of interview questions you have practiced.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {previewCategories.map((label) => (
                            <div key={label} className="rounded-[1.25rem] border border-dashed border-[rgb(var(--candidate-border)/0.9)] bg-white/70 p-4 shadow-flat">
                                <span className="inline-flex rounded-full bg-primary/5 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-text-muted">Not started</span>
                                <p className="mt-3 font-bold text-text-primary">{label}</p>
                                <p className="mt-1 text-sm font-semibold text-text-secondary">0 questions practiced</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rounded-[1.5rem] border border-[rgb(var(--candidate-border)/0.82)] bg-gradient-to-br from-surface-subtle to-surface-base p-5 shadow-[var(--candidate-shadow-card)] md:sticky md:top-6">
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
            sourceRefs: [...current.sourceRefs, ...card.sourceRefs],
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

const CATEGORY_CARD_ORDER: PrepQuestionCategoryCard["categoryId"][] = [
    "behavioral",
    "culture_fit",
    "technical_role_specific",
    "case_scenario",
    "screening",
];

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
        fillPercent: averageScore === null
            ? signals.find((signal) => signal.fillPercent !== undefined)?.fillPercent
            : scoreToFillPercent(averageScore),
        whyItMatters: lane.whyItMatters,
        evidence,
        nextPracticeAction: recommendationReason || lane.nextPracticeAction[state],
        href,
    };
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
