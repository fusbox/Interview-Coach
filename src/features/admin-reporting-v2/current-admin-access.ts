import { cookies } from "next/headers";

import { getUserBySessionToken } from "@/features/app-auth-v2/app-auth";
import { getAppSessionCookieName } from "@/features/app-auth-v2/app-session-cookie";
import type { AppUser } from "@/features/app-auth-v2/app-user";

export type AdminAccess =
    | { kind: "authorized"; user: AppUser }
    | { kind: "missing" }
    | { kind: "forbidden"; user: AppUser };

type CookieReader = {
    get(name: string): { value: string } | undefined;
};

export async function getCurrentAdminAccess(dependencies: {
    cookieStore?: CookieReader;
    resolveUser?: (sessionToken: string | undefined) => Promise<AppUser | null>;
} = {}): Promise<AdminAccess> {
    const cookieStore = dependencies.cookieStore ?? await cookies();
    const sessionToken = cookieStore.get(getAppSessionCookieName())?.value;
    const user = await (dependencies.resolveUser ?? getUserBySessionToken)(sessionToken);

    if (!user) return { kind: "missing" };
    if (!user.roles.includes("admin")) return { kind: "forbidden", user };
    return { kind: "authorized", user };
}
