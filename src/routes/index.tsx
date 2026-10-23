import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Trophy,
  CheckCircle2,
  Clock,
  Award,
  RefreshCw,
  Gamepad2,
  Sparkles,
  ArrowRight,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { EditGameModal } from "@/components/EditGameModal";
import { Skeleton, LazyCoverImage } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  gamesQuery,
  annualTrophiesQuery,
  allAnnualTrophiesQuery,
  formatRating,
  isCompletedStatus,
  type Game,
} from "@/lib/games";
import { syncAnnualTrophies } from "@/lib/trophies.server";
import { supabase } from "@/integrations/supabase/client";
import { useSessaoUsuario } from "@/lib/use-session";

const DashboardCharts = lazy(() => import("@/components/DashboardCharts"));

const GENRE_TRANSLATIONS: Record<string, string> = {
  "Role-playing (RPG)": "RPG",
  "Adventure": "Aventura",
  "Action": "Ação",
  "Shooter": "Tiro",
  "Platform": "Plataforma",
  "Racing": "Corrida",
  "Sport": "Esportes",
  "Strategy": "Estratégia",
  "Simulation": "Simulação",
  "Simulator": "Simulação",
  "Puzzle": "Quebra-cabeça",
  "Fighting": "Luta",
  "Point-and-click": "Aponte e Clique",
  "Tactical": "Tático",
  "Turn-based strategy (TBS)": "Estratégia em turnos",
  "Real Time Strategy (RTS)": "Estratégia em tempo real",
  "Card & Board Game": "Cartas e Tabuleiro",
  "Music": "Música",
  "Indie": "Indie",
  "Arcade": "Arcade",
  "Hack and slash/Beat 'em up": "Hack & Slash",
  "Visual Novel": "Visual Novel",
};

