import Link from "next/link";

import { CandidateAccountShell } from "@/features/candidate-auth-v2/CandidateAccountShell";
import { CandidateRegistrationExperience } from "@/features/candidate-auth-v2/CandidateRegistrationExperience";

export default function CandidateRegisterPage() {
    return (
        <CandidateAccountShell utility={<Link href="/candidate/login">Sign in</Link>}>
            <CandidateRegistrationExperience />
        </CandidateAccountShell>
    );
}
