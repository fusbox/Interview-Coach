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
 * Marketing lab: hero → HIW peek/dock → sticky chapters (no spine, no morphs).
 * Upscroll through the intro restores the hero and undocks HIW for a clean replay.
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
    const [heroOpacity, setHeroOpacity] = useState(1);
    const [hiwOpacity, setHiwOpacity] = useState(0);
    const [hiwToTop, setHiwToTop] = useState(0);
    const [hiwDocked, setHiwDocked] = useState(false);
    const hiwDockedRef = useRef(false);

    useEffect(() => {
        hiwDockedRef.current = hiwDocked;
    }, [hiwDocked]);

    useEffect(() => {
        const syncCeiling = () => {
            const dock = document.getElementById("lab-hiw-dock");
            if (dock && hiwDockedRef.current) {
                document.documentElement.style.setProperty(
                    "--lab-ceiling",
                    `${Math.round(dock.getBoundingClientRect().bottom + 8)}px`,
                );
            } else {
                document.documentElement.style.setProperty("--lab-ceiling", "4.5rem");
            }
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
                setHiwOpacity(0);
                setHiwToTop(0);
                setHiwDocked(false);
                syncCeiling();
                return;
            }

            // Undock when scrolling back into the intro scrub.
            if (hiwDockedRef.current && scrolled < 0.88) {
                setHiwDocked(false);
            }

            if (scrolled >= 0.98) {
                setHeroOpacity(0);
                setHiwOpacity(0);
                setHiwToTop(1);
                setHiwDocked(true);
                syncCeiling();
                return;
            }

            setHeroOpacity(clamp01(1 - scrolled / 0.32));
            setHiwOpacity(clamp01((scrolled - 0.34) / 0.4));
            setHiwToTop(clamp01((scrolled - 0.74) / 0.24));
            syncCeiling();
        };

        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, []);

    const hiwTranslate = hiwOpacity <= 0 ? 28 : (1 - hiwOpacity) * 28 - hiwToTop * 38;

    return (
        <main className={`marketing-home marketing-home--lab${hiwDocked ? " has-docked-hiw" : ""}`}>
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
                style={{ minHeight: "180vh" }}
                aria-label="Introduction"
            >
                <div className="lab-intro__sticky">
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
                            opacity: hiwDocked ? 0 : hiwOpacity,
                            transform: `translateY(${hiwTranslate.toFixed(2)}vh)`,
                        }}
                        aria-hidden={hiwDocked || hiwOpacity < 0.2}
                    >
                        <p className="lab-intro__hiw-title lab-peek__title">How it works</p>
                    </div>
                </div>
            </section>

            <div className="lab-sequence" aria-label="Product learning lab">
                <div
                    id="lab-hiw-dock"
                    className={`lab-hiw-dock${hiwDocked ? " is-docked" : ""}`}
                    aria-hidden={!hiwDocked}
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
                    />
                ))}
            </div>

            {trust}
            {audiences}
            {footer}
        </main>
    );
}
