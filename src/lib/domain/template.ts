import { QuestionInput } from "@/app/(recruiter)/recruiter/create/constants";

export interface RecruiterTemplate {
    id: string;
    recruiterId: string;
    name: string;
    isShared: boolean;
    targetRole: string;
    questions: {
        star: QuestionInput[];
        perma: QuestionInput[];
        technical: QuestionInput[];
    };
    createdAt: string;
    updatedAt: string;
}

export interface TemplateRepository {
    list(): Promise<RecruiterTemplate[]>;
    create(template: Partial<RecruiterTemplate>): Promise<RecruiterTemplate>;
    delete(id: string): Promise<void>;
}
