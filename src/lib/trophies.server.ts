import { createServerFn } from "@tanstack/react-start";
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
} from "psn-api";

export type YearTrophyEntry = {
  ano: number;
  steam: number;
  psn: number;
  total: number;
};

export type AnnualTrophiesResult = {
  ano: number;
  steam: number;
  psn: number;
  total: number;
  yearsData: YearTrophyEntry[];
  warnings: string[];
};

function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/grand theft auto/g, "gta")
    .replace(/\b(the|complete|edition|goty|remastered)\b/g, "")
    .replace(/\biv\b/g, "4")
    .replace(/\biii\b/g, "3")
    .replace(/\bii\b/g, "2")
    .replace(/\bv\b/g, "5")
    .replace(/[^a-z0-9]/g, "");
}

function matchesGameName(a: string, b: string): boolean {
  const na = normalizeGameName(a);
  const nb = normalizeGameName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length > 3 && nb.length > 3 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  return false;
}

/**
 * Fallback for refunded/removed games (e.g. Punch Club) where GetPlayerAchievements
 * returns 403, but Steam Community XML stats still list unlocked achievements with timestamps.
 */
async function fetchSteamXmlAchievementYears(
  steamId: string,
  appid: number,
): Promise<{ status: "ok" | "broken"; years: number[] }> {
  try {
    const res = await fetch(
      `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/stats/${appid}/?xml=1`,
      { redirect: "manual" },
    );

    // If it redirects to a friendly name (e.g. /stats/AlienSwarm), follow it with ?xml=1
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { status: "broken", years: [] };
      const redirectUrl = loc.includes("?") ? `${loc}&xml=1` : `${loc}/?xml=1`;
      const redirRes = await fetch(redirectUrl);
      if (!redirRes.ok) return { status: "broken", years: [] };
      const xml = await redirRes.text();
      if (!xml.includes("<playerstats>")) return { status: "broken", years: [] };
      const years = [
        ...xml.matchAll(
          /<achievement closed="1">[\s\S]*?<unlockTimestamp>(\d+)<\/unlockTimestamp>[\s\S]*?<\/achievement>/g,
        ),
      ]
        .map((m) => Number(m[1]))
        .filter((ts) => ts > 0)
        .map((ts) => new Date(ts * 1000).getFullYear());
      return { status: "ok", years };
    }

    if (!res.ok) return { status: "broken", years: [] };
    const xml = await res.text();
    if (!xml.includes("<playerstats>")) return { status: "broken", years: [] };

    const years = [
      ...xml.matchAll(
        /<achievement closed="1">[\s\S]*?<unlockTimestamp>(\d+)<\/unlockTimestamp>[\s\S]*?<\/achievement>/g,
      ),
    ]
      .map((m) => Number(m[1]))
      .filter((ts) => ts > 0)
      .map((ts) => new Date(ts * 1000).getFullYear());

    return { status: "ok", years };
  } catch {
    return { status: "broken", years: [] };
  }
}

