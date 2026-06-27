"use client";

import { useState } from "react";

import type { CandidateDashboardModel } from "@/lib/server/candidate";
import {
    CoachPlanCategoryFace,
    CoachPlanCategorySheet,
    CoachPlanOverview,
    CoachPlanQuestionSetFace,
    CoachPlanSkillSheet,
    CoachPlanSkillsFace,
    EmptyPreparednessDashboard,
    PracticeNextCard,
    PreparednessMapExperience,
    QuestionCategoryDrilldown,
    RecentActivityList,
    SkillDrilldown,
    toInstantReadPreparednessModel,
    toCoachPlanOverviewModel,
    TargetInterviewSwitcher,
    toQuestionCategoryCards,
    toQuestionCategoryDrilldowns,
    toPreparednessMatrix,
    toPreparednessSkills,
    toPracticeNextItems,
    withPracticeCoverageBaselineCategories,
} from "./components/CandidateDashboardComponents";

type CandidateDashboardPageProps = {
    dashboard: CandidateDashboardModel;
};

export function CandidateDashboardPage({ dashboard }: CandidateDashboardPageProps) {
    const hasPractice = dashboard.stats.totalPracticeCount > 0;
    const latestItem = dashboard.activeItems[0] || dashboard.completedItems[0] || null;
    const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [selectedCoachPlanCategoryId, setSelectedCoachPlanCategoryId] = useState<string | null>(null);
    const [selectedCoachPlanSkillId, setSelectedCoachPlanSkillId] = useState<string | null>(null);
    const [selectedMatrixCellId, setSelectedMatrixCellId] = useState<string | null>(null);
    const scopedItems = [...dashboard.activeItems, ...dashboard.completedItems];
    const skills = toPreparednessSkills({
        latestItem,
        items: scopedItems,
        fallbackHref: dashboard.nextBestAction.href || "/practice",
    });
    const categoryCards = withPracticeCoverageBaselineCategories(toQuestionCategoryCards(scopedItems), scopedItems);
    const categoryDrilldowns = toQuestionCategoryDrilldowns(categoryCards);
    const preparednessMatrix = toPreparednessMatrix(skills, categoryCards);
    const preparednessSnapshot = toInstantReadPreparednessModel(skills, categoryCards);
    const coachPlanOverview = toCoachPlanOverviewModel({
        latestItem,
        categories: categoryCards,
    });
    const practiceNextItems = toPracticeNextItems({
        activeItems: dashboard.activeItems,
        completedItems: dashboard.completedItems,
        matrix: preparednessMatrix,
        categories: categoryCards,
    });
    const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) || null;
    const selectedCoachPlanSkill = skills.find((skill) => skill.id === selectedCoachPlanSkillId) || null;
    const selectedCategory = categoryDrilldowns.find((category) => category.id === selectedCategoryId) || null;
    const selectedCoachPlanCategory = categoryDrilldowns.find((category) => category.id === selectedCoachPlanCategoryId) || null;
    const selectedMatrixCell = preparednessMatrix.cells.find((cell) => cell.id === selectedMatrixCellId) || null;
    const recentItems = scopedItems.slice(0, 4);

    return (
        <main className="candidate-design-system -mx-4 -mt-4 min-h-screen w-full overflow-x-hidden bg-surface-base text-text-primary sm:-mx-6 sm:-mt-6 lg:-mx-10 lg:-mt-10">
            {hasPractice ? (
                <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
                    <div className="mb-8">
                        <h1 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                            Practice Coach
                        </h1>
                    </div>

                    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-10">
                        <section className="min-w-0 space-y-8">
                            <TargetInterviewSwitcher targetInterviews={dashboard.targetInterviews} />
                            {coachPlanOverview ? <CoachPlanOverview overview={coachPlanOverview} /> : null}
                            <CoachPlanCategoryFace
                                categories={categoryDrilldowns}
                                onCategorySelect={setSelectedCoachPlanCategoryId}
                            />
                            <CoachPlanSkillsFace
                                skills={skills}
                                onSkillSelect={setSelectedCoachPlanSkillId}
                            />
                            <CoachPlanQuestionSetFace categories={categoryDrilldowns} />
                            <PreparednessMapExperience
                                snapshot={preparednessSnapshot}
                                matrix={preparednessMatrix}
                                onLaneClick={setSelectedSkillId}
                                onCategoryClick={setSelectedCategoryId}
                                onCellClick={setSelectedMatrixCellId}
                            />
                            <RecentActivityList items={recentItems} />
                        </section>

                        <aside className="min-w-0 space-y-4 xl:pt-[5.25rem]">
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
            {selectedCoachPlanCategory ? (
                <CoachPlanCategorySheet
                    category={selectedCoachPlanCategory}
                    onClose={() => setSelectedCoachPlanCategoryId(null)}
                />
            ) : null}
            {selectedCoachPlanSkill ? (
                <CoachPlanSkillSheet
                    skill={selectedCoachPlanSkill}
                    onClose={() => setSelectedCoachPlanSkillId(null)}
                />
            ) : null}
            {selectedMatrixCell ? (
                <QuestionCategoryDrilldown category={selectedMatrixCell} onClose={() => setSelectedMatrixCellId(null)} />
            ) : null}
        </main>
    );
}
