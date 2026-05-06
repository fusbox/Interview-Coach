import type { AppUser } from "./user";

type StaffUser = AppUser & {
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
    roles?: string[];
};

/**
 * Hardcoded whitelist of internal admin emails.
 * These users gain access to the /admin route group and visual oversight tools.
 */
const ADMIN_EMAILS = [
    "fu@rangam.com",
    "sudeep@rangam.com"
];

/**
 * Temporary quality-evaluator allowlist for the first /qa surface.
 *
 * Long-term, this should move to database-managed roles or identity-provider
 * group claims. Metadata role checks below let us grant QA access without
 * making someone an app admin.
 */
const QUALITY_EVALUATOR_EMAILS = [
    ...ADMIN_EMAILS,
    "kushal@rangam.com",
];

/**
 * RBAC Utility to determine if a user has administrative privileges.
 * 
 * NOTE: This is an abstraction layer. In the future, this can be updated 
 * to check for MS Entra ID / Azure AD specific claims in the user's metadata 
 * without changing the signature.
 */
export function isAdmin(user: StaffUser | null | undefined): boolean {
    if (!user?.email) return false;

    // Exact match check
    if (ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;

    return getMetadataRoles(user).includes("admin");
}

function getMetadataRoles(user: StaffUser): string[] {
    const roleValues = [
        user.roles,
        user.app_metadata?.role,
        user.app_metadata?.roles,
        user.user_metadata?.role,
        user.user_metadata?.roles,
    ];

    return roleValues
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase());
}

/**
 * Checks whether an authenticated staff user can access /qa tooling.
 *
 * QA access is intentionally separate from admin access. Admins inherit it,
 * but evaluators can be granted it through app or identity-provider metadata
 * roles such as "qa", "quality", "quality_evaluator", or "evaluator".
 */
export function isQualityEvaluator(user: StaffUser | null | undefined): boolean {
    if (!user?.email) return false;

    const email = user.email.toLowerCase();
    if (QUALITY_EVALUATOR_EMAILS.includes(email)) return true;

    const roles = getMetadataRoles(user);
    return roles.some((role) => [
        "admin",
        "qa",
        "quality",
        "quality_evaluator",
        "evaluator",
    ].includes(role));
}

/**
 * Checks if a user is an internal staff member (not a candidate).
 * Currently, all authenticated users in this app are recruiters/staff.
 */
export function isStaff(user: StaffUser | null | undefined): boolean {
    return !!user;
}
