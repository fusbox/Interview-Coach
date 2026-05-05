import type { Pool, QueryResultRow } from "pg";
import { z } from "zod";
import type { RecruiterTemplate, TemplateRepository } from "@/lib/domain/template";
import { getPostgresPool } from "@/lib/server/db/postgres";

const QuestionInputSchema = z.object({
    id: z.string(),
    text: z.string(),
    category: z.string(),
    label: z.string(),
    isLocked: z.boolean().optional(),
});

const TemplateQuestionsSchema = z.object({
    star: z.array(QuestionInputSchema),
    perma: z.array(QuestionInputSchema),
    technical: z.array(QuestionInputSchema),
});

type TemplateQuestions = z.infer<typeof TemplateQuestionsSchema>;

type TemplateRow = QueryResultRow & {
    id: string;
    recruiter_id: string;
    name: string;
    is_shared: boolean;
    target_role: string;
    questions: unknown;
    created_at: string | Date;
    updated_at: string | Date;
};

export type PostgresTemplateRepositoryOptions = {
    userId: string;
    canManageAllTemplates?: boolean;
};

export class PostgresTemplateRepository implements TemplateRepository {
    private readonly userId: string;
    private readonly canManageAllTemplates: boolean;

    constructor(
        options: PostgresTemplateRepositoryOptions,
        private readonly pool: Pool = getPostgresPool()
    ) {
        this.userId = options.userId;
        this.canManageAllTemplates = options.canManageAllTemplates ?? false;
    }

    async list(): Promise<RecruiterTemplate[]> {
        const result = await this.pool.query<TemplateRow>(
            `
                select *
                from public.recruiter_templates
                where $2::boolean
                   or recruiter_id = $1
                   or is_shared = true
                order by created_at desc
            `,
            [this.userId, this.canManageAllTemplates]
        );

        return result.rows.map((row) => this.mapRowToTemplate(row));
    }

    async create(template: Partial<RecruiterTemplate>): Promise<RecruiterTemplate> {
        if (!template.name) {
            throw new Error("Template name is required.");
        }
        if (!template.targetRole) {
            throw new Error("Template target role is required.");
        }

        const questions = this.parseQuestions(template.questions);
        const result = await this.pool.query<TemplateRow>(
            `
                insert into public.recruiter_templates (
                    recruiter_id,
                    name,
                    is_shared,
                    target_role,
                    questions
                )
                values ($1, $2, $3, $4, $5::jsonb)
                returning *
            `,
            [
                this.userId,
                template.name,
                template.isShared ?? true,
                template.targetRole,
                JSON.stringify(questions)
            ]
        );

        return this.mapRowToTemplate(result.rows[0]);
    }

    async delete(id: string): Promise<void> {
        const result = await this.pool.query(
            `
                delete from public.recruiter_templates
                where id = $1
                  and ($3::boolean or recruiter_id = $2)
            `,
            [id, this.userId, this.canManageAllTemplates]
        );

        if ((result.rowCount ?? 0) === 0) {
            throw new Error("Unauthorized or Template not found. You can only delete templates you created.");
        }
    }

    async update(id: string, updates: Partial<RecruiterTemplate>): Promise<RecruiterTemplate> {
        const assignments: string[] = [];
        const values: unknown[] = [];

        const addUpdate = (column: string, value: unknown, cast = "") => {
            values.push(value);
            assignments.push(`${column} = $${values.length}${cast}`);
        };

        if (updates.name !== undefined) addUpdate("name", updates.name);
        if (updates.isShared !== undefined) addUpdate("is_shared", updates.isShared);
        if (updates.targetRole !== undefined) addUpdate("target_role", updates.targetRole);
        if (updates.questions !== undefined) {
            addUpdate("questions", JSON.stringify(this.parseQuestions(updates.questions)), "::jsonb");
        }

        if (assignments.length === 0) {
            return this.getEditableTemplate(id);
        }

        values.push(id, this.userId, this.canManageAllTemplates);
        const idPlaceholder = `$${values.length - 2}`;
        const userPlaceholder = `$${values.length - 1}`;
        const manageAllPlaceholder = `$${values.length}`;

        const result = await this.pool.query<TemplateRow>(
            `
                update public.recruiter_templates
                set ${assignments.join(", ")}
                where id = ${idPlaceholder}
                  and (${manageAllPlaceholder}::boolean or recruiter_id = ${userPlaceholder})
                returning *
            `,
            values
        );

        const row = result.rows[0];
        if (!row) {
            throw new Error("Unauthorized or Template not found. You can only edit templates you created.");
        }

        return this.mapRowToTemplate(row);
    }

    private async getEditableTemplate(id: string): Promise<RecruiterTemplate> {
        const result = await this.pool.query<TemplateRow>(
            `
                select *
                from public.recruiter_templates
                where id = $1
                  and ($3::boolean or recruiter_id = $2)
            `,
            [id, this.userId, this.canManageAllTemplates]
        );

        const row = result.rows[0];
        if (!row) {
            throw new Error("Unauthorized or Template not found. You can only edit templates you created.");
        }

        return this.mapRowToTemplate(row);
    }

    private parseQuestions(value: unknown): TemplateQuestions {
        const questionsResult = TemplateQuestionsSchema.safeParse(value);
        if (!questionsResult.success) {
            throw new Error("Template questions payload is invalid.");
        }

        return questionsResult.data;
    }

    private toIsoString(value: string | Date): string {
        if (value instanceof Date) {
            return value.toISOString();
        }

        return new Date(value).toISOString();
    }

    private mapRowToTemplate(row: TemplateRow): RecruiterTemplate {
        return {
            id: row.id,
            recruiterId: row.recruiter_id,
            name: row.name,
            isShared: row.is_shared,
            targetRole: row.target_role,
            questions: this.parseQuestions(row.questions),
            createdAt: this.toIsoString(row.created_at),
            updatedAt: this.toIsoString(row.updated_at),
        };
    }
}
