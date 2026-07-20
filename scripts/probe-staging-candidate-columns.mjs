/**
 * Read-only column inventory for launch-context identity + job bridge tables.
 * Does not SELECT row data - INFORMATION_SCHEMA.COLUMNS only.
 */
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

const TABLES = [
  "CandidateMaster",
  "CandidateJobCollectionTxn",
  "CandidateJobCollectionStatusTxn",
  "CandidateAuthentication",
  "CandidatePortal",
  "AICandidateMaster",
  "CandidateRangamworksTxn",
];

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

function writeCsv(filePath, rows) {
  const header = "COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,IS_NULLABLE,ORDINAL_POSITION";
  const body = rows.map((r) =>
    [
      r.COLUMN_NAME,
      r.DATA_TYPE,
      r.CHARACTER_MAXIMUM_LENGTH ?? "",
      r.IS_NULLABLE,
      r.ORDINAL_POSITION,
    ].join(","),
  );
  fs.writeFileSync(filePath, [header, ...body].join("\n") + "\n", "utf8");
}

async function probe(label, prefix, env, outDir) {
  const config = configFromPrefix(env, prefix);
  if (!config.server || !config.user || !config.password) {
    throw new Error(`${label}: missing server/user/password in .env.local`);
  }

  process.stdout.write(
    `${label}: ${config.server}/${config.database} (schema only)...\n`,
  );
  const pool = await sql.connect(config);
  try {
    for (const table of TABLES) {
      const exists = await pool
        .request()
        .input("t", sql.NVarChar, table)
        .query(`
          SELECT 1 AS ok
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t
        `);

      if (exists.recordset.length === 0) {
        process.stdout.write(`  ${table}: missing on ${label}\n`);
        continue;
      }

      const cols = await pool
        .request()
        .input("t", sql.NVarChar, table)
        .query(`
          SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE,
            ORDINAL_POSITION
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t
          ORDER BY ORDINAL_POSITION
        `);

      const outName = `${label}-cols-${table}.csv`;
      writeCsv(path.join(outDir, outName), cols.recordset);

      const interesting = cols.recordset
        .map((r) => r.COLUMN_NAME)
        .filter((name) =>
          /candidate|user|email|name|company|jobcollection|requirement|portal|phone|first|last|display/i.test(
            name,
          ),
        );

      process.stdout.write(
        `  ${table}: ${cols.recordset.length} columns -> ${outName}\n`,
      );
      process.stdout.write(
        `    identity-ish: ${interesting.slice(0, 30).join(", ")}${interesting.length > 30 ? " ..." : ""}\n`,
      );
    }
  } finally {
    await pool.close();
  }
}

const root = process.cwd();
const env = loadEnvLocal(path.join(root, ".env.local"));
const outDir = path.join(root, "docs", "candidate-app", "09-dev");

await probe("TA", "TA_STAGING_SQL", env, outDir);
await probe("RW", "RW_STAGING_SQL", env, outDir);
