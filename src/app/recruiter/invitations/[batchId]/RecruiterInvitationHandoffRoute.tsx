import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { RecruiterAccessDenied } from "@/features/recruiter-auth-v2/RecruiterAccessDenied";
import { getAppUserDisplayName } from "@/features/recruiter-auth-v2/app-user";
import { getCurrentRecruiterAccess, type RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";
import { createInvitedPracticeTokenVault } from "@/features/recruiter-invites-v2/invited-practice-token-vault";
import { RecruiterInvitationHandoffExperience } from "@/features/recruiter-invites-v2/RecruiterInvitationHandoffExperience";
import { resolveRecruiterInvitationAppOrigin } from "@/features/recruiter-invites-v2/recruiter-invitation-app-origin";
import {
    createRecruiterInvitationHandoffReadModel,
    type RecruiterInvitationHandoffFact,
    type RecruiterInvitationHandoffReadModel,
} from "@/features/recruiter-invites-v2/recruiter-invitation-handoff-read-model";
import { createRecruiterInvitationHandoffRepository } from "@/features/recruiter-invites-v2/recruiter-invitation-handoff-repository";

export async function renderRecruiterInvitationHandoffRoute({
    params,
    resolveAccess = getCurrentRecruiterAccess,
    loadHandoffFact = loadOwnedHandoffFact,
    buildReadModel = buildOwnedReadModel,
}: {
    params: Promise<{ batchId: string }> | { batchId: string };
    resolveAccess?: () => Promise<RecruiterAccess>;
    loadHandoffFact?: (recruiterId: string, batchId: string) => Promise<RecruiterInvitationHandoffFact | null>;
    buildReadModel?: (
        fact: RecruiterInvitationHandoffFact,
        access: Extract<RecruiterAccess, { kind: "authorized" }>,
    ) => Promise<RecruiterInvitationHandoffReadModel>;
}) {
    const { batchId } = await params;
    const access = await resolveAccess();
    if (access.kind === "missing") {
        const next = encodeURIComponent(`/recruiter/invitations/${batchId}`);
        redirect(`/login?next=${next}`);
    }
    if (access.kind === "forbidden") return <RecruiterAccessDenied />;

    const fact = await loadHandoffFact(access.user.id, batchId);
    if (!fact) notFound();

    const model = await buildReadModel(fact, access);
    return <RecruiterInvitationHandoffExperience key={model.revision} model={model} />;
}

async function loadOwnedHandoffFact(recruiterId: string, batchId: string) {
    const client = createRecruiterAuthQueryClientFromEnv();
    return createRecruiterInvitationHandoffRepository(client).findOwnedHandoffFact(recruiterId, batchId);
}

async function buildOwnedReadModel(
    fact: RecruiterInvitationHandoffFact,
    access: Extract<RecruiterAccess, { kind: "authorized" }>,
) {
    return createRecruiterInvitationHandoffReadModel(fact, {
        appOrigin: await resolveRequestAppOrigin(),
        recruiterName: getAppUserDisplayName(access.user),
        tokenVault: createInvitedPracticeTokenVault(),
    });
}

async function resolveRequestAppOrigin() {
    const requestHeaders = await headers();
    const host = firstForwardedValue(
        requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000",
    );
    const forwardedProtocol = firstForwardedValue(requestHeaders.get("x-forwarded-proto") ?? "http");
    const protocol = forwardedProtocol === "https" ? "https" : "http";
    return resolveRecruiterInvitationAppOrigin(`${protocol}://${host}/recruiter/invitations`);
}

function firstForwardedValue(value: string) {
    return value.split(",")[0]?.trim() || "localhost:3000";
}
