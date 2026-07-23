import { ShieldX } from "lucide-react";

import { RecruiterLogoutButton } from "@/features/recruiter-auth-v2/RecruiterLogoutButton";

export function AiEvalAccessDenied() {
    return (
        <main className="candidate-design-system ai-eval-access-denied">
            <section>
                <ShieldX size={28} aria-hidden="true" />
                <p className="type-eyebrow">Access unavailable</p>
                <h1>This account does not have AI evaluation access.</h1>
                <p>Workbench access is granted individually and does not follow an app role.</p>
                <RecruiterLogoutButton />
            </section>
        </main>
    );
}
