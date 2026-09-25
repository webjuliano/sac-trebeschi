ALTER TYPE public.protocolo_status ADD VALUE IF NOT EXISTS 'nf_anexada';
ALTER TABLE public.protocolos ADD COLUMN IF NOT EXISTS aprovacao text;
ALTER TABLE public.protocolos ADD COLUMN IF NOT EXISTS nf_devolucao_path text;
UPDATE public.protocolos SET aprovacao = status::text WHERE status::text IN ('aceito_parcial','aceito_total','recusado');
ALTER TABLE public.protocolos ADD CONSTRAINT protocolos_aprovacao_check CHECK (aprovacao IS NULL OR aprovacao IN ('aceito_parcial','aceito_total','recusado'));