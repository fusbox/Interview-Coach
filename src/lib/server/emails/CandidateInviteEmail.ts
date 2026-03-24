import { normalizeRecruiterSignature } from "@/lib/recruiter-signature";

export interface CandidateInviteEmailProps {
  firstName: string;
  role: string;
  inviteLink: string;
  logoUrl: string;
  recruiterName: string;
  recruiterTitle?: string;
  recruiterCompany?: string;
  recruiterPhone?: string;
  recruiterEmail?: string;
  pilotEnabled?: boolean;
  supportPhone?: string;
  supportContactName?: string;
  supportContactEmail?: string;
}

export function renderCandidateInviteEmail({
  firstName,
  role,
  inviteLink,
  logoUrl,
  recruiterName,
  recruiterTitle,
  recruiterCompany,
  recruiterPhone,
  recruiterEmail,
  pilotEnabled = false,
  supportPhone,
  supportContactName,
  supportContactEmail,
}: CandidateInviteEmailProps): string {
  const currentYear = new Date().getFullYear();

  const escapeHTML = (str: string) => str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m] || m));

  const safeFirstName = escapeHTML(firstName);
  const safeRole = escapeHTML(role);
  const recruiterSignature = normalizeRecruiterSignature({
    name: recruiterName,
    title: recruiterTitle,
    company: recruiterCompany,
    phone: recruiterPhone,
    email: recruiterEmail,
  });
  const safeRecruiterName = escapeHTML(recruiterSignature.name);
  const safeRecruiterTitle = escapeHTML(recruiterSignature.title);
  const safeRecruiterCompany = escapeHTML(recruiterSignature.company);
  const safeRecruiterPhone = escapeHTML(recruiterSignature.phone);
  const safeRecruiterEmail = escapeHTML(recruiterSignature.email);
  const safeSupportPhone = supportPhone ? escapeHTML(supportPhone) : '(908) 704-8843';
  const safeSupportContactName = supportContactName ? escapeHTML(supportContactName) : 'Fu Chen';
  const safeSupportContactEmail = supportContactEmail ? escapeHTML(supportContactEmail) : 'fu@rangam.com';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Practice Interview Invitation: ${safeRole}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'; background-color: #ffffff; color: #333333; padding: 40px 20px; max-width: 600px; margin: 0 auto; -webkit-font-smoothing: antialiased;">
    <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
      <tr>
        <td align="left" style="background-color: #ffffff; padding: 8px; border-radius: 8px;">
          <img src="${logoUrl}" alt="Rangam" width="160" style="display: block; border: 0; outline: none; text-decoration: none;" />
        </td>
      </tr>
    </table>

    <h1 style="font-size: 24px; font-weight: bold; line-height: 1.2; margin-bottom: 24px; color: #1a1a1a;">
      Practice Interview Invitation: ${safeRole}
    </h1>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Hi ${safeFirstName},
    </p>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      I'd like to invite you to a guided interview practice session for the <strong>${safeRole}</strong> role. Your practice responses help us tailor how we support your preparation during the selection process.
    </p>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Please click the button below to start whenever you're ready:
    </p>

    <div style="text-align: left; margin-bottom: 40px;">
      <a href="${inviteLink}" style="background-color: #2563eb; color: #ffffff; padding: 18px 36px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
        Start My Practice Session
      </a>
    </div>

    ${pilotEnabled ? `
    <div style="margin-bottom: 40px; padding: 20px 22px; border-radius: 18px; background-color: #f8fafc; border: 1px solid #dbeafe;">
      <p style="margin: 0 0 10px 0; font-size: 12px; line-height: 1.4; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #1d4ed8;">
        Pilot Notice
      </p>
      <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.65; color: #334155;">
        This invitation is part of a limited pilot rollout of Rangam's interview practice experience. It is intended for practice and product testing, not as a standalone hiring or assessment tool.
      </p>
      <p style="margin: 0 0 12px 0; font-size: 14px; line-height: 1.65; color: #334155;">
        Your spoken or written responses may be transcribed and reviewed by the recruiting team to support your preparation. All AI coaching feedback remains visible only to you.
      </p>
      <p style="margin: 0; font-size: 14px; line-height: 1.65; color: #334155;">
        Questions about this pilot? Contact ${safeSupportContactName} at ${safeSupportPhone} or ${safeSupportContactEmail}.
      </p>
    </div>` : ''}

    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="margin-top: 32px; border-top: 1px solid #eeeeee; padding-top: 32px; width: 100%;">
      <tr>
        <td style="padding: 0;">
          <p style="margin: 0 0 10px 0; font-size: 15px; line-height: 1.2; font-weight: 700; color: #0f172a;">
            ${safeRecruiterName}
          </p>
          <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.25; font-weight: 600; color: #64748b;">
            ${safeRecruiterTitle}
          </p>
          <p style="margin: 0 0 24px 0; font-size: 13px; line-height: 1.25; font-weight: 600; color: #64748b;">
            ${safeRecruiterCompany}
          </p>
          ${safeRecruiterPhone ? `<p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.4; font-weight: 700; color: #0f172a;">M:&nbsp;&nbsp;${safeRecruiterPhone}</p>` : ''}
          ${safeRecruiterEmail ? `<p style="margin: 0; font-size: 13px; line-height: 1.4; font-weight: 700; color: #0f172a;">E:&nbsp;&nbsp;${safeRecruiterEmail}</p>` : ''}
          <div style="margin-top: 24px;">
            <img src="${logoUrl}" alt="Rangam" width="140" style="display: block; border: 0; outline: none; text-decoration: none;" />
          </div>
        </td>
      </tr>
    </table>
    
    <p style="font-size: 12px; color: #aaaaaa; margin-top: 48px;">
      &copy; ${currentYear} Rangam. All rights reserved.
    </p>
</body>
</html>
  `.trim();
}
