import Link from "next/link";

import { CandidateAccountShell } from "@/features/candidate-auth-v2/CandidateAccountShell";
import { CandidateResetPasswordExperience } from "@/features/candidate-auth-v2/CandidateResetPasswordExperience";

export default async function CandidateResetPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string | string[] }>;
}) {
    const params = await searchParams;
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    return (
        <CandidateAccountShell utility={<Link href="/candidate/login">Sign in</Link>}>
            <CandidateResetPasswordExperience token={token} />
        </CandidateAccountShell>
    );
}
