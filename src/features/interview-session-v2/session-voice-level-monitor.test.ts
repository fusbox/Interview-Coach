import { describe, expect, it, vi } from "vitest";

import {
    createSessionVoiceLevels,
    startSessionVoiceLevelMonitor,
} from "./session-voice-level-monitor";

describe("session voice level monitor", () => {
    it("maps live frequency energy into bounded visualizer levels", () => {
        const levels = createSessionVoiceLevels(
            new Uint8Array([0, 0, 16, 64, 128, 255]),
            4,
        );

        expect(levels).toHaveLength(4);
        expect(levels.every((level) => level >= 0.08 && level <= 1)).toBe(true);
        expect(levels[3]).toBeGreaterThan(levels[0]);
    });

    it("samples the microphone analyser and releases every browser resource", () => {
        const frames: FrameRequestCallback[] = [];
        const requestFrame = vi.fn((callback: FrameRequestCallback) => {
            frames.push(callback);
            return 17;
        });
        const cancelFrame = vi.fn();
        const source = {
            connect: vi.fn(),
            disconnect: vi.fn(),
        };
        const analyser = {
            fftSize: 0,
            smoothingTimeConstant: 0,
            frequencyBinCount: 4,
            getByteFrequencyData: vi.fn((samples: Uint8Array) => {
                samples.set([0, 32, 128, 255]);
            }),
            disconnect: vi.fn(),
        };
        const context = {
            createMediaStreamSource: vi.fn(() => source),
            createAnalyser: vi.fn(() => analyser),
            close: vi.fn(async () => undefined),
        };
        const onLevels = vi.fn();

        const monitor = startSessionVoiceLevelMonitor({
            stream: {} as MediaStream,
            barCount: 4,
            onLevels,
            dependencies: {
                createAudioContext: () => context as unknown as AudioContext,
                requestFrame,
                cancelFrame,
            },
        });

        expect(monitor).not.toBeNull();
        expect(source.connect).toHaveBeenCalledWith(analyser);
        frames[0](16);
        expect(onLevels).toHaveBeenCalledWith(expect.arrayContaining([
            expect.any(Number),
            expect.any(Number),
        ]));

        monitor?.stop();
        expect(cancelFrame).toHaveBeenCalledWith(17);
        expect(source.disconnect).toHaveBeenCalledOnce();
        expect(analyser.disconnect).toHaveBeenCalledOnce();
        expect(context.close).toHaveBeenCalledOnce();
    });
});
