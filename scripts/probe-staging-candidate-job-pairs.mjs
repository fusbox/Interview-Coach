/**
 * Read-only: sample CandidateID + JobCollectionID pairs (no emails/SSN/passwords).
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

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

async function probe(label, prefix, env, outDir) {
  const config = configFromPrefix(env, prefix);
  process.stdout.write(`${label}: ${config.server}/${config.database}...\n`);
  const pool = await sql.connect(config);
  try {
    const counts = await pool.request().query(`
      SELECT
        COUNT_BIG(*) AS totalRows,
        COUNT_BIG(CASE WHEN JobCollectionID IS NOT NULL THEN 1 END) AS withJobCollectionId,
        COUNT_BIG(CASE WHEN JobCollectionID IS NULL THEN 1 END) AS withoutJobCollectionId
      FROM dbo.CandidateJobCollectionTxn;
    `);
    const c = counts.recordset[0];
    process.stdout.write(
      `  rows total=${c.totalRows} withJobCollectionId=${c.withJobCollectionId} without=${c.withoutJobCollectionId}\n`,
    );

    const pairs = await pool.request().query(`
      SELECT TOP 20
        cjt.CandidateJobCollectionTxnID,
        cjt.CandidateID,
        cjt.JobCollectionID,
        cjt.JobTitle AS BridgeJobTitle,
        cjt.IsActive AS BridgeIsActive,
        cjt.IsExpired AS BridgeIsExpired,
        cjt.IsJobCreatedByCandidate,
        cjt.CreatedDate AS BridgeCreatedDate,
        jc.JobTitle AS JobCollectionTitle,
        jc.Client AS JobCollectionClient,
        jc.Source AS JobCollectionSource,
        jc.IsActive AS JobCollectionIsActive,
        jc.IsExpired AS JobCollectionIsExpired
      FROM dbo.CandidateJobCollectionTxn AS cjt
      LEFT JOIN dbo.JobCollection AS jc
        ON jc.JobCollectionID = cjt.JobCollectionID
      WHERE cjt.JobCollectionID IS NOT NULL
      ORDER BY cjt.CreatedDate DESC, cjt.CandidateJobCollectionTxnID DESC;
    `);

    const header = [
      "CandidateJobCollectionTxnID",
      "CandidateID",
      "JobCollectionID",
      "BridgeJobTitle",
      "BridgeIsActive",
      "BridgeIsExpired",
      "IsJobCreatedByCandidate",
      "BridgeCreatedDate",
      "JobCollectionTitle",
      "JobCollectionClient",
      "JobCollectionSource",
      "JobCollectionIsActive",
      "JobCollectionIsExpired",
    ];
    const lines = pairs.recordset.map((r) =>
      header.map((key) => csvEscape(r[key])).join(","),
    );
    const outName = `${label}-candidate-job-pairs.csv`;
    fs.writeFileSync(
      path.join(outDir, outName),
      [header.join(","), ...lines].join("\n") + "\n",
      "utf8",
    );

    process.stdout.write(`  wrote ${pairs.recordset.length} pairs -> ${outName}\n`);
    for (const r of pairs.recordset.slice(0, 8)) {
      process.stdout.write(
        `  - candidate=${r.CandidateID} job=${r.JobCollectionID} bridge="${r.BridgeJobTitle}" listing="${r.JobCollectionTitle ?? ""}" active=${r.BridgeIsActive}/${r.JobCollectionIsActive}\n`,
      );
    }
    if (pairs.recordset.length > 8) {
      process.stdout.write(`  ... ${pairs.recordset.length - 8} more in CSV\n`);
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
