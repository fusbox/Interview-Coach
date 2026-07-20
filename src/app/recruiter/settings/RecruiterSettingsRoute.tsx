import { redirect } from "next/navigation";

import { RecruiterAccessDenied } from "@/features/recruiter-auth-v2/RecruiterAccessDenied";
import type { RecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { getCurrentRecruiterAccess } from "@/features/recruiter-auth-v2/current-recruiter-access";
import { createRecruiterAuthQueryClientFromEnv } from "@/features/recruiter-auth-v2/recruiter-auth-postgres-runtime";
import { RecruiterSettingsExperience } from "@/features/recruiter-auth-v2/RecruiterSettingsExperience";
import type { RecruiterSettings } from "@/features/recruiter-auth-v2/recruiter-settings-contract";
import { createRecruiterSettingsRepository } from "@/features/recruiter-auth-v2/recruiter-settings-repository";

export async function renderRecruiterSettingsRoute(dependencies: {
    resolveAccess?: () => Promise<RecruiterAccess>;
    loadSettings?: (userId: string) => Promise<RecruiterSettings | null>;
} = {}) {
    const access = await (dependencies.resolveAccess ?? getCurrentRecruiterAccess)();
    if (access.kind === "missing") redirect("/login?next=%2Frecruiter%2Fsettings");
    if (access.kind === "forbidden") return <RecruiterAccessDenied />;

    const settings = await (dependencies.loadSettings ?? loadOwnedSettings)(access.user.id);
    if (!settings) return <RecruiterAccessDenied />;
    return <RecruiterSettingsExperience initialSettings={settings} />;
}

async function loadOwnedSettings(userId: string) {
    const client = createRecruiterAuthQueryClientFromEnv();
    return createRecruiterSettingsRepository(client).findOwnedSettings(userId);
}
