"use client";

import { useState } from "react";

import type { CandidateDashboardModel } from "@/lib/server/candidate";
import {
    EmptyPreparednessDashboard,
    PracticeNextCard,
    PreparednessMapExperience,
    QuestionCategoryDrilldown,
    RecentActivityList,
    SkillDrilldown,
    toInstantReadPreparednessModel,
    TargetInterviewSwitcher,
    toQuestionCategoryCards,
    toQuestionCategoryDrilldowns,
    toPreparednessMatrix,
    toPreparednessSkills,
    toPracticeNextItems,
} from "./components/CandidateDashboardComponents";

type CandidateDashboardPageProps = {
    dashboard: CandidateDashboardModel;
};

export function CandidateDashboardPage({ dashboard }: CandidateDashboardPageProps) {
    const hasPractice = dashboard.stats.totalPracticeCount > 0;
    const latestItem = dashboard.activeItems[0] || dashboard.completedItems[0] || null;
    const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedMatrixCellId, setSelectedMatrixCellId] = useState<string | null>(null);
    const scopedItems = [...dashboard.activeItems, ...dashboard.completedItems];
    const skills = toPreparednessSkills({
        latestItem,
        items: scopedItems,
        fallbackHref: dashboard.nextBestAction.href || "/practice",
    });
    const categoryCards = toQuestionCategoryCards(scopedItems);
    const categoryDrilldowns = toQuestionCategoryDrilldowns(categoryCards);
    const preparednessMatrix = toPreparednessMatrix(skills, categoryCards);
    const preparednessSnapshot = toInstantReadPreparednessModel(skills, categoryCards);
    const practiceNextItems = toPracticeNextItems({
        activeItems: dashboard.activeItems,
        completedItems: dashboard.completedItems,
        matrix: preparednessMatrix,
        categories: categoryCards,
    });
    const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) || null;
    const selectedCategory = categoryDrilldowns.find((category) => category.id === selectedCategoryId) || null;
    const selectedMatrixCell = preparednessMatrix.cells.find((cell) => cell.id === selectedMatrixCellId) || null;
    const recentItems = scopedItems.slice(0, 4);

    return (
        <main className="candidate-design-system -mx-4 -mt-4 min-h-screen bg-surface-base text-text-primary sm:-mx-6 sm:-mt-6 lg:-mx-10 lg:-mt-10">
            <h1 className="sr-only">Candidate dashboard</h1>
            {hasPractice ? (
                <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
                    <div className="mb-8">
                        <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                            {latestItem?.title || "Target interview"}
                        </h2>
                    </div>

                    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-10">
                        <section className="space-y-8">
                            <TargetInterviewSwitcher targetInterviews={dashboard.targetInterviews} />
                            <PreparednessMapExperience
                                snapshot={preparednessSnapshot}
                                matrix={preparednessMatrix}
                                onLaneClick={setSelectedSkillId}
                                onCategoryClick={setSelectedCategoryId}
                                onCellClick={setSelectedMatrixCellId}
                            />
                            <RecentActivityList items={recentItems} />
                        </section>

                        <aside className="space-y-4 xl:pt-[5.25rem]">
                            <div className="xl:sticky xl:top-8">
                                <PracticeNextCard
                                    title={dashboard.nextBestAction.title}
                                    body={dashboard.nextBestAction.body}
                                    href={dashboard.nextBestAction.href}
                                    actionLabel={dashboard.nextBestAction.actionLabel}
                                    items={practiceNextItems}
                                />
                            </div>
                        </aside>
                    </div>
                </div>
            ) : (
                <EmptyPreparednessDashboard href={dashboard.nextBestAction.href || "/practice"} />
            )}

            {selectedSkill ? (
                <SkillDrilldown skill={selectedSkill} onClose={() => setSelectedSkillId(null)} />
            ) : null}
            {selectedCategory ? (
                <QuestionCategoryDrilldown category={selectedCategory} onClose={() => setSelectedCategoryId(null)} />
            ) : null}
            {selectedMatrixCell ? (
                <QuestionCategoryDrilldown category={selectedMatrixCell} onClose={() => setSelectedMatrixCellId(null)} />
            ) : null}
        </main>
    );
}
