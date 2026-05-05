export type AppRole = "recruiter" | "admin" | "qa";

export type AppUserMetadata = Record<string, unknown>;

export interface AppUser {
    id: string;
    email: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    status?: "active" | "invited" | "disabled";
    roles?: AppRole[];
    app_metadata?: AppUserMetadata;
    user_metadata?: AppUserMetadata;
}

