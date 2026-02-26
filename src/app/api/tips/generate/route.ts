import { NextRequest, NextResponse } from "next/server";
import { TipsService, GenerateTipsSchema } from "@/lib/server/services/tips-service";
import { Logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Validate input
        const validation = GenerateTipsSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Invalid request", details: validation.error.format() },
                { status: 400 }
            );
        }

        const { question, role, competency, blueprint, resumeText } = validation.data;

        // Generate Tips
        const tips = await TipsService.generateTips(
            question,
            role,
            competency,
            blueprint,
            resumeText
        );

        return NextResponse.json(tips);

    } catch (error) {
        Logger.error("[API] Tips Generation Failed", error);
        return NextResponse.json(
            { error: "Failed to generate tips" },
            { status: 500 }
        );
    }
}
