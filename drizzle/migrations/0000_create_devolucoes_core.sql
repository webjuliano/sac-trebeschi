-- ===== Enums =====
CREATE TYPE public.app_role AS ENUM ('admin', 'analista', 'loja');

CREATE TYPE public.protocolo_status AS ENUM (
  'aberto',
  'em_analise',
  'aguardando_cliente',
  'aceito_total',
  'aceito_parcial',
  'recusado',
  'aguardando_nf',
  'coletado',
  'encerrado'
);

-- ===== Utility functions =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve o proprio perfil"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Usuario atualiza o proprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_equipe(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'analista')
  )
$$;

CREATE POLICY "Usuario ve os proprios papeis"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin gerencia papeis"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== Lojas / clientes =====
CREATE TABLE public.lojas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  email_contato TEXT,
  rede TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lojas TO authenticated;
GRANT ALL ON public.lojas TO service_role;
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve lojas"
  ON public.lojas FOR SELECT TO authenticated
  USING (public.is_equipe(auth.uid()));

CREATE POLICY "Admin gerencia lojas"
  ON public.lojas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER lojas_set_updated_at
  BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Protocolos =====
CREATE SEQUENCE public.protocolo_numero_seq START 1;

CREATE TABLE public.protocolos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  loja_nome TEXT NOT NULL,
  loja_codigo TEXT,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT NOT NULL,
  cliente_telefone TEXT,
  nota_fiscal TEXT,
  pedido TEXT,
  data_compra DATE,
  motivo TEXT NOT NULL,
  descricao TEXT,
  status public.protocolo_status NOT NULL DEFAULT 'aberto',
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  responsavel_id UUID,
  parecer TEXT,
  decidido_por UUID,
  decidido_em TIMESTAMPTZ,
  nf_devolucao TEXT,
  canhoto_path TEXT,
  canhoto_confirmado_por UUID,
  canhoto_confirmado_em TIMESTAMPTZ,
  encerrado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX protocolos_status_idx ON public.protocolos (status);
CREATE INDEX protocolos_created_at_idx ON public.protocolos (created_at DESC);
CREATE INDEX protocolos_loja_idx ON public.protocolos (loja_id);
CREATE INDEX protocolos_cliente_email_idx ON public.protocolos (lower(cliente_email));

GRANT SELECT, INSERT, UPDATE ON public.protocolos TO authenticated;
GRANT ALL ON public.protocolos TO service_role;
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve protocolos"
  ON public.protocolos FOR SELECT TO authenticated
  USING (public.is_equipe(auth.uid()));

