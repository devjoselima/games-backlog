ALTER TABLE public.jogos
  ADD COLUMN IF NOT EXISTS tempo_zerar numeric(5,1),
  ADD COLUMN IF NOT EXISTS tempo_platinar numeric(5,1),
  ADD COLUMN IF NOT EXISTS trofeus_obtidos integer,
  ADD COLUMN IF NOT EXISTS trofeus_totais integer,
  ADD COLUMN IF NOT EXISTS trofeus_psn jsonb;
