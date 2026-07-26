"use client";

import {
    ArrowDown,
    ArrowRight,
    ArrowUp,
    ClipboardList,
    Plus,
    Trash2,
    X,
} from "lucide-react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react";

import type { CandidateNextRoundBuilderModel } from "@/features/candidate-practice-v2/candidate-next-round-builder";
import type { CandidateNextRoundBuilderMutation } from "@/features/candidate-practice-v2/candidate-next-round-builder-service";

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
    openBuilder: (anchor?: DOMRect | null, returnFocusTo?: HTMLElement | null) => void;
    resolveChoice: (pointer: CandidateNextRoundChoicePointer) => CandidateNextRoundChoiceState | null;
    toggleChoice: (pointer: CandidateNextRoundChoicePointer) => Promise<CandidateNextRoundChoiceMutationResult>;
    busyChoiceKey: string | null;
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
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
    const [busyChoiceKey, setBusyChoiceKey] = useState<string | null>(null);
    const busyChoiceRef = useRef<string | null>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        setBuilder(initialBuilder);
        setIsOpen(false);
        setAnchorRect(null);
        setBusyChoiceKey(null);
        busyChoiceRef.current = null;
    }, [initialBuilder]);

    const openBuilder = useCallback((anchor?: DOMRect | null, returnFocusTo?: HTMLElement | null) => {
        setAnchorRect(anchor ?? null);
        returnFocusRef.current = returnFocusTo ?? (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);
        setIsOpen(true);
    }, []);
    const closeBuilder = useCallback(() => {
        setIsOpen(false);
        setAnchorRect(null);
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
        openBuilder,
        resolveChoice,
        toggleChoice,
        busyChoiceKey,
    }), [builder, busyChoiceKey, openBuilder, resolveChoice, toggleChoice]);

    return (
        <CandidateNextRoundBuilderContext.Provider value={controller}>
            {children}
            {isOpen ? (
                <CandidateNextRoundBuilderDialog
                    builder={builder}
                    anchorRect={anchorRect}
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

export function CandidateNextRoundBuilderTrigger() {
    const controller = useContext(CandidateNextRoundBuilderContext);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    if (!controller) {
        return null;
    }

    return (
        <button
            className={`candidate-dashboard-next-link candidate-dashboard-next-link--builder${controller.builder.itemCount > 0 ? " has-items" : ""}`}
            ref={triggerRef}
            type="button"
            aria-haspopup="dialog"
            aria-label={controller.builder.itemCount > 0
                ? `Next practice round, ${controller.builder.itemCount} queued`
                : "Next practice round"}
            onClick={() => {
                const trigger = triggerRef.current;
                const useAnchor = window.matchMedia("(min-width: 48rem)").matches;
                controller.openBuilder(useAnchor && trigger ? trigger.getBoundingClientRect() : null, trigger);
            }}
        >
            <ClipboardList size={18} aria-hidden="true" />
            <span>Next practice round</span>
            {controller.builder.itemCount > 0 ? (
                <span className="candidate-next-round-count" aria-hidden="true">
                    {controller.builder.itemCount}
                </span>
            ) : null}
        </button>
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
    anchorRect,
    onBuilderChange,
    onClose,
    requestMutation,
    requestLaunch,
    navigate,
}: {
    builder: CandidateNextRoundBuilderModel;
    anchorRect: DOMRect | null;
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
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const busyActionRef = useRef<string | null>(null);
    const [notice, setNotice] = useState<{ kind: "info" | "error"; message: string } | null>(null);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const availableChoices = builder.choices.filter((choice) => !choice.isQueued);

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
    }, [isClearConfirmOpen, onClose]);

    useEffect(() => {
        if (isClearConfirmOpen) {
            clearConfirmCancelRef.current?.focus();
        }
    }, [isClearConfirmOpen]);

    const mutate = async (mutation: CandidateNextRoundBuilderMutation) => {
        if (busyActionRef.current) return;
        busyActionRef.current = mutation.kind;
        setBusyAction(mutation.kind);
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
        setBusyAction("launch");
        setNotice(null);
        try {
            const result = await requestLaunch(builder);
            if (result.redirectTo) {
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
            busyActionRef.current = null;
            setBusyAction(null);
        }
    };

    const moveItem = (index: number, offset: -1 | 1) => {
        const nextIndex = index + offset;
        if (nextIndex < 0 || nextIndex >= builder.items.length) return;
        const orderedItemIds = builder.items.map((item) => item.candidateNextRoundDraftItemId);
        [orderedItemIds[index], orderedItemIds[nextIndex]] = [orderedItemIds[nextIndex], orderedItemIds[index]];
        void mutate({ kind: "reorder", orderedItemIds });
    };
    const anchoredStyle = anchorRect ? ({
        "--next-round-anchor-top": `${Math.max(anchorRect.top - 20, 12)}px`,
        "--next-round-anchor-right": `${Math.max(window.innerWidth - anchorRect.right, 12)}px`,
        "--next-round-anchor-width": `${anchorRect.width}px`,
    } as CSSProperties) : undefined;

    return (
        <div
            className="candidate-next-round-backdrop"
            data-testid="candidate-next-round-backdrop"
            onPointerDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                className={`candidate-next-round-dialog${anchorRect ? " is-anchored" : ""}${isExpanded ? " is-expanded" : ""}`}
                style={anchoredStyle}
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="candidate-next-round-title"
            >
                <header
                    className="candidate-next-round-dialog__header"
                    aria-hidden={isClearConfirmOpen || undefined}
                    inert={isClearConfirmOpen || undefined}
                >
                    <div className="candidate-next-round-dialog__title-row">
                        <h2 id="candidate-next-round-title">Next practice round</h2>
                        <span>{builder.itemCount}</span>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close next practice round">
                        <X size={19} aria-hidden="true" />
                    </button>
                    <button
                        className="candidate-next-round-start"
                        type="button"
                        disabled={builder.itemCount < 1 || Boolean(busyAction)}
                        onClick={() => void launch()}
                    >
                        {busyAction === "launch" ? "Preparing practice..." : "Start practice"}
                        <ArrowRight size={17} aria-hidden="true" />
                    </button>
                </header>

                <div
                    className="candidate-next-round-dialog__body"
                    aria-hidden={isClearConfirmOpen || undefined}
                    inert={isClearConfirmOpen || undefined}
                >
                    <div className="candidate-next-round-context">
                        <span>Preparing for</span>
                        <strong>{builder.targetRole}</strong>
                    </div>
                    {notice ? (
                        <p className={`candidate-next-round-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
                            {notice.message}
                        </p>
                    ) : null}

                    <section className="candidate-next-round-section" aria-labelledby="candidate-next-round-queued-title">
                        <div className="candidate-next-round-section__heading">
                            <h3 id="candidate-next-round-queued-title">In this round</h3>
                            <span>{builder.itemCount} of {builder.capacity}</span>
                        </div>
                        {builder.items.length > 0 ? (
                            <ol className="candidate-next-round-list">
                                {builder.items.map((item, index) => (
                                    <li key={item.candidateNextRoundDraftItemId}>
                                        <div className="candidate-next-round-item__meta">
                                            <span>Q{item.questionNumber}:</span>
                                            <span>{item.category}</span>
                                            <span>{item.evidenceLabel}</span>
                                        </div>
                                        <p>{item.questionText}</p>
                                        <div className="candidate-next-round-item__actions">
                                            <button
                                                type="button"
                                                disabled={index === 0 || Boolean(busyAction)}
                                                onClick={() => moveItem(index, -1)}
                                                aria-label={`Move question ${item.questionNumber} up`}
                                            >
                                                <ArrowUp size={16} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={index === builder.items.length - 1 || Boolean(busyAction)}
                                                onClick={() => moveItem(index, 1)}
                                                aria-label={`Move question ${item.questionNumber} down`}
                                            >
                                                <ArrowDown size={16} aria-hidden="true" />
                                            </button>
                                            <button
                                                className="is-remove"
                                                type="button"
                                                disabled={Boolean(busyAction)}
                                                onClick={() => void mutate({
                                                    kind: "remove",
                                                    candidateNextRoundDraftItemId: item.candidateNextRoundDraftItemId,
                                                })}
                                                aria-label={`Remove question ${item.questionNumber} from next practice round`}
                                            >
                                                <X size={16} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <div className="candidate-next-round-empty">
                                <ClipboardList size={20} aria-hidden="true" />
                                <p>Add questions from your Coach Plan to build this round.</p>
                            </div>
                        )}
                    </section>

                    <section className="candidate-next-round-section" aria-labelledby="candidate-next-round-available-title">
                        <div className="candidate-next-round-section__heading">
                            <h3 id="candidate-next-round-available-title">Available from Coach Plan</h3>
                        </div>
                        {availableChoices.length > 0 ? (
                            <ul className="candidate-next-round-choices">
                                {availableChoices.map((choice) => (
                                    <li key={`${choice.sourceCandidatePracticeSessionId}:${choice.sourceQuestionKey}`}>
                                        <div>
                                            <div className="candidate-next-round-item__meta">
                                                <span>Q{choice.questionNumber}:</span>
                                                <span>{choice.category}</span>
                                                <span>{choice.evidenceLabel}</span>
                                            </div>
                                            <p>{choice.questionText}</p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={Boolean(busyAction) || builder.itemCount >= builder.capacity}
                                            onClick={() => void mutate({
                                                kind: "add",
                                                sourceCandidatePracticeSessionId: choice.sourceCandidatePracticeSessionId,
                                                sourceQuestionKey: choice.sourceQuestionKey,
                                            })}
                                            aria-label={`Add question ${choice.questionNumber} to next practice round`}
                                        >
                                            <Plus size={17} aria-hidden="true" />
                                            <span>Add</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="candidate-next-round-section__complete">Every currently eligible question is already in this round.</p>
                        )}
                    </section>
                </div>

                <footer
                    className="candidate-next-round-dialog__footer"
                    aria-hidden={isClearConfirmOpen || undefined}
                    inert={isClearConfirmOpen || undefined}
                >
                    <button type="button" onClick={onClose}>Cancel</button>
                    <button
                        className="is-clear"
                        type="button"
                        disabled={builder.itemCount < 1 || Boolean(busyAction)}
                        onClick={() => setIsClearConfirmOpen(true)}
                    >
                        Clear all
                        <Trash2 size={16} aria-hidden="true" />
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
                                        void mutate({ kind: "clear" });
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
