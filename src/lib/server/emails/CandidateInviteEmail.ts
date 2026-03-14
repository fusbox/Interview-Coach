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
  const safeRecruiterName = escapeHTML(recruiterName);
  const safeRecruiterTitle = recruiterTitle ? escapeHTML(recruiterTitle) : 'Recruiter';
  const safeRecruiterCompany = recruiterCompany ? escapeHTML(recruiterCompany) : 'Rangam Consultants Inc.';
  const safeRecruiterPhone = recruiterPhone ? escapeHTML(recruiterPhone) : '';
  const safeRecruiterEmail = recruiterEmail ? escapeHTML(recruiterEmail) : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Invitation: ${safeRole}</title>
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
      Interview Invitation: ${safeRole}
    </h1>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Hi ${safeFirstName},
    </p>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      I'd like to invite you to a preliminary interview practice session for the <strong>${safeRole}</strong> role. This interactive session will help us understand your experience better.
    </p>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Please click the button below to start whenever you're ready:
    </p>

    <div style="text-align: left; margin-bottom: 40px;">
      <a href="${inviteLink}" style="background-color: #2563eb; color: #ffffff; padding: 18px 36px; border-radius: 12px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);">
        Start My Practice Session
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin-bottom: 32px;" />

    <div style="font-size: 14px; color: #555555; line-height: 1.6; margin-top: 24px;">
      <p style="margin: 0; font-weight: bold; color: #1a1a1a;">${safeRecruiterName}</p>
      <p style="margin: 0;">${safeRecruiterTitle}</p>
      <p style="margin: 0;">${safeRecruiterCompany}</p>
      ${safeRecruiterPhone ? `<p style="margin: 4px 0 0 0;">M: ${safeRecruiterPhone}</p>` : ''}
      ${safeRecruiterEmail ? `<p style="margin: 0;">E: ${safeRecruiterEmail}</p>` : ''}
      
      <div style="margin-top: 16px;">
        <img src="${logoUrl}" alt="Rangam" width="100" style="display: block; border: 0; outline: none; text-decoration: none;" />
      </div>
    </div>
    
    <p style="font-size: 12px; color: #aaaaaa; margin-top: 48px;">
      &copy; ${currentYear} Rangam. All rights reserved.
    </p>
</body>
</html>
  `.trim();
}
