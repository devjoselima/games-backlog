import { createServerFn } from "@tanstack/react-start";

function normalizeName(name: string): string {
  let n = name.toLowerCase();
  n = n.replace(/grand theft auto/g, 'gta');
  n = n.replace(/\bthe\b/g, '');
  n = n.replace(/\bcomplete\b/g, '');
  n = n.replace(/\bedition\b/g, '');
  n = n.replace(/\bgoty\b/g, '');
  n = n.replace(/\biv\b/g, '4');
  n = n.replace(/\biii\b/g, '3');
  n = n.replace(/\bii\b/g, '2');
  n = n.replace(/\bv\b/g, '5');
  n = n.replace(/\bvi\b/g, '6');
  return n.replace(/[^a-z0-9]/g, '');
}

function fuzzyMatch(localName: string, steamName: string): boolean {
  const normLocal = normalizeName(localName);
  const normSteam = normalizeName(steamName);
  if (normLocal === normSteam) return true;
  if (normSteam.includes(normLocal) && normLocal.length > 3) return true;
  if (normLocal.includes(normSteam) && normSteam.length > 3) return true;
  return false;
}

export type SyncResult = {
  id: string;
  horas_jogadas?: number;
  status?: string;
  steamName?: string;
};

export const syncSteamLibrary = createServerFn({ method: "POST" })
  .validator((input: { steamId: string; localGames: { id: string; nome: string; status: string; horas_jogadas: number | null }[] }) => input)
  .handler(async ({ data }): Promise<SyncResult[]> => {
    const { steamId, localGames } = data;
    const apiKey = process.env["STEAM_API_KEY"];
    if (!apiKey) throw new Error("STEAM_API_KEY não configurada no servidor.");

    const inputJson = encodeURIComponent(
      JSON.stringify({
        steamid: steamId,
        include_appinfo: true,
        include_played_free_games: true,
        include_free_sub: true,
        include_family_licenses: true,
        include_all_free_games: true,
        skip_unvetted_apps: false,
      }),
    );
    const ownedGamesRes = await fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}&input_json=${inputJson}`
    );
    
    if (!ownedGamesRes.ok) {
      throw new Error("Não foi possível acessar a biblioteca da Steam. Verifique se o Steam ID está correto e o perfil é Público.");
    }

    const ownedData = await ownedGamesRes.json();
    const steamGames = ownedData?.response?.games || [];
    if (steamGames.length === 0) return [];

    const updates: SyncResult[] = [];

    for (const localGame of localGames) {
      const match = steamGames.find((sg: any) => fuzzyMatch(localGame.nome, sg.name));
      if (!match) continue;

      const horasJogadas = Math.floor(match.playtime_forever / 60);
      let novoStatus = localGame.status;

      if (novoStatus !== "Platinado") {
        try {
          const achRes = await fetch(
            `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${match.appid}&key=${apiKey}&steamid=${steamId}`
          );
          if (achRes.ok) {
            const achData = await achRes.json();
            const achievements = achData?.playerstats?.achievements || [];
            if (achievements.length > 0) {
              const unlocked = achievements.filter((a: any) => a.achieved === 1).length;
              if (unlocked === achievements.length) {
                novoStatus = "Platinado";
              }
            }
          }
        } catch (e) {
        }
      }

      // Skip if nothing changed
      if (horasJogadas === localGame.horas_jogadas && novoStatus === localGame.status) {
        continue;
      }

      updates.push({
        id: localGame.id,
        horas_jogadas: horasJogadas,
        status: novoStatus,
        steamName: match.name,
      });
    }

    return updates;
  });
