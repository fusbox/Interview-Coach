import type { NextRequest } from "next/server";

import { createInvitedPracticeAccessRepository } from "@/features/recruiter-invites-v2/invited-practice-access-repository";
import { INVITED_PRACTICE_ACCESS_COOKIE } from "@/features/recruiter-invites-v2/invited-practice-access-session";
import { confirmInvitedPracticeInitials } from "@/features/recruiter-invites-v2/invited-practice-entry-service";
import { createInvitedPracticeQueryClientFromEnv } from "@/features/recruiter-invites-v2/invited-practice-postgres-runtime";

import { handleInvitedPracticeInitialsRequest } from "./route-implementation";

export async function POST(request: NextRequest) {
    return handleInvitedPracticeInitialsRequest({
        request,
        rawBrowserSessionToken: request.cookies.get(INVITED_PRACTICE_ACCESS_COOKIE)?.value,
        confirm: async (input) => confirmInvitedPracticeInitials(
            input,
            createInvitedPracticeAccessRepository(createInvitedPracticeQueryClientFromEnv()),
        ),
    });
}
