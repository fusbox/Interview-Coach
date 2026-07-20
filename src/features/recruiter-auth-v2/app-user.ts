export type AppRole = "recruiter" | "admin" | "qa";

export type AppUserStatus = "active" | "invited" | "disabled";

export type AppUser = {
    id: string;
    email: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    status: AppUserStatus;
    roles: AppRole[];
};

export function canAccessRecruiterRoutes(user: AppUser): boolean {
    return user.roles.includes("recruiter") || user.roles.includes("admin");
}

export function getAppUserDisplayName(user: AppUser): string {
    return user.displayName
        ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || user.email);
}
