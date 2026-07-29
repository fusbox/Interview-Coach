"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { LabChapter } from "./LabChapter";
import type { LabChapterConfig } from "./lab-types";

type LabExperienceProps = {
    chapters: LabChapterConfig[];
    candidateLoginHref: string;
    candidateRegisterHref: string;
    jobSeekerHref: string;
    employerHref: string;
    employeeLoginHref: string;
    footer: ReactNode;
    audiences: ReactNode;
    trust: ReactNode;
};

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

/**
 * Marketing lab: hero → HIW interstitial → sticky chapters under a docked HIW header.
 * Prepare eases in after HIW docks. Dock scrub-fades out as the final chapter unpins.
 */
export function LabExperience({
    chapters,
    candidateLoginHref,
    candidateRegisterHref,
    jobSeekerHref,
    employerHref,
    employeeLoginHref,
    footer,
    audiences,
    trust,
}: LabExperienceProps) {
    const lastChapterId = chapters[chapters.length - 1]?.id ?? "improve";
    const [heroOpacity, setHeroOpacity] = useState(1);
    const [hiwPeek, setHiwPeek] = useState(0);
    const [hiwOpacity, setHiwOpacity] = useState(0);
    const [hiwExit, setHiwExit] = useState(0);
    /** True after HIW has left the intro — keeps Prepare revealed until intro rewind. */
    const [pastIntro, setPastIntro] = useState(false);
    /** 0–1 sticky HIW header presence; scrubbed off when Improve unpins. */
    const [dockProgress, setDockProgress] = useState(0);
    const [prepareReveal, setPrepareReveal] = useState(0);
    const dockProgressRef = useRef(0);

    useEffect(() => {
        dockProgressRef.current = dockProgress;
    }, [dockProgress]);

    // Ease Prepare in after intro handoff — independent of later dock fade-out.
    useEffect(() => {
        if (!pastIntro) {
            setPrepareReveal(0);
            return;
        }

        let raf = 0;
        const start = performance.now();
        const durationMs = 780;
        const tick = (now: number) => {
            const t = clamp01((now - start) / durationMs);
            setPrepareReveal(1 - (1 - t) ** 3);
            if (t < 1) {
                raf = window.requestAnimationFrame(tick);
            }
        };
        raf = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(raf);
    }, [pastIntro]);

    useEffect(() => {
        const syncCeiling = () => {
            const dock = document.getElementById("lab-hiw-dock");
            // Keep chapter pins under the dock while it still occupies space.
            if (dock && dockProgressRef.current > 0.08) {
                document.documentElement.style.setProperty(
                    "--lab-ceiling",
                    `${Math.round(dock.getBoundingClientRect().bottom + 8)}px`,
                );
            } else {
                document.documentElement.style.setProperty("--lab-ceiling", "4.5rem");
            }
        };

        /**
         * Final-chapter leave: 0 while Improve is still pinned / covering the viewport,
         * then 0→1 as its sticky pin releases and the section scrolls away.
         * Scroll-driven so upscroll restores the HIW dock.
         */
        const readFinalChapterLeave = (vh: number) => {
            const chapter = document.getElementById(lastChapterId);
            if (!chapter) {
                return 0;
            }
            const section = chapter.getBoundingClientRect();
            // Pin holds while section.bottom clears the viewport; leave begins at that edge.
            if (section.bottom > vh + 8) {
                return 0;
            }
            return clamp01((vh + 8 - section.bottom) / (vh * 0.55));
        };

        const onScroll = () => {
            const intro = document.getElementById("lab-intro");
            if (!intro) {
                return;
            }

            const vh = window.innerHeight;
            const rect = intro.getBoundingClientRect();
            const total = Math.max(intro.offsetHeight - vh, 1);
            const scrolled = clamp01(-rect.top / total);

            // Reset near the top so the intro sequence can replay.
            if (scrolled <= 0.06 || window.scrollY <= 8) {
                setHeroOpacity(1);
                setHiwPeek(0);
                setHiwOpacity(0);
                setHiwExit(0);
                setPastIntro(false);
                setDockProgress(0);
                syncCeiling();
                return;
            }

            setHeroOpacity(clamp01(1 - scrolled / 0.28));

            // Peek into center, then hold while still an interstitial.
            const peek = clamp01((scrolled - 0.28) / 0.36);
            setHiwPeek(peek);

            // After center hold: travel fully off the top before any chapter can show.
            const exit = clamp01((scrolled - 0.72) / 0.26);
            setHiwExit(exit);

            const introComplete = exit >= 1;
            setHiwOpacity(introComplete ? 0 : peek);

            // Rewind into intro undoes sequence entry; otherwise stay past-intro through footer.
            if (!introComplete && scrolled < 0.88) {
                setPastIntro(false);
                setDockProgress(0);
                syncCeiling();
                return;
            }

            if (introComplete) {
                setPastIntro(true);
            }

            const leave = readFinalChapterLeave(vh);
            const nextDock = introComplete ? clamp01(1 - leave) : 0;
            setDockProgress(nextDock);
            syncCeiling();
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [lastChapterId]);

    // Peek from below → settle at center → continue up and off the top.
    const hiwTranslate = (1 - hiwPeek) * 30 - hiwExit * 72;
    const dockVisible = dockProgress > 0.02;

    return (
        <main className={`marketing-home marketing-home--lab${dockVisible ? " has-docked-hiw" : ""}`}>
            <header className="marketing-home__header marketing-home__header--over-hero">
                <div className="marketing-home__header-inner">
                    <Link href="/" aria-label="TalentArbor Interview Coach" className="brand-lockup brand-lockup--on-dark">
                        <Image
                            src="/TA-logo.webp"
                            alt=""
                            width={300}
                            height={70}
                            className="brand-lockup__mark"
                            priority
                            unoptimized
                        />
                    </Link>
                    <nav className="marketing-home__nav" aria-label="Primary">
                        <Link href={candidateLoginHref} className="marketing-home__nav-link marketing-home__nav-link--light">
                            Sign in
                        </Link>
                        <Link href={candidateRegisterHref} className="marketing-home__nav-cta">
                            Start practicing
                        </Link>
                        <Link
                            href={employeeLoginHref}
                            prefetch={false}
                            className="marketing-home__nav-utility marketing-home__nav-utility--light"
                        >
                            Employee login
                        </Link>
                    </nav>
                </div>
            </header>

            <section
                id="lab-intro"
                className="lab-intro"
                style={{ minHeight: "220vh" }}
                aria-label="Introduction"
            >
                <div
                    className="lab-intro__sticky"
                    style={{
                        // Solid cover until past intro — Prepare sits under this via sequence overlap.
                        background: pastIntro ? "transparent" : undefined,
                    }}
                >
                    <div
                        className="marketing-hero marketing-hero--bleed lab-intro__hero"
                        style={{
                            opacity: heroOpacity,
                            pointerEvents: heroOpacity > 0.45 ? "auto" : "none",
                        }}
                    >
                        <Image
                            src="/marketing/hero-candidate.jpg"
                            alt=""
                            fill
                            priority
                            className="marketing-hero__photo"
                            sizes="100vw"
                        />
                        <div className="marketing-hero__scrim" aria-hidden="true" />
                        <div className="marketing-hero__inner marketing-hero__inner--bleed">
                            <div className="marketing-hero__copy marketing-hero__copy--on-photo">
                                <p className="marketing-hero__brand">Interview Coach</p>
                                <h1 id="marketing-hero-heading" className="marketing-hero__title">
                                    Practice with a coach, not a score.
                                </h1>
                                <p className="marketing-hero__lede">
                                    Interview-domain expertise shapes every question and every coaching note — so you
                                    always know what to practice next.
                                </p>
                                <div className="marketing-hero__actions">
                                    <Link href={candidateRegisterHref} className="marketing-btn marketing-btn--primary">
                                        Start practicing
                                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                                    </Link>
                                    <Link href={candidateRegisterHref} className="marketing-btn marketing-btn--on-photo">
                                        Create account
                                    </Link>
                                </div>
                                <p className="marketing-hero__audience marketing-hero__audience--on-photo">
                                    Looking for a job instead? <Link href={jobSeekerHref}>Job seekers</Link>
                                    {" · "}
                                    Hiring or staffing? <Link href={employerHref}>Employers</Link>
                                </p>
                            </div>
                        </div>
                        <p className="marketing-hero__credit">Photo: Christina Wocintechchat / Unsplash</p>
                    </div>

                    <div
                        className="lab-peek"
                        style={{
                            opacity: pastIntro ? 0 : hiwOpacity,
                            transform: `translateY(${hiwTranslate.toFixed(2)}vh)`,
                        }}
                        aria-hidden={pastIntro || hiwOpacity < 0.2}
                    >
                        <p className="lab-intro__hiw-title lab-peek__title">How it works</p>
                    </div>
                </div>
            </section>

            <div className="lab-sequence" aria-label="Product learning lab">
                <div
                    id="lab-hiw-dock"
                    className={`lab-hiw-dock${dockVisible ? " is-docked" : ""}${
                        dockVisible && dockProgress < 0.999 ? " is-scroll-scrubbed" : ""
                    }`}
                    style={
                        dockVisible && dockProgress < 0.999
                            ? {
                                  opacity: dockProgress,
                                  transform: `translateY(${((1 - dockProgress) * -0.45).toFixed(2)}rem)`,
                              }
                            : undefined
                    }
                    aria-hidden={!dockVisible}
                >
                    <p className="lab-hiw-dock__title">How it works</p>
                </div>

                {chapters.map((chapter, index) => (
                    <LabChapter
                        key={chapter.id}
                        id={chapter.id}
                        chapterIndex={index}
                        label={chapter.label}
                        heading={chapter.heading}
                        outcome={chapter.outcome}
                        flip={chapter.flip}
                        beats={chapter.beats}
                        handoffProgress={index === 0 ? prepareReveal : 1}
                        handoffGated={index === 0}
                    />
                ))}
            </div>

            {trust}
            {audiences}
            {footer}
        </main>
    );
}
