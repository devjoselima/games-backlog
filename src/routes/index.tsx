import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Trophy, CheckCircle2, CalendarDays, Clock } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { jogosQuery, formatarNota, statusConcluido, type Jogo } from "@/lib/jogos";
import { buscarCapas } from "@/lib/game-covers.functions";
import { useSessaoUsuario } from "@/lib/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Backlog do José | Jogos zerados e platinados" },
      {
        name: "description",
        content:
          "Dashboard pessoal de jogos zerados e platinados: últimos jogos jogados, notas, gêneros e estatísticas por ano.",
      },
      { property: "og:title", content: "Backlog do José | Jogos zerados e platinados" },
      {
        property: "og:description",
        content:
          "Últimos jogos jogados, contadores de zerados e platinados, notas e gráficos por ano e gênero.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const anoAtual = () => new Date().getFullYear();

function Stat({
  titulo,
  valor,
  Icon,
}: {
  titulo: string;
  valor: string | number;
  Icon: typeof Trophy;
}) {
  return (
    <div className="panel flex flex-col items-center gap-1 px-4 py-5">
      <Icon className="h-4 w-4 text-primary" />
      <span className="font-display text-3xl font-semibold tabular-nums">{valor}</span>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{titulo}</span>
    </div>
  );
}

function Card({
  titulo,
  children,
  className = "",
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-muted-foreground">{titulo}</h2>
      {children}
    </section>
  );
}

/** Capa vertical (IGDB t_cover_big, 264x374) exibida inteira, sem cortes. */
function Retrato({
  nome,
  src,
  tamanho = 156,
}: {
  nome: string;
  src: string | null;
  tamanho?: number;
}) {
  const height = Math.round(tamanho * (374 / 264));
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 shadow-lg"
      style={{ width: tamanho, height }}
    >
      {src ? (
        <>
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-lg"
          />
          <img
            src={src}
            alt={`Capa de ${nome}`}
            loading="lazy"
            className="relative h-full w-full object-contain"
          />
        </>
      ) : (
        <span className="px-2 text-center text-xs text-muted-foreground">{nome}</span>
      )}
    </div>
  );
}



const tooltipStyle = {
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
};

