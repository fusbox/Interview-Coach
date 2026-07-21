"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";

import {
    createSessionQuestionAudioPlaybackMemory,
    type SessionQuestionAudioLifecycle,
    type SessionQuestionAudioTarget,
} from "./session-question-audio-contract";

const MAX_BROWSER_CACHE_ENTRIES = 12;

type BrowserPlaybackState = {
    phase: "idle" | "loading" | "playing";
    key: string | null;
};

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export type SessionQuestionAudioBrowserEngineDependencies = {
    fetch?: typeof fetch;
    createAudioContext?: () => AudioContext | null;
};

export function useSessionQuestionAudio(input: {
    enabled: boolean;
    requestPath: string;
    activeTarget?: SessionQuestionAudioTarget | null;
}) {
    const state = useSyncExternalStore(
        questionAudioEngine.subscribe,
        questionAudioEngine.getSnapshot,
        questionAudioEngine.getSnapshot,
    );
    const memoryRef = useRef<ReturnType<typeof createSessionQuestionAudioPlaybackMemory> | null>(null);
    const readMemory = useCallback(() => {
        if (memoryRef.current) return memoryRef.current;
        try {
            memoryRef.current = createSessionQuestionAudioPlaybackMemory(window.sessionStorage);
        } catch {
            memoryRef.current = createSessionQuestionAudioPlaybackMemory(createMemoryStorage());
        }
        return memoryRef.current;
    }, []);

    const lifecycle = useMemo<SessionQuestionAudioLifecycle | undefined>(() => {
        if (!input.enabled) return undefined;
        return {
            unlock: async () => {
                await questionAudioEngine.unlock();
            },
            prefetch: (target) => questionAudioEngine.prefetch(input.requestPath, target),
            async playOnce(target) {
                const memory = readMemory();
                if (memory.hasPlayed(target)) return;
                const outcome = await questionAudioEngine.play(input.requestPath, target);
                if (outcome === "started") memory.markPlayed(target);
            },
            stop: () => questionAudioEngine.stop(),
        };
    }, [input.enabled, input.requestPath, readMemory]);

    const activeKey = input.activeTarget
        ? createBrowserAudioKey(input.requestPath, input.activeTarget)
        : null;
    const isActive = Boolean(activeKey && state.key === activeKey);
    const onToggle = useCallback(async () => {
        const target = input.activeTarget;
        if (!input.enabled || !target) return;
        const key = createBrowserAudioKey(input.requestPath, target);
        const snapshot = questionAudioEngine.getSnapshot();
        if (snapshot.key === key && snapshot.phase !== "idle") {
            questionAudioEngine.stop();
            return;
        }

        const unlocked = await questionAudioEngine.unlock();
        if (!unlocked) return;
        const outcome = await questionAudioEngine.play(input.requestPath, target);
        if (outcome === "started") readMemory().markPlayed(target);
    }, [input.activeTarget, input.enabled, input.requestPath, readMemory]);

    return {
        questionAudio: lifecycle,
        questionPlaybackControl: input.enabled && input.activeTarget ? {
            isPlaying: isActive && state.phase === "playing",
            isLoading: isActive && state.phase === "loading",
            onToggle,
        } : undefined,
    };
}

export class SessionQuestionAudioBrowserEngine {
    private audioContext: AudioContext | null = null;
    private activeSource: AudioBufferSourceNode | null = null;
    private state: BrowserPlaybackState = { phase: "idle", key: null };
    private readonly listeners = new Set<() => void>();
    private readonly binaryCache = new Map<string, ArrayBuffer>();
    private readonly decodedCache = new Map<string, AudioBuffer>();
    private readonly pending = new Map<string, Promise<ArrayBuffer>>();
    private playbackGeneration = 0;

    constructor(private readonly dependencies: SessionQuestionAudioBrowserEngineDependencies = {}) {}

