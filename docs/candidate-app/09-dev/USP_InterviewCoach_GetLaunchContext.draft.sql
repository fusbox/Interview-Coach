-- Draft: USP_InterviewCoach_GetLaunchContext
-- Status: design draft from 2026-07-14 TA/RW staging discovery (not deployed).
-- Confirmed on both TalentArbor and HealthWorksStag:
--   CandidateMaster (identity), CandidateJobCollectionTxn (CandidateID+JobCollectionID),
--   JobCollection, Requirement*, JobPostTxn, ResumeParserJSONMaster, CandidateAIConsent
-- TA-only: CandidateRangamworksTxn
-- Safety:
--   Never SELECT Password*, Salt, SSN*, Birthdate, JSONData, or other sensitive bodies.
--   Resume text stays on a separate approved retrieval path.
-- Note:
--   JobCollection remains the preferred JD source for host job listings.
--   CandidateJobCollectionTxn proves candidate-to-job association; JobCollectionID is nullable
--   on that bridge (candidate-created jobs may lack a platform JobCollectionID).

CREATE OR ALTER PROCEDURE dbo.USP_InterviewCoach_GetLaunchContext
    @CandidateID INT,
    @JobCollectionID INT,
    @HostDomain VARCHAR(150) = NULL,
    @SourceSurface VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH LatestParsedResume AS (
        SELECT TOP (1)
            rpm.ResumeParserID,
            rpm.CandidateID,
            rpm.CreatedDate,
            rpm.UserId,
            rpm.ParsedBy,
            rpm.ResumeName,
            rpm.LinkID
        FROM dbo.ResumeParserJSONMaster AS rpm
        WHERE rpm.CandidateID = @CandidateID
        ORDER BY rpm.CreatedDate DESC, rpm.ResumeParserID DESC
    ),
    LatestConsent AS (
        SELECT TOP (1)
            c.CandidateId,
            c.ConsentDate
        FROM dbo.CandidateAIConsent AS c
        WHERE c.CandidateId = @CandidateID
        ORDER BY c.ConsentDate DESC
    ),
    CandidateJobLink AS (
        SELECT TOP (1)
            cjt.CandidateJobCollectionTxnID,
            cjt.CandidateID,
            cjt.JobCollectionID,
            cjt.IsActive AS LinkIsActive,
            cjt.IsExpired AS LinkIsExpired
        FROM dbo.CandidateJobCollectionTxn AS cjt
        WHERE cjt.CandidateID = @CandidateID
          AND cjt.JobCollectionID = @JobCollectionID
        ORDER BY cjt.ModifiedDate DESC, cjt.CreatedDate DESC, cjt.CandidateJobCollectionTxnID DESC
    ),
    JobBridge AS (
        -- Requirement/JobPost column names still provisional until round-2 column probes.
        SELECT TOP (1)
            rct.JobCollectionID,
            rct.RequirementID
        FROM dbo.RequirementCollectionTxn AS rct
        WHERE rct.JobCollectionID = @JobCollectionID
        ORDER BY rct.RequirementID DESC
    ),
    ChannelBridge AS (
        SELECT TOP (1)
            jpt.JobCollectionID,
            jpt.RequirementID,
            jpt.TalentChannelID
        FROM dbo.JobPostTxn AS jpt
        WHERE jpt.JobCollectionID = @JobCollectionID
        ORDER BY jpt.PostDate DESC
    )
    SELECT
        /* candidate - CandidateMaster columns confirmed 2026-07-14 */
        CAST(cm.CandidateID AS VARCHAR(32)) AS candidateId,
        CAST(cm.CreatedBy AS VARCHAR(32)) AS userId,
        CAST(cm.CompanyID AS VARCHAR(32)) AS companyId,
        CAST(cm.Email AS VARCHAR(320)) AS email,
        CAST(
            NULLIF(
                LTRIM(RTRIM(CONCAT(
                    NULLIF(LTRIM(RTRIM(cm.FirstName)), ''),
                    CASE
                        WHEN NULLIF(LTRIM(RTRIM(cm.FirstName)), '') IS NOT NULL
                         AND NULLIF(LTRIM(RTRIM(cm.LastName)), '') IS NOT NULL
                        THEN ' '
                        ELSE ''
                    END,
                    NULLIF(LTRIM(RTRIM(cm.LastName)), '')
                ))),
                ''
            ) AS VARCHAR(200)
        ) AS displayName,

        /* source - host hints + optional channel */
        CAST(@HostDomain AS VARCHAR(150)) AS hostDomain,
        CAST(COALESCE(NULLIF(LTRIM(RTRIM(@SourceSurface)), ''), 'quick-help') AS VARCHAR(100)) AS sourceSurface,
        CAST(cb.TalentChannelID AS VARCHAR(32)) AS talentChannelId,

        /* job - prefer JobCollection listing; association via CandidateJobCollectionTxn */
        CAST(jc.JobCollectionID AS VARCHAR(32)) AS jobCollectionId,
        CAST(jb.RequirementID AS VARCHAR(32)) AS requirementId,
        CAST(rm.RequirementCode AS VARCHAR(100)) AS requirementCode,
        CAST(jc.JobTitle AS VARCHAR(250)) AS jobTitle,
        CAST(jc.JobDescription AS VARCHAR(MAX)) AS jobDescription,
        CAST('JobCollection' AS VARCHAR(40)) AS jobDescriptionSource,
        CAST(jc.Client AS VARCHAR(250)) AS client,
        CAST(
            COALESCE(
                NULLIF(LTRIM(RTRIM(jc.Location)), ''),
                NULLIF(LTRIM(RTRIM(CONCAT_WS(', ', jc.CityName, jc.StateShortName))), '')
            ) AS VARCHAR(500)
        ) AS location,
        CAST(jc.IsActive AS BIT) AS isActive,
        CAST(jc.IsExpired AS BIT) AS isExpired,
        jc.ExpirationDate AS expirationDate,
        CAST(cjl.CandidateJobCollectionTxnID AS VARCHAR(32)) AS candidateJobCollectionTxnId,

        /* resume availability only - never JSONData / cleaned text */
        CAST(CASE WHEN lpr.ResumeParserID IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS hasParsedResume,
        CAST(
            CASE
                WHEN lpr.ResumeParserID IS NOT NULL THEN 'ResumeParserJSONMaster'
                ELSE 'None'
            END AS VARCHAR(40)
        ) AS resumeSourceType,
        lpr.CreatedDate AS resumeCreatedDate,
        CAST(
            CASE
                WHEN lpr.ResumeParserID IS NOT NULL THEN 1
                ELSE 0
            END AS BIT
        ) AS resumeContentAvailable,

        /* consent */
        CAST(CASE WHEN lc.CandidateId IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS hasAIConsent,
        lc.ConsentDate AS aiConsentDate
    FROM dbo.CandidateMaster AS cm
    INNER JOIN dbo.JobCollection AS jc
        ON jc.JobCollectionID = @JobCollectionID
    LEFT JOIN CandidateJobLink AS cjl
        ON cjl.CandidateID = cm.CandidateID
       AND cjl.JobCollectionID = jc.JobCollectionID
    LEFT JOIN JobBridge AS jb
        ON jb.JobCollectionID = jc.JobCollectionID
    LEFT JOIN dbo.RequirementMaster AS rm
        ON rm.RequirementID = jb.RequirementID
    LEFT JOIN ChannelBridge AS cb
        ON cb.JobCollectionID = jc.JobCollectionID
    LEFT JOIN LatestParsedResume AS lpr
        ON lpr.CandidateID = cm.CandidateID
    LEFT JOIN LatestConsent AS lc
        ON lc.CandidateId = cm.CandidateID
    WHERE cm.CandidateID = @CandidateID;
END;
GO

/*
Validation sketch (after deploy to staging):

-- Supply a candidate-owned staging pair through local variables or query parameters.
-- Do not commit staging candidate or job identifiers in this validation sketch.

EXEC dbo.USP_InterviewCoach_GetLaunchContext
  @CandidateID = <candidate id>,
  @JobCollectionID = <owned job collection id>,
  @HostDomain = 'talentarbor.com',
  @SourceSurface = 'quick-help';

-- Skip JobCollectionID = 0 rows (candidate-created jobs without platform listing id).
-- On RW staging, verify JobCollection join hits before trusting high JobCollectionIDs.
*/
