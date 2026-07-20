export type RecruiterInvitationMessageInput = {
    firstName: string;
    targetRole: string;
    inviteLink: string;
    recruiterName: string;
};

export type RecruiterInvitationMessage = {
    subject: string;
    text: string;
    html: string;
};

export function createRecruiterInvitationMessage(
    input: RecruiterInvitationMessageInput,
): RecruiterInvitationMessage {
    const firstName = normalizeLine(input.firstName, "Candidate");
    const targetRole = normalizeLine(input.targetRole, "your upcoming interview");
    const recruiterName = normalizeLine(input.recruiterName, "Your recruiter");
    const inviteLink = input.inviteLink.trim();

    const subject = `Interview practice invitation: ${targetRole}`;
    const text = [
        `Hi ${firstName},`,
        "",
        `${recruiterName} invited you to an Interview Coach practice round for the ${targetRole} role.`,
        "",
        "Open your personal practice link when you're ready:",
        inviteLink,
        "",
        "This link is intended for you. Please do not forward it.",
        "",
        "Interview Coach supports interview preparation. It does not make hiring decisions.",
    ].join("\n");

    return {
        subject,
        text,
        html: renderHtml({ firstName, targetRole, inviteLink, recruiterName }),
    };
}

export function createRecruiterInvitationCopyMessage(input: RecruiterInvitationMessageInput) {
    return createRecruiterInvitationMessage(input).text;
}

function renderHtml(input: Required<RecruiterInvitationMessageInput>) {
    const firstName = escapeHtml(input.firstName);
    const targetRole = escapeHtml(input.targetRole);
    const recruiterName = escapeHtml(input.recruiterName);
    const inviteLink = escapeHtml(input.inviteLink);

    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Interview practice invitation</title></head>
<body style="margin:0;padding:32px 18px;background:#f6f8fb;color:#12213a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dbe3ef;border-radius:8px;">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">Hi ${firstName},</p>
          <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:#12213a;">Your interview practice is ready.</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.55;">${recruiterName} invited you to an Interview Coach practice round for the <strong>${targetRole}</strong> role.</p>
          <p style="margin:0 0 28px;"><a href="${inviteLink}" style="display:inline-block;padding:13px 20px;border-radius:6px;background:#1261d8;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">Open practice round</a></p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#52627a;">This personal link is intended for you. Please do not forward it.</p>
          <p style="margin:0;font-size:13px;line-height:1.55;color:#52627a;">Interview Coach supports interview preparation. It does not make hiring decisions.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function normalizeLine(value: string, fallback: string) {
    const normalized = value.replace(/[\r\n]+/g, " ").trim();
    return normalized || fallback;
}

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character] ?? character);
}
