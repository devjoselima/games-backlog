import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { gamesQuery, formatRating, type Game } from "@/lib/games";
import { supabase } from "@/integrations/supabase/client";
import {
  Pencil,
  Check,
  X,
  Trophy,
  ArrowLeft,
  CheckCircle2,
  Gamepad2,
  Clock,
  Hourglass,
  Search,
  RefreshCw,
  CalendarDays,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { EditGameModal } from "@/components/EditGameModal";
import { Skeleton, LazyCoverImage } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { syncSteamLibrary } from "@/lib/steam.server";
import { SteamSyncModal, type SyncResultDisplay } from "@/components/SteamSyncModal";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Perfil | Backlog de games" },
      { name: "description", content: "Seu perfil e coleção de games." },
    ],
  }),
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(gamesQuery);
    return null;
  },
  component: Perfil,
});

type TabType = "Backlog" | "Zerados" | "Platinados" | "Jogando";

function getGameYearForTab(game: Game, tab: TabType): number | null {
  if (tab === "Platinados" && game.data_platinado) {
    return Number(game.data_platinado.split("-")[0]);
  }
  if (game.data_zerado) {
    return Number(game.data_zerado.split("-")[0]);
  }
  if (game.data_platinado) {
    return Number(game.data_platinado.split("-")[0]);
  }
  return game.ano_jogado ?? null;
}

function formatShortDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function Perfil() {
  const queryClient = useQueryClient();
  const { data: games = [], isLoading } = useQuery(gamesQuery);
  const [activeTab, setActiveTab] = useState<TabType>("Backlog");
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [textFilter, setTextFilter] = useState<string>("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || "usuario@email.com");
      setUserName(data.user?.user_metadata?.name || "");
    });
  }, []);

  const changeTab = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setYearFilter("All");
    setPlatformFilter("All");
    setTextFilter("");
  };

  const saveName = async () => {
    const newName = editNameValue.trim();
    if (!newName) {
      toast.error("O nome não pode ser vazio.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: newName },
      });
      if (error) throw error;
      setUserName(newName);
      setIsEditingName(false);
      toast.success("Nome atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao atualizar nome: " + err.message);
    }
  };

  const playing = useMemo(
    () => games.filter((j) => j.status === "Jogando"),
    [games],
  );
  const backlog = useMemo(
    () => games.filter((j) => j.status === "Quero jogar" || j.status === "Pausado"),
    [games],
  );
  const completed = useMemo(
    () =>
      [...games.filter((j) => j.status === "Zerado" || j.status === "Platinado")].sort(
        (a, b) => {
          const dateA = a.data_zerado || a.created_at;
          const dateB = b.data_zerado || b.created_at;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        },
      ),
    [games],
  );
  const platinum = useMemo(
    () =>
      [...games.filter((j) => j.status === "Platinado")].sort((a, b) => {
        const dateA = a.data_platinado || a.data_zerado || a.created_at;
        const dateB = b.data_platinado || b.data_zerado || b.created_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }),
    [games],
  );

  const totalHoursAll = useMemo(
    () =>
      Math.round(
        games.reduce((acc, g) => acc + (g.horas_jogadas ? Number(g.horas_jogadas) : 0), 0),
      ),
    [games],
  );

  let gamesToShow = playing;
  if (activeTab === "Backlog") gamesToShow = backlog;
  if (activeTab === "Zerados") gamesToShow = completed;
  if (activeTab === "Platinados") gamesToShow = platinum;

  const availableYears = useMemo(() => {
    const years = new Set(
      gamesToShow
        .map((j) => getGameYearForTab(j, activeTab))
        .filter((y): y is number => Boolean(y)),
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [gamesToShow, activeTab]);

  const availablePlatforms = useMemo(() => {
    const platforms = new Set(
      gamesToShow.map((j) => j.plataforma).filter((p): p is string => Boolean(p)),
    );
    return Array.from(platforms).sort();
  }, [gamesToShow]);

  let filteredGames = gamesToShow;
  if (textFilter.trim() !== "") {
    const lowerTerm = textFilter.toLowerCase();
    filteredGames = filteredGames.filter((j) => j.nome.toLowerCase().includes(lowerTerm));
  }
  if (yearFilter !== "All") {
    filteredGames = filteredGames.filter(
      (j) => String(getGameYearForTab(j, activeTab)) === yearFilter,
    );
  }
  if (platformFilter !== "All") {
    filteredGames = filteredGames.filter((j) => j.plataforma === platformFilter);
  }

  const hasActiveFilters =
    textFilter.trim() !== "" || yearFilter !== "All" || platformFilter !== "All";

  const itemsPerPage = 15;
  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const pagedGames = filteredGames.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const [isSyncingSteam, setIsSyncingSteam] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResultDisplay[] | null>(null);

  const handleSteamSync = async (steamId: string) => {
    if (!/^\d{17}$/.test(steamId)) {
      toast.error("Steam ID inválido. Ele deve conter exatamente 17 números.");
      return;
    }

    setIsSyncingSteam(true);
    const toastId = toast.loading("Buscando jogos na Steam...");

    try {
      const steamGamesInput = games
        .filter((g) => g.plataforma === "Steam")
        .map((g) => ({
          id: g.id,
          nome: g.nome,
          status: g.status,
          horas_jogadas: g.horas_jogadas,
        }));

      if (steamGamesInput.length === 0) {
        toast.dismiss(toastId);
        toast.info(
          "Você não tem nenhum jogo cadastrado com a plataforma 'Steam' no seu backlog.",
        );
        setIsSyncingSteam(false);
        return;
      }

      const updates = await syncSteamLibrary({
        data: { steamId, localGames: steamGamesInput },
      });

      if (updates.length === 0) {
        toast.dismiss(toastId);
        toast.success("Nenhum jogo novo para sincronizar ou nenhum match encontrado.");
        setIsSyncingSteam(false);
        return;
      }

      const displayResults: SyncResultDisplay[] = updates.map((update) => {
        const payload: any = {};
        if (update.horas_jogadas !== undefined)
          payload.horas_jogadas = update.horas_jogadas;
        if (update.status !== undefined) payload.status = update.status;

        return {
          id: update.id,
          localName:
            steamGamesInput.find((g) => g.id === update.id)?.nome || "Desconhecido",
          steamName: update.steamName || "Match Steam",
          horas: update.horas_jogadas || 0,
          platinou: update.status === "Platinado" || payload.status === "Platinado",
          status: payload.status,
        };
      });

      setSyncResults(displayResults);
      toast.dismiss(toastId);
    } catch (err: any) {
      toast.error("Erro na sincronização: " + err.message, { id: toastId });
    } finally {
      setIsSyncingSteam(false);
    }
  };

  const handleConfirmSync = async (confirmedResults: SyncResultDisplay[]) => {
    const toastId = toast.loading(`Salvando ${confirmedResults.length} jogos...`);
    let count = 0;
    try {
      for (const res of confirmedResults) {
        const payload: any = { horas_jogadas: res.horas };
        if (res.status) payload.status = res.status;
        await supabase.from("jogos").update(payload).eq("id", res.id);
        count++;
      }
      toast.success(`${count} jogos sincronizados com sucesso!`, { id: toastId });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message, { id: toastId });
    }
    setSyncResults(null);
  };

  const getPortrait = (fixedImage: string | null) => fixedImage ?? null;

  const username = userEmail.split("@")[0];
  const name =
    userName || (username ? username.charAt(0).toUpperCase() + username.slice(1) : "Gamer");

  const tabsConfig: Array<{
    id: TabType;
    label: string;
    count: number;
    Icon: typeof Trophy;
    activeClass: string;
    badgeClass: string;
  }> = [
    {
      id: "Backlog",
      label: "Backlog",
      count: backlog.length,
      Icon: Hourglass,
      activeClass: "border-amber-400 text-amber-400 bg-amber-500/10",
      badgeClass: "bg-amber-500/20 text-amber-400",
    },
    {
      id: "Zerados",
      label: "Zerados",
      count: completed.length,
      Icon: CheckCircle2,
      activeClass: "border-primary text-primary bg-primary/10",
      badgeClass: "bg-primary/20 text-primary",
    },
    {
      id: "Platinados",
      label: "Platinados",
      count: platinum.length,
      Icon: Trophy,
      activeClass: "border-platinum text-platinum bg-platinum/10",
      badgeClass: "bg-platinum/20 text-platinum",
    },
    {
      id: "Jogando",
      label: "Jogando",
      count: playing.length,
      Icon: Gamepad2,
      activeClass: "border-emerald-400 text-emerald-400 bg-emerald-500/10",
      badgeClass: "bg-emerald-500/20 text-emerald-400",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
        {/* Topo de Navegação */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a Dashboard
          </Link>

          <SteamSyncModal
            onSync={handleSteamSync}
            isSyncing={isSyncingSteam}
            pendingResults={syncResults}
            onConfirm={handleConfirmSync}
            onCancel={() => setSyncResults(null)}
          >
            <button
              type="button"
              disabled={isSyncingSteam}
              className="inline-flex items-center gap-2 rounded-lg border border-[#66c0f4]/30 bg-[#171a21] px-4 py-2 text-xs font-semibold text-[#66c0f4] shadow-sm transition-colors hover:bg-[#2a475e] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingSteam ? "animate-spin" : ""}`} />
              {isSyncingSteam ? "Sincronizando Steam…" : "Sincronizar Horas / Platinas Steam"}
            </button>
          </SteamSyncModal>
        </div>

        {/* Profile Hero Card */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-[#281822] via-surface to-surface p-6 sm:p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Avatar + Identificação */}
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-background ring-4 ring-primary/20 shadow-xl bg-surface-2">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail}&backgroundColor=ffdfbf`}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
                  Perfil & Coleção
                </span>

                {isEditingName ? (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <input
                      type="text"
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      className="font-display text-xl font-bold bg-background border border-border rounded-md px-3 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveName();
                        if (e.key === "Escape") setIsEditingName(false);
                      }}
                    />
                    <button
                      onClick={saveName}
                      className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors cursor-pointer"
                      title="Salvar"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-2 text-muted-foreground hover:bg-surface-2 rounded-md transition-colors cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center sm:justify-start gap-2.5 group">
                    <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
                      {name}
                    </h1>
                    <button
                      onClick={() => {
                        setEditNameValue(name);
                        setIsEditingName(true);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-md transition-colors cursor-pointer"
                      title="Editar nome"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {games.length} {games.length === 1 ? "jogo cadastrado" : "jogos cadastrados"} ·{" "}
                  {totalHoursAll}h registradas no total
                </p>
              </div>
            </div>

            {/* Resumo Rápido Interativo */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => changeTab("Backlog")}
                className={`flex flex-col items-center justify-center rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                  activeTab === "Backlog"
                    ? "border-amber-400/60 bg-amber-500/15 shadow-sm"
                    : "border-border/60 bg-background/40 hover:border-amber-400/30"
                }`}
              >
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Hourglass className="h-3.5 w-3.5" />
                  <span className="font-display text-xl font-bold tabular-nums text-foreground">
                    {backlog.length}
                  </span>
                </div>
                <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                  Backlog
                </span>
              </button>

              <button
                type="button"
                onClick={() => changeTab("Zerados")}
                className={`flex flex-col items-center justify-center rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                  activeTab === "Zerados"
                    ? "border-primary/60 bg-primary/15 shadow-sm"
                    : "border-border/60 bg-background/40 hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-1.5 text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="font-display text-xl font-bold tabular-nums text-foreground">
                    {completed.length}
                  </span>
                </div>
                <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                  Zerados
                </span>
              </button>

              <button
                type="button"
                onClick={() => changeTab("Platinados")}
                className={`flex flex-col items-center justify-center rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                  activeTab === "Platinados"
                    ? "border-platinum/60 bg-platinum/15 shadow-sm"
                    : "border-border/60 bg-background/40 hover:border-platinum/30"
                }`}
              >
                <div className="flex items-center gap-1.5 text-platinum">
                  <Trophy className="h-3.5 w-3.5" />
                  <span className="font-display text-xl font-bold tabular-nums text-platinum">
                    {platinum.length}
                  </span>
                </div>
                <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                  Platinados
                </span>
              </button>

              <button
                type="button"
                onClick={() => changeTab("Jogando")}
                className={`flex flex-col items-center justify-center rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                  activeTab === "Jogando"
                    ? "border-emerald-400/60 bg-emerald-500/15 shadow-sm"
                    : "border-border/60 bg-background/40 hover:border-emerald-400/30"
                }`}
              >
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  <span className="font-display text-xl font-bold tabular-nums text-foreground">
                    {playing.length}
                  </span>
                </div>
                <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                  Jogando
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Barra de Abas e Filtros */}
        <section className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-end sm:justify-between">
          {/* Abas */}
          <nav className="flex flex-wrap gap-2">
            {tabsConfig.map(({ id, label, count, Icon, activeClass, badgeClass }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeTab(id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? activeClass
                      : "border-transparent bg-surface-2/60 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
                      isActive ? badgeClass : "bg-background/60 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Filtros com Label */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="filter-name"
                className="text-[11px] font-medium text-muted-foreground"
              >
                Buscar
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="filter-name"
                  type="text"
                  placeholder="Nome do jogo..."
                  value={textFilter}
                  onChange={(e) => {
                    setTextFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-[180px] rounded-md border border-border bg-surface-2 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {textFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setTextFilter("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {availablePlatforms.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Plataforma
                </label>
                <Select
                  value={platformFilter}
                  onValueChange={(val) => {
                    setPlatformFilter(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[135px] border-border bg-surface-2 text-xs">
                    <SelectValue placeholder="Plataforma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Todas</SelectItem>
                    {availablePlatforms.map((plat) => (
                      <SelectItem key={plat} value={plat}>
                        {plat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {availableYears.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">
                  Ano
                </label>
                <Select
                  value={yearFilter}
                  onValueChange={(val) => {
                    setYearFilter(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 w-[110px] border-border bg-surface-2 text-xs">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">Todos</SelectItem>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setTextFilter("");
                  setPlatformFilter("All");
                  setYearFilter("All");
                  setPage(1);
                }}
                className="h-9 rounded-md border border-border bg-surface-2 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </section>

        {/* Grade de Jogos */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
              >
                <Skeleton className="aspect-[264/374] w-full rounded-none" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-4 w-4/5" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                </div>
              </div>
            ))
          ) : pagedGames.length === 0 ? (
            <div className="panel col-span-full flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <Gamepad2 className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">Nenhum jogo encontrado nesta lista.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setTextFilter("");
                    setPlatformFilter("All");
                    setYearFilter("All");
                    setPage(1);
                  }}
                  className="mt-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Limpar filtros ativos
                </button>
              )}
            </div>
          ) : (
            pagedGames.map((j) => {
              const capa = getPortrait(j.imagem);
              const dateToDisplay =
                activeTab === "Platinados"
                  ? formatShortDate(j.data_platinado || j.data_zerado)
                  : formatShortDate(j.data_zerado);
              const fallbackYear = getGameYearForTab(j, activeTab);

              return (
                <EditGameModal key={j.id} jogo={j} capa={capa}>
                  <button
                    type="button"
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl text-left cursor-pointer"
                  >
                    <div className="relative aspect-[264/374] w-full overflow-hidden bg-surface-2">
                      <LazyCoverImage
                        src={capa}
                        alt={j.nome}
                        fallbackText={j.nome}
                        className="transition-transform duration-300 group-hover:scale-105"
                      />

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/75 to-transparent" />

                      {j.plataforma && (
                        <span className="absolute right-2 top-2 rounded-md border border-white/10 bg-black/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                          {j.plataforma}
                        </span>
                      )}

                      {j.status === "Platinado" && (
                        <span
                          className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-platinum/40 bg-background/90 px-2 py-0.5 text-[10px] font-bold text-platinum backdrop-blur-sm shadow-sm"
                          title="Platinado"
                        >
                          <Trophy className="h-3 w-3" />
                        </span>
                      )}

                      {j.nota !== null && j.nota !== undefined && (
                        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-400 backdrop-blur-sm">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {formatRating(j.nota)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                      <h3
                        className="line-clamp-2 font-display text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary"
                        title={j.nome}
                      >
                        {j.nome}
                      </h3>

                      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 opacity-70" />
                          {dateToDisplay || fallbackYear || "—"}
                        </span>

                        {j.horas_jogadas ? (
                          <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                            <Clock className="h-3 w-3 opacity-70" />
                            {j.horas_jogadas}h
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </EditGameModal>
              );
            })
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 items-center justify-center rounded-md border border-border bg-surface px-4 text-xs font-semibold shadow-sm transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              Anterior
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              Página <strong className="text-foreground">{page}</strong> de{" "}
              <strong className="text-foreground">{totalPages}</strong>
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-9 items-center justify-center rounded-md border border-border bg-surface px-4 text-xs font-semibold shadow-sm transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              Próxima
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
