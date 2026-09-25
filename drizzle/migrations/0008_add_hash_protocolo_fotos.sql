ALTER TABLE public.protocolo_fotos ADD COLUMN IF NOT EXISTS hash TEXT;
CREATE INDEX IF NOT EXISTS protocolo_fotos_hash_idx ON public.protocolo_fotos (hash) WHERE hash IS NOT NULL;