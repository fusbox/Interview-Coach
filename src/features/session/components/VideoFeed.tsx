import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Camera, CameraOff } from 'lucide-react';

interface VideoFeedProps {
    className?: string;
    onStreamReady?: (stream: MediaStream) => void;
}

export function VideoFeed({ className, onStreamReady }: VideoFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const onStreamReadyRef = useRef(onStreamReady);
    onStreamReadyRef.current = onStreamReady;

    useEffect(() => {
        let mounted = true;
        let localStream: MediaStream | null = null;

        const initCamera = async () => {
            try {
                // Request video only, audio handled separately by recording hooks
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: "user"
                    },
                    audio: false
                });

                if (mounted) {
                    setStream(localStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = localStream;
                    }
                    if (onStreamReadyRef.current) {
                        onStreamReadyRef.current(localStream);
                    }
                }
            } catch (err) {
                console.error("Camera access failed:", err);
                if (mounted) setError("Camera access denied or unavailable.");
            }
        };

        initCamera();

        return () => {
            mounted = false;
            // Cleanup: Stop all video tracks
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Re-attach stream if ref changes (e.g. strict mode remount)
    useEffect(() => {
        if (stream && videoRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    if (error) {
        return (
            <div className={cn("flex flex-col items-center justify-center bg-text-primary text-text-muted", className)}>
                <CameraOff size={48} className="mb-2 opacity-50" />
                <p className="text-sm font-medium">Camera Off</p>
            </div>
        );
    }

    return (
        <div className={cn("relative bg-black overflow-hidden", className)}>
            {!stream && (
                <div className="absolute inset-0 flex items-center justify-center text-white/50 z-10">
                    <Camera size={32} className="animate-pulse" />
                </div>
            )}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
            />
        </div>
    );
}
