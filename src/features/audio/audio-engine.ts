/**
 * AudioEngine — Singleton for stable TTS playback via Web Audio API.
 *
 * Solves browser autoplay restrictions by unlocking an AudioContext once
 * on user gesture, then reusing it for all subsequent playback.
 *
 * Usage:
 *   1. Call `audioEngine.unlock()` on a user gesture (button click)
 *   2. Call `audioEngine.play(id, text)` to fetch TTS + play
 *   3. Call `audioEngine.prefetch(id, text)` to cache audio ahead of time
 */

interface WebkitWindow extends Window {
    webkitAudioContext?: typeof AudioContext;
}

type EngineState = 'locked' | 'unlocked';
type PlaybackState = 'idle' | 'loading' | 'playing';

class AudioEngine {
    private ctx: AudioContext | null = null;
    private state: EngineState = 'locked';
    private playbackState: PlaybackState = 'idle';
    private cache = new Map<string, AudioBuffer>();
    private pending = new Map<string, Promise<AudioBuffer>>();
    private activeSource: AudioBufferSourceNode | null = null;
    private listeners = new Set<() => void>();

    // --- Public API ---

    /** Call on a user gesture (click/tap) to unlock the AudioContext. Idempotent. */
    async unlock(): Promise<void> {
        if (this.state === 'unlocked' && this.ctx?.state === 'running') return;

        try {
            const AudioCtx = window.AudioContext ||
                (window as unknown as WebkitWindow).webkitAudioContext;

            if (!AudioCtx) {
                console.warn('[AudioEngine] AudioContext not supported');
                return;
            }

            if (!this.ctx) {
                this.ctx = new AudioCtx();
            }

            // Resume if suspended (happens on some browsers)
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            // Play a silent buffer to fully unlock
            const silent = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = silent;
            source.connect(this.ctx.destination);
            source.start();

            this.state = 'unlocked';
            console.log('[AudioEngine] Unlocked');
        } catch (err) {
            console.error('[AudioEngine] Unlock failed:', err);
        }
    }

    /** Fetch TTS audio (or use cache) and play it. */
    async play(id: string, text: string): Promise<void> {
        if (this.state !== 'unlocked' || !this.ctx) {
            console.warn('[AudioEngine] Not unlocked. Call unlock() first.');
            return;
        }

        // Stop any current playback
        this.stop();

        try {
            this.setPlaybackState('loading');
            const buffer = await this.getOrFetch(id, text);

            // Check if we were stopped while loading
            if (this.playbackState !== 'loading') return;

            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.onended = () => {
                this.activeSource = null;
                this.setPlaybackState('idle');
            };

            this.activeSource = source;
            // Look-ahead rendering: Delay start by 150ms to give hardware/drivers time to fully engage.
            // This prevents the "clipped start" issue in production environments.
            const lookAheadTime = this.ctx.currentTime + 3;
            source.start(lookAheadTime);
            this.setPlaybackState('playing');
        } catch (err) {
            console.error('[AudioEngine] Play failed:', err);
            this.setPlaybackState('idle');
        }
    }

    /** Stop current playback. */
    stop(): void {
        if (this.activeSource) {
            try {
                this.activeSource.onended = null;
                this.activeSource.stop();
            } catch {
                // Already stopped — ignore
            }
            this.activeSource = null;
        }
        this.setPlaybackState('idle');
    }

    /** Prefetch audio for a question (fire-and-forget). */
    prefetch(id: string, text: string): void {
        if (this.state !== 'unlocked' || !this.ctx) return;
        // Fire-and-forget — just populate cache
        this.getOrFetch(id, text).catch(() => { /* swallow */ });
    }

    /** Whether audio is currently playing. */
    get isPlaying(): boolean {
        return this.playbackState === 'playing';
    }

    /** Whether audio is currently loading/fetching. */
    get isLoading(): boolean {
        return this.playbackState === 'loading';
    }

    /** Subscribe to state changes. Returns unsubscribe function. */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    // --- Internal ---

    private setPlaybackState(next: PlaybackState): void {
        if (this.playbackState === next) return;
        this.playbackState = next;
        this.listeners.forEach(fn => fn());
    }

    private async getOrFetch(id: string, text: string): Promise<AudioBuffer> {
        // Cache hit
        if (this.cache.has(id)) {
            return this.cache.get(id)!;
        }

        // Already in-flight — deduplicate
        if (this.pending.has(id)) {
            return this.pending.get(id)!;
        }

        // Fetch, decode, cache
        const promise = this.fetchAndDecode(id, text);
        this.pending.set(id, promise);

        try {
            const buffer = await promise;
            this.cache.set(id, buffer);
            return buffer;
        } finally {
            this.pending.delete(id);
        }
    }

    private async fetchAndDecode(id: string, text: string): Promise<AudioBuffer> {
        if (!this.ctx) throw new Error('AudioContext not initialized');

        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`TTS request failed: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

        console.log(`[AudioEngine] Cached audio for "${id}" (${audioBuffer.duration.toFixed(1)}s)`);
        return audioBuffer;
    }
}

// Module-level singleton
export const audioEngine = new AudioEngine();
