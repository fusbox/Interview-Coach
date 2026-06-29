"use client";

import { useRef, useState } from "react";

import type { CandidateDashboardModel } from "@/lib/server/candidate";
import {
    CoachPlanCategoryFace,
    CoachPlanCategorySheet,
    CoachPlanOverview,
    CoachPlanQuestionSetFace,
    CoachPlanSkillSheet,
    CoachPlanSkillsFace,
    CoachUpdateCard,
    CoachUpdateDialog,
    EmptyPreparednessDashboard,
    NextPracticeRoundButton,
    NextPracticeRoundSurface,
    PracticeNextCard,
    PreparednessMapExperience,
    QuestionCategoryDrilldown,
    RecentActivityList,
    SkillDrilldown,
    toInstantReadPreparednessModel,
    toCoachPlanOverviewModel,
    toCoachPlanQuestionSet,
    toCoachUpdateModel,
    toCoachUpdateQuestionFeedbackItems,
    type NextPracticeRoundAnchorRect,
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
    const [isCoachUpdateOpen, setIsCoachUpdateOpen] = useState(false);
    const [selectedMatrixCellId, setSelectedMatrixCellId] = useState<string | null>(null);
    const [queuedQuestions, setQueuedQuestions] = useState<Array<{ id: string }>>([]);
    const [isNextPracticeRoundOpen, setIsNextPracticeRoundOpen] = useState(false);
    const [nextPracticeRoundAnchorRect, setNextPracticeRoundAnchorRect] = useState<NextPracticeRoundAnchorRect | null>(null);
    const nextPracticeRoundAnchorRef = useRef<HTMLDivElement | null>(null);
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
    const coachUpdate = toCoachUpdateModel({
        items: scopedItems,
        practiceNextItems,
    });
    const coachUpdateQuestions = toCoachUpdateQuestionFeedbackItems(categoryDrilldowns);
    const coachPlanQuestions = toCoachPlanQuestionSet(categoryDrilldowns);
    const selectedSkill = skills.find((skill) => skill.id === selectedSkillId) || null;
    const selectedCoachPlanSkill = skills.find((skill) => skill.id === selectedCoachPlanSkillId) || null;
    const selectedCategory = categoryDrilldowns.find((category) => category.id === selectedCategoryId) || null;
    const selectedCoachPlanCategory = categoryDrilldowns.find((category) => category.id === selectedCoachPlanCategoryId) || null;
    const selectedMatrixCell = preparednessMatrix.cells.find((cell) => cell.id === selectedMatrixCellId) || null;
    const recentItems = scopedItems.slice(0, 4);
    const queuedQuestionItems = queuedQuestions
        .map((queuedQuestion) => coachPlanQuestions.find((question) => question.id === queuedQuestion.id) || null)
        .filter((question): question is NonNullable<typeof question> => Boolean(question));
    const queuedQuestionIds = queuedQuestions.map((question) => question.id);
    const handleAddQuestionToNextRound = (question: { id: string }) => {
        setQueuedQuestions((current) => current.some((queuedQuestion) => queuedQuestion.id === question.id)
            ? current
            : [...current, { id: question.id }]);
    };
    const handleRemoveQuestionFromNextRound = (questionId: string) => {
        setQueuedQuestions((current) => {
            const next = current.filter((question) => question.id !== questionId);
            if (next.length === 0) {
                setIsNextPracticeRoundOpen(false);
            }
            return next;
        });
    };
    const handleClearNextPracticeRound = () => {
        setQueuedQuestions([]);
        setIsNextPracticeRoundOpen(false);
    };
    const handleOpenNextPracticeRound = () => {
        if (queuedQuestions.length === 0) {
            document.getElementById("coach-plan-question-set")?.scrollIntoView({ block: "start", behavior: "smooth" });
            return;
        }
        const rect = nextPracticeRoundAnchorRef.current?.getBoundingClientRect();
        setNextPracticeRoundAnchorRect(rect ? {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        } : null);
        setIsNextPracticeRoundOpen(true);
    };

    return (
        <main className="candidate-design-system relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] -mt-4 min-h-screen w-screen overflow-x-hidden bg-surface-base text-text-primary sm:-mt-6 lg:-mt-10">
            {hasPractice ? (
                <div className="mx-auto w-full max-w-[88rem] px-4 pb-6 pt-36 sm:px-5 sm:pt-32 md:px-6 md:pb-8 lg:px-8">
                    <header
                        role="banner"
                        aria-label="Dashboard header"
                        className="fixed left-0 right-0 top-0 z-50 bg-gradient-to-b from-surface-base/95 via-surface-base/90 to-surface-base/0 px-4 pb-8 pt-3 sm:px-5 md:px-6 lg:px-8"
                    >
                        <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <h1 className="font-display text-3xl font-bold tracking-tight text-[rgb(var(--candidate-foreground)/0.84)] md:text-4xl">
                                Interview Coach
                            </h1>
                            <div ref={nextPracticeRoundAnchorRef} className="w-full rounded-[1.75rem] bg-white/40 p-1 backdrop-blur-xl sm:w-80">
                                <NextPracticeRoundButton
                                    queuedCount={queuedQuestions.length}
                                    onOpen={handleOpenNextPracticeRound}
                                />
                            </div>
                        </div>
                    </header>

                    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_23rem] xl:gap-8">
                        <section className="min-w-0 space-y-8">
                            <TargetInterviewSwitcher targetInterviews={dashboard.targetInterviews} />
                            {coachUpdate ? (
                                <CoachUpdateCard
                                    update={coachUpdate}
                                    onOpen={() => setIsCoachUpdateOpen(true)}
                                />
                            ) : null}
                            {coachPlanOverview ? <CoachPlanOverview overview={coachPlanOverview} /> : null}
                            <CoachPlanCategoryFace
                                categories={categoryDrilldowns}
                                onCategorySelect={setSelectedCoachPlanCategoryId}
                            />
                            <CoachPlanSkillsFace
                                skills={skills}
                                onSkillSelect={setSelectedCoachPlanSkillId}
                            />
                            <CoachPlanQuestionSetFace
                                categories={categoryDrilldowns}
                                queuedQuestionIds={queuedQuestionIds}
                                onAddQuestionToNextRound={handleAddQuestionToNextRound}
                            />
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
            {coachUpdate && isCoachUpdateOpen ? (
                <CoachUpdateDialog
                    update={coachUpdate}
                    questions={coachUpdateQuestions}
                    queuedQuestionIds={queuedQuestionIds}
                    onAddQuestionToNextRound={handleAddQuestionToNextRound}
                    onClose={() => setIsCoachUpdateOpen(false)}
                />
            ) : null}
            {isNextPracticeRoundOpen && queuedQuestionItems.length > 0 ? (
                <NextPracticeRoundSurface
                    questions={queuedQuestionItems}
                    onRemoveQuestion={handleRemoveQuestionFromNextRound}
                    onClearAll={handleClearNextPracticeRound}
                    anchorRect={nextPracticeRoundAnchorRect}
                    onClose={() => setIsNextPracticeRoundOpen(false)}
                />
            ) : null}
        </main>
    );
}
