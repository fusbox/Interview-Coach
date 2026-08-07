"use client";

import {
    ArrowDown,
    ArrowRight,
    ArrowUp,
    Loader2,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";
import type { CandidateNextRoundBuilderMutation } from "@/features/candidate-practice-v2/candidate-next-round-builder-service";
import { CandidateOpenedSurfaceHeader } from "@/features/candidate-v2/CandidateOpenedSurfaceHeader";

type BuilderRequestResult = {
    ok: boolean;
    status: number;
    outcome?: string;
    builder?: CandidateNextRoundBuilderModel | null;
    redirectTo?: string;
};

export type CandidateNextRoundChoicePointer = {
    sourceCandidatePracticeSessionId?: string;
    sourceQuestionKey?: string;
    rootCandidatePracticeSessionId?: string;
    rootQuestionKey?: string;
};

export type CandidateNextRoundChoiceState = {
    choice: CandidateNextRoundBuilderModel["choices"][number];
    queuedItem: CandidateNextRoundBuilderModel["items"][number] | null;
    choiceKey: string;
};

type CandidateNextRoundChoiceMutationResult = BuilderRequestResult & {
    choiceState: CandidateNextRoundChoiceState | null;
};

type CandidateNextRoundBuilderController = {
    builder: CandidateNextRoundBuilderModel;
    isOpen: boolean;
    openBuilder: (returnFocusTo?: HTMLElement | null) => void;
    resolveChoice: (pointer: CandidateNextRoundChoicePointer) => CandidateNextRoundChoiceState | null;
    toggleChoice: (pointer: CandidateNextRoundChoicePointer) => Promise<CandidateNextRoundChoiceMutationResult>;
    busyChoiceKey: string | null;
};

type CandidateNextRoundBusyAction = {
    announcement: string;
    key: string;
};

type CandidateNextRoundBuilderExperienceProps = {
    initialBuilder: CandidateNextRoundBuilderModel;
    children: ReactNode;
    requestMutation?: (
        builder: CandidateNextRoundBuilderModel,
        mutation: CandidateNextRoundBuilderMutation,
    ) => Promise<BuilderRequestResult>;
    requestLaunch?: (builder: CandidateNextRoundBuilderModel) => Promise<BuilderRequestResult>;
    navigate?: (href: string) => void;
};

const CandidateNextRoundBuilderContext = createContext<CandidateNextRoundBuilderController | null>(null);

export function CandidateNextRoundBuilderExperience({
    initialBuilder,
    children,
    requestMutation = requestBuilderMutation,
    requestLaunch = requestBuilderLaunch,
    navigate = (href) => window.location.assign(href),
}: CandidateNextRoundBuilderExperienceProps) {
    const [builder, setBuilder] = useState(initialBuilder);
    const [isOpen, setIsOpen] = useState(false);
    const [busyChoiceKey, setBusyChoiceKey] = useState<string | null>(null);
    const busyChoiceRef = useRef<string | null>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        const content = contentRef.current;
        if (!content) return;
        if (isOpen) content.setAttribute("inert", "");
        else content.removeAttribute("inert");
        return () => content.removeAttribute("inert");
    }, [isOpen]);

    useEffect(() => {
        setBuilder(initialBuilder);
        setIsOpen(false);
        setBusyChoiceKey(null);
        busyChoiceRef.current = null;
    }, [initialBuilder]);

    const openBuilder = useCallback((returnFocusTo?: HTMLElement | null) => {
        returnFocusRef.current = returnFocusTo ?? (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
        setIsOpen(true);
    }, []);
    const closeBuilder = useCallback(() => {
        contentRef.current?.removeAttribute("inert");
        setIsOpen(false);
        window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    }, []);
    const resolveChoice = useCallback((pointer: CandidateNextRoundChoicePointer) => (
        resolveCandidateNextRoundChoiceState(builder, pointer)
    ), [builder]);
    const toggleChoice = useCallback(async (pointer: CandidateNextRoundChoicePointer) => {
        const choiceState = resolveCandidateNextRoundChoiceState(builder, pointer);
        if (!choiceState || busyChoiceRef.current) {
            return {
                ok: false,
                status: choiceState ? 409 : 404,
                outcome: choiceState ? "busy" : "invalid_source",
                choiceState,
            };
        }

        busyChoiceRef.current = choiceState.choiceKey;
        setBusyChoiceKey(choiceState.choiceKey);
        const mutation: CandidateNextRoundBuilderMutation = choiceState.queuedItem
            ? {
                kind: "remove",
                candidateNextRoundDraftItemId: choiceState.queuedItem.candidateNextRoundDraftItemId,
            }
            : {
                kind: "add",
                sourceCandidatePracticeSessionId: choiceState.choice.sourceCandidatePracticeSessionId,
                sourceQuestionKey: choiceState.choice.sourceQuestionKey,
            };
        try {
            const result = await requestMutation(builder, mutation);
            if (result.builder) {
                setBuilder(result.builder);
            }
            return { ...result, choiceState };
        } catch {
            return { ok: false, status: 0, outcome: "network_error", choiceState };
        } finally {
            busyChoiceRef.current = null;
            setBusyChoiceKey(null);
        }
    }, [builder, requestMutation]);
    const controller = useMemo(() => ({
        builder,
        isOpen,
        openBuilder,
        resolveChoice,
        toggleChoice,
        busyChoiceKey,
    }), [builder, busyChoiceKey, isOpen, openBuilder, resolveChoice, toggleChoice]);

    return (
        <CandidateNextRoundBuilderContext.Provider value={controller}>
            <div
                ref={contentRef}
                className="candidate-next-round-builder-content"
                data-next-round-builder-content
                aria-hidden={isOpen || undefined}
            >
                {children}
            </div>
            {isOpen ? (
                <CandidateNextRoundBuilderDialog
                    builder={builder}
                    onBuilderChange={setBuilder}
                    onClose={closeBuilder}
                    requestMutation={requestMutation}
                    requestLaunch={requestLaunch}
                    navigate={navigate}
                />
            ) : null}
        </CandidateNextRoundBuilderContext.Provider>
    );
}

