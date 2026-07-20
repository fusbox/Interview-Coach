import type { NextRequest } from "next/server";

import { createInvitedPracticeAccessRepository } from "@/features/recruiter-invites-v2/invited-practice-access-repository";
import {
    resolveInvitedPracticeAccessTtlSeconds,
} from "@/features/recruiter-invites-v2/invited-practice-access-session";
import { exchangeInvitedPracticeLink } from "@/features/recruiter-invites-v2/invited-practice-entry-service";
import { createInvitedPracticeQueryClientFromEnv } from "@/features/recruiter-invites-v2/invited-practice-postgres-runtime";

import { handleInvitedPracticeLinkExchange } from "./route-implementation";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ token: string }> },
) {
    const { token } = await context.params;
    return handleInvitedPracticeLinkExchange({
        rawInvitationToken: token,
        secureCookie: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
        exchange: async (rawInvitationToken) => {
            const repository = createInvitedPracticeAccessRepository(createInvitedPracticeQueryClientFromEnv());
            return exchangeInvitedPracticeLink({
                rawInvitationToken,
                now: new Date(),
                accessTtlSeconds: resolveInvitedPracticeAccessTtlSeconds(
                    process.env.INVITED_PRACTICE_ACCESS_TTL_SECONDS,
                ),
            }, { repository });
        },
        onDiagnostic: (event) => console.info("invited_practice_link_exchange", event),
    });
}