    readonly subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };

    readonly getSnapshot = () => this.state;

    async unlock() {
        const context = this.ensureAudioContext();
        if (!context) return false;
        try {
            if (context.state !== "running") await context.resume();
            return context.state === "running";
        } catch {
            return false;
        }
    }

    prefetch(requestPath: string, target: SessionQuestionAudioTarget) {
        const key = createBrowserAudioKey(requestPath, target);
        if (this.binaryCache.has(key) || this.pending.has(key)) return;
        void this.getOrFetch(key, requestPath, target).catch(() => undefined);
    }

    async play(requestPath: string, target: SessionQuestionAudioTarget) {
        const context = this.ensureAudioContext();
        if (!context || context.state !== "running") return "blocked" as const;
        this.stop();
        const key = createBrowserAudioKey(requestPath, target);
        const generation = ++this.playbackGeneration;
        this.setState({ phase: "loading", key });

        try {
            const buffer = await this.getDecodedAudio(context, key, requestPath, target);
            if (generation !== this.playbackGeneration) return "cancelled" as const;
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.onended = () => {
                if (this.activeSource === source) {
                    this.activeSource = null;
                    this.setState({ phase: "idle", key: null });
                }
            };
            this.activeSource = source;
            source.start(context.currentTime + 0.1);
            this.setState({ phase: "playing", key });
            return "started" as const;
        } catch {
            if (generation === this.playbackGeneration) this.setState({ phase: "idle", key: null });
            return "unavailable" as const;
        }
    }

    stop() {
        this.playbackGeneration += 1;
        if (this.activeSource) {
            const source = this.activeSource;
            this.activeSource = null;
            source.onended = null;
            try {
                source.stop();
            } catch {
                // A completed source is already stopped.
            }
        }
        this.setState({ phase: "idle", key: null });
    }

    private ensureAudioContext() {
        if (this.audioContext) return this.audioContext;
        if (this.dependencies.createAudioContext) {
            this.audioContext = this.dependencies.createAudioContext();
            return this.audioContext;
        }
        if (typeof window === "undefined") return null;
        const AudioContextConstructor = window.AudioContext
            ?? (window as WebkitWindow).webkitAudioContext;
        if (!AudioContextConstructor) return null;
        try {
            this.audioContext = new AudioContextConstructor();
            return this.audioContext;
        } catch {
            return null;
        }
    }

    private async getDecodedAudio(
        context: AudioContext,
        key: string,
        requestPath: string,
        target: SessionQuestionAudioTarget,
    ) {
        const decoded = this.decodedCache.get(key);
        if (decoded) return decoded;
        const binary = await this.getOrFetch(key, requestPath, target);
        const audioBuffer = await context.decodeAudioData(binary.slice(0));
        this.writeBounded(this.decodedCache, key, audioBuffer);
        return audioBuffer;
    }

    private async getOrFetch(
        key: string,
        requestPath: string,
        target: SessionQuestionAudioTarget,
    ) {
        const cached = this.binaryCache.get(key);
        if (cached) return cached;
        const inFlight = this.pending.get(key);
        if (inFlight) return inFlight;
        const request = (this.dependencies.fetch ?? fetch)(requestPath, {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionKey: target.questionKey }),
        }).then(async (response) => {
            if (!response.ok) throw new Error("Question audio unavailable.");
            return response.arrayBuffer();
        });
        this.pending.set(key, request);
        try {
            const binary = await request;
            this.writeBounded(this.binaryCache, key, binary);
            return binary;
        } finally {
            if (this.pending.get(key) === request) this.pending.delete(key);
        }
    }

    private writeBounded<T>(cache: Map<string, T>, key: string, value: T) {
        cache.delete(key);
        cache.set(key, value);
        while (cache.size > MAX_BROWSER_CACHE_ENTRIES) {
            const oldestKey = cache.keys().next().value;
            if (typeof oldestKey !== "string") break;
            cache.delete(oldestKey);
        }
    }

    private setState(nextState: BrowserPlaybackState) {
        if (this.state.phase === nextState.phase && this.state.key === nextState.key) return;
        this.state = nextState;
        this.listeners.forEach((listener) => listener());
    }
}

export function createBrowserAudioKey(requestPath: string, target: SessionQuestionAudioTarget) {
    return [requestPath, target.sessionId, target.questionKey].map(encodeURIComponent).join(":");
}

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem"> {
    const values = new Map<string, string>();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

const questionAudioEngine = new SessionQuestionAudioBrowserEngine();
