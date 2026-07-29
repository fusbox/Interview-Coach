import Link from "next/link";

import { CandidateAccountShell } from "@/features/candidate-auth-v2/CandidateAccountShell";
import { CandidateForgotPasswordExperience } from "@/features/candidate-auth-v2/CandidateForgotPasswordExperience";
import { getCandidatePasswordResetTtlSeconds } from "@/features/candidate-auth-v2/candidate-password-reset-token";

export default function CandidateForgotPasswordPage() {
    const resetLinkMinutes = Math.ceil(getCandidatePasswordResetTtlSeconds() / 60);
    return (
        <CandidateAccountShell utility={<Link href="/candidate/login">Sign in</Link>}>
            <CandidateForgotPasswordExperience resetLinkMinutes={resetLinkMinutes} />
        </CandidateAccountShell>
    );
}
