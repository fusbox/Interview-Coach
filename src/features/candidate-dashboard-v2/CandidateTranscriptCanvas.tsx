"use client";

import * as Popover from "@radix-ui/react-popover";
import { Lightbulb, MessageSquareQuote, X } from "lucide-react";
import { useMemo } from "react";

import { getCandidateEvidenceMarkerLabel } from "./candidate-transcript-canvas-labels";
import type {
    CandidateTranscriptAnnotation,
    CandidateTranscriptCanvasProjection,
} from "./candidate-transcript-canvas";
import { createCandidateTranscriptSegments } from "./candidate-transcript-segments";

export function CandidateTranscriptCanvas({
    answerText,
    projection,
    isCurrent,
}: {
    answerText: string;
    projection: CandidateTranscriptCanvasProjection | null;
    isCurrent: boolean;
}) {
    const annotationsById = useMemo(
        () => new Map(projection?.annotations.map((annotation) => [annotation.id, annotation]) ?? []),
        [projection],
    );
    const segments = useMemo(
        () => createCandidateTranscriptSegments(answerText, projection?.annotations ?? []),
        [answerText, projection],
    );

    return (
        <div className="candidate-transcript-canvas">
            <blockquote className="candidate-transcript-canvas__answer">
                {segments.map((segment) => {
                    const annotations = segment.annotationIds.flatMap((id) => {
                        const annotation = annotationsById.get(id);
                        return annotation ? [annotation] : [];
                    });
                    return annotations.length > 0 ? (
                        <CandidateTranscriptAnnotationTrigger
                            key={segment.id}
                            annotations={annotations}
                            isCurrent={isCurrent}
                            text={segment.text}
                        />
                    ) : <span key={segment.id}>{segment.text}</span>;
                })}
            </blockquote>

            {projection && projection.wholeAnswerIndicators.length > 0 ? (
                <div
                    className="candidate-transcript-canvas__answer-signals"
                    role="region"
                    aria-label="Answer-level coach notes"
                >
                    {projection.wholeAnswerIndicators.map((indicator) => (
                        <div key={indicator.id} className="candidate-transcript-canvas__answer-signal">
                            <MessageSquareQuote size={16} aria-hidden="true" />
                            <div>
                                <p className="type-eyebrow">{indicator.label}</p>
                                <p>{indicator.message}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {projection?.primaryGap ? (
                <aside className="candidate-transcript-canvas__gap" aria-label="A useful signal to add">
                    <Lightbulb size={17} aria-hidden="true" />
                    <div>
                        <p className="type-eyebrow">{projection.primaryGap.label}</p>
                        <p>{projection.primaryGap.message}</p>
                        <p className="candidate-transcript-canvas__shape">
                            {projection.primaryGap.suggestedShape.join(" / ")}
                        </p>
                    </div>
                </aside>
            ) : null}
        </div>
    );
}

function CandidateTranscriptAnnotationTrigger({
    annotations,
    isCurrent,
    text,
}: {
    annotations: CandidateTranscriptAnnotation[];
    isCurrent: boolean;
    text: string;
}) {
    const markerIds = Array.from(new Set(annotations.flatMap((annotation) => annotation.markerIds)));
    const indicators = annotations.flatMap((annotation) => annotation.indicators).filter((indicator, index, all) => (
        all.findIndex((candidate) => (
            candidate.kind === indicator.kind && candidate.message === indicator.message
        )) === index
    ));

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className="candidate-transcript-canvas__annotation"
                    tabIndex={isCurrent ? 0 : -1}
                >
                    {text}
                </button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    className="candidate-transcript-canvas__popover"
                    side="top"
                    align="start"
                    sideOffset={8}
                    collisionPadding={12}
                >
                    <div className="candidate-transcript-canvas__popover-header">
                        <p>Evidence in your answer</p>
                        <Popover.Close aria-label="Close evidence note">
                            <X size={15} aria-hidden="true" />
                        </Popover.Close>
                    </div>
                    <div className="candidate-transcript-canvas__markers" aria-label="Evidence signals">
                        {markerIds.map((markerId) => (
                            <span key={markerId}>{getCandidateEvidenceMarkerLabel(markerId)}</span>
                        ))}
                    </div>
                    {indicators.map((indicator) => (
                        <div key={`${indicator.kind}-${indicator.message}`} className="candidate-transcript-canvas__indicator">
                            <p className="type-eyebrow">{indicator.label}</p>
                            <p>{indicator.message}</p>
                        </div>
                    ))}
                    <Popover.Arrow className="candidate-transcript-canvas__popover-arrow" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
