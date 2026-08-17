import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GENERO_OPCOES, PLATAFORMA_OPCOES, STATUS_OPCOES } from "@/lib/jogos";
import { buscarJogos } from "@/lib/game-search.functions";
import { useNavigate } from "@tanstack/react-router";

const vazio = {
  nome: "",
  genero: "",
  plataforma: "",
  status: "Zerado",
  data_zerado: "",
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
  const [focusedIndex, setFocusedIndex] = useState(-1);
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

  useEffect(() => {
    setFocusedIndex(-1);
  }, [sugestoes, busca]);

  const set = (k: keyof typeof vazio) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const criar = useMutation({
    mutationFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) throw new Error("Sessão expirada. Faça login novamente.");
      
      const isConcluido = form.status === "Zerado" || form.status === "Platinado";
      const dataFinal = isConcluido ? (form.data_zerado || null) : null;
      const notaFinal = isConcluido && form.nota ? Number(form.nota.replace(",", ".")) : null;
      const horasFinal = isConcluido && form.horas_jogadas ? Number(form.horas_jogadas.replace(",", ".")) : null;
      
        const { error } = await supabase.from("jogos").insert({
          user_id: uid,
          nome: form.nome.trim(),
          genero: form.genero || null,
          plataforma: form.plataforma || null,
          status: form.status,
          data_zerado: dataFinal,
          ano_jogado: dataFinal ? Number(dataFinal.split("-")[0]) : null,
          nota: notaFinal,
          horas_jogadas: horasFinal,
          imagem: capaSelecionada,
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
      <DialogContent className="sm:max-w-[650px] w-[95vw] overflow-hidden bg-background">
        <DialogHeader>
          <DialogTitle>Log Game</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-3 py-4 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.nome.trim()) {
              toast.error("Selecione um jogo na lista");
              return;
            }
            criar.mutate();
          }}
        >
          <div className="space-y-1.5 w-full">
            <Label htmlFor="nome">Nome do jogo</Label>
            {form.nome ? (
              <div className="flex items-center gap-2 rounded-md bg-surface-2 p-2 w-full overflow-hidden">
                {capaSelecionada ? (
                  <img
                    src={capaSelecionada}
                    alt={form.nome}
                    className="h-8 w-[74px] shrink-0 rounded object-cover"
                  />
                ) : null}
                <span className="flex-1 truncate text-sm" title={form.nome}>{form.nome}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
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
              <div className="relative w-full">
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
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && form.nome) return; // allows submitting if game is already picked
                    if (e.key === "Enter" && !form.nome && busca) {
                      e.preventDefault();
                    }
                    if (!sugestoesAbertas || sugestoes.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setFocusedIndex((prev) => (prev < sugestoes.length - 1 ? prev + 1 : prev));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (focusedIndex >= 0 && focusedIndex < sugestoes.length) {
                        const s = sugestoes[focusedIndex];
                        set("nome")(s.nome);
                        setCapaSelecionada(s.imagem ?? null);
                        setSugestoesAbertas(false);
                      }
                    }
                  }}
                  placeholder="Buscar jogo"
                  className="bg-surface-2 w-full"
                />
                {sugestoesAbertas && (buscando || sugestoes.length > 0) ? (
                  <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto overflow-x-hidden rounded-md border border-border bg-surface-2 p-1 shadow-lg">
                    {buscando && sugestoes.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">Buscando jogos…</p>
                    ) : null}
                    {sugestoes.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        ref={(el) => {
                          if (el && focusedIndex === idx) {
                            el.scrollIntoView({ block: "nearest" });
                          }
                        }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm overflow-hidden ${focusedIndex === idx ? "bg-background text-foreground" : "hover:bg-background"}`}
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
                        <span className="truncate flex-1" title={s.nome}>{s.nome}</span>
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
            {(form.status === "Zerado" || form.status === "Platinado") && (
              <div className="space-y-1.5 flex flex-col pt-1">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`justify-start text-left font-normal bg-surface-2 px-3 ${!form.data_zerado ? "text-muted-foreground" : ""}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{form.data_zerado ? format(new Date(form.data_zerado + "T12:00:00"), "dd/MM/yyyy") : "Selecione"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.data_zerado ? new Date(form.data_zerado + "T12:00:00") : undefined}
                      onSelect={(d) => set("data_zerado")(d ? format(d, "yyyy-MM-dd") : "")}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {(form.status === "Zerado" || form.status === "Platinado") && (
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
            )}
            {(form.status === "Zerado" || form.status === "Platinado") && (
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
            )}
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
