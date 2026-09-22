ALTER TABLE public.lojas ADD COLUMN IF NOT EXISTS codigo_sankhya TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS lojas_codigo_sankhya_unico
  ON public.lojas (codigo_sankhya) WHERE codigo_sankhya IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sankhya_cache (
  chave TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expira_em TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.sankhya_cache TO service_role;

ALTER TABLE public.sankhya_cache ENABLE ROW LEVEL SECURITY;

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('limite_percentual_devolucao', '2', 'Percentual de devolução considerado aceitável na análise comercial'),
  ('sankhya_cache_minutos', '15', 'Minutos de validade do cache dos indicadores do Sankhya')
ON CONFLICT (chave) DO NOTHING;