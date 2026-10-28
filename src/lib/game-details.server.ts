import { createServerFn } from "@tanstack/react-start";
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
} from "psn-api";
import { getServerEnv, igdbQuery } from "./igdb.server";

export type PsnTrophyBreakdown = {
  platinum: { earned: number; total: number };
  gold: { earned: number; total: number };
  silver: { earned: number; total: number };
  bronze: { earned: number; total: number };
};

export type GameModalDetails = {
  timeToBeat: {
    mainHours: number | null;
    completionistHours: number | null;
  } | null;
  achievements: {
    platform: "Steam" | "PSN";
    unlocked: number;
    total: number;
    percentage: number;
    breakdown: PsnTrophyBreakdown | null;
  } | null;
};

type IgdbGameLookupRow = {
  id: number;
  name: string;
  version_parent?: number | null;
};

type IgdbTimeToBeatRow = {
  id: number;
  game_id: number;
  hastily?: number;
  normally?: number;
  completely?: number;
};

function secondsToHours(seconds?: number | null): number | null {
  if (!seconds || seconds <= 0) return null;
  const hours = seconds / 3600;
  if (hours >= 10) return Math.round(hours);
  return Math.max(0.5, Math.round(hours * 10) / 10);
}

function formatTimeRow(row: IgdbTimeToBeatRow): GameModalDetails["timeToBeat"] {
  // In IGDB game_time_to_beats:
  // - hastily = Main Story (campanha principal / zerar)
  // - normally = Main + Sides
  // - completely = Completionist (100% / platinar)
  const mainSec =
    row.normally && row.completely && row.normally > row.completely && row.hastily
      ? row.hastily
      : (row.normally ?? row.hastily);
  const compSec = row.completely;

  const mainHours = secondsToHours(mainSec);
  let completionistHours = secondsToHours(compSec);

  if (
    mainHours !== null &&
    completionistHours !== null &&
    completionistHours < mainHours
  ) {
    const hastilyHours = secondsToHours(row.hastily);
    if (hastilyHours !== null && hastilyHours <= completionistHours) {
      return { mainHours: hastilyHours, completionistHours };
    }
    completionistHours = mainHours;
  }

  return {
    mainHours,
    completionistHours,
  };
}

