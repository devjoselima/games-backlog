import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { GENERO_OPCOES, PLATAFORMA_OPCOES, STATUS_OPCOES } from "@/lib/jogos";
import { buscarJogos } from "@/lib/game-search.functions";
import { useNavigate } from "@tanstack/react-router";

const vazio = {
  nome: "",
  genero: "",
  plataforma: "",
  status: "Zerado",
  ano_jogado: String(new Date().getFullYear()),
  nota: "",
  horas_jogadas: "",
};

export function LogGameModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [busca, setBusca] = useState("");
  const [capaSelecionada, setCapaSelecionada] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => setTermoBusca(busca.trim()), 500);
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
      setOpen(false);
      navigate({ to: "/perfil" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-background">
        <DialogHeader>
          <DialogTitle>Log Game</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.nome.trim()) {
              toast.error("Selecione um jogo na lista");
              return;
            }
            criar.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome do jogo</Label>
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
                  placeholder="Busque um jogo: Resident Evil 4"
                  className="bg-surface-2"
                />
                {sugestoesAbertas && (buscando || sugestoes.length > 0) ? (
                  <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface-2 p-1 shadow-lg">
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
                  <SelectItem key={g} value={g}>{g}</SelectItem>
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
                    <SelectItem key={p} value={p}>{p}</SelectItem>
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
                    <SelectItem key={s} value={s}>{s}</SelectItem>
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

          <div className="mt-4 flex gap-2">
            <Button type="submit" className="w-full" disabled={criar.isPending}>
              {criar.isPending ? "Salvando…" : "Salvar Log"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
