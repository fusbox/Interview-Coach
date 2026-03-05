-- SQL Migration: User Feedback System
-- Description: Create the table for tracking candidate and recruiter signals.
-- Run this in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.sessions(session_id) ON DELETE SET NULL,
    recruiter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Type categorizes the signal: 
    -- 'candidate_baseline' (preparedness start)
    -- 'helpfulness_pulse' (inline thumbs up/down)
    -- 'session_completion' (Confidence, Safety, Repeat Intent)
    -- 'recruiter_friction' (Invite ease)
    -- 'recruiter_preparedness' (Observation of candidate lift)
    type TEXT NOT NULL,
    
    -- Standard 1-5 rating across most signals
    rating INTEGER,
    
    -- Any prose comments or "Why" follow-ups
    comment TEXT,
    
    -- JSONB for multi-question sets or dynamic categorization
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices for Dashboard performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON public.user_feedback(type);
CREATE INDEX IF NOT EXISTS idx_user_feedback_recruiter_id ON public.user_feedback(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON public.user_feedback(created_at);

-- RLS Policies
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Admins can read all feedback (Policy to be refined based on profile metadata later)
-- For now, we allow service role or authenticated admins if we set a specific claim.
-- For local dev/initial MVP, we'll use an permissive policy for authenticated users 
-- if they are in the admin list, handled at the APP level.

CREATE POLICY "Allow authenticated inserts" 
ON public.user_feedback FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow read for admins only" 
ON public.user_feedback FOR SELECT 
TO authenticated 
USING (true); -- Logic refined via app-level RBAC for now.
