UPDATE public.jogos SET nome = v.novo FROM (VALUES
 ('Assassin''s creed 3','Assassin''s Creed III Remastered'),
 ('Spider man (DLC''s)','Marvel''s Spider-Man Remastered'),
 ('It takes two','It Takes Two'),
 ('Naruto Storm 1','NARUTO: Ultimate Ninja STORM'),
 ('Naruto Storm 2','NARUTO SHIPPUDEN: Ultimate Ninja STORM 2'),
 ('Naruto Storm 3','NARUTO SHIPPUDEN: Ultimate Ninja STORM 3 Full Burst'),
 ('Overcooked','Overcooked! All You Can Eat'),
 ('Death Stranding','DEATH STRANDING DIRECTOR''S CUT'),
 ('Resident Evil 1','Resident Evil'),
 ('Resident Evil 2 Remake','Resident Evil 2'),
 ('Resident Evil 3 Remake','Resident Evil 3'),
 ('Resident Evil 4 Remake','Resident Evil 4'),
 ('Astrobot Playroom','Astro''s Playroom'),
 ('Spider man 2','Marvel''s Spider-Man 2'),
 ('Ratchet & Clank','Ratchet & Clank: Rift Apart'),
 ('Resident Evil 9','Resident Evil Requiem'),
 ('God of War (2018)','God of War'),
 ('Ghost of Tsushima','Ghost of Tsushima DIRECTOR''S CUT'),
 ('Gta IV','Grand Theft Auto IV: The Complete Edition'),
 ('Bioshock','BioShock Remastered')
) AS v(antigo, novo)
WHERE public.jogos.nome = v.antigo;