import type { NextRequest } from "next/server";

import { createInvitedPracticeAccessRepository } from "@/features/recruiter-invites-v2/invited-practice-access-repository";
import {
    INVITED_PRACTICE_ACCESS_COOKIE,
    resolveInvitedPracticeAccessTtlSeconds,
} from "@/features/recruiter-invites-v2/invited-practice-access-session";
import { repeatInvitedPractice } from "@/features/recruiter-invites-v2/invited-practice-entry-service";
import { createInvitedPracticeQueryClientFromEnv } from "@/features/recruiter-invites-v2/invited-practice-postgres-runtime";

import { handleInvitedPracticeAgainRequest } from "./route-implementation";

export async function POST(request: NextRequest) {
    return handleInvitedPracticeAgainRequest({
        request,
        secureCookie: request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production",
        repeat: async (expectedParentSessionId) => repeatInvitedPractice({
            rawBrowserSessionToken: request.cookies.get(INVITED_PRACTICE_ACCESS_COOKIE)?.value,
            expectedParentSessionId,
            now: new Date(),
            accessTtlSeconds: resolveInvitedPracticeAccessTtlSeconds(
                process.env.INVITED_PRACTICE_ACCESS_TTL_SECONDS,
            ),
        }, {
            repository: createInvitedPracticeAccessRepository(createInvitedPracticeQueryClientFromEnv()),
        }),
    });
}
