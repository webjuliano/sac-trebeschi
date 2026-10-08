ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master' BEFORE 'admin';

CREATE TABLE IF NOT EXISTS public.api_credentials (
  provider TEXT PRIMARY KEY,
  base_url TEXT NOT NULL,
  token_encrypted TEXT NOT NULL,
  client_id_encrypted TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT ALL ON public.api_credentials TO service_role;
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_equipe(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('master', 'admin', 'analista')
  )
$$;
