import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/lib/server/services/email-service";
import { Logger } from "@/lib/logger";
import { SupabaseSessionRepository } from "@/lib/server/infrastructure/supabase-session-repository";

const sessionRepo = new SupabaseSessionRepository();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { 
            recipientEmail, 
            recipientEmails,
            recipientFirstName, 
            role, 
            inviteLink, 
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail,
            sessionIds
        } = body;

        // Support both single recipientEmail and recipientEmails array
        const finalRecipientEmails = recipientEmails || (recipientEmail ? [recipientEmail] : []);

        if (finalRecipientEmails.length === 0 || !inviteLink || !role || !recruiterName) {
            return NextResponse.json(
                { error: "Missing required fields (recipientEmail/recipientEmails, inviteLink, role, recruiterName)" },
                { status: 400 }
            );
        }

        Logger.info("[API] Triggering candidate invite email", { 
            recipients: finalRecipientEmails, 
            role,
            recruiter: recruiterName
        }, "InviteAPI");

        const result = await EmailService.sendInviteEmail({
            recipientEmails: finalRecipientEmails,
            recipientFirstName,
            role,
            inviteLink,
            recruiterName,
            recruiterTitle,
            recruiterCompany,
            recruiterPhone,
            recruiterEmail
        });

        // Mark as sent in DB if session IDs provided
        if (sessionIds && Array.isArray(sessionIds)) {
            await Promise.all(sessionIds.map(id => sessionRepo.markInvitationSent(id)));
        }

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        Logger.error("[API] Failed to trigger invite email", error, "InviteAPI");
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
