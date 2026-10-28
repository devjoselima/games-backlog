import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PsnTrophyBreakdown } from "./game-details.server";

export type { PsnTrophyBreakdown };

export type Game = {
  id: string;
  nome: string;
  genero: string | null;
  plataforma: string | null;
  status: string;
  ano_jogado: number | null;
  data_zerado: string | null;
  data_platinado: string | null;
  nota: number | null;
  horas_jogadas: number | null;
  ordem: number | null;
  created_at: string;
  imagem: string | null;
  tempo_zerar: number | null;
  tempo_platinar: number | null;
  trofeus_obtidos: number | null;
  trofeus_totais: number | null;
  trofeus_psn: PsnTrophyBreakdown | null;
};

const LOCAL_DETAILS_CACHE_KEY = "games_details_cache_v2_hltb";

type CachedGameDetails = {
  tempo_zerar?: number | null;
  tempo_platinar?: number | null;
  trofeus_obtidos?: number | null;
  trofeus_totais?: number | null;
  trofeus_psn?: PsnTrophyBreakdown | null;
};

function readLocalDetailsCache(): Record<string, CachedGameDetails> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_DETAILS_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeLocalDetailsCache(gameId: string, patch: CachedGameDetails) {
  if (typeof window === "undefined") return;
  try {
    const current = readLocalDetailsCache();
    current[gameId] = { ...(current[gameId] || {}), ...patch };
    window.localStorage.setItem(LOCAL_DETAILS_CACHE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage quota errors
  }
}

function mergeWithLocalDetails(rows: any[]): Game[] {
  const cache = readLocalDetailsCache();
  return rows.map((g: any) => {
    const local = cache[g.id];
    return {
      ...g,
      data_platinado: g.data_platinado ?? null,
      tempo_zerar: g.tempo_zerar ?? local?.tempo_zerar ?? null,
      tempo_platinar: g.tempo_platinar ?? local?.tempo_platinar ?? null,
      trofeus_obtidos: g.trofeus_obtidos ?? local?.trofeus_obtidos ?? null,
      trofeus_totais: g.trofeus_totais ?? local?.trofeus_totais ?? null,
      trofeus_psn: g.trofeus_psn ?? local?.trofeus_psn ?? null,
    } as Game;
  });
}

export async function saveGameDetailsToDb(
  gameId: string,
  patch: CachedGameDetails,
): Promise<void> {
  writeLocalDetailsCache(gameId, patch);
  const { error } = await supabase
    .from("jogos")
    .update(patch as any)
    .eq("id", gameId);
  if (error) {
    // Column might not be migrated on remote DB yet; local cache already holds the data
  }
}

export const STATUS_OPTIONS = ["Zerado", "Platinado", "Jogando", "Quero jogar"] as const;
export const PLATFORM_OPTIONS = ["PSN", "Steam", "Xbox", "Nintendo", "Epic", "Outra"] as const;
export const GENERO_OPCOES = [
  "Ação",
  "Aventura",
  "Puzzle",
  "Casual",
  "Terror",
  "Survival Horror",
  "Soulslike",
  "FPS",
  "RPG",
  "Plataforma 2D",
  "Corrida",
  "Outros",
] as const;

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("jogos")
    .select(
      "id, nome, genero, plataforma, status, ano_jogado, data_zerado, data_platinado, nota, horas_jogadas, ordem, created_at, imagem, tempo_zerar, tempo_platinar, trofeus_obtidos, trofeus_totais, trofeus_psn",
    )
    .order("data_zerado", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (
      error.message?.includes("tempo_zerar") ||
      error.message?.includes("trofeus_") ||
      error.message?.includes("data_platinado") ||
      (error as any).code === "42703"
    ) {
      const fallbackWithPlatinum = await supabase
        .from("jogos")
        .select(
          "id, nome, genero, plataforma, status, ano_jogado, data_zerado, data_platinado, nota, horas_jogadas, ordem, created_at, imagem",
        )
        .order("data_zerado", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!fallbackWithPlatinum.error) {
        return mergeWithLocalDetails(fallbackWithPlatinum.data ?? []);
      }

      const fallback = await supabase
        .from("jogos")
        .select(
          "id, nome, genero, plataforma, status, ano_jogado, data_zerado, nota, horas_jogadas, ordem, created_at, imagem",
        )
        .order("data_zerado", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      return mergeWithLocalDetails(fallback.data ?? []);
    }
    throw error;
  }
  return mergeWithLocalDetails(data ?? []);
}

export const gamesQuery = queryOptions({
  queryKey: ["games"],
  queryFn: fetchGames,
});

export function formatRating(nota: number | null) {
  if (nota === null || nota === undefined) return "—";
  return nota.toFixed(1).replace(".", ",").replace(",0", "");
}

export const isCompletedStatus = (s: string) => s === "Zerado" || s === "Platinado";

export type AnnualTrophies = {
  ano: number;
  total: number;
  steam: number;
  psn: number;
  updated_at?: string;
};

export async function fetchAnnualTrophies(ano: number): Promise<AnnualTrophies | null> {
  const { data: sessionData } = await supabase.auth.getUser();
  const uid = sessionData.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from("trofeus_anuais")
    .select("ano, total, steam, psn, updated_at")
    .eq("user_id", uid)
    .eq("ano", ano)
    .maybeSingle();

  if (error) {
    const fallbackMeta = sessionData.user?.user_metadata?.[`trofeus_${ano}`];
    if (fallbackMeta) return fallbackMeta as AnnualTrophies;
    return null;
  }

  if (data) return data as AnnualTrophies;

  const fallbackMeta = sessionData.user?.user_metadata?.[`trofeus_${ano}`];
  return (fallbackMeta as AnnualTrophies) ?? null;
}

export const annualTrophiesQuery = (ano: number) =>
  queryOptions({
    queryKey: ["annual-trophies", ano],
    queryFn: () => fetchAnnualTrophies(ano),
  });

export async function fetchAllAnnualTrophies(): Promise<AnnualTrophies[]> {
  const { data: sessionData } = await supabase.auth.getUser();
  const uid = sessionData.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("trofeus_anuais")
    .select("ano, total, steam, psn, updated_at")
    .eq("user_id", uid)
    .order("ano", { ascending: false });

  if (error || !data) return [];
  return data as AnnualTrophies[];
}

export const allAnnualTrophiesQuery = queryOptions({
  queryKey: ["annual-trophies", "all"],
  queryFn: fetchAllAnnualTrophies,
});
