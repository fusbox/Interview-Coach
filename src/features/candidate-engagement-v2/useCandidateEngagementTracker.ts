"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
    CandidateEngagementActivityReason,
    CandidateEngagementDebugEvent,
    CandidateEngagementDebugEventType,
    CandidateEngagementFlushReason,
    CandidateEngagementSessionSummary,
    CandidateEngagementSlice,
} from "./candidate-engagement-contract";
import {
    applyCandidateEngagementEvent,
    closeCandidateEngagementWindow,
    createClosedCandidateEngagementWindow,
    readCandidateEngagementAccrual,
    sustainCandidateEngagementRecording,
    type CandidateEngagementWindowState,
} from "./candidate-engagement-window";

const TICK_MS = 1_000;
const PERSIST_AFTER_ACTIVE_MS = 10_000;
const MAX_DEBUG_EVENTS = 60;
const LEASE_HEARTBEAT_MS = 2_000;
const LEASE_TTL_MS = 5_000;

type PersistenceState = "idle" | "saving" | "saved" | "error";

export type CandidateEngagementTracker = {
    enabled: boolean;
    isLeader: boolean;
    isWindowOpen: boolean;
    windowTimeRemaining: number;
    localActiveMilliseconds: number;
    serverSummary: CandidateEngagementSessionSummary;
    pendingSliceCount: number;
    persistenceState: PersistenceState;
    debugEvents: CandidateEngagementDebugEvent[];
    trackEvent: (tier: "tier2" | "tier3", activity: CandidateEngagementActivityReason) => void;
    flush: (reason?: CandidateEngagementFlushReason) => Promise<boolean>;
    clearDebugEvents: () => void;
};

