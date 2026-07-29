"use client";

import { useEffect, useRef, useState } from "react";

import type { LabBeat } from "./lab-types";

type LabChapterProps = {
    id: string;
    chapterIndex: number;
    label: string;
    heading: string;
    outcome: string;
    flip?: boolean;
    beats: LabBeat[];
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

function readCeiling() {
    const dock = document.getElementById("lab-hiw-dock");
    if (dock) {
        const bottom = dock.getBoundingClientRect().bottom;
        if (bottom > 0) {
            return bottom + 8;
        }
    }
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--lab-ceiling").trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 72;
}

function scrollChapterToBeat(root: HTMLElement, index: number, beatCount: number, smooth: boolean) {
    const total = root.offsetHeight - window.innerHeight;
    if (total <= 0 || beatCount <= 0) {
        return;
    }
    const segment = total / beatCount;
    const top = root.getBoundingClientRect().top + window.scrollY + index * segment + 1;
    window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
}

/**
 * Sticky chapter: left header peeks from the bottom to a ceiling under HIW,
 * then beat content fades in and scrubs. On exit, header + content leave together
 * while the next chapter peeks in naturally via sequential sticky sections.
 */
export function LabChapter({
    id,
    chapterIndex,
    label,
    heading,
    outcome,
    flip = false,
    beats,
}: LabChapterProps) {
    const rootRef = useRef<HTMLElement | null>(null);
    const pinRef = useRef<HTMLDivElement | null>(null);
    const [active, setActive] = useState(0);
    const [progress, setProgress] = useState(0);
    const [pinned, setPinned] = useState(false);
    const [headingOpacity, setHeadingOpacity] = useState(0);
    const [headingRise, setHeadingRise] = useState(24);
    const [contentOpacity, setContentOpacity] = useState(0);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sync = () => setReducedMotion(media.matches);
        sync();
        media.addEventListener("change", sync);
        return () => media.removeEventListener("change", sync);
    }, []);

    useEffect(() => {
        const root = rootRef.current;
        const pin = pinRef.current;
        if (!root || !pin) {
            return;
        }

        const onScroll = () => {
            const vh = window.innerHeight;
            const ceiling = readCeiling();
            const pinTop = pin.getBoundingClientRect().top;
            const section = root.getBoundingClientRect();
            const total = Math.max(root.offsetHeight - vh, 1);
            const scrolled = clamp01(-section.top / total);

            // Header peeks from bottom toward the HIW ceiling.
            const arriveSpan = Math.max(vh - ceiling, 120);
            const arrive = clamp01(1 - (pinTop - ceiling) / arriveSpan);
            setHeadingOpacity(arrive);
            setHeadingRise((1 - arrive) * 22);

            // Content fades in once the header is near its ceiling.
            const reveal = reducedMotion ? (arrive > 0.5 ? 1 : 0) : clamp01((arrive - 0.72) / 0.28);
            setContentOpacity(reveal);

            const isPinned = pinTop <= ceiling + 2 && section.bottom > vh + 8;
            setPinned(isPinned);

            // Beat scrub across the chapter's sticky travel.
            const nextProgress = scrolled;
            const nextActive = Math.min(
                beats.length - 1,
                Math.floor(clamp01((scrolled - 0.08) / 0.84) * beats.length),
            );
            setProgress(nextProgress);
            setActive((current) => (current === nextActive ? current : nextActive));
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [beats.length, reducedMotion]);

    useEffect(() => {
        const root = rootRef.current as (HTMLElement & { __selectBeat?: (index: number) => void }) | null;
        if (!root) {
            return;
        }
        root.__selectBeat = (index: number) => {
            setActive(index);
            scrollChapterToBeat(root, index, beats.length, !reducedMotion);
        };
        return () => {
            delete root.__selectBeat;
        };
    }, [beats.length, reducedMotion]);

    const beat = beats[active] ?? beats[0];
    const beatLocal = beats.length > 0 ? Math.max(0, (progress - 0.08) / 0.84) * beats.length - active : 0;
    const peekNext = !reducedMotion && contentOpacity > 0.6 && active < beats.length - 1 && beatLocal >= 0.72;
    const nextBeat = peekNext ? beats[active + 1] : null;
    const indexLabel = String(chapterIndex + 1).padStart(2, "0");

    return (
        <section
            ref={rootRef}
            id={id}
            className={`lab-chapter${flip ? " lab-chapter--flip" : ""}${pinned ? " is-pinned" : ""}`}
            style={{ minHeight: `${Math.max(beats.length + 1, 2) * 100}vh` }}
            aria-labelledby={`${id}-heading`}
            data-chapter-index={chapterIndex}
        >
            <div ref={pinRef} className="lab-chapter__pin">
                <div className="lab-chapter__mesh" aria-hidden="true" />
                <div className="lab-chapter__layout">
                    <header
                        className="lab-chapter__heading"
                        style={{
                            opacity: headingOpacity,
                            transform: `translateY(${headingRise.toFixed(2)}vh)`,
                        }}
                    >
                        <p className="lab-chapter__index">{indexLabel}</p>
                        <h2 id={`${id}-heading`} className="lab-chapter__name">
                            {label}
                        </h2>
                    </header>

                    <div className="lab-chapter__body" style={{ opacity: contentOpacity }}>
                        <div className="lab-chapter__copy">
                            <p className="lab-chapter__claim">{heading}</p>
                            <div key={`copy-${beat.id}`} className="lab-chapter__beat-block">
                                <p className="lab-chapter__beat-title">
                                    <span className="lab-chapter__beat-num" aria-hidden="true">
                                        {active + 1}
                                    </span>
                                    <span className="lab-chapter__beat-sep" aria-hidden="true">
                                        ·
                                    </span>
                                    {beat.title}
                                </p>
                                <p className="lab-chapter__beat-body">{beat.body}</p>
                            </div>
                            <div className="lab-chapter__meter" aria-hidden="true">
                                {beats.map((item, index) => (
                                    <span
                                        key={item.id}
                                        className={
                                            index < active ? "is-done" : index === active ? "is-active" : undefined
                                        }
                                        style={
                                            index === active
                                                ? {
                                                      ["--beat-fill" as string]: `${Math.min(1, Math.max(0, beatLocal))}`,
                                                  }
                                                : undefined
                                        }
                                    />
                                ))}
                            </div>
                            <p className="lab-chapter__outcome">{outcome}</p>
                        </div>

                        <div className="lab-chapter__stage" aria-live="polite">
                            <div className="lab-chapter__stage-stack">
                                {nextBeat ? (
                                    <div className="lab-chapter__stage-peek" aria-hidden="true">
                                        {nextBeat.stage}
                                    </div>
                                ) : null}
                                <div key={beat.id} className="lab-chapter__stage-active">
                                    {beat.stage}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function selectLabChapterBeat(chapterId: string, beatIndex: number) {
    const root = document.getElementById(chapterId) as
        | (HTMLElement & { __selectBeat?: (index: number) => void })
        | null;
    root?.__selectBeat?.(beatIndex);
}
