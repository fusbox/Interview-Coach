"use client";

import {
    AlertCircle,
    Lightbulb,
    Loader2,
    RefreshCw,
    Sparkles,
    X,
} from "lucide-react";
import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent,
    type RefObject,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
    parseCandidateQuestionAssistanceOutput,
    type CandidateQuestionAssistanceKind,
    type CandidateQuestionAssistanceOutput,
} from "@/features/candidate-session-v2/candidate-question-assistance";

import styles from "./QuestionAssistanceDisclosure.module.css";

type AssistancePanel = CandidateQuestionAssistanceKind;
type ModalPhase = "closed" | "open" | "closing";
type SwitchDirection = "none" | "forward" | "backward";
type AssistanceState = {
    phase: "idle" | "loading" | "ready" | "error";
    output: CandidateQuestionAssistanceOutput | null;
    retryable: boolean;
};

const INITIAL_STATE: AssistanceState = {
    phase: "idle",
    output: null,
    retryable: true,
};
const MAX_PENDING_POLLS = 24;
const MODAL_CLOSE_MS = 150;
const PANEL_ORDER: Record<AssistancePanel, number> = {
    hints: 0,
    strong_response: 1,
};

type QuestionAssistanceDisclosureProps = {
    anchorRef?: RefObject<HTMLElement | null>;
    boundaryRef?: RefObject<HTMLElement | null>;
    disabled?: boolean;
    endpoint: string;
    questionKey: string;
};

type AssistanceDrawerStyle = CSSProperties & {
    "--assistance-boundary-distance"?: string;
    "--assistance-viewport-limit"?: string;
};

const VIEWPORT_INSET_PX = 16;