export function useCandidateEngagementTracker(input: {
    enabled: boolean;
    sessionId: string;
    endpoint: string;
    initialSummary?: CandidateEngagementSessionSummary;
    isContinuousActive?: boolean;
}): CandidateEngagementTracker {
    const initialSummary = input.initialSummary ?? emptySummary();
    const [isLeader, setIsLeader] = useState(false);
    const [isWindowOpen, setIsWindowOpen] = useState(false);
    const [windowTimeRemaining, setWindowTimeRemaining] = useState(0);
    const [localActiveMilliseconds, setLocalActiveMilliseconds] = useState(0);
    const [serverSummary, setServerSummary] = useState(initialSummary);
    const [pendingSliceCount, setPendingSliceCount] = useState(0);
    const [persistenceState, setPersistenceState] = useState<PersistenceState>("idle");
    const [debugEvents, setDebugEvents] = useState<CandidateEngagementDebugEvent[]>([]);

    const trackerInstanceIdRef = useRef(createUuid());
    const sequenceRef = useRef(0);
    const isLeaderRef = useRef(false);
    const isContinuousActiveRef = useRef(Boolean(input.isContinuousActive));
    const windowRef = useRef<CandidateEngagementWindowState>(createClosedCandidateEngagementWindow());
    const lastTickRef = useRef(0);
    const accumulatedMillisecondsRef = useRef(0);
    const sliceStartedAtRef = useRef<number | null>(null);
    const pendingSlicesRef = useRef<CandidateEngagementSlice[]>([]);
    const persistencePromiseRef = useRef<Promise<boolean> | null>(null);

    const logEvent = useCallback((
        type: CandidateEngagementDebugEventType,
        detail: string,
        tier?: CandidateEngagementDebugEvent["tier"],
    ) => {
        const event: CandidateEngagementDebugEvent = {
            id: createUuid(),
            timestamp: Date.now(),
            type,
            tier,
            detail,
        };
        setDebugEvents((events) => [event, ...events].slice(0, MAX_DEBUG_EVENTS));
    }, []);

    const accrueUntil = useCallback((now: number) => {
        const from = lastTickRef.current || now;
        const activeMilliseconds = readCandidateEngagementAccrual({
            state: windowRef.current,
            from,
            to: now,
            isVisible: !document.hidden,
            isLeader: isLeaderRef.current,
        });
        lastTickRef.current = now;
        if (activeMilliseconds <= 0) return;
        if (sliceStartedAtRef.current === null) {
            sliceStartedAtRef.current = Date.now() - activeMilliseconds;
        }
        accumulatedMillisecondsRef.current += activeMilliseconds;
        setLocalActiveMilliseconds((total) => total + activeMilliseconds);
    }, []);

    const storePendingSlices = useCallback((slices: CandidateEngagementSlice[]) => {
        pendingSlicesRef.current = slices;
        setPendingSliceCount(slices.length);
        try {
            if (slices.length) {
                window.sessionStorage.setItem(pendingStorageKey(input.sessionId), JSON.stringify(slices));
            } else {
                window.sessionStorage.removeItem(pendingStorageKey(input.sessionId));
            }
        } catch {
            // Persistence still has the in-memory replay queue when browser storage is unavailable.
        }
    }, [input.sessionId]);

    const queueAccumulatedSlice = useCallback((flushReason: CandidateEngagementFlushReason) => {
        const activeMilliseconds = Math.round(accumulatedMillisecondsRef.current);
        if (activeMilliseconds < 1) return false;
        const endedAt = Date.now();
        const startedAt = Math.min(
            sliceStartedAtRef.current ?? endedAt - activeMilliseconds,
            endedAt - activeMilliseconds,
        );
        sequenceRef.current += 1;
        const slice: CandidateEngagementSlice = {
            engagementSliceId: createUuid(),
            trackerInstanceId: trackerInstanceIdRef.current,
            sequenceNumber: sequenceRef.current,
            activeMilliseconds: Math.min(activeMilliseconds, 60_000),
            clientStartedAt: new Date(startedAt).toISOString(),
            clientEndedAt: new Date(endedAt).toISOString(),
            openedBy: windowRef.current.openedBy,
            lastActivity: windowRef.current.lastActivity,
            flushReason,
        };
        accumulatedMillisecondsRef.current = 0;
        sliceStartedAtRef.current = null;
        storePendingSlices([...pendingSlicesRef.current, slice]);
        logEvent("slice_queued", `${slice.activeMilliseconds}ms · ${flushReason}`);
        return true;
    }, [logEvent, storePendingSlices]);

    const persistPendingSlices = useCallback((keepalive = false): Promise<boolean> => {
        if (!input.enabled || !pendingSlicesRef.current.length) return Promise.resolve(true);
        if (persistencePromiseRef.current) return persistencePromiseRef.current;
        const batch = pendingSlicesRef.current.slice(0, 20);
        const batchIds = new Set(batch.map((slice) => slice.engagementSliceId));
        setPersistenceState("saving");
        const request = fetch(input.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slices: batch }),
            cache: "no-store",
            keepalive,
        }).then(async (response) => {
            const payload = await response.json().catch(() => null) as {
                status?: string;
                summary?: CandidateEngagementSessionSummary;
            } | null;
            if (!response.ok || payload?.status !== "engagement_saved" || !payload.summary) {
                throw new Error("engagement_not_saved");
            }
            storePendingSlices(pendingSlicesRef.current.filter(
                (slice) => !batchIds.has(slice.engagementSliceId),
            ));
            setServerSummary(payload.summary);
            setPersistenceState("saved");
            logEvent("persist_succeeded", `${batch.length} slice${batch.length === 1 ? "" : "s"}`);
            return true;
        }).catch(() => {
            setPersistenceState("error");
            logEvent("persist_failed", `${batch.length} slice${batch.length === 1 ? "" : "s"} pending`);
            return false;
        }).finally(() => {
            persistencePromiseRef.current = null;
        });
        persistencePromiseRef.current = request;
        return request;
    }, [input.enabled, input.endpoint, logEvent, storePendingSlices]);

    const flush = useCallback(async (
        reason: CandidateEngagementFlushReason = "session_transition",
    ) => {
        if (!input.enabled) return true;
        accrueUntil(performance.now());
        queueAccumulatedSlice(reason);
        return persistPendingSlices(reason === "page_exit" || reason === "tracker_unmount");
    }, [accrueUntil, input.enabled, persistPendingSlices, queueAccumulatedSlice]);

    const trackEvent = useCallback((
        tier: "tier2" | "tier3",
        activity: CandidateEngagementActivityReason,
    ) => {
        if (!input.enabled || document.hidden || !isLeaderRef.current) return;
        const now = performance.now();
        accrueUntil(now);
        const result = applyCandidateEngagementEvent({
            state: windowRef.current,
            tier,
            activity,
            now,
        });
        windowRef.current = result.state;
        setIsWindowOpen(true);
        setWindowTimeRemaining(Math.ceil((result.state.expiresAt - now) / 1_000));
        logEvent(result.transition === "open" ? "window_open" : "window_extend", activity, tier);
    }, [accrueUntil, input.enabled, logEvent]);

    useEffect(() => {
        isContinuousActiveRef.current = Boolean(input.isContinuousActive);
        if (input.enabled && input.isContinuousActive && isLeaderRef.current && !document.hidden) {
            const now = performance.now();
            accrueUntil(now);
            const wasOpen = windowRef.current.isOpen && windowRef.current.expiresAt > now;
            windowRef.current = sustainCandidateEngagementRecording(windowRef.current, now);
            setIsWindowOpen(true);
            logEvent(wasOpen ? "window_extend" : "window_open", "recording", "tier3");
        }
    }, [accrueUntil, input.enabled, input.isContinuousActive, logEvent]);

    useEffect(() => {
        if (!input.enabled) return;
        lastTickRef.current = performance.now();
        const recovered = readPendingSlices(input.sessionId);
        if (recovered.length) {
            sequenceRef.current = Math.max(sequenceRef.current, ...recovered
                .filter((slice) => slice.trackerInstanceId === trackerInstanceIdRef.current)
                .map((slice) => slice.sequenceNumber));
            storePendingSlices(recovered);
            void persistPendingSlices();
        }

        const interval = window.setInterval(() => {
            const now = performance.now();
            if (isContinuousActiveRef.current && isLeaderRef.current && !document.hidden) {
                windowRef.current = sustainCandidateEngagementRecording(windowRef.current, now);
                setIsWindowOpen(true);
            }
            accrueUntil(now);
            const isOpen = windowRef.current.isOpen && windowRef.current.expiresAt > now;
            if (!isOpen && windowRef.current.isOpen) {
                windowRef.current = closeCandidateEngagementWindow(windowRef.current);
                setIsWindowOpen(false);
                setWindowTimeRemaining(0);
                logEvent("window_close", "window expired");
                queueAccumulatedSlice("window_expired");
                void persistPendingSlices();
            } else if (isOpen) {
                setWindowTimeRemaining(Math.max(0, Math.ceil((windowRef.current.expiresAt - now) / 1_000)));
            }
            if (accumulatedMillisecondsRef.current >= PERSIST_AFTER_ACTIVE_MS) {
                queueAccumulatedSlice("periodic");
                void persistPendingSlices();
            }
        }, TICK_MS);

        const handleVisibility = () => {
            const now = performance.now();
            accrueUntil(now);
            if (document.hidden) {
                if (windowRef.current.isOpen) logEvent("presence_lost", "page hidden", "tier1");
                windowRef.current = closeCandidateEngagementWindow(windowRef.current);
                setIsWindowOpen(false);
                setWindowTimeRemaining(0);
                queueAccumulatedSlice("page_hidden");
                void persistPendingSlices(true);
            } else {
                lastTickRef.current = now;
                logEvent("presence_regained", "page visible", "tier1");
            }
        };
        const handlePageExit = () => {
            void flush("page_exit");
        };
        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("pagehide", handlePageExit);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("pagehide", handlePageExit);
            void flush("tracker_unmount");
        };
    }, [
        accrueUntil,
        flush,
        input.enabled,
        input.sessionId,
        logEvent,
        persistPendingSlices,
        queueAccumulatedSlice,
        storePendingSlices,
    ]);

    useEffect(() => {
        if (!input.enabled) return;
        let lastInputAt = 0;
        let lastScrollAt = 0;
        const handleInput = (event: Event) => {
            if (!(event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement)) return;
            const now = performance.now();
            if (now - lastInputAt < 1_000) return;
            lastInputAt = now;
            trackEvent("tier2", "answer_input");
        };
        const handleClick = (event: MouseEvent) => {
            const target = event.target instanceof Element
                ? event.target.closest<HTMLElement>("button, a, summary, input, textarea, select")
                : null;
            if (!target || target.closest("[data-engagement-ignore='true']")) return;
            trackEvent("tier2", readInteractionActivity(target));
        };
        const handleScroll = () => {
            const now = performance.now();
            if (now - lastScrollAt < 5_000) return;
            lastScrollAt = now;
            trackEvent("tier2", "page_navigation");
        };
        document.addEventListener("input", handleInput, true);
        document.addEventListener("click", handleClick, true);
        document.addEventListener("scroll", handleScroll, true);
        return () => {
            document.removeEventListener("input", handleInput, true);
            document.removeEventListener("click", handleClick, true);
            document.removeEventListener("scroll", handleScroll, true);
        };
    }, [input.enabled, trackEvent]);

    useEffect(() => {
        if (!input.enabled) return;
        return acquireSessionLeadership({
            sessionId: input.sessionId,
            ownerId: trackerInstanceIdRef.current,
            onChange(nextLeader) {
                if (isLeaderRef.current === nextLeader) return;
                isLeaderRef.current = nextLeader;
                setIsLeader(nextLeader);
                lastTickRef.current = performance.now();
                logEvent(nextLeader ? "leader_acquired" : "leader_released", nextLeader
                    ? "this tab owns accrual"
                    : "this tab is a follower", "tier1");
                if (nextLeader && !document.hidden) trackEvent("tier2", "session_view");
            },
        });
    }, [input.enabled, input.sessionId, logEvent, trackEvent]);

    return {
        enabled: input.enabled,
        isLeader,
        isWindowOpen,
        windowTimeRemaining,
        localActiveMilliseconds,
        serverSummary,
        pendingSliceCount,
        persistenceState,
        debugEvents,
        trackEvent,
        flush,
        clearDebugEvents: () => setDebugEvents([]),
    };
}