export function CandidateNextRoundReviewFooter({
    className,
}: {
    className?: string;
}) {
    const controller = useContext(CandidateNextRoundBuilderContext);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    if (!controller || controller.builder.itemCount < 1) return null;

    const count = controller.builder.itemCount;
    return (
        <footer
            className={`candidate-next-round-review-footer${className ? ` ${className}` : ""}`}
            role="group"
            aria-label={`Next round, ${count} ${count === 1 ? "question" : "questions"}`}
        >
            <span className="candidate-next-round-review-footer__label">Next round</span>
            <span className="candidate-next-round-review-footer__count" aria-hidden="true">
                {count}
            </span>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="dialog"
                onClick={() => controller.openBuilder(triggerRef.current)}
            >
                Review next round
                <ArrowRight size={16} aria-hidden="true" />
            </button>
        </footer>
    );
}

export function useCandidateNextRoundBuilder() {
    return useContext(CandidateNextRoundBuilderContext);
}

export function resolveCandidateNextRoundChoiceState(
    builder: CandidateNextRoundBuilderModel,
    pointer: CandidateNextRoundChoicePointer,
): CandidateNextRoundChoiceState | null {
    const choice = builder.choices.find((candidate) => {
        const matchesSource = pointer.sourceCandidatePracticeSessionId
            && pointer.sourceQuestionKey
            && candidate.sourceCandidatePracticeSessionId === pointer.sourceCandidatePracticeSessionId
            && candidate.sourceQuestionKey === pointer.sourceQuestionKey;
        const matchesRoot = pointer.rootCandidatePracticeSessionId
            && pointer.rootQuestionKey
            && candidate.rootCandidatePracticeSessionId === pointer.rootCandidatePracticeSessionId
            && candidate.rootQuestionKey === pointer.rootQuestionKey;
        return Boolean(matchesSource || matchesRoot);
    });
    if (!choice) {
        return null;
    }

    const queuedItem = builder.items.find((item) => (
        item.rootCandidatePracticeSessionId === choice.rootCandidatePracticeSessionId
        && item.rootQuestionKey === choice.rootQuestionKey
    )) ?? null;
    return {
        choice,
        queuedItem,
        choiceKey: `${choice.rootCandidatePracticeSessionId}:${choice.rootQuestionKey}`,
    };
}

