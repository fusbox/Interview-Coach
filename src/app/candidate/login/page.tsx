import Link from "next/link";

import { CandidateAccountShell } from "@/features/candidate-auth-v2/CandidateAccountShell";
import { CandidateLoginExperience } from "@/features/candidate-auth-v2/CandidateLoginExperience";
import { resolveCandidateReturnTarget } from "@/features/candidate-auth-v2/candidate-return-target";

export default async function CandidateLoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string | string[] }>;
}) {
    const params = await searchParams;
    const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
    return (
        <CandidateAccountShell utility={<Link href="/candidate/register">Create account</Link>}>
            <CandidateLoginExperience nextTarget={resolveCandidateReturnTarget(nextValue)} />
        </CandidateAccountShell>
    );
}
