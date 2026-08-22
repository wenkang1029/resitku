-- Migration 006: Telegram Account Link Codes
-- Enables multi-user linking between Telegram identities and web accounts

CREATE TABLE IF NOT EXISTS public.link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_link_codes_code ON public.link_codes(code);
CREATE INDEX IF NOT EXISTS idx_link_codes_user_id ON public.link_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);

ALTER TABLE public.link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "link_codes: insert own" ON public.link_codes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "link_codes: select own" ON public.link_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
