"use client";

import { ArrowRight, MessageSquareQuote } from "lucide-react";

import type { CandidateCoachUpdateQuestionDetail } from "./candidate-coach-update-detail";
import { CandidateTranscriptCanvas } from "./CandidateTranscriptCanvas";

export function CandidateAnswerReview({
    item,
    isCurrent,
}: {
    item: CandidateCoachUpdateQuestionDetail;
    isCurrent: boolean;
}) {
    const transcriptProjection = item.transcriptCanvas
        ? {
            ...item.transcriptCanvas,
            wholeAnswerIndicators: [],
            primaryGap: null,
        }
        : null;
    const wholeAnswerIndicator = item.transcriptCanvas?.wholeAnswerIndicators[0] ?? null;
    const gap = item.transcriptCanvas?.primaryGap ?? null;
    const nextFocus = gap?.message ?? item.coachRead.nextPracticeFocus;
    const observation = selectDistinctObservation({
        preferred: wholeAnswerIndicator?.message ?? null,
        fallback: item.coachRead.observation,
        nextFocus,
    });

    return (
        <div className="candidate-answer-review">
            <section
                className="candidate-answer-review__evidence"
                aria-labelledby={`candidate-answer-${item.questionKey}`}
            >
                <p className="type-eyebrow" id={`candidate-answer-${item.questionKey}`}>Your answer</p>
                <CandidateTranscriptCanvas
                    annotationPopoverVariant="compact"
                    answerText={item.answer.text}
                    projection={transcriptProjection}
                    isCurrent={isCurrent}
                />
            </section>

            {observation ? (
                <aside
                    className="candidate-answer-review__note surface-sky"
                    aria-label={`What the coach noticed in question ${item.questionNumber}`}
                >
                    <span className="candidate-answer-review__icon" aria-hidden="true">
                        <MessageSquareQuote size={16} />
                    </span>
                    <div>
                        <div className="candidate-answer-review__meta">
                            <p>What I noticed</p>
                            <span>Question {item.questionNumber}</span>
                        </div>
                        <p className="candidate-answer-review__message">{observation}</p>
                    </div>
                </aside>
            ) : null}

            <aside
                className="candidate-answer-review__next"
                aria-label={`What to try next for question ${item.questionNumber}`}
            >
                <span className="candidate-answer-review__icon" aria-hidden="true">
                    <ArrowRight size={17} strokeWidth={2.2} />
                </span>
                <div>
                    <div className="candidate-answer-review__meta">
                        <p>Try next</p>
                        <span>Question {item.questionNumber}</span>
                    </div>
                    <p className="candidate-answer-review__message">{nextFocus}</p>
                    {gap?.suggestedShape.length ? (
                        <p className="candidate-answer-review__shape">
                            {gap.suggestedShape.join(" / ")}
                        </p>
                    ) : null}
                </div>
            </aside>
        </div>
    );
}

function selectDistinctObservation({
    fallback,
    nextFocus,
    preferred,
}: {
    fallback: string;
    nextFocus: string;
    preferred: string | null;
}) {
    const normalizedNextFocus = normalizeGuidance(nextFocus);
    const candidates = [preferred, fallback].filter((value): value is string => Boolean(value?.trim()));
    return candidates.find((value) => normalizeGuidance(value) !== normalizedNextFocus) ?? null;
}

function normalizeGuidance(value: string) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
