DROP POLICY IF EXISTS "Jogos são públicos" ON public.jogos;

GRANT SELECT ON public.jogos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jogos TO authenticated;
GRANT ALL ON public.jogos TO service_role;

CREATE POLICY "Jogos visíveis para todos"
  ON public.jogos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir jogos"
  ON public.jogos FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar jogos"
  ON public.jogos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem apagar jogos"
  ON public.jogos FOR DELETE
  TO authenticated
  USING (true);