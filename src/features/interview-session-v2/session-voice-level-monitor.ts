type AudioContextWindow = Window & {
    webkitAudioContext?: typeof AudioContext;
};

type SessionVoiceLevelMonitorDependencies = {
    createAudioContext?: () => AudioContext | null;
    requestFrame?: (callback: FrameRequestCallback) => number;
    cancelFrame?: (frameId: number) => void;
};

export type SessionVoiceLevelMonitor = {
    stop: () => void;
};

export function startSessionVoiceLevelMonitor(input: {
    stream: MediaStream;
    barCount: number;
    onLevels: (levels: number[]) => void;
    dependencies?: SessionVoiceLevelMonitorDependencies;
}): SessionVoiceLevelMonitor | null {
    const createAudioContext = input.dependencies?.createAudioContext ?? createBrowserAudioContext;
    const requestFrame = input.dependencies?.requestFrame ?? window.requestAnimationFrame.bind(window);
    const cancelFrame = input.dependencies?.cancelFrame ?? window.cancelAnimationFrame.bind(window);
    const context = createAudioContext();
    if (!context) return null;

    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let frameId: number | null = null;
    let stopped = false;

    try {
        source = context.createMediaStreamSource(input.stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        if (context.state === "suspended") {
            void context.resume().catch(() => undefined);
        }
    } catch {
        void context.close().catch(() => undefined);
        return null;
    }

    const samples = new Uint8Array(analyser.frequencyBinCount);
    const sampleFrame = () => {
        if (stopped || !analyser) return;
        analyser.getByteFrequencyData(samples);
        input.onLevels(createSessionVoiceLevels(samples, input.barCount));
        frameId = requestFrame(sampleFrame);
    };
    frameId = requestFrame(sampleFrame);

    return {
        stop() {
            if (stopped) return;
            stopped = true;
            if (frameId !== null) cancelFrame(frameId);
            source?.disconnect();
            analyser?.disconnect();
            void context.close().catch(() => undefined);
        },
    };
}

export function createSessionVoiceLevels(samples: Uint8Array, barCount: number) {
    if (barCount <= 0) return [];
    if (samples.length === 0) return Array.from({ length: barCount }, () => 0.08);

    const firstUsefulBin = Math.min(2, samples.length - 1);
    const usefulBinCount = Math.max(1, samples.length - firstUsefulBin);

    return Array.from({ length: barCount }, (_, index) => {
        const start = firstUsefulBin + Math.floor((index / barCount) * usefulBinCount);
        const end = firstUsefulBin + Math.max(
            Math.floor(((index + 1) / barCount) * usefulBinCount),
            Math.floor((index / barCount) * usefulBinCount) + 1,
        );
        let total = 0;
        let count = 0;

        for (let sampleIndex = start; sampleIndex < Math.min(end, samples.length); sampleIndex += 1) {
            total += samples[sampleIndex];
            count += 1;
        }

        const normalized = count > 0 ? total / count / 255 : 0;
        return Math.max(0.08, Math.min(1, Math.pow(normalized, 0.72)));
    });
}

function createBrowserAudioContext() {
    if (typeof window === "undefined") return null;
    const AudioContextConstructor = window.AudioContext
        ?? (window as AudioContextWindow).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    try {
        return new AudioContextConstructor();
    } catch {
        return null;
    }
}
