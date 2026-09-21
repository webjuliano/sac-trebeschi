CREATE POLICY "Equipe le fotos dos protocolos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'protocolo-fotos' AND public.is_equipe(auth.uid()));

CREATE POLICY "Equipe gerencia fotos dos protocolos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'protocolo-fotos' AND public.is_equipe(auth.uid()));