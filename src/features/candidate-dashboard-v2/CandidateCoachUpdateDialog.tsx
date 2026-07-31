"use client";

import useEmblaCarousel from "embla-carousel-react";
import {
    ChevronLeft,
    ChevronRight,
    MessageSquareQuote,
    X,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { CandidateCoachUpdateDetail } from "./candidate-coach-update-detail";
import { CandidateAnswerReview } from "./CandidateAnswerReview";
import { CandidateQuestionPracticeActions } from "./CandidatePracticeNextActions";

export function CandidateCoachUpdateDialog({
    detail,
    onClose,
}: {
    detail: CandidateCoachUpdateDetail;
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
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

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

    useEffect(() => {
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
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

    return (
        <div
            className="candidate-coach-update-backdrop"
            data-testid="coach-update-backdrop"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className="candidate-coach-update-dialog"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-coach-update-title"
            >
                <header className="candidate-coach-update-dialog__header">
                    <MessageSquareQuote size={20} aria-hidden="true" />
                    <h2 id="candidate-coach-update-title">Let&apos;s review your latest practice.</h2>
                    <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close Coach Update">
                        <X size={19} aria-hidden="true" />
                    </button>
                </header>

                <div className="candidate-coach-update-dialog__body" ref={contentRef}>
                    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                        Showing question feedback {selectedIndex + 1} of {detail.items.length}
                    </p>

                    {detail.items.length > 1 ? (
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
                    ) : null}

                    <div
                        className="candidate-coach-update-carousel"
                        ref={emblaRef}
                        role="region"
                        aria-label="Coach Update question feedback carousel"
                        aria-roledescription="carousel"
                    >
                        <div className="candidate-coach-update-carousel__track">
                            {detail.items.map((item, index) => {
                                const isCurrent = selectedIndex === index;
                                return (
                                    <div
                                        className={`candidate-coach-update-carousel__slide${isCurrent ? " is-current" : ""}`}
                                        id={`coach-update-slide-${item.questionKey}`}
                                        key={item.questionKey}
                                        role="group"
                                        aria-roledescription="slide"
                                        aria-label={`Question feedback ${index + 1} of ${detail.items.length}`}
                                        aria-hidden={isCurrent ? undefined : true}
                                    >
                                        <article className="candidate-coach-update-question">
                                            <header className="candidate-coach-update-question__context">
                                                <p>Question {item.questionNumber} &middot; {item.category}</p>
                                                <h3>{item.questionText}</h3>
                                            </header>

                                            <CandidateAnswerReview item={item} isCurrent={isCurrent} />

                                            {item.comparison.kind === "repeat_practice" ? (
                                                <p className="candidate-coach-update-question__comparison">
                                                    {item.comparison.message}
                                                </p>
                                            ) : null}

                                            <CandidateQuestionPracticeActions
                                                pointer={{
                                                    sourceCandidatePracticeSessionId: item.focusedPracticeAction.source.candidatePracticeSessionId,
                                                    sourceQuestionKey: item.focusedPracticeAction.source.questionKey,
                                                }}
                                                practiceNowHref={item.focusedPracticeAction.href}
                                                isCurrent={isCurrent}
                                            />
                                        </article>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
