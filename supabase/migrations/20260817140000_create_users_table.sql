CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de usuários
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view their own profile" 
ON public.users FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Trigger para atualizar 'updated_at'
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função e Trigger para inserir automaticamente um usuário na tabela public.users quando ele se cadastrar na auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
