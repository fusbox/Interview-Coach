import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = path.join(process.cwd(), "src", "app");
const recruiterOwnedPrefixes = ["/recruiter", "/admin", "/qa"];
const candidateTopLevelRoutes = ["/practice", "/dashboard", "/session/session_123", "/summary/session_123"];

function appFile(relativePath: string) {
    return path.join(appRoot, relativePath);
}

describe("shared host route ownership", () => {
    it.each([
        ["/", "page.tsx"],
        ["/recruiter", "(recruiter)/recruiter/page.tsx"],
        ["/recruiter/create", "(recruiter)/recruiter/create/page.tsx"],
        ["/recruiter/templates", "(recruiter)/recruiter/templates/page.tsx"],
        ["/recruiter/settings", "(recruiter)/recruiter/settings/page.tsx"],
        ["/admin/feedback", "(recruiter)/admin/feedback/page.tsx"],
        ["/qa/ai-quality", "(recruiter)/qa/ai-quality/page.tsx"],
        ["/auth/talentarbor/start", "auth/talentarbor/start/route.ts"],
    ])("keeps %s owned by the expected shared-host route file", (_route, routeFile) => {
        expect(existsSync(appFile(routeFile))).toBe(true);
    });

    it.each(candidateTopLevelRoutes)("keeps candidate route %s outside recruiter-owned namespaces", (route) => {
        expect(recruiterOwnedPrefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`))).toBe(false);
    });
});
