import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { jogosQuery, formatarNota } from "@/lib/jogos";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Check, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import { EditGameModal } from "@/components/EditGameModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buscarJogos } from "@/lib/game-search.functions";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil | Planilha de Jogos Zerados" },
      { name: "description", content: "Seu perfil e backlog de jogos." },
    ],
  }),
  loader: async ({ context: { queryClient } }) => {
    // 1. Puxar todos os jogos primeiro
    await queryClient.ensureQueryData(jogosQuery);
    return null;
  },
  component: Perfil,
});

function Perfil() {
  const { data: jogos = [] } = useQuery(jogosQuery);
  const [activeTab, setActiveTab] = useState<"Jogando" | "Backlog" | "Zerados" | "Platinados">("Backlog");
  const [pagina, setPagina] = useState(1);
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

  const mudarAba = (aba: "Jogando" | "Backlog" | "Zerados" | "Platinados") => {
    setActiveTab(aba);
    setPagina(1);
    setYearFilter("All");
    setPlatformFilter("All");
    setTextFilter("");
  };

  const salvarNome = async () => {
    const novoNome = editNameValue.trim();
    if (!novoNome) {
      toast.error("O nome não pode ser vazio.");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: novoNome }
      });
      if (error) throw error;
      setUserName(novoNome);
      setIsEditingName(false);
      toast.success("Nome atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao atualizar nome: " + err.message);
    }
  };

  const jogando = jogos.filter((j) => j.status === "Jogando");
  const backlog = jogos.filter((j) => j.status === "Quero jogar" || j.status === "Pausado");
  const zerados = jogos.filter((j) => j.status === "Zerado" || j.status === "Platinado");
  const platinados = jogos.filter((j) => j.status === "Platinado");

  let gamesToShow = jogando;
  if (activeTab === "Backlog") gamesToShow = backlog;
  if (activeTab === "Zerados") gamesToShow = zerados;
  if (activeTab === "Platinados") gamesToShow = platinados;

  const availableYears = useMemo(() => {
    const years = new Set(gamesToShow.map(j => j.ano_jogado).filter(Boolean));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [gamesToShow]);

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
    filteredGames = filteredGames.filter(j => String(j.ano_jogado) === yearFilter);
  }
  if (platformFilter !== "All") {
    filteredGames = filteredGames.filter(j => j.plataforma === platformFilter);
  }

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredGames.length / itemsPerPage);
  const pagedGames = filteredGames.slice((pagina - 1) * itemsPerPage, pagina * itemsPerPage);

  const retratoDe = (imagemFixa: string | null) => {
    return imagemFixa ?? null;
  };

  const username = userEmail.split("@")[0];
  const name = userName || (username.charAt(0).toUpperCase() + username.slice(1));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-5xl p-5 py-10">
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
                    if (e.key === "Enter") salvarNome();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                />
                <button onClick={salvarNome} className="p-2 text-green-500 hover:bg-green-500/10 rounded-md transition-colors" title="Salvar">
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
                <span className="text-xl font-bold text-foreground">{zerados.length}</span>
                <span className="text-xs text-muted-foreground">Zerados</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-5 py-3 border border-border/50 min-w-[80px]">
                <span className="text-xl font-bold text-foreground">{platinados.length}</span>
                <span className="text-xs text-muted-foreground">Platinados</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-5 py-3 border border-border/50 min-w-[80px]">
                <span className="text-xl font-bold text-foreground">{jogando.length}</span>
                <span className="text-xs text-muted-foreground">Jogando</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs and Filters */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
          <nav className="flex gap-6 overflow-x-auto">
            <button
              onClick={() => mudarAba("Backlog")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Backlog"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">⌛ Backlog</span>
              <span className="text-[10px] font-medium opacity-70">{backlog.length} {backlog.length === 1 ? "jogo" : "jogos"}</span>
            </button>
            <button
              onClick={() => mudarAba("Zerados")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Zerados"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">🏆 Zerados</span>
              <span className="text-[10px] font-medium opacity-70">{zerados.length} {zerados.length === 1 ? "jogo" : "jogos"}</span>
            </button>
            <button
              onClick={() => mudarAba("Platinados")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Platinados"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">💎 Platinados</span>
              <span className="text-[10px] font-medium opacity-70">{platinados.length} {platinados.length === 1 ? "jogo" : "jogos"}</span>
            </button>
            <button
              onClick={() => mudarAba("Jogando")}
              className={`pb-3 flex flex-col items-center gap-1 whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === "Jogando"
                  ? "border-b-2 border-ember text-ember"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm font-semibold">🕹️ Jogando</span>
              <span className="text-[10px] font-medium opacity-70">{jogando.length} {jogando.length === 1 ? "jogo" : "jogos"}</span>
            </button>
          </nav>

          <div className="flex flex-wrap gap-2 shrink-0 pb-3">
            <input
              type="text"
              placeholder="Buscar pelo nome..."
              value={textFilter}
              onChange={(e) => { setTextFilter(e.target.value); setPagina(1); }}
              className="w-[180px] bg-surface-2 border border-border h-9 text-sm rounded-md px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ember placeholder:text-muted-foreground"
            />
            {availablePlatforms.length > 0 && (
              <Select value={platformFilter} onValueChange={(val) => { setPlatformFilter(val); setPagina(1); }}>
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
            )}

            {availableYears.length > 0 && (
              <Select value={yearFilter} onValueChange={(val) => { setYearFilter(val); setPagina(1); }}>
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
            )}
          </div>
        </div>

        {/* Game Grid */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pagedGames.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              Nenhum jogo nesta lista.
            </div>
          ) : (
            pagedGames.map((j) => {
              const capa = retratoDe(j.imagem);
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
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="flex h-9 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium shadow-sm transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm font-medium text-muted-foreground">
              Página {pagina} de {totalPages}
            </span>
            <button
              onClick={() => setPagina((p) => Math.min(totalPages, p + 1))}
              disabled={pagina === totalPages}
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