function readInteractionActivity(target: HTMLElement): CandidateEngagementActivityReason {
    const explicit = target.dataset.engagementActivity;
    if (explicit === "question_audio" || explicit === "question_assistance" || explicit === "answer_mode"
        || explicit === "voice_control" || explicit === "feedback_action") return explicit;
    const label = `${target.getAttribute("aria-label") ?? ""} ${target.getAttribute("title") ?? ""}`.toLowerCase();
    if (label.includes("hint") || label.includes("strong response")) return "question_assistance";
    if (label.includes("read question") || label.includes("question audio")) return "question_audio";
    if (label.includes("type answer") || label.includes("record answer")) return "answer_mode";
    if (label.includes("recording") || label.includes("transcript") || label.includes("microphone")) return "voice_control";
    return "interface_control";
}

type CandidateEngagementLockManager = {
    request: (
        name: string,
        options: { mode: "exclusive"; ifAvailable: true },
        callback: (lock: unknown | null) => Promise<void>,
    ) => Promise<void>;
};

function acquireSessionLeadership(input: {
    sessionId: string;
    ownerId: string;
    onChange: (isLeader: boolean) => void;
}) {
    const lockManager = (navigator as Navigator & { locks?: CandidateEngagementLockManager }).locks;
    if (lockManager) return acquireWithWebLock(lockManager, input);
    return acquireWithLocalLease(input);
}