function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/grand theft auto/g, "gta")
    .replace(
      /\b(the|complete|edition|goty|remastered|director'?s\s*cut|full\s*burst|definitive)\b/g,
      "",
    )
    .replace(/\bviii\b/g, "8")
    .replace(/\bvii\b/g, "7")
    .replace(/\bvi\b/g, "6")
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

function extractIgdbCoverId(imagem?: string | null): string | null {
  if (!imagem) return null;
  const match = imagem.match(/\/t_[^/]+\/([a-z0-9_]+)\.(?:jpg|jpeg|png|webp)/i);
  return match?.[1] ?? null;
}

function stripEditionSuffixes(name: string): string {
  return name
    .replace(
      /\s*[-:–]?\s*\b(director'?s\s*cut|remastered|the\s+complete\s+edition|complete\s+edition|full\s*burst|definitive\s+edition|game\s+of\s+the\s+year\s+edition|goty)\b/gi,
      "",
    )
    .replace(/["\\]/g, " ")
    .trim();
}

const HLTB_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

let hltbTokenCache: { token: string; expiresAt: number } | null = null;

async function getHltbToken(forceRefresh = false): Promise<string | null> {
  if (!forceRefresh && hltbTokenCache && hltbTokenCache.expiresAt > Date.now()) {
    return hltbTokenCache.token;
  }
  try {
    const res = await fetch(
      `https://howlongtobeat.com/api/search/site/init?t=${Date.now()}`,
      {
        headers: {
          "User-Agent": HLTB_UA,
          Referer: "https://howlongtobeat.com/",
        },
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { token?: string };
    if (!json.token) return null;
    hltbTokenCache = {
      token: json.token,
      expiresAt: Date.now() + 5 * 60_000,
    };
    return json.token;
  } catch {
    return null;
  }
}

type HltbGameRow = {
  game_id: number;
  game_name: string;
  game_alias?: string;
  comp_main?: number;
  comp_plus?: number;
  comp_100?: number;
};

async function fetchTimeToBeatFromHltb(
  nome: string,
): Promise<GameModalDetails["timeToBeat"]> {
  const baseName = stripEditionSuffixes(nome);
  const queriesToTry = Array.from(new Set([nome.trim(), baseName.trim()])).filter(
    (q) => q.length >= 2,
  );

  for (const query of queriesToTry) {
    let token = await getHltbToken(false);
    if (!token) break;

    const searchTerms = query
      .replace(/[^a-zA-Z0-9\s']/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    if (searchTerms.length === 0) continue;

    const doRequest = async (tok: string) =>
      fetch("https://howlongtobeat.com/api/search/site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": HLTB_UA,
          Referer: "https://howlongtobeat.com/",
          Origin: "https://howlongtobeat.com",
          "x-auth-token": tok,
        },
        body: JSON.stringify({
          searchType: "games",
          searchTerms,
          searchPage: 1,
          size: 10,
          searchOptions: {
            games: {
              userId: 0,
              platform: "",
              sortCategory: "popular",
              rangeCategory: "main",
              rangeTime: { min: null, max: null },
              gameplay: {
                perspective: "",
                flow: "",
                genre: "",
                difficulty: "",
              },
              rangeYear: { min: "", max: "" },
              modifier: "",
            },
            users: { sortCategory: "postcount" },
            lists: { sortCategory: "follows" },
            filter: "",
            sort: 0,
            randomizer: 0,
          },
          useCache: true,
        }),
      });

    try {
      let res = await doRequest(token);
      if (res.status === 403 || res.status === 401) {
        token = await getHltbToken(true);
        if (token) res = await doRequest(token);
      }
      if (!res.ok) continue;

      const json = (await res.json()) as { data?: HltbGameRow[] };
      const rows = json.data ?? [];
      if (rows.length === 0) continue;

      const sorted = [...rows].sort((a, b) => {
        const aExact =
          normalizeGameName(a.game_name) === normalizeGameName(nome) ||
          normalizeGameName(a.game_name) === normalizeGameName(baseName)
            ? 1
            : 0;
        const bExact =
          normalizeGameName(b.game_name) === normalizeGameName(nome) ||
          normalizeGameName(b.game_name) === normalizeGameName(baseName)
            ? 1
            : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aMatch =
          matchesGameName(a.game_name, nome) ||
          (a.game_alias ? matchesGameName(a.game_alias, nome) : false)
            ? 1
            : 0;
        const bMatch =
          matchesGameName(b.game_name, nome) ||
          (b.game_alias ? matchesGameName(b.game_alias, nome) : false)
            ? 1
            : 0;
        return bMatch - aMatch;
      });

      const best = sorted.find(
        (r) =>
          (matchesGameName(r.game_name, nome) ||
            matchesGameName(r.game_name, baseName) ||
            (r.game_alias && matchesGameName(r.game_alias, nome))) &&
          ((r.comp_main && r.comp_main > 0) || (r.comp_100 && r.comp_100 > 0)),
      );

      if (best) {
        const mainHours = secondsToHours(best.comp_main || best.comp_plus);
        const completionistHours = secondsToHours(best.comp_100 || best.comp_plus);
        if (mainHours !== null || completionistHours !== null) {
          return { mainHours, completionistHours };
        }
      }
    } catch {
      // continue to next query or IGDB fallback
    }
  }

  return null;
}

async function fetchTimeToBeat(
  nome: string,
  imagem?: string | null,
): Promise<GameModalDetails["timeToBeat"]> {
  // 1. Primary: HowLongToBeat (most complete & accurate Main Story / Completionist data)
  const hltb = await fetchTimeToBeatFromHltb(nome);
  if (hltb && (hltb.mainHours !== null || hltb.completionistHours !== null)) {
    return hltb;
  }

  // 2. Fallback: IGDB game_time_to_beats
  return fetchTimeToBeatFromIgdb(nome, imagem);
}

async function fetchTimeToBeatFromIgdb(
  nome: string,
  imagem?: string | null,
): Promise<GameModalDetails["timeToBeat"]> {
  const candidateIds: number[] = [];
  const addId = (id?: number | null) => {
    if (id && !candidateIds.includes(id)) candidateIds.push(id);
  };

  // 1. Try exact lookup via IGDB cover image_id
  const coverId = extractIgdbCoverId(imagem);
  if (coverId) {
    const byCover = await igdbQuery<IgdbGameLookupRow>(
      "games",
      `fields id, name, version_parent; where cover.image_id = "${coverId}"; limit 5;`,
    );
    if (byCover && byCover.length > 0) {
      for (const row of byCover) {
        addId(row.id);
        addId(row.version_parent);
      }
    }
  }

  // Check if we already have time_to_beat for the cover-matched game IDs
  if (candidateIds.length > 0) {
    const ttbRows = await igdbQuery<IgdbTimeToBeatRow>(
      "game_time_to_beats",
      `fields game_id, hastily, normally, completely; where game_id = (${candidateIds.join(",")}); limit 10;`,
    );
    const completeHit = ttbRows?.find(
      (r) => Boolean(r.normally ?? r.hastily) && Boolean(r.completely),
    );
    const hit =
      completeHit ?? ttbRows?.find((r) => (r.normally ?? r.hastily) || r.completely);
    if (hit) {
      return formatTimeRow(hit);
    }
  }

  // 2. Fallback: search by base game name (handles remasters/editions where TTB is on the base game)
  const baseName = stripEditionSuffixes(nome);
  const escaped = baseName.replace(/"/g, "");
  if (escaped.length >= 2) {
    const byName = await igdbQuery<IgdbGameLookupRow>(
      "games",
      `search "${escaped}"; fields id, name, version_parent; where version_parent = null & game_type = (0, 8, 9, 10); limit 8;`,
    );
    if (byName && byName.length > 0) {
      // Sort so exact/closest normalized name matches come first
      const sorted = [...byName].sort((a, b) => {
        const aExact = normalizeGameName(a.name) === normalizeGameName(nome) ? 1 : 0;
        const bExact = normalizeGameName(b.name) === normalizeGameName(nome) ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const aMatch = matchesGameName(a.name, nome) ? 1 : 0;
        const bMatch = matchesGameName(b.name, nome) ? 1 : 0;
        return bMatch - aMatch;
      });
      for (const row of sorted) {
        addId(row.id);
        addId(row.version_parent);
      }
    }
  }

  if (candidateIds.length === 0) return null;

  const ttbRows = await igdbQuery<IgdbTimeToBeatRow>(
    "game_time_to_beats",
    `fields game_id, hastily, normally, completely; where game_id = (${candidateIds.slice(0, 10).join(",")}); limit 10;`,
  );

  if (!ttbRows || ttbRows.length === 0) return null;

  // First prefer a candidate that has BOTH main and completionist times
  for (const id of candidateIds) {
    const row = ttbRows.find(
      (r) =>
        r.game_id === id &&
        Boolean(r.normally ?? r.hastily) &&
        Boolean(r.completely),
    );
    if (row) {
      return formatTimeRow(row);
    }
  }

  // Otherwise pick the first candidate ID in priority order that has any time data
  for (const id of candidateIds) {
    const row = ttbRows.find(
      (r) => r.game_id === id && ((r.normally ?? r.hastily) || r.completely),
    );
    if (row) {
      return formatTimeRow(row);
    }
  }

  return null;
}

// Short-lived in-memory caches to avoid redundant API calls when opening multiple modals
let psnTitlesCache: { expiresAt: number; titles: any[] } | null = null;
let steamOwnedCache: { expiresAt: number; games: Array<{ appid: number; name?: string }> } | null =
  null;

async function fetchPsnGameAchievements(
  nome: string,
): Promise<GameModalDetails["achievements"]> {
  const npsso = getServerEnv("PSN_NPSSO");
  if (!npsso) return null;

  try {
    let titles: any[] = [];
    if (psnTitlesCache && psnTitlesCache.expiresAt > Date.now()) {
      titles = psnTitlesCache.titles;
    } else {
      const accessCode = await exchangeNpssoForAccessCode(npsso);
      const authorization = await exchangeAccessCodeForAuthTokens(accessCode);
      const titlesResponse = await getUserTitles(
        { accessToken: authorization.accessToken },
        "me",
        { limit: 800 },
      );
      titles = titlesResponse?.trophyTitles || [];
      psnTitlesCache = {
        expiresAt: Date.now() + 2 * 60_000,
        titles,
      };
    }

    const candidates = titles.filter(
      (t) => t.trophyTitleName && matchesGameName(nome, t.trophyTitleName),
    );
    if (candidates.length === 0) return null;

    // Prefer exact normalized match, then highest progress
    candidates.sort((a, b) => {
      const aExact =
        normalizeGameName(a.trophyTitleName) === normalizeGameName(nome) ? 1 : 0;
      const bExact =
        normalizeGameName(b.trophyTitleName) === normalizeGameName(nome) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return (b.progress ?? 0) - (a.progress ?? 0);
    });

    const match = candidates[0];
    const defined = match.definedTrophies || {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    };
    const earned = match.earnedTrophies || {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0,
    };

    const breakdown: PsnTrophyBreakdown = {
      platinum: { earned: earned.platinum ?? 0, total: defined.platinum ?? 0 },
      gold: { earned: earned.gold ?? 0, total: defined.gold ?? 0 },
      silver: { earned: earned.silver ?? 0, total: defined.silver ?? 0 },
      bronze: { earned: earned.bronze ?? 0, total: defined.bronze ?? 0 },
    };

    const unlocked =
      breakdown.platinum.earned +
      breakdown.gold.earned +
      breakdown.silver.earned +
      breakdown.bronze.earned;
    const total =
      breakdown.platinum.total +
      breakdown.gold.total +
      breakdown.silver.total +
      breakdown.bronze.total;

    if (total === 0) return null;

    const percentage = Math.min(100, Math.round((unlocked / total) * 100));

    return {
      platform: "PSN",
      unlocked,
      total,
      percentage,
      breakdown,
    };
  } catch {
    return null;
  }
}

async function fetchSteamGameAchievements(
  nome: string,
): Promise<GameModalDetails["achievements"]> {
  const apiKey = getServerEnv("STEAM_API_KEY");
  const steamId = getServerEnv("STEAM_ID");
  if (!apiKey || !steamId) return null;

  try {
    let steamGames: Array<{ appid: number; name?: string }> = [];
    if (steamOwnedCache && steamOwnedCache.expiresAt > Date.now()) {
      steamGames = steamOwnedCache.games;
    } else {
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
      const ownedRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}&input_json=${inputJson}`,
      );
      if (ownedRes.ok) {
        const ownedData = await ownedRes.json();
        steamGames = ownedData?.response?.games || [];
        steamOwnedCache = {
          expiresAt: Date.now() + 2 * 60_000,
          games: steamGames,
        };
      }
    }

    let appid = steamGames.find(
      (sg) => sg.name && matchesGameName(nome, sg.name),
    )?.appid;

    if (!appid) {
      const searchRes = await fetch(
        `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(nome)}&l=english&cc=US`,
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const items: Array<{ id?: number; name?: string }> = searchData?.items || [];
        const matchedItem =
          items.find((it) => it.name && matchesGameName(nome, it.name)) ?? items[0];
        appid = matchedItem?.id;
      }
    }

    if (!appid) return null;

    const achRes = await fetch(
      `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${encodeURIComponent(apiKey)}&steamid=${encodeURIComponent(steamId)}`,
    );

    if (!achRes.ok) return null;

    const achData = await achRes.json();
    const achievements: Array<{ achieved?: number }> =
      achData?.playerstats?.achievements || [];

    if (achievements.length === 0) return null;

    const total = achievements.length;
    const unlocked = achievements.filter((a) => a.achieved === 1).length;
    const percentage = Math.min(100, Math.round((unlocked / total) * 100));

    return {
      platform: "Steam",
      unlocked,
      total,
      percentage,
      breakdown: null,
    };
  } catch {
    return null;
  }
}

export const getGameModalDetails = createServerFn({ method: "GET" })
  .validator(
    (input: {
      nome: string;
      imagem?: string | null;
      plataforma?: string | null;
      includeAchievements?: boolean;
      needTimeToBeat?: boolean;
    }) => ({
      nome: String(input?.nome ?? "").slice(0, 150),
      imagem: input?.imagem ? String(input.imagem).slice(0, 300) : null,
      plataforma: input?.plataforma ? String(input.plataforma).slice(0, 30) : null,
      includeAchievements: Boolean(input?.includeAchievements),
      needTimeToBeat: input?.needTimeToBeat !== false,
    }),
  )
  .handler(async ({ data }): Promise<GameModalDetails> => {
    const nome = data.nome.trim();
    if (!nome) {
      return { timeToBeat: null, achievements: null };
    }

    const timePromise = data.needTimeToBeat
      ? fetchTimeToBeat(nome, data.imagem)
      : Promise.resolve(null);

    let achievementsPromise: Promise<GameModalDetails["achievements"]> =
      Promise.resolve(null);

    if (data.includeAchievements) {
      if (data.plataforma === "PSN") {
        achievementsPromise = fetchPsnGameAchievements(nome);
      } else if (data.plataforma === "Steam") {
        achievementsPromise = fetchSteamGameAchievements(nome);
      }
    }

    const [timeRes, achRes] = await Promise.allSettled([
      timePromise,
      achievementsPromise,
    ]);

    return {
      timeToBeat: timeRes.status === "fulfilled" ? timeRes.value : null,
      achievements: achRes.status === "fulfilled" ? achRes.value : null,
    };
  });

export type BackfillGameInput = {
  id: string;
  nome: string;
  imagem: string | null;
  plataforma: string | null;
  status: string;
  needTime: boolean;
  needAchievements: boolean;
};

export type BackfillGameResult = {
  id: string;
  tempo_zerar?: number | null;
  tempo_platinar?: number | null;
  trofeus_obtidos?: number | null;
  trofeus_totais?: number | null;
  trofeus_psn?: PsnTrophyBreakdown | null;
};

export const backfillGamesDetails = createServerFn({ method: "POST" })
  .validator((input: { games: BackfillGameInput[] }) => ({
    games: Array.isArray(input?.games) ? input.games.slice(0, 100) : [],
  }))
  .handler(async ({ data }): Promise<BackfillGameResult[]> => {
    const results = await Promise.all(
      data.games.map(async (g): Promise<BackfillGameResult | null> => {
        const nome = String(g.nome ?? "").trim();
        if (!nome) return null;

        const entry: BackfillGameResult = { id: g.id };
        let hasChange = false;

        const [ttb, ach] = await Promise.all([
          g.needTime ? fetchTimeToBeat(nome, g.imagem) : Promise.resolve(null),
          g.needAchievements
            ? g.plataforma === "PSN"
              ? fetchPsnGameAchievements(nome)
              : g.plataforma === "Steam"
                ? fetchSteamGameAchievements(nome)
                : Promise.resolve(null)
            : Promise.resolve(null),
        ]);

        if (ttb && (ttb.mainHours !== null || ttb.completionistHours !== null)) {
          entry.tempo_zerar = ttb.mainHours;
          entry.tempo_platinar = ttb.completionistHours;
          hasChange = true;
        }

        if (ach) {
          entry.trofeus_obtidos = ach.unlocked;
          entry.trofeus_totais = ach.total;
          entry.trofeus_psn = ach.breakdown ?? null;
          hasChange = true;
        }

        return hasChange ? entry : null;
      }),
    );

    return results.filter((r): r is BackfillGameResult => r !== null);
  });
