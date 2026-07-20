/**
 * Certainty check: prove which server/database each probe hits,
 * then measure JobCollection + CandidateJobCollectionTxn.
 * No passwords or PII row dumps.
 */
import fs from "node:fs";
import path from "node:path";
import sql from "mssql";

function loadEnvLocal(filePath) {
  const env = {};
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
    connectionTimeout: 20000,
    requestTimeout: 120000,
  };
}

async function inspect(label, prefix, env) {
  const config = configFromPrefix(env, prefix);
  console.log(`\n======== ${label} ========`);
  console.log(`env target: ${config.server}:${config.port} / ${config.database} / user=${config.user}`);

  const pool = await sql.connect(config);
  try {
    const identity = await pool.request().query(`
      SELECT
        @@SERVERNAME AS server_name,
        DB_NAME() AS database_name,
        ORIGINAL_LOGIN() AS original_login,
        SUSER_SNAME() AS suser_sname,
        SYSTEM_USER AS system_user_name;
    `);
    const id = identity.recordset[0];
    console.log(
      `sql identity: server=${id.server_name} db=${id.database_name} login=${id.original_login}`,
    );

    const tables = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN (
        'JobCollection',
        'CandidateJobCollectionTxn',
        'CandidateMaster',
        'CandidateAIConsent',
        'ResumeParserJSONMaster'
      )
      ORDER BY TABLE_NAME;
    `);
    console.log("key tables:");
    for (const row of tables.recordset) {
      console.log(`  - ${row.TABLE_SCHEMA}.${row.TABLE_NAME} (${row.TABLE_TYPE})`);
    }

    const jcMeta = await pool.request().query(`
      SELECT
        OBJECT_ID('dbo.JobCollection') AS object_id,
        OBJECTPROPERTY(OBJECT_ID('dbo.JobCollection'), 'IsTable') AS is_table,
        OBJECTPROPERTY(OBJECT_ID('dbo.JobCollection'), 'IsView') AS is_view;
    `);
    console.log("JobCollection object:", JSON.stringify(jcMeta.recordset[0]));

    const counts = await pool.request().query(`
      SELECT
        (SELECT COUNT_BIG(*) FROM dbo.JobCollection) AS job_collection_rows,
        (SELECT COUNT_BIG(*) FROM dbo.CandidateJobCollectionTxn) AS bridge_rows,
        (SELECT COUNT_BIG(*) FROM dbo.CandidateJobCollectionTxn WHERE JobCollectionID IS NOT NULL AND JobCollectionID <> 0) AS bridge_nonzero_job_ids,
        (SELECT COUNT_BIG(*) FROM dbo.CandidateJobCollectionTxn WHERE JobCollectionID = 0) AS bridge_zero_job_ids,
        (SELECT COUNT_BIG(*) FROM dbo.CandidateMaster) AS candidate_master_rows;
    `);
    console.log("counts:", JSON.stringify(counts.recordset[0], null, 0));

    const joinHealth = await pool.request().query(`
      SELECT
        COUNT_BIG(*) AS bridge_rows,
        COUNT_BIG(CASE WHEN jc.JobCollectionID IS NOT NULL THEN 1 END) AS join_hits,
        COUNT_BIG(CASE WHEN cjt.JobCollectionID IS NOT NULL AND cjt.JobCollectionID <> 0 AND jc.JobCollectionID IS NULL THEN 1 END) AS orphan_job_ids
      FROM dbo.CandidateJobCollectionTxn AS cjt
      LEFT JOIN dbo.JobCollection AS jc
        ON jc.JobCollectionID = cjt.JobCollectionID;
    `);
    console.log("bridge-to-JobCollection join:", JSON.stringify(joinHealth.recordset[0]));

    const sampleJc = await pool.request().query(`
      SELECT TOP 5
        JobCollectionID,
        LEFT(JobTitle, 80) AS JobTitle,
        LEFT(Client, 60) AS Client,
        LEFT(Source, 40) AS Source
      FROM dbo.JobCollection
      ORDER BY JobCollectionID DESC;
    `);
    console.log(`JobCollection TOP 5 by id (n=${sampleJc.recordset.length}):`);
    for (const row of sampleJc.recordset) {
      console.log(
        `  - id=${row.JobCollectionID} title="${row.JobTitle ?? ""}" client="${row.Client ?? ""}" source="${row.Source ?? ""}"`,
      );
    }

    const sampleBridge = await pool.request().query(`
      SELECT TOP 5
        cjt.CandidateID,
        cjt.JobCollectionID,
        LEFT(cjt.JobTitle, 80) AS BridgeTitle,
        LEFT(jc.JobTitle, 80) AS ListingTitle
      FROM dbo.CandidateJobCollectionTxn AS cjt
      LEFT JOIN dbo.JobCollection AS jc
        ON jc.JobCollectionID = cjt.JobCollectionID
      WHERE cjt.JobCollectionID IS NOT NULL AND cjt.JobCollectionID <> 0
      ORDER BY cjt.CreatedDate DESC;
    `);
    console.log(`Recent bridge pairs with nonzero JobCollectionID (n=${sampleBridge.recordset.length}):`);
    for (const row of sampleBridge.recordset) {
      console.log(
        `  - candidate=${row.CandidateID} job=${row.JobCollectionID} bridge="${row.BridgeTitle ?? ""}" listing="${row.ListingTitle ?? ""}"`,
      );
    }

    return {
      label,
      envServer: config.server,
      envDatabase: config.database,
      sqlServer: id.server_name,
      sqlDatabase: id.database_name,
      ...counts.recordset[0],
      ...joinHealth.recordset[0],
      jobCollectionSampleCount: sampleJc.recordset.length,
    };
  } finally {
    await pool.close();
  }
}

const env = loadEnvLocal(path.join(process.cwd(), ".env.local"));
const ta = await inspect("TA", "TA_STAGING_SQL", env);
const rw = await inspect("RW", "RW_STAGING_SQL", env);

console.log("\n======== COMPARISON ========");
console.log(
  JSON.stringify(
    {
      sameEnvServer: ta.envServer === rw.envServer,
      sameSqlServer: ta.sqlServer === rw.sqlServer,
      sameDatabase: ta.sqlDatabase === rw.sqlDatabase,
      ta: {
        server: ta.sqlServer,
        db: ta.sqlDatabase,
        jobCollectionRows: String(ta.job_collection_rows),
        joinHits: String(ta.join_hits),
        bridgeRows: String(ta.bridge_rows),
      },
      rw: {
        server: rw.sqlServer,
        db: rw.sqlDatabase,
        jobCollectionRows: String(rw.job_collection_rows),
        joinHits: String(rw.join_hits),
        bridgeRows: String(rw.bridge_rows),
      },
    },
    null,
    2,
  ),
);
