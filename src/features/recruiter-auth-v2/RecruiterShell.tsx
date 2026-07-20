import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AppUser } from "./app-user";
import { getAppUserDisplayName } from "./app-user";
import { RecruiterLogoutButton } from "./RecruiterLogoutButton";

export function RecruiterShell({ user, children }: { user: AppUser; children: ReactNode }) {
    return (
        <div className="candidate-design-system recruiter-shell">
            <header className="recruiter-shell__header">
                <Link href="/recruiter" aria-label="Interview Coach recruiter home">
                    <Image
                        src="/TA-logo.webp"
                        alt="TalentArbor"
                        width={300}
                        height={70}
                        className="recruiter-shell__logo"
                        priority
                        unoptimized
                    />
                </Link>
                <div className="recruiter-shell__identity">
                    <span>{getAppUserDisplayName(user)}</span>
                    <RecruiterLogoutButton />
                </div>
            </header>
            {children}
        </div>
    );
}
