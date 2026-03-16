-- Add invitation_sent_at to track when an invite was actually dispatched
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMPTZ;

-- Migration: Set invitation_sent_at to created_at for existing sessions that have already been processed
-- (e.g. status IS NOT 'NOT_STARTED') or just all historical data to avoid hiding it.
-- Based on user request to only show "Sent" sessions, we'll set it for all current sessions to avoid data loss.
UPDATE sessions SET invitation_sent_at = created_at WHERE invitation_sent_at IS NULL;

-- Optional index for faster dashboard filtering
CREATE INDEX IF NOT EXISTS idx_sessions_invitation_sent_at ON sessions (invitation_sent_at);
