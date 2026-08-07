import { ShieldX } from "lucide-react";

import { RecruiterLogoutButton } from "@/features/recruiter-auth-v2/RecruiterLogoutButton";

export function AdminReportsAccessDenied() {
    return (
        <main className="recruiter-access-denied">
            <section>
                <ShieldX size={28} aria-hidden="true" />
                <p className="type-eyebrow">Access unavailable</p>
                <h1>This account does not have reporting access.</h1>
                <p>Sign out and use an account with the administrator role.</p>
                <RecruiterLogoutButton />
            </section>
        </main>
    );
}
