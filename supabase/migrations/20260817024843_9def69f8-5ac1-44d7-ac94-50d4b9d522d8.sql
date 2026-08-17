ALTER TABLE public.jogos ADD COLUMN user_id uuid;

UPDATE public.jogos SET user_id = '5dd910d5-e80d-464e-b3cc-7ba6e43205e8' WHERE user_id IS NULL;

ALTER TABLE public.jogos ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.jogos ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS jogos_user_id_idx ON public.jogos(user_id);

DROP POLICY IF EXISTS "Jogos visíveis para todos" ON public.jogos;
DROP POLICY IF EXISTS "Usuários autenticados podem apagar jogos" ON public.jogos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar jogos" ON public.jogos;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir jogos" ON public.jogos;

REVOKE ALL ON public.jogos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jogos TO authenticated;
GRANT ALL ON public.jogos TO service_role;

CREATE POLICY "Usuários veem seus próprios jogos" ON public.jogos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Usuários inserem seus próprios jogos" ON public.jogos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários atualizam seus próprios jogos" ON public.jogos FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários apagam seus próprios jogos" ON public.jogos FOR DELETE TO authenticated USING (auth.uid() = user_id);