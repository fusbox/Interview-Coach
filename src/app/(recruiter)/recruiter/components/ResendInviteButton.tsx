"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteEmailPreviewModal } from "@/components/patterns/InviteEmailPreviewModal";
import type { RecruiterProfile } from "./RecruiterSessionsTable";
import type { SessionSummary } from "@/lib/domain/types";

interface ResendInviteButtonProps {
    session: SessionSummary;
    recruiterProfile?: RecruiterProfile;
    className?: string;
    title?: string;
    ariaLabel?: string;
}

export function ResendInviteButton({
    session,
    recruiterProfile,
    className,
    title = "Resend Invite Email",
    ariaLabel,
}: ResendInviteButtonProps) {
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);

    if (!session.inviteToken || !session.candidateEmail || !recruiterProfile) {
        return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://coach.rangam.com";
    const inviteLink = `${baseUrl}/s/${session.inviteToken}`;

    const handleSend = async () => {
        setIsSending(true);
        setSendError(null);

        try {
            const response = await fetch("/api/invite/resend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: session.id,
                    recruiterName: recruiterProfile.name,
                    recruiterTitle: recruiterProfile.title,
                    recruiterCompany: recruiterProfile.company,
                    recruiterPhone: recruiterProfile.phone,
                    recruiterEmail: recruiterProfile.email,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => null);
                throw new Error(errorBody?.message || errorBody?.error || `Failed to resend invite to ${session.candidateEmail}`);
            }

            setSendSuccess(true);
        } catch (error) {
            setSendError(error instanceof Error ? error.message : "Failed to resend invite.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className={className}
                title={title}
                aria-label={ariaLabel || `Resend invite email to ${session.candidateName}`}
                onClick={(event) => {
                    event.stopPropagation();
                    setSendError(null);
                    setSendSuccess(false);
                    setIsPreviewOpen(true);
                }}
            >
                <Mail className="h-4 w-4" />
            </Button>

            <InviteEmailPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                data={{
                    recipientEmails: [session.candidateEmail],
                    recipientFirstName: session.candidateFirstName || session.candidateName,
                    role: session.role,
                    inviteLink,
                    recruiterName: recruiterProfile.name,
                    recruiterTitle: recruiterProfile.title,
                    recruiterCompany: recruiterProfile.company,
                    recruiterPhone: recruiterProfile.phone,
                    recruiterEmail: recruiterProfile.email,
                }}
                onSend={handleSend}
                isSending={isSending}
                sendSuccess={sendSuccess}
                errorMessage={sendError}
                showSuccessFeedbackPrompt={false}
                onNewInvite={() => {
                    setIsPreviewOpen(false);
                    setSendSuccess(false);
                    window.location.assign("/recruiter/create");
                }}
                onDashboard={() => {
                    setIsPreviewOpen(false);
                    setSendSuccess(false);
                    window.location.assign("/recruiter");
                }}
            />
        </>
    );
}
