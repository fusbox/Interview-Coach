export {
    createAppAuthQueryClient as createRecruiterAuthQueryClient,
    createAppAuthQueryClientFromEnv as createRecruiterAuthQueryClientFromEnv,
} from "@/features/app-auth-v2/app-auth-postgres-runtime";
export type {
    AppAuthQueryClient as RecruiterAuthQueryClient,
} from "@/features/app-auth-v2/app-auth-postgres-runtime";
