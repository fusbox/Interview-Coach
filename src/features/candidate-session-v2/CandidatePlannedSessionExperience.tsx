"use client";

import {
    AlertCircle,
    ArrowLeft,
    Camera,
    CheckCircle2,
    ClipboardList,
    Keyboard,
    Mic,
    Play,
    SendHorizontal,
    UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
    candidateSetupStageOptions,
    type CandidateSetupStageId,
} from "@/features/candidate-setup-v2/candidate-setup-contract";
import type {
    CandidateAnswerDraft,
    CandidateAnswerDrafts,
} from "./candidate-answer-lifecycle";
import {
    createCandidateQuestionPlan,
    type CandidateQuestionPlanSlot,
} from "./candidate-question-plan";
import {
    readCandidateProvisionalSession,
    saveCandidateProvisionalSessionProgress,
    type CandidateProvisionalSessionProgress,
    type CandidateProvisionalSessionRecord,
} from "./candidate-provisional-session-store";
import {
    createCandidateQuestionWordingRequest,
    createCandidateQuestionWordingUnavailableResult,
    createFixtureCandidateQuestionWordingResult,
    parseCandidateQuestionWordingResult,
} from "./candidate-question-wording";

type CandidatePlannedSessionExperienceProps = {
    sessionId: string;
    dashboardHref: string;
    initialSession?: CandidateProvisionalSessionRecord | null;
};

