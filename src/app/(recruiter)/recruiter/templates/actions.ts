"use server";

import { createTemplateRepository } from "@/lib/server/infrastructure/template-repository";
import { RecruiterTemplate } from "@/lib/domain/template";
import { revalidatePath } from "next/cache";

import { getCachedUser } from "@/lib/server/auth/current-user";

import { isAdmin } from "@/lib/auth/rbac";

export async function fetchTemplates() {
    const user = await getCachedUser();
    const admin = isAdmin(user);
    try {
        const repo = await createTemplateRepository({
            userId: user?.id,
            canManageAllTemplates: admin
        });
        const templates = await repo.list();
        return { templates, recruiterId: user?.id, isAdmin: admin };
    } catch (error) {
        console.error("Action fetchTemplates error:", error);
        return { templates: [], recruiterId: null, isAdmin: false };
    }
}

export async function saveTemplateAction(template: Partial<RecruiterTemplate>) {
    const user = await getCachedUser();
    try {
        const repo = await createTemplateRepository({ userId: user?.id });
        const newTemplate = await repo.create(template);
        revalidatePath("/recruiter/create");
        revalidatePath("/recruiter/templates");
        return { success: true, template: newTemplate };
    } catch (error) {
        console.error("Action saveTemplateAction error:", error);
        const message = error instanceof Error ? error.message : "Failed to save template";
        return { success: false, error: message };
    }
}

export async function deleteTemplateAction(id: string) {
    const user = await getCachedUser();
    const admin = isAdmin(user);

    try {
        const repo = await createTemplateRepository({
            userId: user?.id,
            canManageAllTemplates: admin
        });
        await repo.delete(id);
        revalidatePath("/recruiter/templates");
        revalidatePath("/recruiter/create");
        return { success: true };
    } catch (error) {
        console.error("Action deleteTemplateAction error:", error);
        const message = error instanceof Error ? error.message : "Failed to delete template";
        return { success: false, error: message };
    }
}

export async function updateTemplateNameAction(id: string, name: string) {
    const user = await getCachedUser();
    const admin = isAdmin(user);

    try {
        const repo = await createTemplateRepository({
            userId: user?.id,
            canManageAllTemplates: admin
        });
        await repo.update(id, { name } as Partial<RecruiterTemplate>);
        revalidatePath("/recruiter/templates");
        return { success: true };
    } catch (error) {
        console.error("Action updateTemplateNameAction error:", error);
        const message = error instanceof Error ? error.message : "Failed to update template name";
        return { success: false, error: message };
    }
}
