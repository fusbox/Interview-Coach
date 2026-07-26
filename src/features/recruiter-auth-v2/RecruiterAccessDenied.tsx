import { ShieldX } from "lucide-react";
import { RecruiterLogoutButton } from "./RecruiterLogoutButton";

export function RecruiterAccessDenied() {
    return (
        <main className="recruiter-access-denied">
            <section>
                <ShieldX size={28} aria-hidden="true" />
                <p className="type-eyebrow">Access unavailable</p>
                <h1>This account does not have recruiter access.</h1>
                <p>Sign out and use an account with the recruiter or administrator role.</p>
                <RecruiterLogoutButton />
            </section>
        </main>
    );
}
