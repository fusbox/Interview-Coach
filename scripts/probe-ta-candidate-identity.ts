import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getTalentArborMssqlConfigStatus,
  createTalentArborMssqlReader,
} from "../src/features/candidate-auth-v2/talentarbor-mssql-runtime";
import { htmlResumeToPlainText } from "../src/features/candidate-auth-v2/candidate-launch-context";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const status = getTalentArborMssqlConfigStatus(process.env);
  if (!status.ok) process.exit(1);
  const reader = createTalentArborMssqlReader({ config: status.config });
  const resumeRows = await reader.findCandidateResumeHtml!(353373);
  const html = resumeRows[0]?.HTMLResumeContent;
  const plain = htmlResumeToPlainText(html);
  console.log(JSON.stringify({
    resumeRows: resumeRows.length,
    htmlChars: typeof html === "string" ? html.length : 0,
    plainChars: plain?.length ?? 0,
  }));
}
void main();
