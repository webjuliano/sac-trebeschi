ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS dias_vendas integer NOT NULL DEFAULT 30;
ALTER TABLE public.lojas ADD CONSTRAINT lojas_dias_vendas_check CHECK (dias_vendas BETWEEN 1 AND 365);