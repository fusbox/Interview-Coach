import { User } from "@supabase/supabase-js";

/**
 * Hardcoded whitelist of internal admin emails.
 * These users gain access to the /admin route group and visual oversight tools.
 */
const ADMIN_EMAILS = [
    "fu@rangam.com",
    "sudeep@rangam.com"
];

/**
 * RBAC Utility to determine if a user has administrative privileges.
 * 
 * NOTE: This is an abstraction layer. In the future, this can be updated 
 * to check for MS Entra ID / Azure AD specific claims in the user's metadata 
 * without changing the signature.
 */
export function isAdmin(user: User | null | undefined): boolean {
    if (!user?.email) return false;

    // Exact match check
    return ADMIN_EMAILS.includes(user.email.toLowerCase());
}

/**
 * Checks if a user is an internal staff member (not a candidate).
 * Currently, all authenticated users in this app are recruiters/staff.
 */
export function isStaff(user: User | null | undefined): boolean {
    return !!user;
}