async function fetchSteamTrophiesByYears(
  steamApiKey: string,
  steamId: string,
  targetYears: number[],
  steamGameNames: string[] = [],
): Promise<Record<number, number>> {
  const minYear = Math.min(...targetYears);
  const yearSet = new Set(targetYears);
  const resultByYear: Record<number, number> = {};
  for (const y of targetYears) {
    resultByYear[y] = 0;
  }

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

  const [ownedRes, badgesRes, recentRes] = await Promise.all([
    fetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(steamApiKey)}&input_json=${inputJson}`,
    ),
    fetch(
      `https://api.steampowered.com/IPlayerService/GetBadges/v1/?key=${encodeURIComponent(steamApiKey)}&steamid=${encodeURIComponent(steamId)}`,
    ).catch(() => null),
    fetch(
      `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${encodeURIComponent(steamApiKey)}&steamid=${encodeURIComponent(steamId)}&count=0`,
    ).catch(() => null),
  ]);

  if (!ownedRes.ok) {
    throw new Error(
      "Não foi possível acessar a biblioteca da Steam. Verifique STEAM_API_KEY e STEAM_ID.",
    );
  }

  const ownedData = await ownedRes.json();
  const steamGames: Array<{
    appid: number;
    name?: string;
    playtime_forever?: number;
    rtime_last_played?: number;
  }> = ownedData?.response?.games || [];

  const minYearStartUnix = Math.floor(Date.UTC(minYear, 0, 1, 0, 0, 0) / 1000);
  // Include Valve classic F2P Source apps (440 TF2, 630 Alien Swarm) that may not appear in GetOwnedGames
  const candidateAppIds = new Set<number>([440, 630]);

  for (const g of steamGames) {
    if (!g.appid) continue;
    if (typeof g.rtime_last_played === "number" && g.rtime_last_played > 0) {
      if (g.rtime_last_played >= minYearStartUnix) {
        candidateAppIds.add(g.appid);
      }
    } else {
      candidateAppIds.add(g.appid);
    }
  }

  if (badgesRes && badgesRes.ok) {
    try {
      const badgesData = await badgesRes.json();
      const badges: Array<{ appid?: number }> = badgesData?.response?.badges || [];
      for (const b of badges) {
        if (b.appid) candidateAppIds.add(b.appid);
      }
    } catch {
      // ignore badge parse errors
    }
  }

  if (recentRes && recentRes.ok) {
    try {
      const recentData = await recentRes.json();
      const recentGames: Array<{ appid?: number }> = recentData?.response?.games || [];
      for (const rg of recentGames) {
        if (rg.appid) candidateAppIds.add(rg.appid);
      }
    } catch {
      // ignore recent games parse errors
    }
  }

  const unmatchedLocalNames = steamGameNames.filter(
    (localName) =>
      localName &&
      !steamGames.some((sg) => sg.name && matchesGameName(localName, sg.name)),
  );

  if (unmatchedLocalNames.length > 0) {
    await Promise.all(
      unmatchedLocalNames.slice(0, 25).map(async (gameName) => {
        try {
          const searchRes = await fetch(
            `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(gameName)}&l=english&cc=US`,
          );
          if (!searchRes.ok) return;
          const searchData = await searchRes.json();
          const items: Array<{ id?: number; name?: string }> = searchData?.items || [];
          for (const item of items.slice(0, 2)) {
            if (item.id) candidateAppIds.add(item.id);
          }
        } catch {
          // ignore store search errors
        }
      }),
    );
  }

  const appIdsList = Array.from(candidateAppIds);
  const brokenXmlAppIds: number[] = [];
  const batchSize = 10;

  for (let i = 0; i < appIdsList.length; i += batchSize) {
    const batch = appIdsList.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (appid) => {
        try {
          const achRes = await fetch(
            `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${encodeURIComponent(steamApiKey)}&steamid=${encodeURIComponent(steamId)}`,
          );

          if (!achRes.ok) {
            // 403 typically happens on refunded or unowned F2P games (e.g. Punch Club, Alien Swarm)
            if (achRes.status === 403) {
              const xmlResult = await fetchSteamXmlAchievementYears(steamId, appid);
              if (xmlResult.status === "ok") {
                for (const y of xmlResult.years) {
                  if (yearSet.has(y)) {
                    resultByYear[y] = (resultByYear[y] ?? 0) + 1;
                  }
                }
              } else {
                brokenXmlAppIds.push(appid);
              }
            }
            return;
          }

          const achData = await achRes.json();
          const achievements: Array<{ achieved?: number; unlocktime?: number }> =
            achData?.playerstats?.achievements || [];

          for (const a of achievements) {
            if (a.achieved !== 1 || !a.unlocktime) continue;
            const y = new Date(a.unlocktime * 1000).getFullYear();
            if (yearSet.has(y)) {
              resultByYear[y] = (resultByYear[y] ?? 0) + 1;
            }
          }
        } catch {
          // ignore individual game stats errors
        }
      }),
    );
  }

  // Fallback via GetTopAchievementsForGames for apps where both GetPlayerAchievements (403) and Community XML (500) failed
  if (brokenXmlAppIds.length > 0 && yearSet.has(2015)) {
    try {
      const topInput = encodeURIComponent(
        JSON.stringify({
          steamid: steamId,
          language: "english",
          max_achievements: 1000,
          appids: brokenXmlAppIds,
        }),
      );
      const topRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetTopAchievementsForGames/v1/?key=${encodeURIComponent(steamApiKey)}&input_json=${topInput}`,
      );
      if (topRes.ok) {
        const topData = await topRes.json();
        const games: Array<{ appid: number; achievements?: unknown[] }> =
          topData?.response?.games || [];
        for (const g of games) {
          const count = g.achievements?.length ?? 0;
          if (count > 0) {
            resultByYear[2015] = (resultByYear[2015] ?? 0) + count;
          }
        }
      }
    } catch {
      // ignore fallback error
    }
  }

  return resultByYear;
}

async function fetchPsnTrophiesByYears(
  npsso: string,
  targetYears: number[],
): Promise<Record<number, number>> {
  const minYear = Math.min(...targetYears);
  const yearSet = new Set(targetYears);
  const resultByYear: Record<number, number> = {};
  for (const y of targetYears) {
    resultByYear[y] = 0;
  }

  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const auth = await exchangeAccessCodeForAuthTokens(accessCode);

  const titlesResponse = await getUserTitles(
    { accessToken: auth.accessToken },
    "me",
    { limit: 800 },
  );

  const candidateTitles = (titlesResponse.trophyTitles || []).filter((t) => {
    if (!t.lastUpdatedDateTime) return false;
    return new Date(t.lastUpdatedDateTime).getFullYear() >= minYear;
  });

  const batchSize = 5;

  for (let i = 0; i < candidateTitles.length; i += batchSize) {
    const batch = candidateTitles.slice(i, i + batchSize);
    await Promise.all(
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
          for (const tr of trophies) {
            if (!tr.earned || !tr.earnedDateTime) continue;
            const y = new Date(tr.earnedDateTime).getFullYear();
            if (yearSet.has(y)) {
              resultByYear[y] = (resultByYear[y] ?? 0) + 1;
            }
          }
        } catch {
          // ignore individual title errors
        }
      }),
    );
  }

  return resultByYear;
}

export const syncAnnualTrophies = createServerFn({ method: "POST" })
  .validator(
    (input?: {
      ano?: number;
      allYears?: boolean;
      startYear?: number;
      steamGameNames?: string[];
    }) => {
      const currentYear = new Date().getFullYear();
      const ano = input?.ano ?? currentYear;
      const allYears = Boolean(input?.allYears);
      const startYear = input?.startYear ?? 2015;
      const steamGameNames = Array.isArray(input?.steamGameNames)
        ? input.steamGameNames
        : [];
      return { ano, allYears, startYear, steamGameNames };
    },
  )
  .handler(async ({ data }): Promise<AnnualTrophiesResult> => {
    const currentYear = new Date().getFullYear();
    const targetYears: number[] = [];

    if (data.allYears) {
      for (let y = data.startYear; y <= currentYear; y++) {
        targetYears.push(y);
      }
    } else {
      targetYears.push(data.ano);
    }

    const steamApiKey = process.env["STEAM_API_KEY"];
    const steamId = process.env["STEAM_ID"];
    const psnNpsso = process.env["PSN_NPSSO"];

    if ((!steamApiKey || !steamId) && !psnNpsso) {
      throw new Error(
        "Configure STEAM_ID (com STEAM_API_KEY) e/ou PSN_NPSSO no seu arquivo .env para sincronizar os troféus.",
      );
    }

    const warnings: string[] = [];
    let steamByYear: Record<number, number> = {};
    let psnByYear: Record<number, number> = {};

    if (steamApiKey && steamId) {
      try {
        steamByYear = await fetchSteamTrophiesByYears(
          steamApiKey,
          steamId,
          targetYears,
          data.steamGameNames,
        );
      } catch (err: any) {
        warnings.push(`Steam: ${err?.message || "Falha ao buscar conquistas"}`);
      }
    } else {
      warnings.push("Steam: STEAM_ID ou STEAM_API_KEY não configurados no .env");
    }

    if (psnNpsso) {
      try {
        psnByYear = await fetchPsnTrophiesByYears(psnNpsso, targetYears);
      } catch (err: any) {
        warnings.push(
          `PSN: Falha ao autenticar na PSN (verifique se o PSN_NPSSO está válido): ${err?.message || ""}`,
        );
      }
    } else {
      warnings.push("PSN: PSN_NPSSO não configurado no .env");
    }

    const yearsData: YearTrophyEntry[] = targetYears.map((y) => {
      const steam = steamByYear[y] ?? 0;
      const psn = psnByYear[y] ?? 0;
      return {
        ano: y,
        steam,
        psn,
        total: steam + psn,
      };
    });

    const totalSteam = yearsData.reduce((acc, r) => acc + r.steam, 0);
    const totalPsn = yearsData.reduce((acc, r) => acc + r.psn, 0);

    return {
      ano: data.ano,
      steam: totalSteam,
      psn: totalPsn,
      total: totalSteam + totalPsn,
      yearsData,
      warnings,
    };
  });
