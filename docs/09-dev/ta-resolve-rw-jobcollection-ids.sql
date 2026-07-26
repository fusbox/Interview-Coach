-- TA staging cross-check for JobCollectionID values observed in RW.
-- Run read-only against TalentArbor.
--
-- Replace or extend the VALUES list with recent nonzero IDs returned by
-- rw-job-catalog-ownership-diagnostic.sql. If these IDs resolve here while
-- RW's local JobCollection remains empty, that supports the hypothesis that
-- TA owns the canonical catalog and RW stores references plus job snapshots.

WITH rw_job_ids (JobCollectionID) AS (
    SELECT JobCollectionID
    FROM (VALUES
        (7785490),
        (7785491),
        (7785492),
        (7785486),
        (7572362),
        (920211)
    ) AS ids (JobCollectionID)
)
SELECT
    rw.JobCollectionID,
    CASE
        WHEN jc.JobCollectionID IS NULL THEN 0
        ELSE 1
    END AS talentarbor_catalog_match,
    jc.JobTitle,
    LEFT(jc.JobDescription, 300) AS description_preview,
    jc.Client,
    jc.Source,
    jc.IsActive,
    jc.IsExpired
FROM rw_job_ids AS rw
LEFT JOIN dbo.JobCollection AS jc
    ON jc.JobCollectionID = rw.JobCollectionID
ORDER BY rw.JobCollectionID DESC;