export function QuestionAssistanceDisclosure({
    anchorRef,
    boundaryRef,
    disabled = false,
    endpoint,
    questionKey,
}: QuestionAssistanceDisclosureProps) {
    const [activePanel, setActivePanel] = useState<AssistancePanel | null>(null);
    const [modalPhase, setModalPhase] = useState<ModalPhase>("closed");
    const [switchDirection, setSwitchDirection] = useState<SwitchDirection>("none");
    const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
    const [drawerStyle, setDrawerStyle] = useState<AssistanceDrawerStyle>({});
    const [hints, setHints] = useState<AssistanceState>(INITIAL_STATE);
    const [strongResponse, setStrongResponse] = useState<AssistanceState>(INITIAL_STATE);
    const disclosureId = useId();
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);
    const hintsButtonRef = useRef<HTMLButtonElement | null>(null);
    const strongResponseButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalHintsButtonRef = useRef<HTMLButtonElement | null>(null);
    const modalStrongResponseButtonRef = useRef<HTMLButtonElement | null>(null);
    const closeTimerRef = useRef<number | null>(null);
    const activeRequestsRef = useRef(new Map<AssistancePanel, AbortController>());
    const requestedKindsRef = useRef(new Set<AssistancePanel>());

    const requestAssistance = useCallback(async (
        assistanceKind: AssistancePanel,
        force = false,
    ) => {
        if (!force && requestedKindsRef.current.has(assistanceKind)) {
            return;
        }
        requestedKindsRef.current.add(assistanceKind);
        const update = assistanceKind === "hints" ? setHints : setStrongResponse;
        update({ phase: "loading", output: null, retryable: true });

        activeRequestsRef.current.get(assistanceKind)?.abort();
        const controller = new AbortController();
        activeRequestsRef.current.set(assistanceKind, controller);
        try {
            for (let attempt = 0; attempt <= MAX_PENDING_POLLS; attempt += 1) {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ questionKey, assistanceKind }),
                    cache: "no-store",
                    signal: controller.signal,
                });
                const payload = await readJson(response);
                if (response.status === 202 && attempt < MAX_PENDING_POLLS) {
                    await waitForRetry(response, controller.signal);
                    continue;
                }
                if (!response.ok || payload?.status !== "ready") {
                    update({
                        phase: "error",
                        output: null,
                        retryable: payload?.retryable !== false,
                    });
                    return;
                }
                const output = parseCandidateQuestionAssistanceOutput(payload.output);
                const outputMatchesKind = assistanceKind === "hints"
                    ? output?.status === "candidate_question_hints_v1"
                    : output?.status === "candidate_strong_response_v1";
                if (!output || !outputMatchesKind) {
                    update({ phase: "error", output: null, retryable: true });
                    return;
                }
                update({ phase: "ready", output, retryable: true });
                return;
            }
            update({ phase: "error", output: null, retryable: true });
        } catch (error) {
            if (!isAbortError(error)) {
                update({ phase: "error", output: null, retryable: true });
            }
        } finally {
            if (activeRequestsRef.current.get(assistanceKind) === controller) {
                activeRequestsRef.current.delete(assistanceKind);
            }
        }
    }, [endpoint, questionKey]);

    useEffect(() => {
        setPortalHost(document.body);
    }, []);

    useEffect(() => {
        const activeRequests = activeRequestsRef.current;
        setActivePanel(null);
        setModalPhase("closed");
        setSwitchDirection("none");
        setHints(INITIAL_STATE);
        setStrongResponse(INITIAL_STATE);
        requestedKindsRef.current.clear();
        void requestAssistance("hints");
        return () => {
            activeRequests.forEach((controller) => controller.abort());
            activeRequests.clear();
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
        };
    }, [questionKey, requestAssistance]);

    useEffect(() => {
        if (disabled) {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }
            setActivePanel(null);
            setModalPhase("closed");
            setSwitchDirection("none");
        }
    }, [disabled]);

    useEffect(() => {
        if (!activePanel || modalPhase !== "open") {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            if (activePanel === "hints") {
                modalHintsButtonRef.current?.focus();
            } else {
                modalStrongResponseButtonRef.current?.focus();
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activePanel, modalPhase]);

    useEffect(() => {
        if (!activePanel) {
            return undefined;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [activePanel]);

    useLayoutEffect(() => {
        if (!activePanel) {
            return undefined;
        }

        const anchor = anchorRef?.current
            ?? hintsButtonRef.current?.closest<HTMLElement>("[data-tone='question']");
        if (!anchor) {
            return undefined;
        }
        const boundary = boundaryRef?.current;

        const updateDrawerPosition = () => {
            const bounds = anchor.getBoundingClientRect();
            const visualViewport = window.visualViewport;
            const viewportTop = visualViewport?.offsetTop ?? 0;
            const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight);
            const top = Math.max(bounds.top, viewportTop + VIEWPORT_INSET_PX);
            const availableHeight = Math.max(0, viewportBottom - top - VIEWPORT_INSET_PX);
            const boundaryDistance = boundary
                ? Math.max(0, boundary.getBoundingClientRect().top - top)
                : null;
            setDrawerStyle({
                top,
                left: bounds.left,
                width: bounds.width,
                "--assistance-viewport-limit": `${availableHeight}px`,
                "--assistance-boundary-distance": boundaryDistance === null
                    ? `calc(${availableHeight}px + var(--gap-section))`
                    : `${boundaryDistance}px`,
            });
        };

        updateDrawerPosition();
        const resizeObserver = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(updateDrawerPosition);
        resizeObserver?.observe(anchor);
        if (boundary) {
            resizeObserver?.observe(boundary);
        }
        window.addEventListener("resize", updateDrawerPosition);
        window.addEventListener("scroll", updateDrawerPosition, true);
        window.visualViewport?.addEventListener("resize", updateDrawerPosition);
        window.visualViewport?.addEventListener("scroll", updateDrawerPosition);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener("resize", updateDrawerPosition);
            window.removeEventListener("scroll", updateDrawerPosition, true);
            window.visualViewport?.removeEventListener("resize", updateDrawerPosition);
            window.visualViewport?.removeEventListener("scroll", updateDrawerPosition);
        };
    }, [activePanel, anchorRef, boundaryRef]);

    const panelId = `${disclosureId}-panel`;
    const panelTitleId = `${disclosureId}-title`;

    const closePanel = useCallback((restoreFocus = true) => {
        if (!activePanel || modalPhase === "closing") {
            return;
        }
        const previousPanel = activePanel;
        setModalPhase("closing");
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
        }
        const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : MODAL_CLOSE_MS;
        closeTimerRef.current = window.setTimeout(() => {
            setActivePanel(null);
            setModalPhase("closed");
            setSwitchDirection("none");
            closeTimerRef.current = null;
            if (restoreFocus) {
                window.requestAnimationFrame(() => {
                    if (previousPanel === "hints") {
                        hintsButtonRef.current?.focus();
                    } else {
                        strongResponseButtonRef.current?.focus();
                    }
                });
            }
        }, closeDelay);
    }, [activePanel, modalPhase]);

    const openPanel = useCallback((panel: AssistancePanel) => {
        if (activePanel === panel && modalPhase !== "closing") {
            closePanel();
            return;
        }
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        setSwitchDirection(activePanel
            ? PANEL_ORDER[panel] > PANEL_ORDER[activePanel]
                ? "forward"
                : "backward"
            : "none");
        setActivePanel(panel);
        setModalPhase("open");
        if (panel === "strong_response") {
            void requestAssistance(panel);
        }
    }, [activePanel, closePanel, modalPhase, requestAssistance]);

    const activeState = activePanel === "hints" ? hints : strongResponse;
    const activePanelTitle = activePanel === "hints"
        ? "Hints & framework"
        : "Strong response model";

    const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            closePanel();
            return;
        }
        if (event.key !== "Tab") {
            return;
        }
        const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
                "button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex='-1'])",
            ) ?? [],
        ).filter((element) => !element.hasAttribute("hidden"));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) {
            event.preventDefault();
            return;
        }
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    const modal = activePanel && portalHost ? createPortal(
        <div
            className={styles.modalLayer}
            data-phase={modalPhase}
        >
            <div
                className={styles.backdrop}
                aria-hidden="true"
                onMouseDown={() => closePanel()}
            />
            <div
                ref={dialogRef}
                className={styles.drawer}
                style={drawerStyle}
                id={panelId}
                data-panel={activePanel}
                data-phase={modalPhase}
                role="dialog"
                aria-modal="true"
                aria-labelledby={panelTitleId}
                onKeyDown={handleDialogKeyDown}
            >
                <header className={styles.drawerHeader}>
                    <div className={styles.drawerHeaderSide}>
                        <IconButton
                            ref={closeButtonRef}
                            className={styles.closeButton}
                            label="Close question assistance"
                            title="Close question assistance"
                            size="compact"
                            onClick={() => closePanel()}
                        >
                            <X size={16} aria-hidden="true" />
                        </IconButton>
                    </div>
                    <h2 id={panelTitleId}>{activePanelTitle}</h2>
                    <div
                        className={`${styles.triggers} ${styles.modalTriggers}`}
                        role="group"
                        aria-label="Question assistance view"
                    >
                        <IconButton
                            ref={modalHintsButtonRef}
                            className={`${styles.trigger} ${styles.hintsTrigger}`}
                            label="Hints"
                            title="Hints"
                            tone="accent"
                            pressed={activePanel === "hints"}
                            aria-controls={panelId}
                            aria-expanded={activePanel === "hints"}
                            data-engagement-activity="question_assistance"
                            onClick={() => openPanel("hints")}
                        >
                            {hints.phase === "loading" ? (
                                <Loader2 className={styles.spinner} size={17} aria-hidden="true" />
                            ) : (
                                <Lightbulb size={17} aria-hidden="true" />
                            )}
                        </IconButton>
                        <IconButton
                            ref={modalStrongResponseButtonRef}
                            className={`${styles.trigger} ${styles.strongResponseTrigger}`}
                            label="Strong response"
                            title="Strong response"
                            pressed={activePanel === "strong_response"}
                            aria-controls={panelId}
                            aria-expanded={activePanel === "strong_response"}
                            data-engagement-activity="question_assistance"
                            onClick={() => openPanel("strong_response")}
                        >
                            {strongResponse.phase === "loading" ? (
                                <Loader2 className={styles.spinner} size={17} aria-hidden="true" />
                            ) : (
                                <Sparkles size={17} aria-hidden="true" />
                            )}
                        </IconButton>
                    </div>
                </header>

                <div
                    key={activePanel}
                    className={styles.panelTransition}
                    data-direction={switchDirection}
                >
                    <div className={styles.drawerBody} aria-live="polite">
                        {activeState.phase === "loading" ? (
                            <div className={styles.loading} role="status">
                                <Loader2 className={styles.spinner} size={20} aria-hidden="true" />
                                <p>
                                    {activePanel === "hints"
                                        ? "Preparing hints for this question..."
                                        : "Preparing a strong response example..."}
                                </p>
                            </div>
                        ) : null}

                        {activeState.phase === "error" ? (
                            <div className={styles.error} role="alert">
                                <AlertCircle size={20} aria-hidden="true" />
                                <div>
                                    <p>
                                        {activePanel === "hints"
                                            ? "Hints are not available right now."
                                            : "A strong response is not available right now."}
                                    </p>
                                    {activeState.retryable ? (
                                        <Button
                                            emphasis="secondary"
                                            density="compact"
                                            shape="app"
                                            onClick={() => void requestAssistance(activePanel, true)}
                                        >
                                            <RefreshCw size={15} aria-hidden="true" />
                                            Try again
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        {activeState.output?.status === "candidate_question_hints_v1" ? (
                            <section className={styles.guidance}>
                                <h3>Do&apos;s &amp; structure strategy</h3>
                                <ul>
                                    <li>{activeState.output.doThis}</li>
                                    <li>
                                        <strong>Watch for:</strong>{" "}
                                        {activeState.output.avoidThis}
                                    </li>
                                </ul>
                            </section>
                        ) : null}

                        {activeState.output?.status === "candidate_strong_response_v1" ? (
                            <>
                                <section className={styles.example}>
                                    <h3>Example response</h3>
                                    <p>{activeState.output.strongResponse}</p>
                                </section>
                                <section className={styles.guidance}>
                                    <h3>Why it works</h3>
                                    <p>{activeState.output.whyThisWorks}</p>
                                </section>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>,
        portalHost,
    ) : null;

    return (
        <div
            className={styles.disclosure}
            aria-hidden={modalPhase !== "closed" ? true : undefined}
        >
            <div className={styles.triggers}>
                <IconButton
                    ref={hintsButtonRef}
                    className={`${styles.trigger} ${styles.hintsTrigger}`}
                    label="Hints"
                    title="Hints"
                    tone="accent"
                    pressed={activePanel === "hints"}
                    disabled={disabled}
                    aria-controls={panelId}
                    aria-expanded={activePanel === "hints"}
                    data-engagement-activity="question_assistance"
                    onClick={() => openPanel("hints")}
                >
                    {hints.phase === "loading" ? (
                        <Loader2 className={styles.spinner} size={17} aria-hidden="true" />
                    ) : (
                        <Lightbulb size={17} aria-hidden="true" />
                    )}
                </IconButton>
                <IconButton
                    ref={strongResponseButtonRef}
                    className={`${styles.trigger} ${styles.strongResponseTrigger}`}
                    label="Strong response"
                    title="Strong response"
                    pressed={activePanel === "strong_response"}
                    disabled={disabled}
                    aria-controls={panelId}
                    aria-expanded={activePanel === "strong_response"}
                    data-engagement-activity="question_assistance"
                    onClick={() => openPanel("strong_response")}
                >
                    {strongResponse.phase === "loading" ? (
                        <Loader2 className={styles.spinner} size={17} aria-hidden="true" />
                    ) : (
                        <Sparkles size={17} aria-hidden="true" />
                    )}
                </IconButton>
            </div>
            {modal}
        </div>
    );
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
    try {
        const value: unknown = await response.json();
        return value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
    } catch {
        return null;
    }
}

async function waitForRetry(response: Response, signal: AbortSignal) {
    const retryAfterSeconds = Number(response.headers.get("Retry-After"));
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1_000, 2_000)
        : 750;
    await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, delayMs);
        signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            reject(new DOMException("Request aborted.", "AbortError"));
        }, { once: true });
    });
}

function isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === "AbortError";
}
