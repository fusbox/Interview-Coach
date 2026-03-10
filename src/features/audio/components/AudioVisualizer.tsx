import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    stream: MediaStream | null;
    isRecording: boolean;
    className?: string;
}

// Singleton for AudioContext to avoid initialization issues
let sharedAudioContext: AudioContext | null = null;

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream, isRecording, className }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    useEffect(() => {
        // Start only if we have a recording stream
        if (!isRecording || !stream || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize Shared Audio Context
        if (!sharedAudioContext) {
            const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            sharedAudioContext = new AudioContextClass();
        }

        const audioContext = sharedAudioContext;

        const run = async () => {
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (!analyserRef.current) {
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;
                analyserRef.current = analyser;
            }

            const analyser = analyserRef.current;

            // Connect to source
            try {
                if (sourceRef.current) sourceRef.current.disconnect();
                const source = audioContext.createMediaStreamSource(stream);
                source.connect(analyser);
                sourceRef.current = source;
            } catch (e) {
                console.warn("Visualizer connection error:", e);
            }

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                if (!isRecording) return;
                animationRef.current = requestAnimationFrame(draw);

                analyser.getByteFrequencyData(dataArray);

                const dpr = window.devicePixelRatio || 1;
                const width = canvas.width / dpr;
                const height = canvas.height / dpr;

                ctx.clearRect(0, 0, width, height);

                const barCount = 14;
                const barWidth = 4;
                const barGap = 6;
                const centerX = width / 2;
                const centerY = height / 2;

                for (let i = 0; i < barCount; i++) {
                    const dataIndex = i * 2;
                    const value = (dataArray[dataIndex] || 0) / 255;

                    // Base height + reactive height
                    const h = 4 + (value * height * 0.8);

                    const primaryColor = getComputedStyle(canvas).getPropertyValue('--primary') || '#3b82f6';
                    ctx.fillStyle = `hsl(${primaryColor})`;
                    ctx.globalAlpha = 0.4 + (value * 0.6);

                    // Symmetrical drawing
                    const drawBar = (xPos: number) => {
                        ctx.beginPath();
                        if (ctx.roundRect) ctx.roundRect(xPos, centerY - h / 2, barWidth, h, 2);
                        else ctx.rect(xPos, centerY - h / 2, barWidth, h);
                        ctx.fill();
                    };

                    drawBar(centerX + (i * (barWidth + barGap)));
                    drawBar(centerX - (i * (barWidth + barGap)) - barWidth);
                }
            };
            draw();
        };

        run();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (sourceRef.current) sourceRef.current.disconnect();
        };
    }, [stream, isRecording]);

    // Handle high DPI initialization
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.scale(dpr, dpr);
        };
        resize();
        window.addEventListener('resize', resize);
        return () => window.removeEventListener('resize', resize);
    }, []);

    return (
        <canvas ref={canvasRef} className={className || "w-full h-full"} />
    );
};

export default AudioVisualizer;
