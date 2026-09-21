CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID REFERENCES public.protocolos(id) ON DELETE CASCADE,
  destinatario TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pendente',
  erro TEXT,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notificacoes_protocolo_idx ON public.notificacoes (protocolo_id);
CREATE INDEX notificacoes_status_idx ON public.notificacoes (status);

GRANT SELECT ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve notificacoes"
  ON public.notificacoes FOR SELECT TO authenticated
  USING (public.is_equipe(auth.uid()));