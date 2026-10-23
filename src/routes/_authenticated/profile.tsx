import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { gamesQuery, formatRating } from "@/lib/games";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Check, X, Trophy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { EditGameModal } from "@/components/EditGameModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { syncSteamLibrary } from "@/lib/steam.server";
import { searchGames } from "@/lib/game-search.functions";
import { SteamSyncModal, type SyncResultDisplay } from "@/components/SteamSyncModal";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Perfil | Planilha de Jogos Zerados" },
      { name: "description", content: "Seu perfil e backlog de games." },
    ],
  }),
  loader: async ({ context: { queryClient } }) => {
    // 1. Puxar todos os games primeiro
    await queryClient.ensureQueryData(gamesQuery);
    return null;
  },
  component: Perfil,
});

function Perfil() {
  const queryClient = useQueryClient();
  const { data: games = [] } = useQuery(gamesQuery);
  const [activeTab, setActiveTab] = useState<"Jogando" | "Backlog" | "Zerados" | "Platinados">("Backlog");
  const [page, setPage] = useState(1);
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [platformFilter, setPlatformFilter] = useState<string>("All");
  const [textFilter, setTextFilter] = useState<string>("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  
  // States para edição do nome
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || "usuario@email.com");
      setUserName(data.user?.user_metadata?.name || "");
    });
  }, []);

  const changeTab = (tab: "Jogando" | "Backlog" | "Zerados" | "Platinados") => {
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
        data: { name: newName }
      });
      if (error) throw error;
      setUserName(newName);
      setIsEditingName(false);
      toast.success("Nome atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao atualizar nome: " + err.message);
    }
  };

  const playing = games.filter((j) => j.status === "Jogando");
  const backlog = games.filter((j) => j.status === "Quero jogar" || j.status === "Pausado");
  const completed = games.filter((j) => j.status === "Zerado" || j.status === "Platinado");
  const platinum = [...games.filter((j) => j.status === "Platinado")].sort((a, b) => {
    const dateA = a.data_platinado || a.data_zerado || a.created_at;
    const dateB = b.data_platinado || b.data_zerado || b.created_at;
    const timeA = dateA ? new Date(dateA).getTime() : 0;
    const timeB = dateB ? new Date(dateB).getTime() : 0;
    return timeB - timeA;
  });

  let gamesToShow = playing;
  if (activeTab === "Backlog") gamesToShow = backlog;
  if (activeTab === "Zerados") gamesToShow = completed;
  if (activeTab === "Platinados") gamesToShow = platinum;

  const availableYears = useMemo(() => {
    const years = new Set(
      gamesToShow
        .map((j) => {
          if (activeTab === "Platinados" && j.data_platinado) {
            return Number(j.data_platinado.split("-")[0]);
          }
          return j.ano_jogado;
        })
        .filter(Boolean)
    );
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [gamesToShow, activeTab]);

  const availablePlatforms = useMemo(() => {
    const platforms = new Set(gamesToShow.map(j => j.plataforma).filter(Boolean));
    return Array.from(platforms).sort();
  }, [gamesToShow]);

  let filteredGames = gamesToShow;
  if (textFilter.trim() !== "") {
    const lowerTerm = textFilter.toLowerCase();
    filteredGames = filteredGames.filter(j => j.nome.toLowerCase().includes(lowerTerm));
  }
  if (yearFilter !== "All") {
    filteredGames = filteredGames.filter(j => {
      const gameYear =
        activeTab === "Platinados" && j.data_platinado
          ? j.data_platinado.split("-")[0]
          : String(j.ano_jogado);
      return String(gameYear) === yearFilter;
    });
  }
  if (platformFilter !== "All") {
    filteredGames = filteredGames.filter(j => j.plataforma === platformFilter);
  }

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const pagedGames = filteredGames.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
        .filter(g => g.plataforma === "Steam")
        .map(g => ({ id: g.id, nome: g.nome, status: g.status, horas_jogadas: g.horas_jogadas }));

      if (steamGamesInput.length === 0) {
        toast.dismiss(toastId);
        toast.info("Você não tem nenhum jogo cadastrado com a plataforma 'Steam' no seu backlog.");
        setIsSyncingSteam(false);
        return;
      }

      const updates = await syncSteamLibrary({ data: { steamId, localGames: steamGamesInput } });

      if (updates.length === 0) {
        toast.dismiss(toastId);
        toast.success("Nenhum jogo novo para sincronizar ou nenhum match encontrado.");
        setIsSyncingSteam(false);
        return;
      }

      const displayResults: SyncResultDisplay[] = updates.map(update => {
        const payload: any = {};
        if (update.horas_jogadas !== undefined) payload.horas_jogadas = update.horas_jogadas;
        if (update.status !== undefined) payload.status = update.status;
        
        return {
          id: update.id,
          localName: steamGamesInput.find(g => g.id === update.id)?.nome || "Desconhecido",
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

  const getPortrait = (fixedImage: string | null) => {
    return fixedImage ?? null;
  };

  const username = userEmail.split("@")[0];
  const name = userName || (username.charAt(0).toUpperCase() + username.slice(1));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-5xl p-5 py-10">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:border-ember/50 hover:text-ember"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a Dashboard
          </Link>
        </div>

        {/* Profile Card */}
        <section className="mb-10 flex flex-col sm:flex-row items-center gap-8 rounded-2xl border border-border bg-surface-2 p-8 shadow-sm">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-background shadow-lg">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail}&backgroundColor=ffdfbf`} 
              alt="Avatar" 
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="font-display text-2xl font-bold bg-background border border-border rounded-md px-3 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ember"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveName();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                />
                <button onClick={saveName} className="p-2 text-green-500 hover:bg-green-500/10 rounded-md transition-colors" title="Salvar">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => setIsEditingName(false)} className="p-2 text-muted-foreground hover:bg-surface rounded-md transition-colors" title="Cancelar">
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <h1 className="font-display text-3xl font-bold text-foreground">{name}</h1>
                <button 
                  onClick={() => {
                    setEditNameValue(name);
                    setIsEditingName(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface rounded-md"
                  title="Editar nome"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="mt-5 flex gap-4 overflow-x-auto pb-2 sm:pb-0">
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-5 py-3 border border-border/50 min-w-[80px]">
                <span className="text-xl font-bold text-foreground">{backlog.length}</span>
                <span className="text-xs text-muted-foreground">Backlog</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-5 py-3 border border-border/50 min-w-[80px]">
                <span className="text-xl font-bold text-foreground">{completed.length}</span>
                <span className="text-xs text-muted-foreground">Zerados</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-5 py-3 border border-border/50 min-w-[80px]">
                <span className="text-xl font-bold text-foreground">{platinum.length}</span>
                <span className="text-xs text-muted-foreground">Platinados</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-5 py-3 border border-border/50 min-w-[80px]">
                <span className="text-xl font-bold text-foreground">{playing.length}</span>
                <span className="text-xs text-muted-foreground">Jogando</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
          <nav className="flex gap-6 overflow-x-auto">
            <button
              onClick={() => changeTab("Backlog")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Backlog"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">⌛ Backlog</span>
              <span className="text-[10px] font-medium opacity-70">{backlog.length} {backlog.length === 1 ? "jogo" : "games"}</span>
            </button>
            <button
              onClick={() => changeTab("Zerados")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Zerados"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">🏆 Zerados</span>
              <span className="text-[10px] font-medium opacity-70">{completed.length} {completed.length === 1 ? "jogo" : "games"}</span>
            </button>
            <button
              onClick={() => changeTab("Platinados")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Platinados"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">💎 Platinados</span>
              <span className="text-[10px] font-medium opacity-70">{platinum.length} {platinum.length === 1 ? "jogo" : "games"}</span>
            </button>
            <button
              onClick={() => changeTab("Jogando")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Jogando"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">🕹️ Jogando</span>
              <span className="text-[10px] font-medium opacity-70">{playing.length} {playing.length === 1 ? "jogo" : "games"}</span>
            </button>
          </nav>

          <SteamSyncModal 
            onSync={handleSteamSync} 
            isSyncing={isSyncingSteam}
            pendingResults={syncResults}
            onConfirm={handleConfirmSync}
            onCancel={() => setSyncResults(null)}
          >
            <button 
              disabled={isSyncingSteam}
              className="flex items-center gap-2 rounded-md bg-[#171a21] hover:bg-[#2a475e] text-[#66c0f4] px-4 py-2 text-sm font-bold border border-[#66c0f4]/20 transition-colors disabled:opacity-50"
            >
              {isSyncingSteam ? "Sincronizando..." : "Sincronizar Steam"}
            </button>
          </SteamSyncModal>
        </div>

        <div className="mb-8 flex flex-wrap items-end gap-3 justify-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="filter-name" className="text-xs font-medium text-muted-foreground">
              Buscar
            </label>
            <input
              id="filter-name"
              type="text"
              placeholder="Buscar pelo nome..."
              value={textFilter}
              onChange={(e) => { setTextFilter(e.target.value); setPage(1); }}
              className="w-[180px] bg-surface-2 border border-border h-9 text-sm rounded-md px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ember placeholder:text-muted-foreground"
            />
          </div>
          {availablePlatforms.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Plataforma
              </label>
              <Select value={platformFilter} onValueChange={(val) => { setPlatformFilter(val); setPage(1); }}>
                <SelectTrigger className="w-[140px] bg-surface-2 border-border h-9 text-sm">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Todas</SelectItem>
                  {availablePlatforms.map(plat => (
                    <SelectItem key={plat} value={plat as string}>{plat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {availableYears.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Ano
              </label>
              <Select value={yearFilter} onValueChange={(val) => { setYearFilter(val); setPage(1); }}>
                <SelectTrigger className="w-[110px] bg-surface-2 border-border h-9 text-sm">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">Todos</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Game Grid */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pagedGames.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              Nenhum jogo nesta lista.
            </div>
          ) : (
            pagedGames.map((j) => {
              const capa = getPortrait(j.imagem);
              return (
                <EditGameModal key={j.id} jogo={j} capa={capa}>
                  <button type="button" className="group relative flex flex-col overflow-hidden rounded-xl bg-surface-2 transition-transform hover:-translate-y-1 hover:shadow-xl border border-border/50 text-left cursor-pointer">
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-background">
                      {capa ? (
                        <img
                          src={capa}
                          alt={j.nome}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-surface px-2 text-center text-xs text-muted-foreground font-semibold">
                          {j.nome}
                        </div>
                      )}
                      {j.plataforma && (
                        <div className="absolute right-2 top-2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          {j.plataforma}
                        </div>
                      )}
                      {j.status === "Platinado" && (
                        <div className="absolute left-2 top-2 rounded-full bg-background/80 p-1 backdrop-blur-sm">
                          <Trophy className="h-3.5 w-3.5 text-platinum" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground" title={j.nome}>
                        {j.nome}
                      </h3>
                      
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {j.horas_jogadas ? `${j.horas_jogadas}h jogadas` : ''}
                        </span>
                        <span className="text-[11px] font-bold text-amber-500">
                          {j.nota ? `★ ${j.nota}` : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                </EditGameModal>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-9 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium shadow-sm transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm font-medium text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-9 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium shadow-sm transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