function Dashboard() {
  const userId = useSessaoUsuario();
  const { data: jogos = [], isLoading, error } = useQuery({
    ...jogosQuery,
    enabled: !!userId,
  });

  const stats = useMemo(() => {
    const concluidos = jogos.filter((j) => statusConcluido(j.status));
    const platinados = jogos.filter((j) => j.status === "Platinado");
    const esteAno = concluidos.filter((j) => j.ano_jogado === anoAtual());
    const horasAno = jogos
      .filter((j) => j.ano_jogado === anoAtual() && j.horas_jogadas)
      .map((j) => Number(j.horas_jogadas));
    const media = horasAno.length
      ? horasAno.reduce((a, b) => a + b, 0) / horasAno.length
      : 0;

    const porAnoMap = new Map<number, number>();
    concluidos.forEach((j) => {
      if (!j.ano_jogado) return;
      porAnoMap.set(j.ano_jogado, (porAnoMap.get(j.ano_jogado) ?? 0) + 1);
    });
    const porAno = [...porAnoMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ano, total]) => ({ ano: String(ano), total }));

    const generoMap = new Map<string, number>();
    jogos.forEach((j) => {
      const g = j.genero?.trim() || "Outros";
      generoMap.set(g, (generoMap.get(g) ?? 0) + 1);
    });
    const generos = [...generoMap.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([genero, total]) => ({ genero, total }));

    const ultimo = (arr: Jogo[]) => (arr.length ? arr[arr.length - 1].nome : "—");

    const recentes = [...concluidos].reverse().slice(0, 5);

    return {
      zerados: concluidos.length,
      platinados: platinados.length,
      esteAno: esteAno.length,
      media,
      porAno,
      generos,
      recentes,
      ultimoZerado: ultimo(concluidos.filter((j) => j.status === "Zerado")),
      ultimoPlatinado: ultimo(platinados),
      jogandoAgora: jogos.filter((j) => j.status === "Jogando"),
    };
  }, [jogos]);

  const nomesBusca = useMemo(() => {
    const lista = [
      ...stats.recentes.map((j) => j.nome),
      ...stats.jogandoAgora.map((j) => j.nome),
    ].filter((n) => n && n !== "—");
    return [...new Set(lista)];
  }, [stats]);

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


  if (userId === null) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold">Sua coleção de jogos</h1>
          <p className="text-sm text-muted-foreground">
            Entre na sua conta para ver e gerenciar os jogos que você cadastrou.
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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        {error ? (
          <p className="text-sm text-destructive">
            Não foi possível carregar os jogos. Recarregue a página.
          </p>
        ) : null}

        {/* Hero / últimos jogados */}
        <section className="hero-band overflow-hidden p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="font-display text-2xl font-semibold">
                Bem-vindo de volta, José
              </h1>
              <p className="text-sm text-muted-foreground">
                Seus últimos 5 jogos jogados
              </p>
            </div>
            <Link
              to="/cadastro"
              className="text-sm font-medium text-primary hover:underline"
            >
              Gerenciar coleção
            </Link>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : stats.recentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum jogo concluído ainda.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              {stats.recentes.map((j) => {
                const capa = retratoDe(j.nome);
                return (
                  <article
                    key={j.id}
                    className="group overflow-hidden rounded-lg border border-border bg-surface transition-transform hover:-translate-y-1"
                  >
                    <div className="relative aspect-[264/374] w-full overflow-hidden bg-surface-2">
                      {capa ? (
                        <img
                          src={capa}
                          alt={`Capa de ${j.nome}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2 text-center font-display text-sm text-muted-foreground">
                          {j.nome}
                        </div>
                      )}
                      {j.status === "Platinado" ? (
                        <span className="absolute right-2 top-2 rounded-full bg-background/80 p-1">
                          <Trophy className="h-3.5 w-3.5 text-platinum" />
                        </span>
                      ) : null}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium" title={j.nome}>
                        {j.nome}
                      </p>
                      <p className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{j.ano_jogado ?? "—"}</span>
                        <span className="font-semibold text-primary">
                          {formatarNota(j.nota)}
                        </span>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Contadores */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat titulo="Zerados" valor={stats.zerados} Icon={CheckCircle2} />
          <Stat titulo="Este ano" valor={stats.esteAno} Icon={CalendarDays} />
          <Stat titulo="Platinados" valor={stats.platinados} Icon={Trophy} />
          <Stat
            titulo={`Média ${anoAtual()}`}
            valor={`${stats.media.toFixed(1).replace(".", ",")}h`}
            Icon={Clock}
          />
        </div>

        {/* Jogando agora */}
        <Card titulo="Jogando agora">
          {stats.jogandoAgora.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.jogandoAgora.map((j) => (
                <article
                  key={j.id}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
                >
                  <Retrato nome={j.nome} src={retratoDe(j.nome)} tamanho={120} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-display text-sm font-semibold" title={j.nome}>
                      {j.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {j.plataforma} · {j.genero}
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs font-medium text-primary">
                        {formatarNota(j.nota)}
                      </span>
                      {j.horas_jogadas ? (
                        <span className="text-xs text-muted-foreground">
                          {j.horas_jogadas}h
                        </span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nada em andamento</p>
          )}
        </Card>


        {/* Gráficos */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card titulo="Zerados por ano">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.porAno} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="ano"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle} />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={54}>
                    <LabelList
                      dataKey="total"
                      position="top"
                      style={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card titulo="Jogos por gênero">
            <div style={{ height: Math.max(260, stats.generos.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.generos}
                  layout="vertical"
                  margin={{ top: 4, right: 28, left: 8, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="genero"
                    width={110}
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip cursor={{ fill: "var(--surface-2)" }} contentStyle={tooltipStyle} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={14}>
                    {stats.generos.map((g) => (
                      <Cell key={g.genero} fill="var(--chart-2)" />
                    ))}
                    <LabelList
                      dataKey="total"
                      position="right"
                      style={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
