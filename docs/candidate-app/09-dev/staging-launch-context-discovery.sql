-- Staging launch-context discovery for TA (TalentArbor) / RW (HealthWorksStag).
-- Run against each staging DB while on the company VPN tunnel.
-- Goal: confirm tables/columns named in platform-launch-prepprofile-migration.md
-- and find sample CandidateID + JobCollectionID pairs for USP_InterviewCoach_GetLaunchContext.

-- 1) Expected launch-context tables
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME IN (
  'JobCollection',
  'RequirementCollectionTxn',
  'RequirementMaster',
  'RequirementDescTxn',
  'JobPostTxn',
  'ResumeParserJSONMaster',
  'CandidateResume',
  'SubmissionResume',
  'DisplayCandidateResume',
  'CandidateAIConsent',
  'Candidate'
)
ORDER BY TABLE_NAME;

-- 2) Columns for core job listing surface
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'JobCollection'
ORDER BY ORDINAL_POSITION;

-- 3) Recent job listings (adjust filter once columns are confirmed)
SELECT TOP 20
  JobCollectionID,
  JobTitle,
  LEFT(JobDescription, 120) AS JobDescriptionPreview,
  Client,
  Source
FROM JobCollection
ORDER BY JobCollectionID DESC;

-- 4) Resume availability metadata (prefer counts/flags over full text)
SELECT TOP 20 *
FROM ResumeParserJSONMaster
ORDER BY 1 DESC;

-- 5) AI consent shape
SELECT TOP 20 *
FROM CandidateAIConsent
ORDER BY 1 DESC;

-- 6) After you have a real CandidateID + JobCollectionID pair, sketch joins here.
-- Keep resume text out of discovery exports; prefer availability + source metadata only.
