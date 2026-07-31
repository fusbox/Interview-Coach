import Link from "next/link";
import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";

import { InterviewCoachBrandMark } from "@/features/brand-v2/InterviewCoachBrandMark";
import type { AppUser } from "./app-user";
import { getAppUserDisplayName } from "./app-user";
import { RecruiterLogoutButton } from "./RecruiterLogoutButton";

export function RecruiterShell({ user, children }: { user: AppUser; children: ReactNode }) {
    return (
        <div className="recruiter-shell">
            <header className="recruiter-shell__header">
                <Link href="/recruiter" aria-label="Interview Coach recruiter home">
                    <InterviewCoachBrandMark
                        className="recruiter-shell__logo"
                        priority
                    />
                </Link>
                <div className="recruiter-shell__identity">
                    <span>{getAppUserDisplayName(user)}</span>
                    <Link href="/recruiter/settings" className="recruiter-shell__settings">
                        <Settings2 size={16} aria-hidden="true" />
                        Settings
                    </Link>
                    <RecruiterLogoutButton />
                </div>
            </header>
            {children}
        </div>
    );
}
