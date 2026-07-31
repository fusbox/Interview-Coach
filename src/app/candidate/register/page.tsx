import { CandidateAccountShell } from "@/features/candidate-auth-v2/CandidateAccountShell";
import { CandidateRegistrationExperience } from "@/features/candidate-auth-v2/CandidateRegistrationExperience";

export default function CandidateRegisterPage() {
    return (
        <CandidateAccountShell variant="registration">
            <CandidateRegistrationExperience />
        </CandidateAccountShell>
    );
}
