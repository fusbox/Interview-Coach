"use client";

import { Check, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef } from "react";

export function InvitedPracticePause({
    targetRole,
    onResume,
}: {
    targetRole: string;
    onResume: () => void;
}) {
    const resumeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        window.scrollTo({ top: 0 });
        resumeButtonRef.current?.focus();
    }, []);

    return (
        <main className="candidate-design-system invited-practice-pause candidate-app-shell">
            <header className="candidate-pre-session__brand app-grid" aria-label="TalentArbor">
                <Image
                    src="/TA-logo.webp"
                    alt="TalentArbor"
                    width={300}
                    height={70}
                    className="candidate-pre-session__brand-mark"
                    priority
                    unoptimized
                />
            </header>
            <section className="invited-practice-pause__panel" aria-labelledby="invited-practice-pause-title">
                <span className="invited-practice-pause__icon" aria-hidden="true">
                    <Check size={24} />
                </span>
                <div className="invited-practice-pause__copy">
                    <p className="type-eyebrow">Practice paused</p>
                    <h1 id="invited-practice-pause-title">Your progress is saved.</h1>
                    <p>
                        Resume your {targetRole} practice here, or come back later by reopening the personal link in
                        your invitation email.
                    </p>
                </div>
                <div className="invited-practice-pause__actions">
                    <button
                        ref={resumeButtonRef}
                        className="candidate-button candidate-button--primary"
                        type="button"
                        onClick={onResume}
                    >
                        <Play size={17} aria-hidden="true" />
                        Resume practice
                    </button>
                </div>
                <p className="invited-practice-pause__close-note">
                    You can close this window when you&apos;re ready.
                </p>
            </section>
        </main>
    );
}
