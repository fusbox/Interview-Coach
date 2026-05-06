import { cache } from "react";
import { cookies } from "next/headers";
import type { AppUser } from "@/lib/auth/user";
import { getE2ERecruiterUser, hasE2ERecruiterCookie, isServerE2EMode } from "@/lib/e2e/test-mode";
import { getUserBySessionToken } from "@/lib/server/auth/app-auth";
import { getAppSessionCookieName } from "@/lib/server/auth/app-session";
import { recordAuthDenial } from "@/lib/server/metrics";

export type CurrentServerUser = AppUser;

export const getCachedUser = cache(async (): Promise<AppUser | null> => {
    const cookieStore = await cookies();

    if (isServerE2EMode() && hasE2ERecruiterCookie(cookieStore)) {
        return getE2ERecruiterUser();
    }

    const sessionToken = cookieStore.get(getAppSessionCookieName())?.value;
    return getUserBySessionToken(sessionToken);
});

export async function getAuthenticatedRouteUser({
    actorType,
    route,
    denialReason = "missing_authenticated_user",
}: {
    actorType: string;
    route: string;
    denialReason?: string;
}): Promise<CurrentServerUser | null> {
    const user = await getCachedUser();

    if (!user) {
        recordAuthDenial({
            actorType,
            route,
            reason: denialReason,
        });
        return null;
    }

    return user;
}
