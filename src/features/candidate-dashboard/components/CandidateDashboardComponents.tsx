"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Briefcase, CheckCircle2, Circle, FileText, MessageSquare, Sparkles, X } from "lucide-react";

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

export function QuestionCategoryCoverage({ categories }: { categories: PrepQuestionCategoryCard[] }) {
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
                        <article
                            key={category.categoryId}
                            data-evidence-state={category.evidenceState}
                            className={cn(
                                "rounded-2xl border p-4 shadow-flat",
                                styles.wrapper,
                            )}
                        >
                            <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em]", styles.badge)}>
                                {formatPreparednessState(category.evidenceState)}
                            </span>
                            <h3 className="mt-3 text-base font-bold leading-5 text-text-primary">{category.label}</h3>
                            <p className="mt-2 text-sm font-semibold text-text-secondary">
                                {category.questionCount === 1 ? "1 question practiced" : `${category.questionCount} questions practiced`}
                            </p>
                        </article>
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
                            <span
                                className={cn("pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-500 ease-standard", styles.fill)}
                                style={{ width: "var(--preparedness-fill)" }}
                                aria-hidden="true"
                            />
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

    return (
        <div
            data-testid="preparedness-drilldown-backdrop"
            className="fixed inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-sm md:items-center md:justify-center"
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
                className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[rgb(var(--candidate-border)/0.92)] bg-white shadow-[var(--candidate-shadow-panel)] md:max-w-xl md:rounded-[1.75rem]"
            >
                <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--candidate-border)/0.7)] p-5 md:p-6">
                    <div>
                        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-bold", styles.badge)}>
                            {formatPreparednessState(skill.state)}
                        </span>
                        <h2 className="mt-3 text-2xl font-bold leading-tight text-text-primary">{skill.label}</h2>
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
                <div className="custom-scrollbar flex-1 space-y-7 overflow-y-auto p-5 md:p-6">
                    <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">Why this matters</h3>
                        <p className="mt-2 text-sm leading-7 text-text-secondary">{skill.whyItMatters}</p>
                    </section>

                    <section>
                        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-text-muted">What your practice shows</h3>
                        <div className="mt-3 grid gap-3">
                            {skill.evidence.length > 0 ? (
                                skill.evidence.map((item, index) => (
                                    <div key={`${item.type}-${index}`} className="flex gap-3 rounded-2xl border border-[rgb(var(--candidate-border)/0.78)] bg-surface-base p-4">
                                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                            {getEvidenceIcon(item.type)}
                                        </span>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{getEvidenceLabel(item.type)}</p>
                                            <p className="mt-1 text-sm leading-6 text-text-secondary">{item.content}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="rounded-2xl bg-surface-base p-4 text-sm leading-6 text-text-secondary">
                                    Complete a baseline practice round to add evidence here.
                                </p>
                            )}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.18em] text-primary">How to use this</h3>
                        <p className="mt-2 text-sm leading-7 text-text-secondary">{skill.nextPracticeAction}</p>
                    </section>
                </div>
            </section>
        </div>
    );
}

export function EmptyPreparednessDashboard({ href = "/practice" }: { href?: string }) {
    return (
        <section aria-label="Empty preparedness dashboard" className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-primary/10 text-primary">
                <Sparkles size={30} aria-hidden="true" />
            </div>
            <h2 className="mt-6 font-display text-3xl font-bold tracking-tight text-text-primary">Start preparing for an interview</h2>
            <p className="mt-3 text-base leading-7 text-text-secondary">
                Add a target role and job description to build your first preparedness map.
            </p>
            <div className="mt-8 w-full space-y-3" aria-label="Preview of your map">
                {["Interview expectations", "Practice evidence", "Confidence"].map((label) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl border border-dashed border-[rgb(var(--candidate-border))] bg-white/70 px-4 py-4 text-sm">
                        <span className="font-semibold text-text-secondary">{label}</span>
                        <span className="text-xs font-bold text-text-muted">Not started</span>
                    </div>
                ))}
            </div>
            <Button asChild emphasis="primary" density="hero" shape="app" label="strong" className="mt-7 w-full">
                <Link href={href}>Create practice</Link>
            </Button>
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
    const readModelSignals = scopedItems.flatMap((item) => item.prepProfile?.signals ?? []);
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

    for (const card of items.flatMap((item) => item.prepProfile?.categoryCards ?? [])) {
        const current = merged.get(card.categoryId);
        if (!current) {
            merged.set(card.categoryId, { ...card, sourceRefs: [...card.sourceRefs] });
            continue;
        }

        const averageScore = mergeAverageScore(current, card);
        merged.set(card.categoryId, {
            ...current,
            questionCount: current.questionCount + card.questionCount,
            evidenceState: strongerCategoryState(current.evidenceState, card.evidenceState),
            averageScore,
            sourceRefs: [...current.sourceRefs, ...card.sourceRefs],
        });
    }

    return Array.from(merged.values()).sort((a, b) => CATEGORY_CARD_ORDER.indexOf(a.categoryId) - CATEGORY_CARD_ORDER.indexOf(b.categoryId));
}

const CATEGORY_CARD_ORDER: PrepQuestionCategoryCard["categoryId"][] = [
    "behavioral",
    "culture_fit",
    "technical_role_specific",
    "case_scenario",
    "screening",
];

function mergeAverageScore(current: PrepQuestionCategoryCard, next: PrepQuestionCategoryCard): number | undefined {
    if (current.averageScore === undefined) {
        return next.averageScore;
    }
    if (next.averageScore === undefined) {
        return current.averageScore;
    }

    const weighted = ((current.averageScore * current.questionCount) + (next.averageScore * next.questionCount)) /
        (current.questionCount + next.questionCount);
    return Math.round(weighted * 100) / 100;
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
    const state = deriveLaneState(signals);
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
        fillPercent: signals.find((signal) => signal.fillPercent !== undefined)?.fillPercent,
        whyItMatters: lane.whyItMatters,
        evidence,
        nextPracticeAction: recommendationReason || lane.nextPracticeAction[state],
        href,
    };
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
            return { type: "practice", content };
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
            return 100;
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

function getEvidenceIcon(type: PreparednessEvidence["type"]) {
    switch (type) {
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
