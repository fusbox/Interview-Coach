import { Link2Off } from "lucide-react";
import Image from "next/image";

export function InvitedPracticeUnavailable() {
    return (
        <main className="invited-practice-entry candidate-app-shell">
            <section className="invited-practice-entry__panel" aria-labelledby="invited-practice-unavailable-title">
                <header className="candidate-pre-session__brand" aria-label="NJ Career">
                    <Image
                        src="/njcareer-logo.png"
                        alt="NJ Career"
                        width={520}
                        height={120}
                        className="candidate-pre-session__brand-mark"
                        priority
                        unoptimized
                    />
                </header>
                <span className="candidate-pre-session__icon" aria-hidden="true">
                    <Link2Off size={22} />
                </span>
                <div className="invited-practice-entry__heading">
                    <p className="type-eyebrow">Interview practice</p>
                    <h1 id="invited-practice-unavailable-title">This practice link isn&apos;t available.</h1>
                    <p>Ask the recruiter who sent the invitation for a new link.</p>
                </div>
            </section>
        </main>
    );
}
