"use client";

import * as Popover from "@radix-ui/react-popover";
import { Lightbulb, MessageSquareQuote, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { getCandidateEvidenceMarkerLabel } from "./candidate-transcript-canvas-labels";
import type {
    CandidateTranscriptAnnotation,
    CandidateTranscriptCanvasProjection,
} from "./candidate-transcript-canvas";
import { createCandidateTranscriptSegments } from "./candidate-transcript-segments";

export function CandidateTranscriptCanvas({
    annotationPopoverVariant = "default",
    answerText,
    projection,
    isCurrent,
}: {
    annotationPopoverVariant?: "default" | "compact";
    answerText: string;
    projection: CandidateTranscriptCanvasProjection | null;
    isCurrent: boolean;
}) {
    const [openAnnotationId, setOpenAnnotationId] = useState<string | null>(null);
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
                            annotationPopoverVariant={annotationPopoverVariant}
                            open={openAnnotationId === segment.id}
                            onOpenChange={(nextOpen) => {
                                setOpenAnnotationId((currentId) => (
                                    nextOpen
                                        ? segment.id
                                        : currentId === segment.id ? null : currentId
                                ));
                            }}
                            annotations={annotations}
                            anotherAnnotationIsOpen={
                                openAnnotationId !== null && openAnnotationId !== segment.id
                            }
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
    annotationPopoverVariant,
    anotherAnnotationIsOpen,
    annotations,
    isCurrent,
    onOpenChange,
    open,
    text,
}: {
    annotationPopoverVariant: "default" | "compact";
    anotherAnnotationIsOpen: boolean;
    annotations: CandidateTranscriptAnnotation[];
    isCurrent: boolean;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    text: string;
}) {
    const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const openedByHoverRef = useRef(false);
    const suppressCloseAutoFocusRef = useRef(false);
    const compact = annotationPopoverVariant === "compact";
    const markerIds = Array.from(new Set(annotations.flatMap((annotation) => annotation.markerIds)));
    const indicators = annotations.flatMap((annotation) => annotation.indicators).filter((indicator, index, all) => (
        all.findIndex((candidate) => (
            candidate.kind === indicator.kind && candidate.message === indicator.message
        )) === index
    ));

    const clearHoverClose = () => {
        if (hoverCloseTimerRef.current === null) return;
        clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
    };

    const scheduleHoverClose = () => {
        if (!compact || !openedByHoverRef.current) return;
        clearHoverClose();
        hoverCloseTimerRef.current = setTimeout(() => {
            suppressCloseAutoFocusRef.current = true;
            openedByHoverRef.current = false;
            onOpenChange(false);
            hoverCloseTimerRef.current = null;
        }, 120);
    };

    useEffect(() => () => {
        if (hoverCloseTimerRef.current !== null) {
            clearTimeout(hoverCloseTimerRef.current);
        }
    }, []);

    return (
        <Popover.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && openedByHoverRef.current) {
                    suppressCloseAutoFocusRef.current = true;
                }
                if (!nextOpen) openedByHoverRef.current = false;
                onOpenChange(nextOpen);
            }}
        >
            <Popover.Trigger asChild>
                <button
                    type="button"
                    className="candidate-transcript-canvas__annotation"
                    tabIndex={isCurrent ? 0 : -1}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        clearHoverClose();
                        openedByHoverRef.current = false;
                    }}
                    onPointerDown={() => {
                        clearHoverClose();
                        openedByHoverRef.current = false;
                    }}
                    onPointerEnter={(event) => {
                        if (!compact || event.pointerType !== "mouse") return;
                        clearHoverClose();
                        openedByHoverRef.current = true;
                        onOpenChange(true);
                    }}
                    onPointerLeave={scheduleHoverClose}
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
                    data-variant={annotationPopoverVariant}
                    onCloseAutoFocus={(event) => {
                        if (!anotherAnnotationIsOpen && !suppressCloseAutoFocusRef.current) return;
                        event.preventDefault();
                        suppressCloseAutoFocusRef.current = false;
                    }}
                    onOpenAutoFocus={(event) => {
                        if (openedByHoverRef.current) event.preventDefault();
                    }}
                    onPointerEnter={(event) => {
                        if (!compact || event.pointerType !== "mouse") return;
                        clearHoverClose();
                    }}
                    onPointerLeave={scheduleHoverClose}
                >
                    <div className="candidate-transcript-canvas__popover-header">
                        <p>{compact ? "What I noticed" : "Evidence in your answer"}</p>
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
                            {!compact ? <p className="type-eyebrow">{indicator.label}</p> : null}
                            <p>{indicator.message}</p>
                        </div>
                    ))}
                    <Popover.Arrow className="candidate-transcript-canvas__popover-arrow" />
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
