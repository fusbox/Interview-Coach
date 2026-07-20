/**
 * One-shot read-only probe: list all tables on TA/RW staging.
 * Loads .env.local without printing secrets.
 */
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

function loadEnvLocal(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

function configFromPrefix(env, prefix) {
  return {
    server: env[`${prefix}_SERVER`],
    port: Number(env[`${prefix}_PORT`] || 1433),
    database: env[`${prefix}_DATABASE`],
    user: env[`${prefix}_USER`],
    password: env[`${prefix}_PASSWORD`],
    options: {
      encrypt: String(env[`${prefix}_ENCRYPT`] || "true").toLowerCase() === "true",
      trustServerCertificate:
        String(env[`${prefix}_TRUST_SERVER_CERTIFICATE`] || "true").toLowerCase() === "true",
    },
    connectionTimeout: 15000,
    requestTimeout: 60000,
  };
}

async function listTables(label, config) {
  if (!config.server || !config.user || !config.password) {
    throw new Error(`${label}: missing server/user/password in .env.local`);
  }

  const pool = await sql.connect(config);
  try {
    const result = await pool.request().query(`
      SELECT
        TABLE_SCHEMA,
        TABLE_NAME,
        TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_SCHEMA, TABLE_NAME;
    `);
    return result.recordset;
  } finally {
    await pool.close();
  }
}

function writeCsv(filePath, rows) {
  const header = "TABLE_SCHEMA,TABLE_NAME,TABLE_TYPE";
  const body = rows.map(
    (r) => `${r.TABLE_SCHEMA},${r.TABLE_NAME},${r.TABLE_TYPE}`,
  );
  fs.writeFileSync(filePath, [header, ...body].join("\n") + "\n", "utf8");
}

function candidateish(name) {
  return /candidate|jobseeker|job_seeker|member|applicant|talent/i.test(name);
}

const root = process.cwd();
const env = loadEnvLocal(path.join(root, ".env.local"));
const outDir = path.join(root, "docs", "candidate-app", "09-dev");

const targets = [
  { label: "TA", prefix: "TA_STAGING_SQL", out: "TA-tables-all.csv" },
  { label: "RW", prefix: "RW_STAGING_SQL", out: "RW-tables-all.csv" },
];

for (const target of targets) {
  const config = configFromPrefix(env, target.prefix);
  process.stdout.write(
    `${target.label}: connecting to ${config.server}/${config.database} as ${config.user}...\n`,
  );
  const rows = await listTables(target.label, config);
  const outPath = path.join(outDir, target.out);
  writeCsv(outPath, rows);

  const hits = rows.filter((r) => candidateish(r.TABLE_NAME));
  process.stdout.write(
    `${target.label}: ${rows.length} tables written to ${target.out}; ${hits.length} candidate-ish names:\n`,
  );
  for (const row of hits) {
    process.stdout.write(`  - ${row.TABLE_SCHEMA}.${row.TABLE_NAME} (${row.TABLE_TYPE})\n`);
  }
}
