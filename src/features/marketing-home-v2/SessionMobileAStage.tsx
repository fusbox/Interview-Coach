"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Lightbulb, Mic, Pause, Send, Sparkles, X } from "lucide-react";

const QUESTION = {
    category: "Behavioral",
    text: "Tell me about a time you resolved a conflict on your team.",
    hints: [
        "Use the STAR method: Situation, Task, Action, Result.",
        "De-escalate the tension: explain how you actively listened to both sides.",
        "Focus on the solution and team health rather than pointing blame.",
    ],
    structure: "Tension Frame → Active Mediation → Retrospective Alignment",
    example:
        "In my last role, two senior devs disagreed on library adoption. I set up a structured sandbox trial, compared metrics objectively, and helped them align on a hybrid approach, saving 3 weeks of delay.",
} as const;

const WAVE_IDLE = [20, 40, 15, 60, 30, 45, 10, 50, 25, 35, 15, 40, 25, 55, 30, 45] as const;

function questionCutoutPath(width: number, height: number) {
    const r = 24;
    const nw = 92;
    const nh = 44;
    const rn = 16;
    return `M ${r} 0 L ${width - nw - rn} 0 A ${rn} ${rn} 0 0 1 ${width - nw} ${rn} L ${width - nw} ${nh - rn} A ${rn} ${rn} 0 0 0 ${width - nw + rn} ${nh} L ${width - r} ${nh} A ${r} ${r} 0 0 1 ${width} ${nh + r} L ${width} ${height - r} A ${r} ${r} 0 0 1 ${width - r} ${height} L ${r} ${height} A ${r} ${r} 0 0 1 0 ${height - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
}

/** Keyboard / text-mode glyph from Candidate Session Mobile A (not a generic “Type” icon). */
function TextModeIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="M6 8h.01" />
            <path d="M10 8h.01" />
            <path d="M14 8h.01" />
            <path d="M18 8h.01" />
            <path d="M8 12h.01" />
            <path d="M12 12h.01" />
            <path d="M16 12h.01" />
            <path d="M7 16h10" />
        </svg>
    );
}

/**
 * Faithful marketing reproduction of Candidate Session Mobile A screen content
 * (`.untracked/design-system-maturation/Candidate Session Mobile A.dc.html`).
 * Rendered inside the shared lab PhoneFrame viewport — no device shell of its own.
 */
export function SessionMobileAStage() {
    const gradientId = useId();
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [stageSize, setStageSize] = useState({ w: 340, h: 227 });

    const [activeCoachTab, setActiveCoachTab] = useState<"hints" | "strong" | null>(null);
    const [lastCoachTab, setLastCoachTab] = useState<"hints" | "strong">("hints");
    const [slideTabs, setSlideTabs] = useState(false);
    const [inputMode, setInputMode] = useState<"text" | "voice">("text");
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [draftText, setDraftText] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [waveHeights, setWaveHeights] = useState<number[]>([...WAVE_IDLE]);

    useEffect(() => {
        const el = stageRef.current;
        if (!el) {
            return;
        }
        const measure = () => {
            const w = Math.round(el.clientWidth);
            const h = Math.round(el.clientHeight);
            if (w > 0 && h > 0) {
                setStageSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
            }
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isRecording) {
            return;
        }
        const timer = window.setInterval(() => setRecordingTime((value) => value + 1), 1000);
        const wave = window.setInterval(() => {
            setWaveHeights(Array.from({ length: 16 }, () => Math.floor(Math.random() * 65) + 15));
        }, 120);
        return () => {
            window.clearInterval(timer);
            window.clearInterval(wave);
        };
    }, [isRecording]);

    const drawerOpen = activeCoachTab !== null;
    const shownTab = activeCoachTab ?? lastCoachTab;
    const shownHints = shownTab === "hints";
    const cutout = questionCutoutPath(stageSize.w, stageSize.h);
    const canSubmit = draftText.trim().length > 0;

    const openHints = () => {
        if (activeCoachTab === "hints") {
            setActiveCoachTab(null);
            setSlideTabs(false);
            return;
        }
        setSlideTabs(activeCoachTab !== null);
        setLastCoachTab("hints");
        setActiveCoachTab("hints");
    };

    const openStrong = () => {
        if (activeCoachTab === "strong") {
            setActiveCoachTab(null);
            setSlideTabs(false);
            return;
        }
        setSlideTabs(activeCoachTab !== null);
        setLastCoachTab("strong");
        setActiveCoachTab("strong");
    };

    const closeDrawer = () => {
        setActiveCoachTab(null);
        setSlideTabs(false);
    };

    const toggleRecord = () => {
        if (isRecording) {
            setIsRecording(false);
            setWaveHeights([...WAVE_IDLE]);
            return;
        }
        setRecordingTime(0);
        setIsRecording(true);
    };

    const minutes = Math.floor(recordingTime / 60);
    const seconds = recordingTime % 60;
    const recordingTimeLabel = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    return (
        <div className="session-mobile-a">
            <header className="session-mobile-a__header">
                <div>
                    <p className="session-mobile-a__eyebrow">Senior Product Designer</p>
                    <strong>Question 1 of 2</strong>
                </div>
                <button type="button" className="session-mobile-a__pause" tabIndex={-1}>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    Pause
                </button>
            </header>

            <div className="session-mobile-a__progress" aria-hidden="true">
                <span className="is-active" />
                <span />
            </div>

            <div ref={stageRef} className="session-mobile-a__stage">
                <div className="session-mobile-a__stage-surface" aria-hidden="true" />
                <div className="session-mobile-a__stage-inset" aria-hidden="true" />
                <svg
                    className="session-mobile-a__cutout"
                    viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <defs>
                        <linearGradient id={`${gradientId}-fill`} x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="rgb(var(--surface-alt, 246 249 252))" />
                            <stop offset="100%" stopColor="rgb(var(--primary-soft))" />
                        </linearGradient>
                        <linearGradient id={`${gradientId}-stroke`} x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="rgb(255 255 255 / 0)" />
                            <stop offset="100%" stopColor="rgb(var(--primary) / 0.15)" />
                        </linearGradient>
                    </defs>
                    <path
                        d={cutout}
                        fill={`url(#${gradientId}-fill)`}
                        stroke={`url(#${gradientId}-stroke)`}
                        strokeWidth="1"
                    />
                </svg>

                <div className="session-mobile-a__category-row">
                    <span className="session-mobile-a__category">{QUESTION.category}</span>
                </div>

                {/* Coach tools stay above the drawer (source z-index 10) so surfaces persist while open. */}
                <div className="session-mobile-a__coach-tools">
                    <button
                        type="button"
                        title="Hints"
                        aria-pressed={activeCoachTab === "hints"}
                        className={`session-mobile-a__glass session-mobile-a__glass--hints${activeCoachTab === "hints" ? " is-on" : ""}`}
                        onClick={openHints}
                    >
                        <Lightbulb className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        title="Strong response framework"
                        aria-pressed={activeCoachTab === "strong"}
                        className={`session-mobile-a__glass session-mobile-a__glass--strong${activeCoachTab === "strong" ? " is-on" : ""}`}
                        onClick={openStrong}
                    >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                <h3 className="session-mobile-a__question">{QUESTION.text}</h3>

                <button
                    type="button"
                    className="session-mobile-a__read-aloud session-mobile-a__glass session-mobile-a__glass--ctrl"
                    title={isAudioPlaying ? "Stop reading" : "Read aloud"}
                    aria-pressed={isAudioPlaying}
                    onClick={() => setIsAudioPlaying((value) => !value)}
                >
                    {isAudioPlaying ? (
                        <span className="session-mobile-a__stop-icon" aria-hidden="true" />
                    ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M7 4.5v15l13-7.5Z" />
                        </svg>
                    )}
                </button>

                <button
                    type="button"
                    className={`session-mobile-a__backdrop${drawerOpen ? " is-open" : ""}`}
                    aria-label="Close coaching drawer"
                    tabIndex={drawerOpen ? 0 : -1}
                    onClick={closeDrawer}
                />

                <div
                    className={`session-mobile-a__drawer${drawerOpen ? " is-open" : ""}`}
                    role="dialog"
                    aria-hidden={!drawerOpen}
                    aria-label={shownHints ? "Hints & Framework" : "Strong Response Model"}
                >
                    <div className="session-mobile-a__drawer-bar">
                        <button type="button" aria-label="Close" onClick={closeDrawer}>
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className={shownHints ? "is-hints" : "is-strong"}>
                            {shownHints ? "Hints & Framework" : "Strong Response Model"}
                        </span>
                        <span className="session-mobile-a__drawer-spacer" aria-hidden="true" />
                    </div>
                    <div className={`session-mobile-a__drawer-panels${slideTabs ? " is-sliding" : ""}`}>
                        <div
                            className={`session-mobile-a__drawer-panel${shownHints ? " is-visible" : " is-exit-left"}`}
                            aria-hidden={!shownHints}
                        >
                            <p className="session-mobile-a__drawer-lead">Do&apos;s &amp; structure strategy</p>
                            <ul>
                                {QUESTION.hints.map((hint) => (
                                    <li key={hint}>{hint}</li>
                                ))}
                            </ul>
                        </div>
                        <div
                            className={`session-mobile-a__drawer-panel${shownHints ? " is-exit-right" : " is-visible"}`}
                            aria-hidden={shownHints}
                        >
                            <p className="session-mobile-a__drawer-kicker">Canonical target structure</p>
                            <p className="session-mobile-a__drawer-structure">{QUESTION.structure}</p>
                            <p className="session-mobile-a__drawer-kicker">Demonstration answer</p>
                            <p className="session-mobile-a__drawer-example">&ldquo;{QUESTION.example}&rdquo;</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Composer height mirrors the question stage — no size drift between modes. */}
            <div className="session-mobile-a__composer" style={{ height: stageSize.h }}>
                <div className="session-mobile-a__composer-surface" aria-hidden="true" />
                <div className="session-mobile-a__composer-inset" aria-hidden="true" />
                <svg
                    className="session-mobile-a__cutout"
                    viewBox={`0 0 ${stageSize.w} ${stageSize.h}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <g transform={`translate(${stageSize.w},${stageSize.h}) rotate(180)`}>
                        <path d={cutout} fill="rgb(var(--surface, 255 255 255))" stroke="rgb(var(--border) / 0.55)" strokeWidth="1.5" />
                    </g>
                </svg>

                <div className="session-mobile-a__mode-tools">
                    <button
                        type="button"
                        title="Voice answer"
                        aria-pressed={inputMode === "voice"}
                        className={`session-mobile-a__glass session-mobile-a__glass--ctrl${inputMode === "voice" ? " is-on" : ""}`}
                        onClick={() => setInputMode("voice")}
                    >
                        <Mic className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        title="Text answer"
                        aria-pressed={inputMode === "text"}
                        className={`session-mobile-a__glass session-mobile-a__glass--ctrl${inputMode === "text" ? " is-on" : ""}`}
                        onClick={() => setInputMode("text")}
                    >
                        <TextModeIcon />
                    </button>
                </div>

                <div className={`session-mobile-a__text-panel${inputMode === "text" ? " is-visible" : ""}`}>
                    <div className="session-mobile-a__panel-label">
                        <span className="session-mobile-a__eyebrow">Your answer</span>
                    </div>
                    <textarea
                        value={draftText}
                        onChange={(event) => setDraftText(event.target.value)}
                        placeholder="Type your answer here..."
                        aria-label="Your answer"
                    />
                    <button
                        type="button"
                        className={`session-mobile-a__submit${canSubmit ? " is-ready" : ""}`}
                        disabled={!canSubmit}
                        onClick={() => {
                            if (!canSubmit) {
                                return;
                            }
                            setDraftText("");
                        }}
                    >
                        <span>Submit</span>
                        <Send className="h-3 w-3" aria-hidden="true" />
                    </button>
                </div>

                <div className={`session-mobile-a__voice-panel${inputMode === "voice" ? " is-visible" : ""}`}>
                    <div className="session-mobile-a__voice-meta">
                        <span>{isRecording ? "Recording" : "Tap to record; tap again to stop."}</span>
                        <span className={isRecording ? "is-live" : undefined}>{recordingTimeLabel}</span>
                    </div>
                    <div className="session-mobile-a__wave" aria-hidden="true">
                        {waveHeights.map((height, index) => (
                            <span
                                key={index}
                                className={isRecording ? "is-live" : undefined}
                                style={{ height: `${height}%` }}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        className={`session-mobile-a__record${isRecording ? " is-recording" : ""}`}
                        title={isRecording ? "Stop recording" : "Record answer"}
                        onClick={toggleRecord}
                    >
                        {isRecording ? (
                            <span className="session-mobile-a__record-stop" aria-hidden="true" />
                        ) : (
                            <Mic className="h-7 w-7" aria-hidden="true" />
                        )}
                    </button>
                </div>
            </div>

            <p className="session-mobile-a__privacy">Private coaching · not shared with recruiters</p>
        </div>
    );
}
