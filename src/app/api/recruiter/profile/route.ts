import { NextResponse } from "next/server";
import { z } from "zod";
import { getCachedUser } from "@/lib/supabase/server";
import {
    getRecruiterProfileRecord,
    upsertRecruiterProfileRecord,
} from "@/lib/server/auth/recruiter-profile";

const ProfileUpdateSchema = z.object({
    first_name: z.string().trim().min(1),
    last_name: z.string().trim().min(1),
    title: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),
    timezone: z.string().trim().optional().default("UTC"),
});

export async function GET() {
    const user = await getCachedUser();

    if (!user) {
        return NextResponse.json({
            code: "UNAUTHORIZED",
            message: "Authentication required",
        }, { status: 401 });
    }

    const profile = await getRecruiterProfileRecord(user.id);

    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email ?? null,
        },
        profile,
        profileExists: Boolean(profile),
    });
}

export async function PUT(request: Request) {
    const user = await getCachedUser();

    if (!user) {
        return NextResponse.json({
            code: "UNAUTHORIZED",
            message: "Authentication required",
        }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({
            code: "INVALID_REQUEST",
            message: "Invalid profile payload",
        }, { status: 400 });
    }

    const parsed = ProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({
            code: "INVALID_REQUEST",
            message: "Invalid profile payload",
        }, { status: 400 });
    }

    const profile = await upsertRecruiterProfileRecord(user.id, parsed.data);

    return NextResponse.json({
        success: true,
        profile,
    });
}

