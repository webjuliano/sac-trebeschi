CREATE TABLE public.user_lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  loja_id UUID NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, loja_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_lojas TO authenticated;
GRANT ALL ON public.user_lojas TO service_role;

ALTER TABLE public.user_lojas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_loja(_user_id UUID, _loja_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_lojas
    WHERE user_id = _user_id
      AND loja_id = _loja_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.usuario_tem_acesso_loja(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.usuario_tem_acesso_loja(UUID, UUID) TO service_role;

CREATE POLICY "Admin gerencia vinculos de lojas"
ON public.user_lojas
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuario ve os proprios vinculos de lojas"
ON public.user_lojas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuario ve lojas vinculadas"
ON public.lojas
FOR SELECT
TO authenticated
USING (public.usuario_tem_acesso_loja(auth.uid(), id));

CREATE POLICY "Usuario ve protocolos das lojas vinculadas"
ON public.protocolos
FOR SELECT
TO authenticated
USING (public.usuario_tem_acesso_loja(auth.uid(), loja_id));

CREATE POLICY "Usuario ve itens das lojas vinculadas"
ON public.protocolo_itens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.protocolos p
    WHERE p.id = protocolo_itens.protocolo_id
      AND public.usuario_tem_acesso_loja(auth.uid(), p.loja_id)
  )
);

CREATE POLICY "Usuario ve fotos das lojas vinculadas"
ON public.protocolo_fotos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.protocolos p
    WHERE p.id = protocolo_fotos.protocolo_id
      AND public.usuario_tem_acesso_loja(auth.uid(), p.loja_id)
  )
);

CREATE POLICY "Usuario ve historico das lojas vinculadas"
ON public.protocolo_eventos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.protocolos p
    WHERE p.id = protocolo_eventos.protocolo_id
      AND public.usuario_tem_acesso_loja(auth.uid(), p.loja_id)
  )
);