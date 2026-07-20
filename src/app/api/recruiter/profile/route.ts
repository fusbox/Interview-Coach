import type { NextRequest } from "next/server";

import { getCurrentRecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";
import { createRecruiterSettingsRepository } from "@/features/recruiter-auth-v2/recruiter-settings-repository";

import { handleRecruiterProfileUpdate } from "./route-implementation";

export async function PUT(request: NextRequest) {
    const repository = createRecruiterSettingsRepository(createRecruiterAuthQueryClientFromEnv());
    return handleRecruiterProfileUpdate({
        request,
        access: await getCurrentRecruiterAccess(),
        update: (input) => repository.updateOwnedSettings(input),
    });
}
