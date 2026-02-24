import { createClient } from "@/lib/supabase/server";
import { RecruiterTemplate, TemplateRepository } from "@/lib/domain/template";
import { QuestionInput } from "@/app/(recruiter)/recruiter/create/constants";

export class SupabaseTemplateRepository implements TemplateRepository {
    async list(): Promise<RecruiterTemplate[]> {
        const supabase = createClient();

        const { data, error } = await supabase
            .from('recruiter_templates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Supabase Template List Error: ${error.message}`);

        return (data || []).map(row => this.mapRowToTemplate(row));
    }

    async create(template: Partial<RecruiterTemplate>): Promise<RecruiterTemplate> {
        const supabase = createClient();

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
        const supabase = createClient();

        const { error } = await supabase
            .from('recruiter_templates')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Supabase Template Delete Error: ${error.message}`);
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