export function CandidatePlannedSessionExperience({
    sessionId,
    dashboardHref,
    initialSession = null,
}: CandidatePlannedSessionExperienceProps) {
    const [session, setSession] = useState<CandidateProvisionalSessionRecord | null>(initialSession);
    const [hasCheckedStorage, setHasCheckedStorage] = useState(Boolean(initialSession));
    const [progress, setProgress] = useState<CandidateProvisionalSessionProgress>({
        status: initialSession?.progress?.status ?? "planned",
        currentQuestionIndex: initialSession?.progress?.currentQuestionIndex ?? 0,
    });
    const [answerDrafts, setAnswerDrafts] = useState<CandidateAnswerDrafts>(initialSession?.answerDrafts ?? {});

    useEffect(() => {
        if (initialSession) {
            setSession(initialSession);
            setHasCheckedStorage(true);
            setProgress(initialSession.progress ?? {
                status: "planned",
                currentQuestionIndex: 0,
            });
            setAnswerDrafts(initialSession.answerDrafts ?? {});
            window.scrollTo({ top: 0 });
            return;
        }

        const storedSession = readCandidateProvisionalSession(window.sessionStorage, sessionId);
        setSession(storedSession);
        setHasCheckedStorage(true);
        setProgress(storedSession?.progress ?? {
            status: "planned",
            currentQuestionIndex: 0,
        });
        setAnswerDrafts(storedSession?.answerDrafts ?? {});
        window.scrollTo({ top: 0 });
    }, [initialSession, sessionId]);

    const stageLabel = useMemo(
        () => session ? getStageLabel(session.setupSnapshot.interviewStage) : "",
        [session],
    );
    const questionPlan = useMemo(() => {
        if (!session) {
            return null;
        }

        return session.questionPlanSnapshot ?? createCandidateQuestionPlan({
            interviewStage: session.setupSnapshot.interviewStage,
            questionCount: session.setupSnapshot.questionCount,
        });
    }, [session]);
    const questionWordingState = useMemo(() => {
        if (!session || !questionPlan) {
            return null;
        }

        try {
            return {
                request: createCandidateQuestionWordingRequest({
                    setupSnapshot: session.setupSnapshot,
                    questionPlanSnapshot: questionPlan,
                    now: new Date(session.setupSnapshot.createdAt),
                }),
                unavailable: createCandidateQuestionWordingUnavailableResult(),
            };
        } catch {
            return null;
        }
    }, [questionPlan, session]);
    const questionWordingPreview = useMemo(() => {
        if (!session || !questionPlan) {
            return null;
        }

        try {
            if (session.questionWordingSnapshot) {
                return parseCandidateQuestionWordingResult(session.questionWordingSnapshot, questionPlan);
            }

            return createFixtureCandidateQuestionWordingResult({
                setupSnapshot: session.setupSnapshot,
                questionPlanSnapshot: questionPlan,
            });
        } catch {
            return null;
        }
    }, [questionPlan, session]);

    if (!hasCheckedStorage) {
        return (
            <main className="candidate-design-system planned-session-page">
                <section className="planned-session-card" aria-live="polite">
                    <p className="type-eyebrow">Practice session</p>
                    <h1>Loading your practice plan.</h1>
                </section>
            </main>
        );
    }

    if (!session) {
        return (
            <main className="candidate-design-system planned-session-page">
                <section className="planned-session-card planned-session-card--missing">
                    <p className="type-eyebrow">Practice session</p>
                    <h1>I need the setup details for this practice round.</h1>
                    <p>
                        Start from Practice Setup again so I can prepare the round from the role, job description,
                        interview stage, and question count.
                    </p>
                    <a className="planned-session-action" href="/candidate/setup">
                        <ArrowLeft size={16} aria-hidden="true" />
                        Back to setup
                    </a>
                </section>
            </main>
        );
    }

    if (progress.status === "question_preview" && questionWordingPreview) {
        const activeQuestionIndex = Math.min(
            progress.currentQuestionIndex,
            Math.max(questionWordingPreview.questions.length - 1, 0),
        );
        const activeQuestion = questionWordingPreview.questions[activeQuestionIndex];
        const activeSlot = questionPlan?.slots[activeQuestion.index] ?? null;

        return (
            <main className="candidate-design-system planned-session-page">
                <section className="planned-live-question app-grid" aria-labelledby="planned-live-question-title">
                    <div className="planned-question-plan__header">
                        <p className="type-eyebrow">Question preview</p>
                        <h1 id="planned-live-question-title">
                            Question {activeQuestion.index + 1} of {questionWordingPreview.questions.length}
                        </h1>
                        <p>
                            This is a read-only question shell from the carried wording snapshot. Answer submission and
                            feedback are not connected yet.
                        </p>
                    </div>

                    <article className="planned-live-question__card">
                        <p className="type-eyebrow">{activeSlot?.label ?? "Question"}</p>
                        <h2>{activeQuestion.questionText}</h2>
                        <p>
                            When the live runtime lands, this surface will collect your answer and guide the next step.
                            For now, it only proves the question handoff.
                        </p>
                    </article>

                    <section className="answer-draft-shell" aria-labelledby="answer-draft-title">
                        <div className="answer-draft-shell__header">
                            <div>
                                <p className="type-eyebrow">Answer draft</p>
                                <h2 id="answer-draft-title">Try your answer here.</h2>
                            </div>
                            <div className="answer-draft-shell__modes" aria-label="Answer mode">
                                <button type="button" aria-pressed="true">
                                    <Keyboard size={16} aria-hidden="true" />
                                    Type answer
                                </button>
                                <button type="button" disabled>
                                    <Mic size={16} aria-hidden="true" />
                                    Record answer
                                </button>
                                <button type="button" disabled>
                                    <Camera size={16} aria-hidden="true" />
                                    Add photo notes
                                </button>
                            </div>
                        </div>

                        <label className="answer-draft-shell__field">
                            <span>Draft answer</span>
                            <textarea
                                value={answerDrafts[activeQuestion.slotId]?.text ?? ""}
                                onChange={(event) => updateAnswerDraft({
                                    slotId: activeQuestion.slotId,
                                    questionIndex: activeQuestion.index,
                                    text: event.target.value,
                                })}
                                rows={7}
                                placeholder="Write a rough answer. Submission and coaching are not connected yet."
                            />
                        </label>

                        <div className="answer-draft-shell__footer">
                            <p>Drafts stay on this screen only until the answer lifecycle is connected.</p>
                            <button className="planned-session-action" type="button" disabled>
                                <SendHorizontal size={16} aria-hidden="true" />
                                Submit answer
                            </button>
                        </div>
                    </section>
                </section>

                <section className="planned-session-footer app-grid" aria-label="Question preview actions">
                    <button
                        className="planned-session-secondary"
                        type="button"
                        onClick={() => updateProgress({
                            status: "planned",
                            currentQuestionIndex: activeQuestionIndex,
                        })}
                    >
                        Back to plan
                    </button>
                    <button
                        className="planned-session-secondary"
                        type="button"
                        disabled={activeQuestionIndex === 0}
                        onClick={() => updateProgress({
                            status: "question_preview",
                            currentQuestionIndex: Math.max(activeQuestionIndex - 1, 0),
                        })}
                    >
                        Previous question preview
                    </button>
                    <button
                        className="planned-session-secondary"
                        type="button"
                        disabled={activeQuestionIndex >= questionWordingPreview.questions.length - 1}
                        onClick={() => updateProgress({
                            status: "question_preview",
                            currentQuestionIndex: Math.min(
                                activeQuestionIndex + 1,
                                questionWordingPreview.questions.length - 1,
                            ),
                        })}
                    >
                        Next question preview
                    </button>
                    <button className="planned-session-action" type="button" disabled>
                        <Play size={16} aria-hidden="true" />
                        Start questions
                    </button>
                </section>
            </main>
        );
    }

    return (
        <main className="candidate-design-system planned-session-page">
            <section className="planned-session-hero app-grid">
                <div className="planned-session-hero__copy">
                    <p className="type-eyebrow">Practice session</p>
                    <h1>{session.setupSnapshot.targetRole}</h1>
                    <p>
                        I have the setup details for this round. Next, I will use them to plan questions before the live
                        session begins.
                    </p>
                </div>

                <aside className="planned-session-card planned-session-card--accent" aria-label="Round setup">
                    <div className="planned-session-card__icon" aria-hidden="true">
                        <UserCheck size={20} />
                    </div>
                    <dl className="planned-session-summary">
                        <div>
                            <dt>Stage</dt>
                            <dd>{stageLabel}</dd>
                        </div>
                        <div>
                            <dt>Questions</dt>
                            <dd>{session.setupSnapshot.questionCount}</dd>
                        </div>
                        <div>
                            <dt>Resume</dt>
                            <dd>{session.setupSnapshot.resumeText ? "Included" : "Not included"}</dd>
                        </div>
                    </dl>
                </aside>
            </section>

            <section className="planned-session-grid app-grid" aria-label="Practice plan">
                <article className="planned-session-card">
                    <div className="planned-session-card__icon" aria-hidden="true">
                        <ClipboardList size={20} />
                    </div>
                    <p className="type-eyebrow">Role context</p>
                    <h2>Job description is ready.</h2>
                    <p>{session.setupSnapshot.jobDescription}</p>
                </article>

                <article className="planned-session-card planned-session-card--soft">
                    <div className="planned-session-card__icon" aria-hidden="true">
                        <CheckCircle2 size={20} />
                    </div>
                    <p className="type-eyebrow">Next boundary</p>
                    <h2>Question wording comes next.</h2>
                    <p>
                        I have the category mix for this round. Next, I will turn it into the questions you can answer
                        in the live practice session.
                    </p>
                </article>

                {questionWordingState ? (
                    <article className="planned-session-card" aria-label="Question wording status">
                        <div className="planned-session-card__icon" aria-hidden="true">
                            <AlertCircle size={20} />
                        </div>
                        <p className="type-eyebrow">Wording status</p>
                        <h2>Question wording request is ready.</h2>
                        <p>
                            {questionWordingState.request.questionPlanSnapshot.slots.length} planned slots are ready to
                            send for wording. Fixture wording is shown below, but question wording is not connected yet.
                        </p>
                        {questionWordingState.unavailable.reason === "provider_not_configured" ? (
                            <p>
                                Start questions stays disabled until the wording service returns questions that match
                                the plan.
                            </p>
                        ) : null}
                    </article>
                ) : null}
            </section>

            {questionPlan ? (
                <section className="planned-question-plan app-grid" aria-labelledby="planned-question-plan-title">
                    <div className="planned-question-plan__header">
                        <p className="type-eyebrow">Question plan</p>
                        <h2 id="planned-question-plan-title">Here is the mix I planned from.</h2>
                        <p>
                            This is the category shape for your selected round. Production question wording has not been
                            generated yet.
                        </p>
                    </div>

                    <ol className="planned-question-list">
                        {questionPlan.slots.map((slot) => (
                            <li key={slot.id}>
                                <QuestionPlanSlotView slot={slot} />
                            </li>
                        ))}
                    </ol>
                </section>
            ) : null}

            {questionWordingPreview && questionPlan ? (
                <section className="planned-question-plan app-grid" aria-labelledby="planned-question-preview-title">
                    <div className="planned-question-plan__header">
                        <p className="type-eyebrow">Question preview</p>
                        <h2 id="planned-question-preview-title">Here is the fixture wording for this round.</h2>
                        <p>
                            This preview is deterministic local wording mapped to the plan slots. It is not the live
                            question-generation service.
                        </p>
                    </div>

                    <ol className="planned-question-list">
                        {questionWordingPreview.questions.map((question, index) => (
                            <li key={question.slotId}>
                                <QuestionPreviewSlotView
                                    questionText={question.questionText}
                                    slot={questionPlan.slots[index]}
                                />
                            </li>
                        ))}
                    </ol>
                </section>
            ) : null}

            <section className="planned-session-footer app-grid" aria-label="Session actions">
                <a className="planned-session-secondary" href={dashboardHref}>
                    Finish session
                </a>
                {questionWordingPreview ? (
                    <button
                        className="planned-session-secondary"
                        type="button"
                        onClick={() => updateProgress({
                            status: "question_preview",
                            currentQuestionIndex: 0,
                        })}
                    >
                        Open first question preview
                    </button>
                ) : null}
                <button className="planned-session-action" type="button" disabled>
                    <Play size={16} aria-hidden="true" />
                    Start questions
                </button>
            </section>
        </main>
    );

    function updateProgress(nextProgress: CandidateProvisionalSessionProgress) {
        setProgress(nextProgress);
        saveCandidateProvisionalSessionProgress(window.sessionStorage, sessionId, nextProgress);
    }

    function updateAnswerDraft({
        slotId,
        questionIndex,
        text,
    }: {
        slotId: string;
        questionIndex: number;
        text: string;
    }) {
        const draft: CandidateAnswerDraft = {
            slotId,
            questionIndex,
            mode: "text",
            text,
            updatedAt: new Date().toISOString(),
        };

        setAnswerDrafts((currentDrafts) => ({
            ...currentDrafts,
            [slotId]: draft,
        }));

        if (!initialSession) {
            return;
        }

        void fetch(`/candidate/session/${encodeURIComponent(sessionId)}/answer-drafts`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                slotId,
                questionIndex,
                mode: "text",
                text,
            }),
        });
    }
}

function QuestionPreviewSlotView({
    questionText,
    slot,
}: {
    questionText: string;
    slot: CandidateQuestionPlanSlot;
}) {
    return (
        <article className="planned-question-slot">
            <span className="planned-question-slot__number">Q{slot.index + 1}</span>
            <div>
                <h3>{slot.label}</h3>
                <p>{questionText}</p>
            </div>
        </article>
    );
}

function QuestionPlanSlotView({ slot }: { slot: CandidateQuestionPlanSlot }) {
    return (
        <article className="planned-question-slot">
            <span className="planned-question-slot__number">Q{slot.index + 1}</span>
            <div>
                <h3>{slot.label}</h3>
                <p>{slot.purpose}</p>
            </div>
        </article>
    );
}

function getStageLabel(stageId: CandidateSetupStageId) {
    return candidateSetupStageOptions.find((stage) => stage.id === stageId)?.label ?? "First interview";
}
