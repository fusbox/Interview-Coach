import { createClient } from "@/lib/supabase/server";
import { RecruiterTemplate, TemplateRepository } from "@/lib/domain/template";
import { QuestionInput } from "@/app/(recruiter)/recruiter/create/constants";

import { SupabaseClient } from '@supabase/supabase-js';

export class SupabaseTemplateRepository implements TemplateRepository {
    private client: SupabaseClient | null = null;

    constructor(client?: SupabaseClient) {
        if (client) this.client = client;
    }

    private getClient(): SupabaseClient {
        return this.client || createClient();
    }

    async list(): Promise<RecruiterTemplate[]> {
        const supabase = this.getClient();

        const { data, error } = await supabase
            .from('recruiter_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Supabase Template List Error: ${error.message}`);

        return (data || []).map(row => this.mapRowToTemplate(row));
    }

    async create(template: Partial<RecruiterTemplate>): Promise<RecruiterTemplate> {
        const supabase = this.getClient();

        // Ensure recruiter_id is set (RLS will also check this)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized: No user found for template creation");

        const { data, error } = await supabase
            .from('recruiter_templates')
            .insert({
                recruiter_id: user.id,
                name: template.name,
                is_shared: template.isShared ?? true,
                target_role: template.targetRole,
                questions: template.questions,
            })
            .select('*')
            .single();

        if (error) throw new Error(`Supabase Template Create Error: ${error.message}`);

        return this.mapRowToTemplate(data);
    }

    async delete(id: string): Promise<void> {
        const supabase = this.getClient();

        const { error } = await supabase
            .from('recruiter_templates')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Supabase Template Delete Error: ${error.message}`);
    }

    async update(id: string, updates: Partial<RecruiterTemplate>): Promise<RecruiterTemplate> {
        const supabase = this.getClient();

        const dataToUpdate: {
            name?: string;
            is_shared?: boolean;
            target_role?: string;
            questions?: unknown; // Supabase JSONB
        } = {};
        if (updates.name !== undefined) dataToUpdate.name = updates.name;
        if (updates.isShared !== undefined) dataToUpdate.is_shared = updates.isShared;
        if (updates.targetRole !== undefined) dataToUpdate.target_role = updates.targetRole;
        if (updates.questions !== undefined) dataToUpdate.questions = updates.questions;

        const { data, error } = await supabase
            .from('recruiter_templates')
            .update(dataToUpdate)
            .eq('id', id)
            .select('*')
            .maybeSingle();

        if (error) throw new Error(`Supabase Template Update Error: ${error.message}`);
        if (!data) throw new Error("Unauthorized or Template not found. You can only edit templates you created.");

        return this.mapRowToTemplate(data);
    }

    private mapRowToTemplate(row: {
        id: string;
        recruiter_id: string;
        name: string;
        is_shared: boolean;
        target_role: string;
        questions: {
            star: QuestionInput[];
            perma: QuestionInput[];
            technical: QuestionInput[];
        };
        created_at: string;
        updated_at: string;
    }): RecruiterTemplate {
        return {
            id: row.id,
            recruiterId: row.recruiter_id,
            name: row.name,
            isShared: row.is_shared,
            targetRole: row.target_role,
            questions: row.questions,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
}
