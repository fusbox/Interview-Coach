import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { RecruiterAccessDenied } from "@/features/recruiter-auth-v2/RecruiterAccessDenied";
import { RecruiterShell } from "@/features/recruiter-auth-v2/RecruiterShell";
import { getCurrentRecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { RECRUITER_RETURN_TARGET_HEADER } from "@/features/recruiter-auth-v2/recruiter-auth-middleware";
import { resolveRecruiterReturnTarget } from "@/features/recruiter-auth-v2/recruiter-return-target";

export default async function RecruiterLayout({ children }: { children: ReactNode }) {
    const access = await getCurrentRecruiterAccess();
    if (access.kind === "missing") {
        const requestHeaders = await headers();
        const returnTarget = resolveRecruiterReturnTarget(
            requestHeaders.get(RECRUITER_RETURN_TARGET_HEADER),
        );
        redirect(`/login?next=${encodeURIComponent(returnTarget)}`);
    }
    if (access.kind === "forbidden") return <RecruiterAccessDenied />;
    return <RecruiterShell user={access.user}>{children}</RecruiterShell>;
}
