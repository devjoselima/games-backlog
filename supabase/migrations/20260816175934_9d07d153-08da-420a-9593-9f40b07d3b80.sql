ALTER TABLE public.jogos ADD COLUMN IF NOT EXISTS ordem integer;

UPDATE public.jogos SET ordem = v.ordem FROM (VALUES
 ('Assassin''s Creed III Remastered',1),
 ('Marvel''s Spider-Man Remastered',2),
 ('A Way Out',3),
 ('It Takes Two',4),
 ('NARUTO: Ultimate Ninja STORM',5),
 ('NARUTO SHIPPUDEN: Ultimate Ninja STORM 2',6),
 ('NARUTO SHIPPUDEN: Ultimate Ninja STORM 3 Full Burst',7),
 ('Overcooked! All You Can Eat',8),
 ('Red Dead Redemption 2',9),
 ('DEATH STRANDING DIRECTOR''S CUT',10),
 ('Resident Evil 0',11),
 ('Resident Evil',12),
 ('Resident Evil 2',13),
 ('Resident Evil 3',14),
 ('Resident Evil 4',15),
 ('Resident Evil 5',16),
 ('Resident Evil 6',17),
 ('Dispatch',18),
 ('Astro''s Playroom',19),
 ('Marvel''s Spider-Man 2',20),
 ('Ratchet & Clank: Rift Apart',21),
 ('Resident Evil Requiem',22),
 ('God of War',23),
 ('Ghost of Tsushima DIRECTOR''S CUT',24),
 ('Life is Strange',25),
 ('Grand Theft Auto IV: The Complete Edition',26),
 ('Hades',27),
 ('Far Cry 3',28),
 ('BioShock Remastered',29)
) AS v(nome, ordem)
WHERE public.jogos.nome = v.nome;

UPDATE public.jogos SET ordem = 100 WHERE ordem IS NULL;