function CandidateNextRoundBuilderDialog({
    builder,
    onBuilderChange,
    onClose,
    requestMutation,
    requestLaunch,
    navigate,
}: {
    builder: CandidateNextRoundBuilderModel;
    onBuilderChange: (builder: CandidateNextRoundBuilderModel) => void;
    onClose: () => void;
    requestMutation: NonNullable<CandidateNextRoundBuilderExperienceProps["requestMutation"]>;
    requestLaunch: NonNullable<CandidateNextRoundBuilderExperienceProps["requestLaunch"]>;
    navigate: NonNullable<CandidateNextRoundBuilderExperienceProps["navigate"]>;
}) {
    const dialogRef = useRef<HTMLElement | null>(null);
    const clearConfirmDialogRef = useRef<HTMLElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const clearConfirmCancelRef = useRef<HTMLButtonElement | null>(null);
    const [busyAction, setBusyAction] = useState<CandidateNextRoundBusyAction | null>(null);
    const busyActionRef = useRef<string | null>(null);
    const [notice, setNotice] = useState<{ kind: "info" | "error"; message: string } | null>(null);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const sheetDragRef = useRef<{ pointerId: number; startY: number } | null>(null);
    const sheetDragOffsetRef = useRef(0);
    const [sheetDragOffset, setSheetDragOffset] = useState(0);
    const [isSheetDragging, setIsSheetDragging] = useState(false);
    const availableChoices = builder.choices.filter((choice) => !choice.isQueued);
    const isBusy = Boolean(busyAction);
    const isLaunching = busyAction?.key === "launch";

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButtonRef.current?.focus();
        const animationFrame = window.requestAnimationFrame(() => setIsExpanded(true));

        return () => {
            window.cancelAnimationFrame(animationFrame);
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                if (isLaunching) return;
                if (isClearConfirmOpen) {
                    setIsClearConfirmOpen(false);
                } else {
                    onClose();
                }
                return;
            }
            const focusScope = isClearConfirmOpen ? clearConfirmDialogRef.current : dialogRef.current;
            if (event.key !== "Tab" || !focusScope) return;
            const focusable = Array.from(focusScope.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
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
        };
    }, [isClearConfirmOpen, isLaunching, onClose]);

    useEffect(() => {
        if (isClearConfirmOpen) {
            clearConfirmCancelRef.current?.focus();
        }
    }, [isClearConfirmOpen]);

    const mutate = async (
        mutation: CandidateNextRoundBuilderMutation,
        pendingAction: CandidateNextRoundBusyAction,
    ) => {
        if (busyActionRef.current) return;
        busyActionRef.current = pendingAction.key;
        setBusyAction(pendingAction);
        setNotice(null);
        try {
            const result = await requestMutation(builder, mutation);
            if (result.builder) {
                onBuilderChange(result.builder);
            }
            if (result.outcome === "version_conflict") {
                setNotice({ kind: "info", message: "This round changed somewhere else. I loaded the latest version." });
            } else if (result.outcome === "capacity_exceeded") {
                setNotice({ kind: "info", message: `This round can include up to ${builder.capacity} questions.` });
            } else if (!result.ok) {
                setNotice({ kind: "error", message: "I couldn't update this round. Your saved items are still here." });
            }
        } catch {
            setNotice({ kind: "error", message: "I couldn't update this round. Check your connection and try again." });
        } finally {
            busyActionRef.current = null;
            setBusyAction(null);
        }
    };

    const launch = async () => {
        if (busyActionRef.current || builder.itemCount < 1) return;
        busyActionRef.current = "launch";
        setBusyAction({
            key: "launch",
            announcement: "Preparing your next round.",
        });
        setNotice(null);
        let releasePending = true;
        try {
            const result = await requestLaunch(builder);
            if (result.redirectTo) {
                releasePending = false;
                navigate(result.redirectTo);
                return;
            }
            if (result.builder) {
                onBuilderChange(result.builder);
            }
            setNotice(result.outcome === "version_conflict"
                ? { kind: "info", message: "This round changed somewhere else. I loaded the latest version before starting." }
                : { kind: "error", message: "I couldn't start this round. Your saved items are still here." });
        } catch {
            setNotice({ kind: "error", message: "I couldn't start this round. Your saved items are still here." });
        } finally {
            if (releasePending) {
                busyActionRef.current = null;
                setBusyAction(null);
            }
        }
    };

    const moveItem = (index: number, offset: -1 | 1) => {
        const nextIndex = index + offset;
        if (nextIndex < 0 || nextIndex >= builder.items.length) return;
        const orderedItemIds = builder.items.map((item) => item.candidateNextRoundDraftItemId);
        [orderedItemIds[index], orderedItemIds[nextIndex]] = [orderedItemIds[nextIndex], orderedItemIds[index]];
        const item = builder.items[index];
        if (!item) return;
        const direction = offset === -1 ? "up" : "down";
        void mutate(
            { kind: "reorder", orderedItemIds },
            {
                key: `reorder:${item.candidateNextRoundDraftItemId}:${direction}`,
                announcement: `Moving question ${item.questionNumber} ${direction}.`,
            },
        );
    };

    const resetSheetDrag = () => {
        sheetDragRef.current = null;
        sheetDragOffsetRef.current = 0;
        setSheetDragOffset(0);
        setIsSheetDragging(false);
    };

    const handleSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (isClearConfirmOpen || isLaunching || (event.pointerType === "mouse" && event.button !== 0)) return;
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

    const dialogStyle = {
        "--candidate-next-round-sheet-offset": `${sheetDragOffset}px`,
    } as CSSProperties;

    return (
        <div
            className="candidate-next-round-backdrop"
            data-testid="candidate-next-round-backdrop"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget && !isLaunching) onClose();
            }}
        >
            <section
                className={`candidate-next-round-dialog${isExpanded ? " is-expanded" : ""}${isSheetDragging ? " is-sheet-dragging" : ""}`}
                style={dialogStyle}
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-next-round-title"
                aria-busy={isBusy || undefined}
            >
                <div
                    className="candidate-next-round-dialog__grabber"
                    data-testid="candidate-next-round-sheet-grabber"
                    aria-hidden="true"
                    onPointerDown={handleSheetPointerDown}
                    onPointerMove={handleSheetPointerMove}
                    onPointerUp={handleSheetPointerEnd}
                    onPointerCancel={resetSheetDrag}
                >
                    <span />
                </div>
                <CandidateOpenedSurfaceHeader
                    className="candidate-next-round-dialog__header"
                    badge={{
                        label: `${builder.itemCount} ${builder.itemCount === 1 ? "question" : "questions"} queued`,
                        value: builder.itemCount,
                    }}
                    closeButtonRef={closeButtonRef}
                    closeDisabled={isLaunching}
                    closeLabel="Close Next round"
                    onClose={onClose}
                    title="Next round"
                    titleId="candidate-next-round-title"
                    aria-hidden={isClearConfirmOpen || undefined}
                    inert={isClearConfirmOpen || undefined}
                />

                {busyAction ? (
                    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                        {busyAction.announcement}
                    </span>
                ) : null}

                <div
                    className="candidate-next-round-dialog__body"
                    aria-hidden={isClearConfirmOpen || undefined}
                    inert={isClearConfirmOpen || undefined}
                >
                    {notice ? (
                        <p className={`candidate-next-round-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
                            {notice.message}
                        </p>
                    ) : null}

                    {builder.items.length > 0 ? (
                        <section className="candidate-next-round-section candidate-next-round-section--queue" aria-labelledby="candidate-next-round-queued-title">
                            <h3 className="sr-only" id="candidate-next-round-queued-title">Questions in your next round</h3>
                            <ol className="candidate-next-round-list">
                                {builder.items.map((item, index) => {
                                    const moveUpKey = `reorder:${item.candidateNextRoundDraftItemId}:up`;
                                    const moveDownKey = `reorder:${item.candidateNextRoundDraftItemId}:down`;
                                    const removeKey = `remove:${item.candidateNextRoundDraftItemId}`;
                                    const pendingItemAction = busyAction?.key === moveUpKey
                                        || busyAction?.key === moveDownKey
                                        || busyAction?.key === removeKey;
                                    return (
                                        <li
                                            key={item.candidateNextRoundDraftItemId}
                                            aria-busy={pendingItemAction || undefined}
                                            data-state={pendingItemAction ? "updating" : undefined}
                                        >
                                            <div className="candidate-next-round-item__meta">
                                                <span>Q{item.questionNumber}:</span>
                                                <span>{item.category}</span>
                                            </div>
                                            <p>{item.questionText}</p>
                                            <div className="candidate-next-round-item__actions">
                                                <button
                                                    type="button"
                                                    disabled={index === 0 || Boolean(busyAction)}
                                                    onClick={() => moveItem(index, -1)}
                                                    aria-label={`Move question ${item.questionNumber} up`}
                                                    aria-busy={busyAction?.key === moveUpKey || undefined}
                                                >
                                                    {busyAction?.key === moveUpKey
                                                        ? <Loader2 className="ui-button__spinner candidate-next-round-inline-spinner" aria-hidden="true" />
                                                        : <ArrowUp size={16} aria-hidden="true" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={index === builder.items.length - 1 || Boolean(busyAction)}
                                                    onClick={() => moveItem(index, 1)}
                                                    aria-label={`Move question ${item.questionNumber} down`}
                                                    aria-busy={busyAction?.key === moveDownKey || undefined}
                                                >
                                                    {busyAction?.key === moveDownKey
                                                        ? <Loader2 className="ui-button__spinner candidate-next-round-inline-spinner" aria-hidden="true" />
                                                        : <ArrowDown size={16} aria-hidden="true" />}
                                                </button>
                                                <button
                                                    className="is-remove"
                                                    type="button"
                                                    disabled={Boolean(busyAction)}
                                                    onClick={() => void mutate(
                                                        {
                                                            kind: "remove",
                                                            candidateNextRoundDraftItemId: item.candidateNextRoundDraftItemId,
                                                        },
                                                        {
                                                            key: removeKey,
                                                            announcement: `Removing question ${item.questionNumber} from your next round.`,
                                                        },
                                                    )}
                                                    aria-label={`Remove question ${item.questionNumber} from next round`}
                                                    aria-busy={busyAction?.key === removeKey || undefined}
                                                >
                                                    {busyAction?.key === removeKey
                                                        ? <Loader2 className="ui-button__spinner candidate-next-round-inline-spinner" aria-hidden="true" />
                                                        : <X size={16} aria-hidden="true" />}
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    ) : null}

                    <section className="candidate-next-round-section" aria-labelledby="candidate-next-round-available-title">
                        <div className="candidate-next-round-section__heading">
                            <h3 id="candidate-next-round-available-title">Coach Plan</h3>
                            <span>Available to add</span>
                        </div>
                        {builder.itemCount >= builder.capacity ? (
                            <p className="candidate-next-round-section__complete">Round is full.</p>
                        ) : availableChoices.length > 0 ? (
                            <ul className="candidate-next-round-choices">
                                {availableChoices.map((choice) => {
                                    const addKey = `add:${choice.sourceCandidatePracticeSessionId}:${choice.sourceQuestionKey}`;
                                    const isAdding = busyAction?.key === addKey;
                                    return (
                                        <li
                                            key={`${choice.sourceCandidatePracticeSessionId}:${choice.sourceQuestionKey}`}
                                            aria-busy={isAdding || undefined}
                                            data-state={isAdding ? "updating" : undefined}
                                        >
                                            <div>
                                                <div className="candidate-next-round-item__meta">
                                                    <span>Q{choice.questionNumber}:</span>
                                                    <span>{choice.category}</span>
                                                </div>
                                                <p>{choice.questionText}</p>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={Boolean(busyAction) || builder.itemCount >= builder.capacity}
                                                onClick={() => void mutate(
                                                    {
                                                        kind: "add",
                                                        sourceCandidatePracticeSessionId: choice.sourceCandidatePracticeSessionId,
                                                        sourceQuestionKey: choice.sourceQuestionKey,
                                                    },
                                                    {
                                                        key: addKey,
                                                        announcement: `Adding question ${choice.questionNumber} to your next round.`,
                                                    },
                                                )}
                                                aria-label={`Add question ${choice.questionNumber} to next round`}
                                                aria-busy={isAdding || undefined}
                                            >
                                                {isAdding
                                                    ? <Loader2 className="ui-button__spinner candidate-next-round-inline-spinner" aria-hidden="true" />
                                                    : <Plus size={17} aria-hidden="true" />}
                                                <span>{isAdding ? "Adding..." : "Add"}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="candidate-next-round-section__complete">Every available Plan question is already in your next round.</p>
                        )}
                    </section>
                </div>

                <footer
                    className="candidate-next-round-dialog__footer"
                    aria-hidden={isClearConfirmOpen || undefined}
                    inert={isClearConfirmOpen || undefined}
                >
                    <button className="is-cancel" type="button" disabled={isLaunching} onClick={onClose}>Cancel</button>
                    <button
                        className="is-clear"
                        type="button"
                        disabled={builder.itemCount < 1 || Boolean(busyAction)}
                        onClick={() => setIsClearConfirmOpen(true)}
                        aria-busy={busyAction?.key === "clear" || undefined}
                    >
                        {busyAction?.key === "clear" ? "Clearing..." : "Clear all"}
                        {busyAction?.key === "clear"
                            ? <Loader2 className="ui-button__spinner candidate-next-round-inline-spinner" aria-hidden="true" />
                            : <Trash2 size={16} aria-hidden="true" />}
                    </button>
                    <button
                        className="candidate-next-round-start"
                        type="button"
                        disabled={builder.itemCount < 1 || Boolean(busyAction)}
                        onClick={() => void launch()}
                        aria-busy={isLaunching || undefined}
                    >
                        {isLaunching ? "Preparing practice..." : "Start practice"}
                        {isLaunching
                            ? <Loader2 className="ui-button__spinner candidate-next-round-inline-spinner" aria-hidden="true" />
                            : <ArrowRight size={17} aria-hidden="true" />}
                    </button>
                </footer>

                {isClearConfirmOpen ? (
                    <div className="candidate-next-round-confirm">
                        <section
                            ref={clearConfirmDialogRef}
                            role="alertdialog"
                            aria-modal="true"
                            aria-labelledby="candidate-next-round-clear-title"
                        >
                            <h3 id="candidate-next-round-clear-title">Clear this next round?</h3>
                            <p>This removes every queued question. You can add them again from the Coach Plan.</p>
                            <div>
                                <button ref={clearConfirmCancelRef} type="button" onClick={() => setIsClearConfirmOpen(false)}>Keep questions</button>
                                <button
                                    className="is-danger"
                                    type="button"
                                    onClick={() => {
                                        setIsClearConfirmOpen(false);
                                        void mutate(
                                            { kind: "clear" },
                                            {
                                                key: "clear",
                                                announcement: "Clearing every question from your next round.",
                                            },
                                        );
                                    }}
                                >
                                    Clear questions
                                </button>
                            </div>
                        </section>
                    </div>
                ) : null}
            </section>
        </div>
    );
}

async function requestBuilderMutation(
    builder: CandidateNextRoundBuilderModel,
    mutation: CandidateNextRoundBuilderMutation,
): Promise<BuilderRequestResult> {
    const response = await fetch("/candidate/practice/next-round-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            roleProfileId: builder.roleProfileId,
            candidateNextRoundDraftId: builder.candidateNextRoundDraftId,
            expectedVersion: builder.version,
            mutation,
        }),
    });
    const body = await response.json().catch(() => null) as BuilderRequestResult | null;
    return {
        ok: response.ok,
        status: response.status,
        ...(body ?? {}),
    };
}

async function requestBuilderLaunch(builder: CandidateNextRoundBuilderModel): Promise<BuilderRequestResult> {
    const response = await fetch("/candidate/practice/next-round-draft/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            roleProfileId: builder.roleProfileId,
            candidateNextRoundDraftId: builder.candidateNextRoundDraftId,
            expectedVersion: builder.version,
        }),
    });
    const body = await response.json().catch(() => null) as BuilderRequestResult | null;
    return {
        ok: response.ok,
        status: response.status,
        ...(body ?? {}),
    };
}
