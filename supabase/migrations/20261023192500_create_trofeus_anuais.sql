CREATE TABLE IF NOT EXISTS public.trofeus_anuais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano integer NOT NULL,
  total integer NOT NULL DEFAULT 0,
  steam integer NOT NULL DEFAULT 0,
  psn integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ano)
);

GRANT SELECT ON public.trofeus_anuais TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trofeus_anuais TO authenticated;
GRANT ALL ON public.trofeus_anuais TO service_role;

ALTER TABLE public.trofeus_anuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Troféus anuais visíveis para todos"
  ON public.trofeus_anuais FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir seus troféus anuais"
  ON public.trofeus_anuais FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários autenticados podem atualizar seus troféus anuais"
  ON public.trofeus_anuais FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trofeus_anuais_updated_at BEFORE UPDATE ON public.trofeus_anuais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
