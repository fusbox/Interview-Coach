"use client";

import { useState } from "react";

import type { CandidateDashboardModel } from "@/lib/server/candidate";
import {
    EmptyPreparednessDashboard,
    PracticeNextCard,
    PreparednessMap,
    QuestionCategoryCoverage,
    RecentActivityList,
    SkillDrilldown,
    TargetInterviewSwitcher,
    toQuestionCategoryCards,
    toPreparednessSkills,
} from "./components/CandidateDashboardComponents";

type CandidateDashboardPageProps = {
    dashboard: CandidateDashboardModel;
};

export function CandidateDashboardPage({ dashboard }: CandidateDashboardPageProps) {
    const hasPractice = dashboard.stats.totalPracticeCount > 0;
    const latestItem = dashboard.activeItems[0] || dashboard.completedItems[0] || null;
    const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
    const scopedItems = [...dashboard.activeItems, ...dashboard.completedItems];
    const skills = toPreparednessSkills({
        latestItem,
        items: scopedItems,
        fallbackHref: dashboard.nextBestAction.href || "/practice",
    });
    const categoryCards = toQuestionCategoryCards(scopedItems);
    const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) || null;
    const recentItems = scopedItems.slice(0, 4);

    return (
        <main className="candidate-design-system -mx-4 -mt-4 min-h-screen bg-surface-base text-text-primary sm:-mx-6 sm:-mt-6 lg:-mx-10 lg:-mt-10">
            <h1 className="sr-only">Candidate dashboard</h1>
            {hasPractice ? (
                <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-10">
                    <section className="space-y-8">
                        <div>
                            <h2 className="font-display text-3xl font-bold tracking-tight text-text-primary md:text-4xl">
                                {latestItem?.title || "Target interview"}
                            </h2>
                        </div>

                        <TargetInterviewSwitcher targetInterviews={dashboard.targetInterviews} />
                        <PreparednessMap skills={skills} onSkillClick={setSelectedSkillId} />
                        <QuestionCategoryCoverage categories={categoryCards} />
                        <RecentActivityList items={recentItems} />
                    </section>

                    <aside className="space-y-4 lg:pt-[5.25rem]">
                        <div className="lg:sticky lg:top-8">
                            <PracticeNextCard
                                title={dashboard.nextBestAction.title}
                                body={dashboard.nextBestAction.body}
                                href={dashboard.nextBestAction.href}
                                actionLabel={dashboard.nextBestAction.actionLabel}
                            />
                        </div>
                    </aside>
                </div>
            ) : (
                <EmptyPreparednessDashboard href={dashboard.nextBestAction.href || "/practice"} />
            )}

            {selectedSkill ? (
                <SkillDrilldown skill={selectedSkill} onClose={() => setSelectedSkillId(null)} />
            ) : null}
        </main>
    );
}
