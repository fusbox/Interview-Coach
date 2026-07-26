import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { RecruiterLogoutButton } from "@/features/recruiter-auth-v2/RecruiterLogoutButton";
import type { AppUser } from "@/features/recruiter-auth-v2/app-user";
import { getAppUserDisplayName } from "@/features/recruiter-auth-v2/app-user";

export function AiEvalShell({ user, children }: { user: AppUser; children: ReactNode }) {
    return (
        <div className="ai-eval-shell">
            <header className="ai-eval-shell__header">
                <div className="ai-eval-shell__brand">
                    <Link href="/qa/ai-eval" aria-label="AI quality workbench home">
                        <Image
                            src="/TA-logo.webp"
                            alt="TalentArbor"
                            width={300}
                            height={70}
                            className="ai-eval-shell__logo"
                            priority
                            unoptimized
                        />
                    </Link>
                    <span>AI quality workbench</span>
                </div>
                <div className="ai-eval-shell__identity">
                    <span>{getAppUserDisplayName(user)}</span>
                    <RecruiterLogoutButton />
                </div>
            </header>
            {children}
        </div>
    );
}
