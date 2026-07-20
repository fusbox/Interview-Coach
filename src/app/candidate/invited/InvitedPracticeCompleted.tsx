import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

export function InvitedPracticeCompleted({ targetRole }: { targetRole: string }) {
    return (
        <main className="invited-practice-entry candidate-app-shell">
            <section className="invited-practice-entry__panel" aria-labelledby="invited-practice-completed-title">
                <header className="candidate-pre-session__brand" aria-label="TalentArbor">
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
                <span className="candidate-pre-session__icon" aria-hidden="true">
                    <CheckCircle2 size={22} />
                </span>
                <div className="invited-practice-entry__heading">
                    <p className="type-eyebrow">Practice complete</p>
                    <h1 id="invited-practice-completed-title">Your {targetRole} practice is complete.</h1>
                    <p>Your answers have been saved. You can close this page or return through the invitation link.</p>
                </div>
            </section>
        </main>
    );
}
