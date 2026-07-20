import { RecruiterLoginExperience } from "@/features/recruiter-auth-v2/RecruiterLoginExperience";
import { resolveRecruiterReturnTarget } from "@/features/recruiter-auth-v2/recruiter-return-target";

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string | string[] }>;
}) {
    const params = await searchParams;
    const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
    return <RecruiterLoginExperience nextTarget={resolveRecruiterReturnTarget(nextValue)} />;
}
