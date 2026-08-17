import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  GENERO_OPCOES,
  PLATAFORMA_OPCOES,
  STATUS_OPCOES,
  formatarNota,
  jogosQuery,
} from "@/lib/jogos";
import { buscarJogos } from "@/lib/game-search.functions";


export const Route = createFileRoute("/_authenticated/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastrar jogo | Planilha de Jogos Zerados" },
      {
        name: "description",
        content:
          "Cadastre um novo jogo com gênero, plataforma, status, ano jogado, nota e horas jogadas.",
      },
      { property: "og:title", content: "Cadastrar jogo | Planilha de Jogos Zerados" },
      {
        property: "og:description",
        content: "Adicione jogos à sua planilha: gênero, plataforma, status, ano, nota e horas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cadastro,
});

const vazio = {
  nome: "",
  genero: "",
  plataforma: "",
  status: "Zerado",
  ano_jogado: String(new Date().getFullYear()),
  nota: "",
  horas_jogadas: "",
};

function Cadastro() {
  const [form, setForm] = useState(vazio);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [busca, setBusca] = useState("");
  const [capaSelecionada, setCapaSelecionada] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: jogos = [] } = useQuery(jogosQuery);

  useEffect(() => {
    const t = window.setTimeout(() => setTermoBusca(busca.trim()), 300);
    return () => window.clearTimeout(t);
  }, [busca]);


  const { data: sugestoes = [], isFetching: buscando } = useQuery({
    queryKey: ["busca-jogos", termoBusca],
    queryFn: () => buscarJogos({ data: { termo: termoBusca } }),
    enabled: termoBusca.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const set = (k: keyof typeof vazio) => (v: string) => setForm((f) => ({ ...f, [k]: v }));


  const criar = useMutation({
    mutationFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) throw new Error("Sessão expirada. Faça login novamente.");
      const { error } = await supabase.from("jogos").insert({
        user_id: uid,
        nome: form.nome.trim(),
        genero: form.genero || null,
        plataforma: form.plataforma || null,
        status: form.status,
        ano_jogado: form.ano_jogado ? Number(form.ano_jogado) : null,
        nota: form.nota ? Number(form.nota.replace(",", ".")) : null,
        horas_jogadas: form.horas_jogadas ? Number(form.horas_jogadas.replace(",", ".")) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jogos"] });
      toast.success("Jogo cadastrado!");
      setForm({ ...vazio });
      setBusca("");
      setCapaSelecionada(null);

    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jogos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jogos"] });
      toast.success("Jogo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-4 lg:grid-cols-[400px_1fr]">
        <section className="panel h-fit overflow-hidden">
          <div className="bar-title px-3 py-2 text-center text-[11px]">Cadastrar jogo</div>
          <form
            className="flex flex-col gap-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.nome.trim()) {
                toast.error("Selecione um jogo na lista da Steam");
                return;
              }
              criar.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome do jogo (Steam)</Label>
              {form.nome ? (
                <div className="flex items-center gap-2 rounded-md bg-surface-2 p-2">
                  {capaSelecionada ? (
                    <img
                      src={capaSelecionada}
                      alt={form.nome}
                      className="h-8 w-[74px] shrink-0 rounded object-cover"
                    />
                  ) : null}
                  <span className="flex-1 truncate text-sm">{form.nome}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      set("nome")("");
                      setCapaSelecionada(null);
                      setBusca("");
                      setSugestoesAbertas(true);
                    }}
                  >
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="nome"
                    autoComplete="off"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setSugestoesAbertas(true);
                    }}
                    onFocus={() => setSugestoesAbertas(true)}
                    onBlur={() => window.setTimeout(() => setSugestoesAbertas(false), 150)}
                    placeholder="Busque na Steam: Resident Evil 4"
                    className="bg-surface-2"
                  />
                  {sugestoesAbertas && (buscando || sugestoes.length > 0) ? (
                    <div className="panel absolute z-50 mt-1 max-h-72 w-full overflow-y-auto bg-surface-2 p-1 shadow-lg">
                      {buscando && sugestoes.length === 0 ? (
                        <p className="px-2 py-2 text-xs text-muted-foreground">Buscando jogos…</p>
                      ) : null}
                      {sugestoes.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-background"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            set("nome")(s.nome);
                            setCapaSelecionada(s.imagem ?? null);
                            setSugestoesAbertas(false);
                          }}
                        >
                          {s.imagem ? (
                            <img
                              src={s.imagem}
                              alt={s.nome}
                              loading="lazy"
                              className="h-8 w-[74px] shrink-0 rounded object-cover"
                            />
                          ) : (
                            <span className="h-8 w-[74px] shrink-0 rounded bg-background" />
                          )}
                          <span className="truncate">{s.nome}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Escolha um resultado da Steam para preencher o nome.
                  </p>
                </div>
              )}
            </div>



            <div className="space-y-1.5">
              <Label>Gênero</Label>
              <Select value={form.genero} onValueChange={set("genero")}>
                <SelectTrigger className="bg-surface-2">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {GENERO_OPCOES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plataforma</Label>
                <Select value={form.plataforma} onValueChange={set("plataforma")}>
                  <SelectTrigger className="bg-surface-2">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATAFORMA_OPCOES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={set("status")}>
                  <SelectTrigger className="bg-surface-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ano">Ano</Label>
                <Input
                  id="ano"
                  inputMode="numeric"
                  value={form.ano_jogado}
                  onChange={(e) => set("ano_jogado")(e.target.value)}
                  className="bg-surface-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nota">Nota</Label>
                <Input
                  id="nota"
                  inputMode="decimal"
                  placeholder="0–10"
                  value={form.nota}
                  onChange={(e) => set("nota")(e.target.value)}
                  className="bg-surface-2"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="horas">Horas</Label>
                <Input
                  id="horas"
                  inputMode="decimal"
                  placeholder="0"
                  value={form.horas_jogadas}
                  onChange={(e) => set("horas_jogadas")(e.target.value)}
                  className="bg-surface-2"
                />
              </div>
            </div>

            <div className="mt-2 flex gap-2">
              <Button type="submit" className="flex-1" disabled={criar.isPending}>
                {criar.isPending ? "Salvando…" : "Cadastrar"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate({ to: "/" })}>
                Ver dashboard
              </Button>
            </div>
          </form>
        </section>

        <section className="panel overflow-hidden">
          <div className="bar-title px-3 py-2 text-[11px]">
            Jogos cadastrados ({jogos.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-3 py-2 font-bold">Nome do jogo</th>
                  <th className="px-3 py-2 font-bold">Gênero</th>
                  <th className="px-3 py-2 font-bold">Plataforma</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 text-center font-bold">Ano</th>
                  <th className="px-3 py-2 text-center font-bold">Nota</th>
                  <th className="px-3 py-2 text-center font-bold">Horas</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {jogos.map((j) => (
                  <tr key={j.id} className="border-t border-border hover:bg-surface-2">
                    <td className="px-3 py-2 font-medium">{j.nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">{j.genero ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{j.plataforma ?? "—"}</td>
                    <td className="px-3 py-2">{j.status}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{j.ano_jogado ?? "—"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{formatarNota(j.nota)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                      {j.horas_jogadas ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remover ${j.nome}`}
                        onClick={() => remover.mutate(j.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jogos.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nada cadastrado ainda. Use o formulário ao lado ou volte ao{" "}
                <Link to="/" className="text-ember underline">
                  dashboard
                </Link>
                .
              </p>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
