"use client";

import useEmblaCarousel from "embla-carousel-react";
import {
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
} from "react";

import type { CandidateCoachUpdateDetail } from "./candidate-coach-update-detail";
import { CandidateAnswerReview } from "./CandidateAnswerReview";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";
import {
    CandidateNextRoundReviewFooter,
    useCandidateNextRoundBuilder,
} from "./CandidateNextRoundBuilderExperience";
import { CandidateOpenedSurfaceHeader } from "@/features/candidate-v2/CandidateOpenedSurfaceHeader";

export function CandidateCoachUpdateDialog({
    detail,
    suppressPracticeActions = false,
    onClose,
}: {
    detail: CandidateCoachUpdateDetail;
    suppressPracticeActions?: boolean;
    onClose: () => void;
}) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: "center",
        containScroll: false,
        loop: false,
        slidesToScroll: 1,
    });
    const dialogRef = useRef<HTMLElement | null>(null);
    const backdropRef = useRef<HTMLDivElement | null>(null);
    const carouselViewportRef = useRef<HTMLDivElement | null>(null);
    const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const sheetDragRef = useRef<{ pointerId: number; startY: number } | null>(null);
    const sheetDragOffsetRef = useRef(0);
    const [sheetDragOffset, setSheetDragOffset] = useState(0);
    const [isSheetDragging, setIsSheetDragging] = useState(false);
    const nextRoundBuilder = useCandidateNextRoundBuilder();
    const isBuilderOpen = Boolean(nextRoundBuilder?.isOpen);
    const isBuilderOpenRef = useRef(isBuilderOpen);

    useEffect(() => {
        isBuilderOpenRef.current = isBuilderOpen;
        const backdrop = backdropRef.current;
        if (!backdrop) return;
        if (isBuilderOpen) backdrop.setAttribute("inert", "");
        else backdrop.removeAttribute("inert");
        return () => backdrop.removeAttribute("inert");
    }, [isBuilderOpen]);

    const setCarouselViewport = useCallback((node: HTMLDivElement | null) => {
        carouselViewportRef.current = node;
        emblaRef(node);
    }, [emblaRef]);

    const resetContentScroll = useCallback(() => {
        if (!contentRef.current) return;
        if (typeof contentRef.current.scrollTo === "function") {
            contentRef.current.scrollTo({ top: 0 });
        } else {
            contentRef.current.scrollTop = 0;
        }
    }, []);

    const revealNavigationItem = useCallback((index: number) => {
        window.requestAnimationFrame(() => {
            document.getElementById(`coach-update-picker-${detail.items[index]?.questionKey}`)?.scrollIntoView?.({
                block: "nearest",
                inline: "center",
            });
        });
    }, [detail.items]);

    const selectQuestion = useCallback((index: number, focusTab = false) => {
        const nextIndex = Math.min(Math.max(index, 0), detail.items.length - 1);
        setSelectedIndex(nextIndex);
        if (emblaApi?.selectedSnap() !== nextIndex) emblaApi?.goTo(nextIndex);
        resetContentScroll();
        revealNavigationItem(nextIndex);
        if (focusTab) {
            window.requestAnimationFrame(() => {
                document.getElementById(`coach-update-picker-${detail.items[nextIndex]?.questionKey}`)?.focus();
            });
        }
    }, [detail.items, emblaApi, resetContentScroll, revealNavigationItem]);

    useEffect(() => {
        if (!emblaApi) return undefined;
        const syncSelection = () => {
            setSelectedIndex(emblaApi.selectedSnap());
            resetContentScroll();
            revealNavigationItem(emblaApi.selectedSnap());
        };
        emblaApi.on("select", syncSelection);
        return () => {
            emblaApi.off("select", syncSelection);
        };
    }, [emblaApi, resetContentScroll, revealNavigationItem]);

    useLayoutEffect(() => {
        const viewport = carouselViewportRef.current;
        const selectedSlide = slideRefs.current[selectedIndex];
        if (!viewport || !selectedSlide) return undefined;

        const syncHeight = () => {
            const height = selectedSlide.getBoundingClientRect().height;
            if (height > 0) viewport.style.height = `${Math.ceil(height)}px`;
        };
        syncHeight();

        const resizeObserver = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(syncHeight);
        resizeObserver?.observe(selectedSlide);
        window.addEventListener("resize", syncHeight);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", syncHeight);
        };
    }, [detail.items.length, selectedIndex]);

    useEffect(() => {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (isBuilderOpenRef.current) return;
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href]:not([tabindex="-1"]), summary, [tabindex]:not([tabindex="-1"])',
            ));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            window.requestAnimationFrame(() => {
                const previousFocus = previousFocusRef.current;
                const returnTarget = previousFocus && previousFocus !== document.body && previousFocus.isConnected
                    ? previousFocus
                    : document.querySelector<HTMLElement>("[data-coach-update-trigger]");
                returnTarget?.focus();
            });
        };
    }, [onClose]);

    const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex: number | null = null;
        if (event.key === "ArrowRight") nextIndex = Math.min(index + 1, detail.items.length - 1);
        if (event.key === "ArrowLeft") nextIndex = Math.max(index - 1, 0);
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = detail.items.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        selectQuestion(nextIndex, true);
    };

    const resetSheetDrag = () => {
        sheetDragRef.current = null;
        sheetDragOffsetRef.current = 0;
        setSheetDragOffset(0);
        setIsSheetDragging(false);
    };

    const handleSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        sheetDragRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
        };
        sheetDragOffsetRef.current = 0;
        setSheetDragOffset(0);
        setIsSheetDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handleSheetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = sheetDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const nextOffset = Math.max(0, event.clientY - drag.startY);
        sheetDragOffsetRef.current = nextOffset;
        setSheetDragOffset(nextOffset);
    };

    const handleSheetPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
        const drag = sheetDragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        const sheetHeight = dialogRef.current?.getBoundingClientRect().height ?? 0;
        const closeThreshold = Math.min(128, Math.max(72, sheetHeight * 0.2));
        const shouldClose = sheetDragOffsetRef.current >= closeThreshold;
        resetSheetDrag();
        if (shouldClose) onClose();
    };

    const sheetStyle = {
        "--candidate-coach-update-sheet-offset": `${sheetDragOffset}px`,
    } as CSSProperties;

    const questionNavigation = detail.items.length > 1 ? (
        <nav className="candidate-coach-update-nav" aria-label="Coach Update question navigation">
            <button
                type="button"
                aria-label="Previous question feedback"
                disabled={selectedIndex === 0}
                onClick={() => selectQuestion(selectedIndex - 1)}
            >
                <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <div role="group" aria-label="Question feedback slides">
                {detail.items.map((item, index) => {
                    const isCurrent = selectedIndex === index;
                    return (
                        <button
                            key={item.questionKey}
                            id={`coach-update-picker-${item.questionKey}`}
                            type="button"
                            aria-controls={`coach-update-slide-${item.questionKey}`}
                            aria-current={isCurrent ? "true" : undefined}
                            aria-label={isCurrent
                                ? `Current feedback: question ${item.questionNumber}`
                                : `Go to question ${item.questionNumber} feedback`}
                            className={`candidate-coach-update-nav__picker${isCurrent ? " is-current" : ""}`}
                            tabIndex={isCurrent ? 0 : -1}
                            onClick={() => selectQuestion(index)}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                        >
                            Q{item.questionNumber}
                        </button>
                    );
                })}
            </div>
            <button
                type="button"
                aria-label="Next question feedback"
                disabled={selectedIndex === detail.items.length - 1}
                onClick={() => selectQuestion(selectedIndex + 1)}
            >
                <ChevronRight size={17} aria-hidden="true" />
            </button>
        </nav>
    ) : undefined;

    return (
        <div
            ref={backdropRef}
            className="candidate-coach-update-backdrop"
            data-testid="coach-update-backdrop"
            aria-hidden={isBuilderOpen || undefined}
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className={`candidate-coach-update-dialog${isSheetDragging ? " is-sheet-dragging" : ""}`}
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-coach-update-title"
                style={sheetStyle}
            >
                <div
                    className="candidate-coach-update-dialog__grabber"
                    data-testid="coach-update-sheet-grabber"
                    aria-hidden="true"
                    onPointerDown={handleSheetPointerDown}
                    onPointerMove={handleSheetPointerMove}
                    onPointerUp={handleSheetPointerEnd}
                    onPointerCancel={resetSheetDrag}
                >
                    <span />
                </div>
                <CandidateOpenedSurfaceHeader
                    className="candidate-coach-update-dialog__header"
                    closeButtonRef={closeButtonRef}
                    closeLabel="Close Coach Update"
                    navigation={questionNavigation}
                    onClose={onClose}
                    title="Let's review your latest practice."
                    titleId="candidate-coach-update-title"
                />

                <div className="candidate-coach-update-dialog__body" ref={contentRef}>
                    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                        Showing question feedback {selectedIndex + 1} of {detail.items.length}
                    </p>

                    <div
                        className="candidate-coach-update-carousel"
                        ref={setCarouselViewport}
                        role="region"
                        aria-label="Coach Update question feedback carousel"
                        aria-roledescription="carousel"
                        data-has-previous={selectedIndex > 0}
                        data-has-next={selectedIndex < detail.items.length - 1}
                    >
                        <div className="candidate-coach-update-carousel__track">
                            {detail.items.map((item, index) => {
                                const isCurrent = selectedIndex === index;
                                return (
                                    <div
                                        className={`candidate-coach-update-carousel__slide${isCurrent ? " is-current" : ""}`}
                                        ref={(node) => {
                                            slideRefs.current[index] = node;
                                        }}
                                        id={`coach-update-slide-${item.questionKey}`}
                                        key={item.questionKey}
                                        role="group"
                                        aria-roledescription="slide"
                                        aria-label={`Question feedback ${index + 1} of ${detail.items.length}`}
                                        aria-hidden={isCurrent ? undefined : true}
                                    >
                                        <article className="candidate-coach-update-question">
                                            <header className="candidate-coach-update-question__context">
                                                <p>{item.category}</p>
                                                <h3>{item.questionText}</h3>
                                            </header>

                                            <CandidateAnswerReview item={item} isCurrent={isCurrent} />

                                            {item.comparison.kind === "repeat_practice" ? (
                                                <p className="candidate-coach-update-question__comparison">
                                                    {item.comparison.message}
                                                </p>
                                            ) : null}

                                            {!suppressPracticeActions ? (
                                                <CandidateQuestionPracticeActions
                                                    pointer={{
                                                        sourceCandidatePracticeSessionId: item.focusedPracticeAction.source.candidatePracticeSessionId,
                                                        sourceQuestionKey: item.focusedPracticeAction.source.questionKey,
                                                    }}
                                                    practiceNowHref={item.focusedPracticeAction.href}
                                                    isCurrent={isCurrent}
                                                />
                                            ) : null}
                                        </article>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <CandidateNextRoundReviewFooter className="candidate-next-round-review-footer--sheet" />
            </section>
        </div>
    );
}
