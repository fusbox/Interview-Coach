import { NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";
import { SupabaseInviteRepository } from "@/lib/server/infrastructure/supabase-invite-repository";
import { createClient } from "@/lib/supabase/server";
import { Invite } from "@/lib/domain/invite";
import { z } from "zod";
import { randomBytes } from "crypto";
import { SupabaseClient } from "@supabase/supabase-js";

const repository = new SupabaseInviteRepository();

const CreateInviteSchema = z.object({
    role: z.string().min(1),
    jobDescription: z.string().optional(),
    candidates: z.array(z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        reqId: z.string().min(1),
        resumeText: z.string().optional()
    })).min(1),
    questions: z.array(z.object({
        text: z.string().min(1),
        category: z.string(),
        index: z.number()
    }))
});

export async function POST(request: Request) {
    try {
        const supabase = createClient();
        const { data: { user }, error } = await supabase.auth.getUser();

        let userId = user?.id;

        if (error || !userId) {
            // Dev Bypass for mobile testing
            if (process.env.NODE_ENV === 'development') {
                console.warn("⚠️ Bypass Auth for Dev Environment");
                userId = "00000000-0000-0000-0000-000000000000";
            } else {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
        }

        const body = await request.json();
        const { role, jobDescription, candidates, questions } = CreateInviteSchema.parse(body);

        const results: { id: string, firstName: string, lastName: string, email: string, link: string }[] = [];

        // Use Admin Client if bypassing auth (RLS Bypass)
        let adminClient: SupabaseClient | null = null;
        if (userId === "00000000-0000-0000-0000-000000000000") {
            const { createAdminClient } = await import("@/lib/supabase/server");
            adminClient = createAdminClient();
        }

        for (const candidate of candidates) {
            const token = randomBytes(16).toString('hex');
            const sessionId = uuidv7();

            const invite: Invite = {
                id: sessionId,
                token,
                role,
                jobDescription,
                candidate,
                questions,
                createdBy: userId,
                createdAt: Date.now()
            };

            if (adminClient) {
                await repository.create(invite, adminClient);
            } else {
                await repository.create(invite);
            }

            // Derive Base URL: Prioritize Env Var, fallback to Request Headers
            const host = request.headers.get("host") || "localhost:3000";
            const protocol = request.headers.get("x-forwarded-proto") || "http";
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

            results.push({
                id: sessionId,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                email: candidate.email,
                link: `${baseUrl}/s/${token}`
            });
        }

        return NextResponse.json({ results });

    } catch (error: unknown) {
        console.error("Invite Create Error:", error);
        return NextResponse.json({
            error: error instanceof z.ZodError ? error.issues : (error instanceof Error ? error.message : "Failed to create invite")
        }, { status: 500 });
    }
}