export function translateGenres(generoString: string | null | undefined): string {
  if (!generoString || !generoString.trim()) return "Outros";
  return generoString
    .split(",")
    .map((g) => g.trim())
    .map((g) => GENRE_TRANSLATIONS[g] || g)
    .join(", ");
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Backlog de games | Jogos zerados, platinas e troféus" },
      {
        name: "description",
        content:
          "Dashboard pessoal de games zerados, platinados e troféus conquistados por ano.",
      },
      { property: "og:title", content: "Backlog de games | Jogos zerados, platinas e troféus" },
      {
        property: "og:description",
        content:
          "Estatísticas de jogos zerados, platinas, troféus na Steam e PSN, notas e gráficos por ano e gênero.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const currentYear = () => new Date().getFullYear();

function Card({
  titulo,
  subtitulo,
  action,
  children,
  className = "",
}: {
  titulo: string;
  subtitulo?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          {subtitulo ? (
            <p className="text-xs text-muted-foreground">{subtitulo}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Capa vertical (IGDB t_cover_big, 264x374) exibida inteira, sem cortes, com lazy loading e skeleton. */
function Retrato({
  nome,
  src,
  tamanho = 76,
}: {
  nome: string;
  src: string | null;
  tamanho?: number;
}) {
  const height = Math.round(tamanho * (374 / 264));
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 shadow-md"
      style={{ width: tamanho, height }}
    >
      {src ? (
        <>
          {!loaded && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
          <img
            src={src}
            alt=""
            aria-hidden
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-lg"
          />
          <img
            src={src}
            alt={`Capa de ${nome}`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`relative h-full w-full object-contain transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      ) : (
        <span className="px-2 text-center text-[10px] text-muted-foreground">{nome}</span>
      )}
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="panel p-5 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex h-[260px] items-end justify-around gap-3 pt-6">
          <Skeleton className="h-28 w-12 rounded-t-md" />
          <Skeleton className="h-44 w-12 rounded-t-md" />
          <Skeleton className="h-56 w-12 rounded-t-md" />
          <Skeleton className="h-36 w-12 rounded-t-md" />
        </div>
      </div>
      <div className="panel p-5 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="flex h-[260px] items-end justify-around gap-3 pt-6">
          <Skeleton className="h-32 w-12 rounded-t-md" />
          <Skeleton className="h-48 w-12 rounded-t-md" />
          <Skeleton className="h-40 w-12 rounded-t-md" />
          <Skeleton className="h-52 w-12 rounded-t-md" />
        </div>
      </div>
    </div>
  );
}

function getGameEffectiveYear(game: Game): number | null {
  if (game.data_zerado) {
    return Number(game.data_zerado.split("-")[0]);
  }
  if (game.data_platinado) {
    return Number(game.data_platinado.split("-")[0]);
  }
  return game.ano_jogado ?? null;
}

function Dashboard() {
  const userId = useSessaoUsuario();
  const queryClient = useQueryClient();
  const anoAtual = currentYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(anoAtual));

  const targetSyncYear = selectedYear === "All" ? anoAtual : Number(selectedYear);

  const { data: games = [], isLoading, error } = useQuery({
    ...gamesQuery,
    enabled: !!userId,
  });

  const { data: yearTrophies, isLoading: isLoadingYearTrophies } = useQuery({
    ...annualTrophiesQuery(targetSyncYear),
    enabled: !!userId && selectedYear !== "All",
  });

  const { data: allTrophies = [], isLoading: isLoadingAllTrophies } = useQuery({
    ...allAnnualTrophiesQuery,
    enabled: !!userId,
  });

  const isLoadingTrophies =
    selectedYear === "All" ? isLoadingAllTrophies : isLoadingYearTrophies;

  const displayedTrophies = useMemo(() => {
    if (selectedYear !== "All") return yearTrophies ?? null;
    if (!allTrophies.length) return null;
    return allTrophies.reduce(
      (acc, row) => ({
        ano: 0,
        total: acc.total + (row.total || 0),
        steam: acc.steam + (row.steam || 0),
        psn: acc.psn + (row.psn || 0),
      }),
      { ano: 0, total: 0, steam: 0, psn: 0 },
    );
  }, [selectedYear, yearTrophies, allTrophies]);

  const trophiesByYear = useMemo(() => {
    return [...allTrophies]
      .sort((a, b) => a.ano - b.ano)
      .map((row) => ({
        ano: String(row.ano),
        total: row.total || 0,
        steam: row.steam || 0,
        psn: row.psn || 0,
      }));
  }, [allTrophies]);

  const syncTrophiesMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sessão expirada.");
      const result = await syncAnnualTrophies({ data: { ano: targetSyncYear } });

      const payload = {
        user_id: userId,
        ano: result.ano,
        total: result.total,
        steam: result.steam,
        psn: result.psn,
      };

      const { error: upsertError } = await supabase
        .from("trofeus_anuais")
        .upsert(payload, { onConflict: "user_id,ano" });

      if (upsertError) {
        await supabase.auth.updateUser({
          data: {
            [`trofeus_${result.ano}`]: {
              ano: result.ano,
              total: result.total,
              steam: result.steam,
              psn: result.psn,
              updated_at: new Date().toISOString(),
            },
          },
        });
      }

      return result;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["annual-trophies"] });
      toast.success(
        `Troféus de ${res.ano} sincronizados! Total: ${res.total} (Steam: ${res.steam} · PSN: ${res.psn})`,
      );
      if (res.warnings.length > 0) {
        res.warnings.forEach((w) => toast.warning(w));
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = anoAtual; y >= 2015; y--) {
      years.push(y);
    }
    return years;
  }, [anoAtual]);

  const stats = useMemo(() => {
    const allCompleted = games.filter((j) => isCompletedStatus(j.status));
    const allPlatinum = games.filter((j) => j.status === "Platinado");

    const matchesYear = (j: Game) => {
      if (selectedYear === "All") return true;
      return String(getGameEffectiveYear(j)) === selectedYear;
    };

    const filteredCompleted = allCompleted.filter(matchesYear);
    const filteredPlatinum = allPlatinum.filter((j) => {
      if (selectedYear === "All") return true;
      const platYear = j.data_platinado
        ? j.data_platinado.split("-")[0]
        : String(getGameEffectiveYear(j));
      return platYear === selectedYear;
    });

    const hoursList = filteredCompleted
      .filter((j) => j.horas_jogadas)
      .map((j) => Number(j.horas_jogadas));
    const totalHours = hoursList.reduce((a, b) => a + b, 0);
    const averageHours = hoursList.length ? totalHours / hoursList.length : 0;

    const ratingsList = filteredCompleted
      .filter((j) => j.nota !== null && j.nota !== undefined)
      .map((j) => Number(j.nota));
    const averageRating = ratingsList.length
      ? ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length
      : null;

    const platinumRate = filteredCompleted.length
      ? Math.round((filteredPlatinum.length / filteredCompleted.length) * 100)
      : 0;

    const byYearMap = new Map<number, number>();
    allCompleted.forEach((j) => {
      const y = getGameEffectiveYear(j);
      if (!y) return;
      byYearMap.set(y, (byYearMap.get(y) ?? 0) + 1);
    });
    const byYear = [...byYearMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, total]) => ({ ano: String(ano), total }));

    const genreSource = selectedYear === "All" ? games : filteredCompleted;
    const genreMap = new Map<string, number>();
    genreSource.forEach((j) => {
      if (!j.genero || !j.genero.trim()) {
        genreMap.set("Outros", (genreMap.get("Outros") ?? 0) + 1);
      } else {
        const generosArray = j.genero
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean);
        generosArray.forEach((g) => {
          const ptBr = GENRE_TRANSLATIONS[g] || g;
          genreMap.set(ptBr, (genreMap.get(ptBr) ?? 0) + 1);
        });
      }
    });
    const genresList = [...genreMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([genero, total]) => ({ genero, total }));

    const lastCompletedItem = (arr: Game[]) => {
      if (!arr.length) return "—";
      const sorted = [...arr].sort((a, b) => {
        const dA = new Date(a.data_zerado || a.created_at).getTime();
        const dB = new Date(b.data_zerado || b.created_at).getTime();
        return dA - dB;
      });
      return sorted[sorted.length - 1].nome;
    };

    const lastPlatinumItem = (arr: Game[]) => {
      if (!arr.length) return "—";
      const sorted = [...arr].sort((a, b) => {
        const dA = new Date(a.data_platinado || a.data_zerado || a.created_at).getTime();
        const dB = new Date(b.data_platinado || b.data_zerado || b.created_at).getTime();
        return dA - dB;
      });
      return sorted[sorted.length - 1].nome;
    };

    const sortedCompleted = [...filteredCompleted].sort((a, b) => {
      const dateA = new Date(a.data_zerado || a.created_at).getTime();
      const dateB = new Date(b.data_zerado || b.created_at).getTime();
      return dateB - dateA;
    });
    const recentItems = sortedCompleted.slice(0, 5);

    return {
      completed: filteredCompleted.length,
      allTimeCompleted: allCompleted.length,
      platinum: filteredPlatinum.length,
      allTimePlatinum: allPlatinum.length,
      platinumRate,
      totalHours,
      averageHours,
      averageRating,
      byYear,
      genresList,
      recentItems,
      lastCompleted: lastCompletedItem(filteredCompleted),
      lastPlatinum: lastPlatinumItem(filteredPlatinum),
      playingNow: games.filter((j) => j.status === "Jogando"),
    };
  }, [games, selectedYear]);

  const getPortrait = (fixedImage: string | null) => fixedImage ?? null;

  if (userId === null) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold">Sua coleção de games</h1>
          <p className="text-sm text-muted-foreground">
            Entre na sua conta para ver e gerenciar os games que você cadastrou.
          </p>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Entrar
          </Link>
        </main>
      </div>
    );
  }

  const periodLabel = selectedYear === "All" ? "Todos os anos" : selectedYear;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        {error ? (
          <p className="text-sm text-destructive">
            Não foi possível carregar os games. Recarregue a página.
          </p>
        ) : null}

        {/* Cabeçalho + Filtro de Ano */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Visão Geral · {periodLabel}
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Bem-vindo de volta, José
            </h1>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Filtrar por ano
              </label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[150px] bg-surface-2 border-border h-9 text-sm font-medium">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Todos os anos</SelectItem>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Link
              to="/profile"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              Gerenciar coleção
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        {/* Destaques Principais: Zerados, Platinados e Troféus */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Card 1: Jogos Zerados */}
          <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-[#281822] via-surface to-surface p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <CheckCircle2 className="h-4 w-4" />
                  Jogos Zerados ({periodLabel})
                </span>
                {isLoading ? (
                  <div className="mt-3 flex items-baseline gap-3">
                    <Skeleton className="h-12 w-20" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ) : (
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-display text-5xl font-bold tabular-nums text-foreground">
                      {stats.completed}
                    </span>
                    {selectedYear !== "All" && (
                      <span className="text-xs text-muted-foreground">
                        de {stats.allTimeCompleted} no total
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-primary/15 p-3 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 text-xs">
              <span className="text-muted-foreground block">Último zerado</span>
              {isLoading ? (
                <Skeleton className="mt-1 h-4 w-40" />
              ) : (
                <span
                  className="font-medium text-foreground truncate block mt-0.5"
                  title={stats.lastCompleted}
                >
                  {stats.lastCompleted}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Platinados */}
          <div className="relative overflow-hidden rounded-xl border border-platinum/30 bg-gradient-to-br from-[#162432] via-surface to-surface p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-platinum">
                  <Trophy className="h-4 w-4" />
                  Platinados ({periodLabel})
                </span>
                {isLoading ? (
                  <div className="mt-3 flex items-baseline gap-3">
                    <Skeleton className="h-12 w-16" />
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </div>
                ) : (
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-display text-5xl font-bold tabular-nums text-platinum">
                      {stats.platinum}
                    </span>
                    <span className="rounded-full bg-platinum/15 px-2 py-0.5 text-[11px] font-semibold text-platinum">
                      {stats.platinumRate}% dos zerados
                    </span>
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-platinum/15 p-3 text-platinum">
                <Trophy className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-xs">
              <div>
                <span className="text-muted-foreground block">Última platina</span>
                {isLoading ? (
                  <Skeleton className="mt-1 h-4 w-28" />
                ) : (
                  <span
                    className="font-medium text-foreground truncate block mt-0.5"
                    title={stats.lastPlatinum}
                  >
                    {stats.lastPlatinum}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground block">Total na coleção</span>
                {isLoading ? (
                  <Skeleton className="mt-1 h-4 w-20" />
                ) : (
                  <span className="font-medium text-foreground block mt-0.5">
                    {stats.allTimePlatinum} {stats.allTimePlatinum === 1 ? "platina" : "platinas"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Troféus Conquistados */}
          <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-[#292218] via-surface to-surface p-6 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                  <Award className="h-4 w-4" />
                  Troféus ({selectedYear === "All" ? "Acumulado" : selectedYear})
                </span>
                {isLoadingTrophies ? (
                  <div className="mt-3 flex items-baseline gap-3">
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ) : (
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-display text-5xl font-bold tabular-nums text-amber-400">
                      {displayedTrophies?.total ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">Steam + PSN</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => syncTrophiesMutation.mutate()}
                disabled={syncTrophiesMutation.isPending}
                title={`Sincronizar troféus de ${targetSyncYear} (Steam + PSN)`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncTrophiesMutation.isPending ? "animate-spin" : ""}`}
                />
                {syncTrophiesMutation.isPending ? "Sincronizando…" : `Sync ${targetSyncYear}`}
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/10 pt-4 text-xs">
              <div className="flex items-center justify-between rounded-md bg-background/40 px-3 py-1.5">
                <span className="text-muted-foreground">Steam</span>
                {isLoadingTrophies ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className="font-display font-semibold text-foreground tabular-nums">
                    {displayedTrophies?.steam ?? "—"}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md bg-background/40 px-3 py-1.5">
                <span className="text-muted-foreground">PSN</span>
                {isLoadingTrophies ? (
                  <Skeleton className="h-4 w-8" />
                ) : (
                  <span className="font-display font-semibold text-foreground tabular-nums">
                    {displayedTrophies?.psn ?? "—"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Faixa Secundária de Indicadores Rápidos */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="panel flex items-center gap-3 px-4 py-3.5">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Horas ({periodLabel})
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-5 w-14" />
              ) : (
                <p className="font-display text-lg font-semibold tabular-nums">
                  {Math.round(stats.totalHours)}h
                </p>
              )}
            </div>
          </div>

          <div className="panel flex items-center gap-3 px-4 py-3.5">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Nota Média ({periodLabel})
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-5 w-12" />
              ) : (
                <p className="font-display text-lg font-semibold tabular-nums">
                  {formatRating(stats.averageRating)}
                </p>
              )}
            </div>
          </div>

          <div className="panel flex items-center gap-3 px-4 py-3.5">
            <Gamepad2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Jogando Agora
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-5 w-16" />
              ) : (
                <p className="font-display text-lg font-semibold tabular-nums">
                  {stats.playingNow.length} {stats.playingNow.length === 1 ? "jogo" : "jogos"}
                </p>
              )}
            </div>
          </div>

          <div className="panel flex items-center gap-3 px-4 py-3.5">
            <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Total na Coleção
              </p>
              {isLoading ? (
                <Skeleton className="mt-1 h-5 w-16" />
              ) : (
                <p className="font-display text-lg font-semibold tabular-nums">
                  {games.length} {games.length === 1 ? "jogo" : "jogos"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Gráficos (Lazy Loaded) */}
        {isLoading || isLoadingAllTrophies ? (
          <ChartsSkeleton />
        ) : (
          <Suspense fallback={<ChartsSkeleton />}>
            <DashboardCharts
              byYear={stats.byYear}
              trophiesByYear={trophiesByYear}
              selectedYear={selectedYear}
              onSelectYear={(yr) =>
                setSelectedYear((prev) => (prev === yr ? "All" : yr))
              }
            />
          </Suspense>
        )}

        {/* Seções Lado a Lado: Jogando Agora & Últimos Concluídos */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Jogando Agora */}
          <section className="panel flex flex-col p-5 lg:col-span-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Jogando agora
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Títulos atualmente em andamento
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                {stats.playingNow.length}
              </span>
            </div>

            {isLoading ? (
              <div className="flex flex-1 flex-col justify-center gap-3">
                <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2/40 p-4">
                  <Skeleton className="h-[119px] w-[84px] shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </div>
            ) : stats.playingNow.length ? (
              <div className="flex flex-1 flex-col justify-center gap-3">
                {stats.playingNow.map((j) => {
                  const capa = getPortrait(j.imagem);
                  return (
                    <EditGameModal key={j.id} jogo={j} capa={capa}>
                      <button
                        type="button"
                        className="group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-[#142620] via-surface to-surface p-4 text-left shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-400/50 hover:shadow-xl cursor-pointer"
                      >
                        {capa ? (
                          <img
                            src={capa}
                            alt=""
                            aria-hidden
                            loading="lazy"
                            decoding="async"
                            className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 scale-125 object-cover opacity-15 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
                          />
                        ) : null}

                        <Retrato nome={j.nome} src={capa} tamanho={84} />

                        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between gap-2.5">
                          <div>
                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                              {j.plataforma ? (
                                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                  {j.plataforma}
                                </span>
                              ) : null}
                              <span className="truncate text-[11px] text-muted-foreground">
                                {translateGenres(j.genero)}
                              </span>
                            </div>

                            <p
                              className="line-clamp-2 font-display text-base font-bold leading-snug text-foreground transition-colors group-hover:text-emerald-300"
                              title={j.nome}
                            >
                              {j.nome}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 border-t border-white/10 pt-2.5 text-xs">
                            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                              <Clock className="h-3.5 w-3.5" />
                              {j.horas_jogadas ? `${j.horas_jogadas}h jogadas` : "Recém iniciado"}
                            </span>
                          </div>
                        </div>
                      </button>
                    </EditGameModal>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center py-8 text-sm text-muted-foreground">
                Nenhum jogo em andamento no momento.
              </div>
            )}
          </section>

          {/* Últimos 5 concluídos (compacto) */}
          <Card
            titulo={`Últimos concluídos (${periodLabel})`}
            subtitulo="Os 5 jogos finalizados mais recentemente no período"
            className="lg:col-span-7"
          >
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-lg border border-border bg-surface-2/40"
                  >
                    <Skeleton className="aspect-[264/374] w-full rounded-none" />
                    <div className="space-y-1.5 p-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))}
              </div>
            ) : stats.recentItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nenhum jogo concluído neste período.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {stats.recentItems.map((j) => {
                  const capa = getPortrait(j.imagem);
                  return (
                    <article
                      key={j.id}
                      className="group overflow-hidden rounded-lg border border-border bg-surface-2/40 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="relative aspect-[264/374] w-full overflow-hidden bg-surface-2">
                        <LazyCoverImage src={capa} alt={`Capa de ${j.nome}`} fallbackText={j.nome} />
                        {j.status === "Platinado" ? (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-background/85 p-1">
                            <Trophy className="h-3 w-3 text-platinum" />
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-0.5 p-2">
                        <p className="truncate text-xs font-medium" title={j.nome}>
                          {j.nome}
                        </p>
                        <p className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{getGameEffectiveYear(j) ?? "—"}</span>
                          <span className="font-semibold text-primary">
                            {formatRating(j.nota)}
                          </span>
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
