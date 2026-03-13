export interface SessionDebriefEmailProps {
  candidateName: string;
  role: string;
  summaryNarrative: string;
  debriefUrl: string;
  logoUrl: string;
}

export function renderSessionDebriefEmail({
  candidateName,
  role,
  summaryNarrative,
  debriefUrl,
  logoUrl,
}: SessionDebriefEmailProps): string {
  const currentYear = new Date().getFullYear();

  const escapeHTML = (str: string) => str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m] || m));

  const safeName = escapeHTML(candidateName);
  const safeRole = escapeHTML(role);
  
  // Extract summary text if it follows the MD structure
  const summaryText = summaryNarrative.split('\n')[0] === '### Executive Summary' 
    ? summaryNarrative.split('\n').slice(1, 4).join(' ').trim() 
    : "View your full performance breakdown, strengths, and primary growth areas in your interactive debrief dashboard.";
  
  const safeSummary = escapeHTML(summaryText);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Interview Prep Debrief is Ready</title>
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
      Your Interview Prep Debrief is Ready
    </h1>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Hi ${safeName},
    </p>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Congratulations on completing your practice session for the <strong>${safeRole}</strong> position! Our AI coach has analyzed your responses and prepared a personalized debrief to help you shine in your upcoming interview.
    </p>

    <div style="background-color: #f9f9f9; border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 1px solid #eeeeee;">
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 16px; margin-top: 0;">Executive Summary</h2>
      <div style="font-size: 15px; line-height: 1.6; color: #444444;">
        ${safeSummary}
      </div>
    </div>

    <div style="text-align: center; margin-bottom: 40px;">
      <a href="${debriefUrl}" style="background-color: #000000; color: #ffffff; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 16px;">
        View Your Full Debrief
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #eeeeee; margin-bottom: 32px;" />

    <p style="font-size: 14px; color: #888888; line-height: 1.5;">
      You'll pick up right where you left off if you want to try another round of practice. Good luck with your preparations!
    </p>
    
    <p style="font-size: 12px; color: #aaaaaa; margin-top: 40px;">
      &copy; ${currentYear} Rangam. All rights reserved.
    </p>
</body>
</html>
  `.trim();
}
