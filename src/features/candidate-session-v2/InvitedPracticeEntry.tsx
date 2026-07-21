"use client";

import { ArrowRight, UserRoundCheck } from "lucide-react";
import { useState } from "react";

import { CandidatePreSessionLanding } from "./CandidatePreSessionLanding";
import type { SessionQuestionAudioLifecycle } from "@/features/interview-session-v2/session-question-audio-contract";

const UNICODE_LETTER_PATTERN = new RegExp("\\p{L}", "u");

type InvitedPracticeEntryProps = {
    targetRole: string;
    stageLabel: string;
    questionCount: number;
    candidateFirstName?: string;
    initialsConfirmed?: boolean;
    onConfirmInitials: (initials: string) => Promise<{ candidateFirstName?: string } | void> | { candidateFirstName?: string } | void;
    onStart: () => void;
    sessionId?: string;
    firstQuestion?: {
        id: string;
        number: number;
        category: string;
        questionText: string;
    };
    questionAudio?: SessionQuestionAudioLifecycle;
};

export function InvitedPracticeEntry({
    targetRole,
    stageLabel,
    questionCount,
    candidateFirstName,
    initialsConfirmed = false,
    onConfirmInitials,
    onStart,
    sessionId,
    firstQuestion,
    questionAudio,
}: InvitedPracticeEntryProps) {
    const [stage, setStage] = useState<"initials" | "landing">(initialsConfirmed ? "landing" : "initials");
    const [resolvedFirstName, setResolvedFirstName] = useState(candidateFirstName);
    const [initials, setInitials] = useState("");
    const [isConfirming, setIsConfirming] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (stage === "landing") {
        return (
            <CandidatePreSessionLanding
                variant="invited"
                targetRole={targetRole}
                stageLabel={stageLabel}
                questionCount={questionCount}
                resumeIncluded={false}
                candidateFirstName={resolvedFirstName}
                sessionId={sessionId}
                firstQuestion={firstQuestion}
                questionAudio={questionAudio}
                manageTransitionExternally
                onStart={onStart}
            />
        );
    }

    return (
        <main className="invited-practice-entry candidate-app-shell">
            <section className="invited-practice-entry__panel" aria-labelledby="invited-practice-entry-title">
                <span className="candidate-pre-session__icon" aria-hidden="true">
                    <UserRoundCheck size={22} />
                </span>
                <div className="invited-practice-entry__heading">
                    <p className="type-eyebrow">Interview practice</p>
                    <h1 id="invited-practice-entry-title">Before your practice</h1>
                    <p>
                        You&apos;ve been invited to practice for the {targetRole} role. Enter your initials before reviewing your round.
                    </p>
                </div>

                <form
                    className="invited-practice-entry__form"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (!initials || isConfirming) {
                            return;
                        }

                        setIsConfirming(true);
                        setErrorMessage(null);
                        try {
                            const result = await onConfirmInitials(initials);
                            if (result?.candidateFirstName) {
                                setResolvedFirstName(result.candidateFirstName);
                            }
                            setStage("landing");
                        } catch {
                            setErrorMessage("I couldn't save those initials. Try again.");
                        } finally {
                            setIsConfirming(false);
                        }
                    }}
                >
                    <label htmlFor="invited-practice-initials">Your initials</label>
                    <input
                        id="invited-practice-initials"
                        name="initials"
                        type="text"
                        value={initials}
                        inputMode="text"
                        autoComplete="off"
                        autoCapitalize="characters"
                        aria-describedby="invited-practice-initials-help"
                        aria-invalid={Boolean(errorMessage)}
                        onChange={(event) => setInitials(normalizeInitials(event.target.value))}
                    />
                    <p id="invited-practice-initials-help" className="invited-practice-entry__help">
                        This helps the recruiting team spot if an invitation may have reached the wrong person. It does not verify your identity or create an account.
                    </p>
                    {errorMessage ? <p className="invited-practice-entry__error" role="alert">{errorMessage}</p> : null}
                    <button
                        className="candidate-button candidate-button--primary"
                        type="submit"
                        disabled={!initials || isConfirming}
                    >
                        {isConfirming ? "Checking..." : "Review practice"}
                        {!isConfirming ? <ArrowRight size={16} aria-hidden="true" /> : null}
                    </button>
                </form>

                <p className="invited-practice-entry__notice">
                    Before practice begins, you&apos;ll see how answers and coaching are handled and how to return later.
                </p>
            </section>
        </main>
    );
}

export function normalizeInitials(value: string) {
    return Array.from(value.normalize("NFKC").toLocaleUpperCase("en-US"))
        .filter((character) => UNICODE_LETTER_PATTERN.test(character))
        .slice(0, 2)
        .join("");
}
