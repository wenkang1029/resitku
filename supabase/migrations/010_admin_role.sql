-- Migration 010: Add is_admin column to users table for administrative access control
-- Defaults to false. Explicitly set to true for designated administrator accounts.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_admin IS
  'Administrative flag gating access to /dashboard/admin/* and /api/admin/* endpoints for rule drafting and management.';