function acquireWithWebLock(
    lockManager: CandidateEngagementLockManager,
    input: { sessionId: string; ownerId: string; onChange: (isLeader: boolean) => void },
) {
    let stopped = false;
    let requesting = false;
    let release: (() => void) | null = null;
    const attempt = () => {
        if (stopped || requesting || release || document.hidden) return;
        requesting = true;
        void lockManager.request(
            `candidate-engagement:${input.sessionId}`,
            { mode: "exclusive", ifAvailable: true },
            async (lock) => {
                requesting = false;
                if (!lock || stopped || document.hidden) return;
                input.onChange(true);
                await new Promise<void>((resolve) => { release = resolve; });
                release = null;
                input.onChange(false);
            },
        ).catch(() => { requesting = false; });
    };
    const handleVisibility = () => {
        if (document.hidden) {
            release?.();
        } else {
            attempt();
        }
    };
    attempt();
    const interval = window.setInterval(attempt, LEASE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
        stopped = true;
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibility);
        release?.();
        input.onChange(false);
    };
}

function acquireWithLocalLease(input: {
    sessionId: string;
    ownerId: string;
    onChange: (isLeader: boolean) => void;
}) {
    const key = `candidate-engagement-lease:${input.sessionId}`;
    let leader = false;
    const release = () => {
        if (!leader) return;
        try {
            const current = readLease(window.localStorage.getItem(key));
            if (current?.ownerId === input.ownerId) window.localStorage.removeItem(key);
        } catch {
            // The tab still drops local leadership when storage is unavailable.
        }
        leader = false;
        input.onChange(false);
    };
    const attempt = () => {
        if (document.hidden) {
            release();
            return;
        }
        try {
            const now = Date.now();
            const current = readLease(window.localStorage.getItem(key));
            if (!current || current.expiresAt <= now || current.ownerId === input.ownerId) {
                window.localStorage.setItem(key, JSON.stringify({
                    ownerId: input.ownerId,
                    expiresAt: now + LEASE_TTL_MS,
                }));
                const confirmed = readLease(window.localStorage.getItem(key));
                const nextLeader = confirmed?.ownerId === input.ownerId;
                if (nextLeader !== leader) {
                    leader = nextLeader;
                    input.onChange(leader);
                }
            } else if (leader) {
                leader = false;
                input.onChange(false);
            }
        } catch {
            if (!leader) {
                leader = true;
                input.onChange(true);
            }
        }
    };
    attempt();
    const interval = window.setInterval(attempt, LEASE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", attempt);
    window.addEventListener("storage", attempt);
    return () => {
        window.clearInterval(interval);
        document.removeEventListener("visibilitychange", attempt);
        window.removeEventListener("storage", attempt);
        release();
    };
}

function readLease(value: string | null): { ownerId: string; expiresAt: number } | null {
    if (!value) return null;
    try {
        const parsed: unknown = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
        const lease = parsed as Record<string, unknown>;
        return typeof lease.ownerId === "string" && typeof lease.expiresAt === "number"
            ? { ownerId: lease.ownerId, expiresAt: lease.expiresAt }
            : null;
    } catch {
        return null;
    }
}

function readPendingSlices(sessionId: string): CandidateEngagementSlice[] {
    try {
        const value: unknown = JSON.parse(window.sessionStorage.getItem(pendingStorageKey(sessionId)) ?? "[]");
        return Array.isArray(value) ? value.filter(isStoredSlice).slice(0, 100) : [];
    } catch {
        return [];
    }
}

function isStoredSlice(value: unknown): value is CandidateEngagementSlice {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const slice = value as Partial<CandidateEngagementSlice>;
    return isUuid(slice.engagementSliceId)
        && isUuid(slice.trackerInstanceId)
        && typeof slice.sequenceNumber === "number"
        && Number.isInteger(slice.sequenceNumber)
        && typeof slice.activeMilliseconds === "number"
        && slice.activeMilliseconds > 0
        && typeof slice.clientStartedAt === "string"
        && typeof slice.clientEndedAt === "string"
        && typeof slice.openedBy === "string"
        && typeof slice.lastActivity === "string"
        && typeof slice.flushReason === "string";
}

function pendingStorageKey(sessionId: string) {
    return `candidate-engagement-pending:${sessionId}`;
}

function emptySummary(): CandidateEngagementSessionSummary {
    return { activeMilliseconds: 0, sliceCount: 0, firstReceivedAt: null, lastReceivedAt: null };
}

function createUuid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
        const random = Math.floor(Math.random() * 16);
        const value = character === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

function isUuid(value: unknown): value is string {
    return typeof value === "string"
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
