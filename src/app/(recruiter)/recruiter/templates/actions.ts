"use server";

import { SupabaseTemplateRepository } from "@/lib/server/infrastructure/supabase-template-repository";
import { RecruiterTemplate } from "@/lib/domain/template";
import { revalidatePath } from "next/cache";

export async function fetchTemplates() {
    const repo = new SupabaseTemplateRepository();
    try {
        return await repo.list();
    } catch (error) {
        console.error("Action fetchTemplates error:", error);
        return [];
    }
}

export async function saveTemplateAction(template: Partial<RecruiterTemplate>) {
    const repo = new SupabaseTemplateRepository();
    try {
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
    const repo = new SupabaseTemplateRepository();
    try {
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
