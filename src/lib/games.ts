import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
};

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
    .select("id, nome, genero, plataforma, status, ano_jogado, data_zerado, data_platinado, nota, horas_jogadas, ordem, created_at, imagem")
    .order("data_zerado", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) {
    if (error.message?.includes("data_platinado") || (error as any).code === "42703") {
      const fallback = await supabase
        .from("jogos")
        .select("id, nome, genero, plataforma, status, ano_jogado, data_zerado, nota, horas_jogadas, ordem, created_at, imagem")
        .order("data_zerado", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      return (fallback.data ?? []).map((g: any) => ({ ...g, data_platinado: null })) as Game[];
    }
    throw error;
  }
  return (data ?? []) as Game[];
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
