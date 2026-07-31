import Link from "next/link";
import type { ReactNode } from "react";

import { CandidateBrandHeader } from "@/features/candidate-v2/CandidateBrandHeader";

export function CandidateAccountShell({
    children,
    utility,
    variant = "default",
}: {
    children: ReactNode;
    utility?: ReactNode;
    variant?: "default" | "login" | "registration";
}) {
    const frame = variant === "registration" ? "form-flow" : "focused";
    const variantClass = variant === "default" ? "" : ` candidate-account-page--${variant}`;

    return (
        <main className={`candidate-account-page${variantClass}`}>
            <CandidateBrandHeader frame={frame} actions={utility} />
            <div className={`candidate-account-page__body app-grid app-grid--${frame}`}>
                {children}
            </div>
            <footer className={`candidate-account-page__footer app-grid app-grid--${frame}`}>
                <nav aria-label="Account policies">
                    <Link href="https://talentarbor.com/privacy-policy">Privacy</Link>
                    <Link href="https://talentarbor.com/terms-of-use">Terms</Link>
                    <Link href="https://talentarbor.com/ResponsibleAIStatement">Responsible AI</Link>
                </nav>
                <p>Interview Coach is a TalentArbor product by Rangam.</p>
            </footer>
        </main>
    );
}
