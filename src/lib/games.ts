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
    .select("id, nome, genero, plataforma, status, ano_jogado, data_zerado, nota, horas_jogadas, ordem, created_at, imagem")
    .order("data_zerado", { ascending: false, nullsLast: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
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
