CREATE TABLE public.jogos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  genero text,
  plataforma text,
  status text NOT NULL DEFAULT 'Zerado',
  ano_jogado integer,
  nota numeric(3,1),
  horas_jogadas numeric(6,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jogos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jogos TO authenticated;
GRANT ALL ON public.jogos TO service_role;

ALTER TABLE public.jogos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jogos são públicos" ON public.jogos FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER jogos_updated_at BEFORE UPDATE ON public.jogos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.jogos (nome, genero, plataforma, status, ano_jogado, nota) VALUES
('Assassin''s creed 3', 'Ação', 'Steam', 'Zerado', 2025, 5),
('Spider man (DLC''s)', 'Ação', 'PSN', 'Zerado', 2025, NULL),
('A Way Out', 'Aventura', 'PSN', 'Zerado', 2025, NULL),
('It takes two', 'Puzzle', 'PSN', 'Platinado', 2025, 9),
('Naruto Storm 1', 'Ação', 'PSN', 'Platinado', 2025, NULL),
('Naruto Storm 2', 'Ação', 'Steam', 'Zerado', 2025, NULL),
('Naruto Storm 3', 'Ação', 'PSN', 'Platinado', 2025, NULL),
('Overcooked', 'Casual', 'PSN', 'Platinado', 2025, NULL),
('Red Dead Redemption 2', 'Aventura', 'PSN', 'Zerado', 2025, 10),
('Death Stranding', 'Aventura', 'PSN', 'Platinado', 2025, NULL),
('Resident Evil 0', 'Survival Horror', 'PSN', 'Zerado', 2025, 6),
('Resident Evil 1', 'Survival Horror', 'PSN', 'Zerado', 2025, 9),
('Resident Evil 2 Remake', 'Survival Horror', 'PSN', 'Zerado', 2025, 9),
('Resident Evil 3 Remake', 'Survival Horror', 'PSN', 'Zerado', 2025, 8),
('Resident Evil 4 Remake', 'Survival Horror', 'PSN', 'Zerado', 2025, 10),
('Resident Evil 5', 'Survival Horror', 'PSN', 'Zerado', 2025, 2.5),
('Resident Evil 6', 'Survival Horror', 'PSN', 'Zerado', 2025, 3),
('Dispatch', 'Aventura', 'Steam', 'Zerado', 2025, 10),
('Astrobot Playroom', 'Plataforma 2D', 'PSN', 'Platinado', 2025, NULL),
('Spider man 2', 'Ação', 'PSN', 'Platinado', 2025, 8.5),
('Ratchet & Clank', 'Plataforma 2D', 'PSN', 'Platinado', 2026, 8),
('Resident Evil 9', 'Survival Horror', 'PSN', 'Platinado', 2026, 9),
('God of War (2018)', 'Ação', 'PSN', 'Platinado', 2026, 10),
('Ghost of Tsushima', 'Ação', 'PSN', 'Zerado', 2026, NULL),
('Life is Strange', 'Aventura', 'Steam', 'Zerado', 2026, NULL),
('Gta IV', 'Ação', 'Steam', 'Jogando', 2026, NULL),
('Hades', 'Soulslike', 'Steam', 'Quero jogar', 2026, NULL),
('Far cry 3', 'FPS', 'Steam', 'Quero jogar', 2026, NULL);