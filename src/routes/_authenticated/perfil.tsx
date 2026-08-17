import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { AppHeader } from "@/components/AppHeader";
import { jogosQuery, formatarNota } from "@/lib/jogos";
import { supabase } from "@/integrations/supabase/client";
import { buscarCapas } from "@/lib/game-covers.functions";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil | Planilha de Jogos Zerados" },
      { name: "description", content: "Seu perfil e backlog de jogos." },
    ],
  }),
  loader: async ({ context: { queryClient } }) => {
    // 1. Puxar todos os jogos primeiro
    const jogos = await queryClient.ensureQueryData(jogosQuery);

    // 2. Por padrão a aba inicial é "Jogando", então paginamos os 10 primeiros dessa aba
    const jogando = jogos.filter((j) => j.status === "Jogando");
    const primeiraPagina = jogando.slice(0, 10);
    const nomes = [...new Set(primeiraPagina.map((j) => j.nome).filter(Boolean))];

    // 3. Pré-carregar na memória do servidor as capas da primeira página,
    // garantindo que não vai ter piscada/placeholder quando o html carregar.
    if (nomes.length > 0) {
      await queryClient.ensureQueryData({
        queryKey: ["capas", nomes],
        staleTime: 1000 * 60 * 60,
        queryFn: () => buscarCapas({ data: { nomes } }),
      });
    }

    return null;
  },
  component: Perfil,
});

function Perfil() {
  const { data: jogos = [] } = useQuery(jogosQuery);
  const [activeTab, setActiveTab] = useState<"Jogando" | "Backlog" | "Zerados">("Jogando");
  const [pagina, setPagina] = useState(1);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || "usuario@email.com");
    });
  }, []);

  const mudarAba = (aba: "Jogando" | "Backlog" | "Zerados") => {
    setActiveTab(aba);
    setPagina(1);
  };

  const jogando = jogos.filter((j) => j.status === "Jogando");
  const backlog = jogos.filter((j) => j.status === "Quero jogar" || j.status === "Pausado");
  const zerados = jogos.filter((j) => j.status === "Zerado");

  let gamesToShow = jogando;
  if (activeTab === "Backlog") gamesToShow = backlog;
  if (activeTab === "Zerados") gamesToShow = zerados;

  const itemsPerPage = 10;
  const totalPages = Math.ceil(gamesToShow.length / itemsPerPage);
  const pagedGames = gamesToShow.slice((pagina - 1) * itemsPerPage, pagina * itemsPerPage);

  const nomesBusca = useMemo(() => {
    return [...new Set(pagedGames.map((j) => j.nome).filter(Boolean))];
  }, [pagedGames]);

  const { data: capas = [] } = useQuery({
    queryKey: ["capas", nomesBusca],
    enabled: nomesBusca.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: () => buscarCapas({ data: { nomes: nomesBusca } }),
  });
  
  const retratoDe = (nome: string) => {
    const c = capas.find((x) => x.nome === nome);
    return c?.retrato ?? c?.imagem ?? null;
  };

  const username = userEmail.split("@")[0];
  const name = username.charAt(0).toUpperCase() + username.slice(1);

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
            <h1 className="font-display text-3xl font-bold text-foreground">{name}</h1>
            <p className="text-sm text-muted-foreground">@{username}</p>

            <div className="mt-5 flex gap-4">
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-6 py-3 border border-border/50">
                <span className="text-xl font-bold text-foreground">{jogando.length}</span>
                <span className="text-xs text-muted-foreground">Jogando</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-6 py-3 border border-border/50">
                <span className="text-xl font-bold text-foreground">{backlog.length}</span>
                <span className="text-xs text-muted-foreground">Backlog</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl bg-background/50 px-6 py-3 border border-border/50">
                <span className="text-xl font-bold text-foreground">{zerados.length}</span>
                <span className="text-xs text-muted-foreground">Zerados</span>
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <nav className="mb-8 flex gap-6 border-b border-border overflow-x-auto">
          <button
            onClick={() => mudarAba("Jogando")}
            className={`pb-3 whitespace-nowrap text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "Jogando"
                ? "border-b-2 border-ember text-ember"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🕹️ Jogando Agora
          </button>
          <button
            onClick={() => mudarAba("Backlog")}
            className={`pb-3 whitespace-nowrap text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "Backlog"
                ? "border-b-2 border-ember text-ember"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            ⌛ Backlog
          </button>
          <button
            onClick={() => mudarAba("Zerados")}
            className={`pb-3 whitespace-nowrap text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === "Zerados"
                ? "border-b-2 border-ember text-ember"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🏆 Zerados
          </button>
        </nav>

        {/* Game Grid */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {pagedGames.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              Nenhum jogo nesta lista.
            </div>
          ) : (
            pagedGames.map((j) => {
              const capa = retratoDe(j.nome);
              return (
                <div key={j.id} className="group relative flex flex-col overflow-hidden rounded-xl bg-surface-2 transition-transform hover:-translate-y-1 hover:shadow-xl border border-border/50">
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
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground" title={j.nome}>
                      {j.nome}
                    </h3>
                    
                    <div className="mt-auto pt-3">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Progresso</span>
                        <span>{j.horas_jogadas ? `${j.horas_jogadas}h` : '--'}</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-background">
                        <div 
                          className="h-full bg-ember" 
                          style={{ width: activeTab === 'Zerados' ? '100%' : (j.horas_jogadas ? Math.min(Number(j.horas_jogadas) * 2, 90) + '%' : '10%') }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
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
