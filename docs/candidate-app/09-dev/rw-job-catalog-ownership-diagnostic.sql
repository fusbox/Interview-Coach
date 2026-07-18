-- RW staging job-catalog ownership diagnostic.
-- Run read-only against HealthWorksStag.
--
-- Purpose:
--   1. Confirm that CandidateJobCollectionTxn contains candidate job snapshots.
--   2. Confirm whether those JobCollectionID values resolve in RW's local catalog.
--   3. Surface linked servers and SQL modules that may reveal the upstream catalog path.
--
-- Copy several nonzero JobCollectionID values from result set 3 into
-- ta-resolve-rw-jobcollection-ids.sql and run that query against TalentArbor.

SELECT
    @@SERVERNAME AS server_name,
    DB_NAME() AS database_name;

SELECT
    'CandidateJobCollectionTxn' AS object_name,
    COUNT_BIG(*) AS row_count
FROM dbo.CandidateJobCollectionTxn
UNION ALL
SELECT
    'JobCollection',
    COUNT_BIG(*)
FROM dbo.JobCollection
UNION ALL
SELECT
    'JobCollectionArchive',
    COUNT_BIG(*)
FROM dbo.JobCollectionArchive;

SELECT TOP (50)
    cjt.CandidateJobCollectionTxnID,
    cjt.CandidateID,
    cjt.JobCollectionID,
    cjt.JobTitle,
    LEFT(cjt.Description, 300) AS bridge_description_preview,
    cjt.CompanyName,
    cjt.Source,
    cjt.IsJobCreatedByCandidate,
    cjt.IsActive,
    cjt.CreatedDate,
    CASE
        WHEN jc.JobCollectionID IS NULL THEN 0
        ELSE 1
    END AS local_catalog_match
FROM dbo.CandidateJobCollectionTxn AS cjt
LEFT JOIN dbo.JobCollection AS jc
    ON jc.JobCollectionID = cjt.JobCollectionID
WHERE cjt.JobCollectionID IS NOT NULL
  AND cjt.JobCollectionID <> 0
ORDER BY cjt.CreatedDate DESC;

SELECT
    name,
    product,
    provider,
    data_source,
    catalog,
    is_linked
FROM sys.servers;

SELECT DISTINCT
    SCHEMA_NAME(o.schema_id) AS schema_name,
    o.name AS object_name,
    o.type_desc
FROM sys.sql_modules AS sm
INNER JOIN sys.objects AS o
    ON o.object_id = sm.object_id
WHERE sm.definition LIKE '%CandidateJobCollectionTxn%'
   OR sm.definition LIKE '%JobCollection%'
ORDER BY
    o.type_desc,
    schema_name,
    object_name;
