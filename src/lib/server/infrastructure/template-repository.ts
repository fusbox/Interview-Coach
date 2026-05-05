import type { TemplateRepository } from "@/lib/domain/template";
import { getOptionalServerEnv } from "@/lib/server/config/server-env";

export type TemplateRepositoryBackend = "supabase" | "postgres";

export type TemplateRepositoryScope = {
    userId?: string | null;
    canManageAllTemplates?: boolean;
};

export function getTemplateRepositoryBackend(): TemplateRepositoryBackend {
    const configured = getOptionalServerEnv("TEMPLATE_REPOSITORY_BACKEND")?.toLowerCase();
    if (!configured) {
        return "supabase";
    }

    if (configured === "supabase" || configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported TEMPLATE_REPOSITORY_BACKEND value "${configured}". Expected "supabase" or "postgres".`);
}

export async function createTemplateRepository(scope: TemplateRepositoryScope = {}): Promise<TemplateRepository> {
    const backend = getTemplateRepositoryBackend();

    if (backend === "postgres") {
        if (!scope.userId) {
            throw new Error("[TemplateRepository] userId is required when TEMPLATE_REPOSITORY_BACKEND=postgres.");
        }

        const { PostgresTemplateRepository } = await import("@/lib/server/infrastructure/postgres-template-repository");
        return new PostgresTemplateRepository({
            userId: scope.userId,
            canManageAllTemplates: scope.canManageAllTemplates ?? false
        });
    }

    const { SupabaseTemplateRepository } = await import("@/lib/server/infrastructure/supabase-template-repository");
    if (scope.canManageAllTemplates) {
        const { createAdminClient } = await import("@/lib/supabase/server");
        return new SupabaseTemplateRepository(createAdminClient());
    }

    return new SupabaseTemplateRepository();
}
