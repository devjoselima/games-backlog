import { createServerFn } from "@tanstack/react-start";
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
} from "psn-api";

export type AnnualTrophiesResult = {
  ano: number;
  steam: number;
  psn: number;
  total: number;
  warnings: string[];
};

async function fetchSteamAnnualTrophies(
  steamApiKey: string,
  steamId: string,
  year: number,
): Promise<number> {
  const ownedRes = await fetch(
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(steamApiKey)}&steamid=${encodeURIComponent(steamId)}&include_appinfo=1&include_played_free_games=1`,
  );

  if (!ownedRes.ok) {
    throw new Error(
      "Não foi possível acessar a biblioteca da Steam. Verifique STEAM_API_KEY e STEAM_ID.",
    );
  }

  const ownedData = await ownedRes.json();
  const steamGames: Array<{
    appid: number;
    playtime_forever?: number;
    rtime_last_played?: number;
  }> = ownedData?.response?.games || [];

  const yearStartUnix = Math.floor(Date.UTC(year, 0, 1, 0, 0, 0) / 1000);

  const candidateGames = steamGames.filter((g) => {
    if (typeof g.rtime_last_played === "number" && g.rtime_last_played > 0) {
      return g.rtime_last_played >= yearStartUnix;
    }
    return (g.playtime_forever ?? 0) > 0;
  });

  let steamTrophies = 0;
  const batchSize = 6;

  for (let i = 0; i < candidateGames.length; i += batchSize) {
    const batch = candidateGames.slice(i, i + batchSize);
    const counts = await Promise.all(
      batch.map(async (g) => {
        try {
          const achRes = await fetch(
            `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${g.appid}&key=${encodeURIComponent(steamApiKey)}&steamid=${encodeURIComponent(steamId)}`,
          );
          if (!achRes.ok) return 0;
          const achData = await achRes.json();
          const achievements: Array<{ achieved?: number; unlocktime?: number }> =
            achData?.playerstats?.achievements || [];
          return achievements.filter((a) => {
            if (a.achieved !== 1 || !a.unlocktime) return false;
            return new Date(a.unlocktime * 1000).getFullYear() === year;
          }).length;
        } catch {
          return 0;
        }
      }),
    );
    steamTrophies += counts.reduce((acc, c) => acc + c, 0);
  }

  return steamTrophies;
}

async function fetchPsnAnnualTrophies(npsso: string, year: number): Promise<number> {
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const auth = await exchangeAccessCodeForAuthTokens(accessCode);

  const titlesResponse = await getUserTitles(
    { accessToken: auth.accessToken },
    "me",
    { limit: 800 },
  );

  const candidateTitles = (titlesResponse.trophyTitles || []).filter((t) => {
    if (!t.lastUpdatedDateTime) return false;
    return new Date(t.lastUpdatedDateTime).getFullYear() >= year;
  });

  let psnTrophies = 0;
  const batchSize = 5;

  for (let i = 0; i < candidateTitles.length; i += batchSize) {
    const batch = candidateTitles.slice(i, i + batchSize);
    const counts = await Promise.all(
      batch.map(async (title) => {
        try {
          const earnedRes = await getUserTrophiesEarnedForTitle(
            { accessToken: auth.accessToken },
            "me",
            title.npCommunicationId,
            "all",
            {
              npServiceName: title.npServiceName === "trophy" ? "trophy" : undefined,
              limit: 500,
            },
          );
          const trophies = earnedRes.trophies || [];
          return trophies.filter((tr) => {
            if (!tr.earned || !tr.earnedDateTime) return false;
            return new Date(tr.earnedDateTime).getFullYear() === year;
          }).length;
        } catch {
          return 0;
        }
      }),
    );
    psnTrophies += counts.reduce((acc, c) => acc + c, 0);
  }

  return psnTrophies;
}

export const syncAnnualTrophies = createServerFn({ method: "POST" })
  .validator((input?: { ano?: number }) => ({
    ano: input?.ano ?? new Date().getFullYear(),
  }))
  .handler(async ({ data }): Promise<AnnualTrophiesResult> => {
    const year = data.ano;
    const steamApiKey = process.env["STEAM_API_KEY"];
    const steamId = process.env["STEAM_ID"];
    const psnNpsso = process.env["PSN_NPSSO"];

    if ((!steamApiKey || !steamId) && !psnNpsso) {
      throw new Error(
        "Configure STEAM_ID (com STEAM_API_KEY) e/ou PSN_NPSSO no seu arquivo .env para sincronizar os troféus.",
      );
    }

    const warnings: string[] = [];
    let steamCount = 0;
    let psnCount = 0;

    if (steamApiKey && steamId) {
      try {
        steamCount = await fetchSteamAnnualTrophies(steamApiKey, steamId, year);
      } catch (err: any) {
        warnings.push(`Steam: ${err?.message || "Falha ao buscar conquistas"}`);
      }
    } else {
      warnings.push("Steam: STEAM_ID ou STEAM_API_KEY não configurados no .env");
    }

    if (psnNpsso) {
      try {
        psnCount = await fetchPsnAnnualTrophies(psnNpsso, year);
      } catch (err: any) {
        warnings.push(
          `PSN: Falha ao autenticar na PSN (verifique se o PSN_NPSSO está válido): ${err?.message || ""}`,
        );
      }
    } else {
      warnings.push("PSN: PSN_NPSSO não configurado no .env");
    }

    return {
      ano: year,
      steam: steamCount,
      psn: psnCount,
      total: steamCount + psnCount,
      warnings,
    };
  });
