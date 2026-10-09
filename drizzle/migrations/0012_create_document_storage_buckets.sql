-- Buckets privados usados pelos anexos dos protocolos.
-- A aplicacao valida os mesmos limites e tipos antes de enviar os arquivos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('protocolo-fotos', 'protocolo-fotos', false, 10485760, ARRAY['image/jpeg', 'image/png']),
  ('protocolo-nf', 'protocolo-nf', false, 10485760, ARRAY['application/pdf']),
  ('protocolo-canhoto', 'protocolo-canhoto', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
