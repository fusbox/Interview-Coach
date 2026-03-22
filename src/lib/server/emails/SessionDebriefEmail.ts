import { parseDebriefSections } from "@/lib/session-debrief";

const EMAIL_TOKENS = {
    pageBackground: "#eef4ff",
    cardBackground: "#ffffff",
    border: "#dbe7f3",
    textPrimary: "#0f172a",
    textSecondary: "#64748b",
    textMuted: "#94a3b8",
    primary: "#2563eb",
    primaryDeep: "#08409a",
    primarySoft: "#eff6ff",
    primarySoftBorder: "#bfdbfe",
    primarySoftText: "#1d4ed8",
    shadowRaised1: "0 2px 10px rgba(15, 23, 42, 0.05)",
    shadowRaised2: "0 8px 24px rgba(15, 23, 42, 0.08)",
    shadowFloating: "0 20px 48px rgba(15, 23, 42, 0.12)",
    radius2xl: "24px",
    radius3xl: "40px",
} as const;

export interface SessionDebriefEmailProps {
    candidateName: string;
    role: string;
    summaryNarrative: string;
    practiceAgainUrl: string;
    logoUrl: string;
}

const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (match) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;",
    }[match] || match));

const formatInlineMarkdown = (value: string) =>
    escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

function renderSectionContent(content: string): string {
    const blocks = content
        .split(/\n\s*\n/g)
        .map((block) => block.trim())
        .filter(Boolean);

    return blocks.map((block) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isBulletList = lines.every((line) => /^[-*]\s+/.test(line));

        if (isBulletList) {
            const items = lines
                .map((line) => line.replace(/^[-*]\s+/, ""))
                .map((line) => `<li style="margin: 0 0 10px;">${formatInlineMarkdown(line)}</li>`)
                .join("");

            return `<ul style="margin: 0; padding-left: 20px; color: ${EMAIL_TOKENS.textSecondary}; font-size: 15px; line-height: 1.7;">${items}</ul>`;
        }

        return `<p style="margin: 0 0 14px; color: ${EMAIL_TOKENS.textSecondary}; font-size: 15px; line-height: 1.75;">${formatInlineMarkdown(lines.join(" "))}</p>`;
    }).join("");
}

export function renderSessionDebriefEmail({
    candidateName,
    role,
    summaryNarrative,
    practiceAgainUrl,
    logoUrl,
}: SessionDebriefEmailProps): string {
    const currentYear = new Date().getFullYear();
    const sections = parseDebriefSections(summaryNarrative);
    const safeName = escapeHtml(candidateName);
    const safeRole = escapeHtml(role);

    const sectionMarkup = sections.map((section, index) => `
        <tr>
          <td style="padding: 0 0 ${index === sections.length - 1 ? 0 : 18}px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: separate; border-spacing: 0; background-color: ${EMAIL_TOKENS.cardBackground}; border: 1px solid ${EMAIL_TOKENS.border}; border-radius: ${EMAIL_TOKENS.radius3xl}; box-shadow: ${EMAIL_TOKENS.shadowRaised1};">
              <tr>
                <td style="padding: 26px 24px 24px;">
                  <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${EMAIL_TOKENS.primarySoftText}; margin-bottom: 14px;">
                    ${escapeHtml(section.title)}
                  </div>
                  ${renderSectionContent(section.content)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
    `).join("");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Interview Practice Debrief</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${EMAIL_TOKENS.pageBackground};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${EMAIL_TOKENS.pageBackground};">
    <tr>
      <td align="center" style="padding: 24px 16px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 680px; border-collapse: separate; border-spacing: 0;">
          <tr>
            <td style="padding-bottom: 16px;">
              <img src="${logoUrl}" alt="Rangam" width="160" style="display: block; border: 0;" />
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: separate; border-spacing: 0; background: linear-gradient(135deg, ${EMAIL_TOKENS.primaryDeep} 0%, ${EMAIL_TOKENS.primary} 100%); border-radius: ${EMAIL_TOKENS.radius3xl}; box-shadow: ${EMAIL_TOKENS.shadowFloating};">
                <tr>
                  <td style="padding: 32px 28px;">
                    <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #dbe7ff; margin-bottom: 12px;">
                      Interview Practice Debrief
                    </div>
                    <h1 style="margin: 0 0 14px; font-size: 30px; line-height: 1.2; color: #ffffff; font-weight: 700;">
                      Your full debrief for the ${safeRole} session
                    </h1>
                    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #e8f0ff;">
                      Hi ${safeName}, your coach feedback is below. Use it as a quick study guide, then jump straight into another round while the patterns are fresh.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 18px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: separate; border-spacing: 0; background-color: ${EMAIL_TOKENS.cardBackground}; border: 1px solid ${EMAIL_TOKENS.border}; border-radius: ${EMAIL_TOKENS.radius3xl}; box-shadow: ${EMAIL_TOKENS.shadowRaised2};">
                <tr>
                  <td style="padding: 28px 24px;">
                    <div style="display: inline-block; margin: 0 0 18px; padding: 8px 12px; border-radius: 999px; background-color: ${EMAIL_TOKENS.primarySoft}; border: 1px solid ${EMAIL_TOKENS.primarySoftBorder}; color: ${EMAIL_TOKENS.primarySoftText}; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">
                      Full Debrief
                    </div>
                    <p style="margin: 0 0 18px; font-size: 16px; line-height: 1.7; color: ${EMAIL_TOKENS.textPrimary};">
                      This debrief focuses on the patterns interviewers would have noticed across your answers and the highest-leverage next move for your next attempt.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${sectionMarkup || `
                        <tr>
                          <td>
                            <p style="margin: 0; color: ${EMAIL_TOKENS.textSecondary}; font-size: 15px; line-height: 1.75;">
                              Your coach is wrapping up the written debrief. If you want another practice round right away, use the button below.
                            </p>
                          </td>
                        </tr>
                      `}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding-top: 24px;">
              <a href="${practiceAgainUrl}" style="display: inline-block; background-color: ${EMAIL_TOKENS.primary}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; padding: 16px 28px; border-radius: ${EMAIL_TOKENS.radius2xl}; border: 1px solid ${EMAIL_TOKENS.primary}; box-shadow: ${EMAIL_TOKENS.shadowFloating};">
                Practice Again
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 18px;">
              <p style="margin: 0; font-size: 14px; line-height: 1.7; color: ${EMAIL_TOKENS.textSecondary};">
                This email now includes the full debrief, so you can review it without reopening the browser session.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: ${EMAIL_TOKENS.textMuted};">
                &copy; ${currentYear} Rangam. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
}
