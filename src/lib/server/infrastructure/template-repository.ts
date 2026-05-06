import type { TemplateRepository } from "@/lib/domain/template";
import { getOptionalServerEnv } from "@/lib/server/config/server-env";

export type TemplateRepositoryBackend = "postgres";

export type TemplateRepositoryScope = {
    userId?: string | null;
    canManageAllTemplates?: boolean;
};

export function getTemplateRepositoryBackend(): TemplateRepositoryBackend {
    const configured = getOptionalServerEnv("TEMPLATE_REPOSITORY_BACKEND")?.toLowerCase();
    if (!configured) {
        return "postgres";
    }

    if (configured === "postgres") {
        return configured;
    }

    throw new Error(`Unsupported TEMPLATE_REPOSITORY_BACKEND value "${configured}". Expected "postgres".`);
}

export async function createTemplateRepository(scope: TemplateRepositoryScope = {}): Promise<TemplateRepository> {
    getTemplateRepositoryBackend();

    if (!scope.userId) {
        throw new Error("[TemplateRepository] userId is required.");
    }

    const { PostgresTemplateRepository } = await import("@/lib/server/infrastructure/postgres-template-repository");
    return new PostgresTemplateRepository({
        userId: scope.userId,
        canManageAllTemplates: scope.canManageAllTemplates ?? false
    });
}