CREATE POLICY "Equipe atualiza protocolos"
  ON public.protocolos FOR UPDATE TO authenticated
  USING (public.is_equipe(auth.uid()))
  WITH CHECK (public.is_equipe(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_protocolo_numero()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'DEV-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.protocolo_numero_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protocolos_set_numero
  BEFORE INSERT ON public.protocolos
  FOR EACH ROW EXECUTE FUNCTION public.set_protocolo_numero();

CREATE TRIGGER protocolos_set_updated_at
  BEFORE UPDATE ON public.protocolos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Itens =====
CREATE TABLE public.protocolo_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  codigo_produto TEXT,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  unidade TEXT,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  lote TEXT,
  validade DATE,
  motivo TEXT,
  quantidade_aceita NUMERIC(12,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX protocolo_itens_protocolo_idx ON public.protocolo_itens (protocolo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolo_itens TO authenticated;
GRANT ALL ON public.protocolo_itens TO service_role;
ALTER TABLE public.protocolo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve itens"
  ON public.protocolo_itens FOR SELECT TO authenticated
  USING (public.is_equipe(auth.uid()));

CREATE POLICY "Equipe atualiza itens"
  ON public.protocolo_itens FOR UPDATE TO authenticated
  USING (public.is_equipe(auth.uid()))
  WITH CHECK (public.is_equipe(auth.uid()));

-- ===== Fotos / anexos =====
CREATE TABLE public.protocolo_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.protocolo_itens(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'evidencia',
  tamanho_bytes INTEGER,
  expurgada BOOLEAN NOT NULL DEFAULT false,
  expurgada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX protocolo_fotos_protocolo_idx ON public.protocolo_fotos (protocolo_id);
CREATE INDEX protocolo_fotos_created_at_idx ON public.protocolo_fotos (created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.protocolo_fotos TO authenticated;
GRANT ALL ON public.protocolo_fotos TO service_role;
ALTER TABLE public.protocolo_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve fotos"
  ON public.protocolo_fotos FOR SELECT TO authenticated
  USING (public.is_equipe(auth.uid()));

-- ===== Historico =====
CREATE TABLE public.protocolo_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  autor_id UUID,
  autor_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX protocolo_eventos_protocolo_idx ON public.protocolo_eventos (protocolo_id, created_at);

GRANT SELECT, INSERT ON public.protocolo_eventos TO authenticated;
GRANT ALL ON public.protocolo_eventos TO service_role;
ALTER TABLE public.protocolo_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve historico"
  ON public.protocolo_eventos FOR SELECT TO authenticated
  USING (public.is_equipe(auth.uid()));

CREATE POLICY "Equipe registra historico"
  ON public.protocolo_eventos FOR INSERT TO authenticated
  WITH CHECK (public.is_equipe(auth.uid()));

-- ===== Configuracoes =====
CREATE TABLE public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descricao TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe ve configuracoes"
  ON public.configuracoes FOR SELECT TO authenticated
  USING (public.is_equipe(auth.uid()));

CREATE POLICY "Admin gerencia configuracoes"
  ON public.configuracoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.configuracoes (chave, valor, descricao) VALUES
  ('retencao_fotos_meses', '12', 'Meses que as fotos ficam guardadas antes do expurgo automatico'),
  ('max_fotos_por_protocolo', '12', 'Limite de fotos por protocolo');

-- ===== Lojas e protocolos de exemplo =====
INSERT INTO public.lojas (id, nome, codigo, rede, email_contato) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Assai Santo Andre', 'ASS-0142', 'Assai', 'santoandre@assai.example.com'),
  ('22222222-2222-2222-2222-222222222222', 'Assai Guarulhos', 'ASS-0207', 'Assai', 'guarulhos@assai.example.com'),
  ('33333333-3333-3333-3333-333333333333', 'Atacadao Osasco', 'ATC-0088', 'Atacadao', 'osasco@atacadao.example.com');

INSERT INTO public.protocolos
  (id, numero, loja_id, loja_nome, loja_codigo, cliente_nome, cliente_email, cliente_telefone,
   nota_fiscal, pedido, data_compra, motivo, descricao, status, valor_total)
VALUES
  ('aaaaaaa1-0000-4000-8000-000000000001', 'DEV-2026-000001',
   '11111111-1111-1111-1111-111111111111', 'Assai Santo Andre', 'ASS-0142',
   'Marcella Souza', 'marcella@assai.example.com', '(11) 98888-1111',
   '145872', 'PED-99231', '2026-09-08', 'Produto avariado no transporte',
   'Caixas amassadas e produto vazando na chegada.', 'aberto', 1280.50),
  ('aaaaaaa1-0000-4000-8000-000000000002', 'DEV-2026-000002',
   '22222222-2222-2222-2222-222222222222', 'Assai Guarulhos', 'ASS-0207',
   'Rogerio Lima', 'rogerio@assai.example.com', '(11) 97777-2222',
   '145903', 'PED-99310', '2026-09-10', 'Validade curta',
   'Lote com 20 dias de validade, fora do acordo comercial.', 'em_analise', 764.00),
  ('aaaaaaa1-0000-4000-8000-000000000003', 'DEV-2026-000003',
   '33333333-3333-3333-3333-333333333333', 'Atacadao Osasco', 'ATC-0088',
   'Fernanda Castro', 'fernanda@atacadao.example.com', '(11) 96666-3333',
   '146011', 'PED-99402', '2026-09-12', 'Divergencia de pedido',
   'Recebeu 40 caixas a mais do que o pedido.', 'aceito_parcial', 2310.90);

SELECT setval('public.protocolo_numero_seq', 3);

INSERT INTO public.protocolo_itens (protocolo_id, codigo_produto, descricao, quantidade, unidade, valor_unitario, lote, motivo) VALUES
  ('aaaaaaa1-0000-4000-8000-000000000001', 'TRB-1020', 'Molho de tomate 340g', 48, 'UN', 12.90, 'L2609A', 'Embalagem violada'),
  ('aaaaaaa1-0000-4000-8000-000000000001', 'TRB-1044', 'Extrato de tomate 1kg', 24, 'UN', 27.50, 'L2609A', 'Caixa amassada'),
  ('aaaaaaa1-0000-4000-8000-000000000002', 'TRB-2010', 'Conserva de palmito 300g', 30, 'UN', 25.40, 'L2531B', 'Validade curta'),
  ('aaaaaaa1-0000-4000-8000-000000000003', 'TRB-3001', 'Azeitona verde 200g', 40, 'CX', 57.70, 'L2544C', 'Excedente de pedido');

INSERT INTO public.protocolo_eventos (protocolo_id, tipo, descricao, autor_nome) VALUES
  ('aaaaaaa1-0000-4000-8000-000000000001', 'abertura', 'Protocolo aberto pela loja.', 'Marcella Souza'),
  ('aaaaaaa1-0000-4000-8000-000000000002', 'abertura', 'Protocolo aberto pela loja.', 'Rogerio Lima'),
  ('aaaaaaa1-0000-4000-8000-000000000002', 'triagem', 'Protocolo encaminhado para analise comercial.', 'Equipe Trebeschi'),
  ('aaaaaaa1-0000-4000-8000-000000000003', 'abertura', 'Protocolo aberto pela loja.', 'Fernanda Castro'),
  ('aaaaaaa1-0000-4000-8000-000000000003', 'decisao', 'Aceite parcial: 30 das 40 caixas autorizadas.', 'Equipe Trebeschi');