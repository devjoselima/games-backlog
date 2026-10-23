import { useState, useEffect, useRef } from "react";
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
import { PLATFORM_OPTIONS, STATUS_OPTIONS, gamesQuery } from "@/lib/games";
import { searchGames } from "@/lib/game-search.functions";
import { useNavigate } from "@tanstack/react-router";

const vazio = {
  nome: "",
  genero: "",
  plataforma: "",
  status: "Zerado",
  data_zerado: "",
  data_platinado: "",
  nota: "",
  horas_jogadas: "",
};

export function LogGameModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(vazio);
  const [suggestionsOpen, setSugestoesAbertas] = useState(false);
  const [search, setBusca] = useState("");
  const [selectedCover, setCapaSelecionada] = useState<string | null>(null);
  const [searchTerm, setTermoBusca] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const blurTimerRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: games = [] } = useQuery(gamesQuery);

  const duplicatedGame = form.nome
    ? games.find(g => g.nome.toLowerCase() === form.nome.toLowerCase().trim())
    : null;

  useEffect(() => {
    const t = window.setTimeout(() => setTermoBusca(search.trim()), 500);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: suggestions = [], isFetching: isSearching } = useQuery({
    queryKey: ["search-games", searchTerm],
    queryFn: () => searchGames({ data: { termo: searchTerm } }),
    enabled: searchTerm.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    setFocusedIndex(-1);
  }, [suggestions, search]);

  const set = (k: keyof typeof vazio) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: sessao } = await supabase.auth.getUser();
      const uid = sessao.user?.id;
      if (!uid) throw new Error("Sessão expirada. Faça login novamente.");
      
      const isConcluido = form.status === "Zerado" || form.status === "Platinado";
      const isPlatinado = form.status === "Platinado";
      const isJogando = form.status === "Jogando";
      const dataZeradoFinal = isConcluido ? (form.data_zerado || null) : null;
      const dataPlatinadoFinal = isPlatinado ? (form.data_platinado || null) : null;
      const dataReferencia = dataPlatinadoFinal || dataZeradoFinal;
      const anoJogadoFinal = dataReferencia ? Number(dataReferencia.split("-")[0]) : null;
      const notaFinal = isConcluido && form.nota ? Number(form.nota.replace(",", ".")) : null;
      const horasFinal = (isConcluido || isJogando) && form.horas_jogadas ? Number(form.horas_jogadas.replace(",", ".")) : null;

      const payload: {
        user_id: string;
        nome: string;
        genero?: string | null;
        plataforma?: string | null;
        status: string;
        data_zerado?: string | null;
        data_platinado?: string | null;
        ano_jogado?: number | null;
        nota?: number | null;
        horas_jogadas?: number | null;
        imagem?: string | null;
      } = {
        user_id: uid,
        nome: form.nome.trim(),
        genero: form.genero || null,
        plataforma: form.plataforma || null,
        status: form.status,
        data_zerado: dataZeradoFinal,
        data_platinado: dataPlatinadoFinal,
        ano_jogado: anoJogadoFinal,
        nota: notaFinal,
        horas_jogadas: horasFinal,
        imagem: selectedCover,
      };

      const { error } = await supabase.from("jogos").insert(payload);
      if (error) {
        if (error.message?.includes("data_platinado") || (error as any).code === "42703") {
          delete payload.data_platinado;
          const retry = await supabase.from("jogos").insert(payload);
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast.success("Game cadastrado!");
      setForm({ ...vazio });
      setBusca("");
      setCapaSelecionada(null);
      setOpen(false);
      navigate({ to: "/profile" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[650px] w-[95vw] bg-background">
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
            if (form.status === "Platinado" && !form.data_platinado) {
              toast.error("Informe a data em que o jogo foi platinado");
              return;
            }
            createMutation.mutate();
          }}
        >
          <div className="space-y-1.5 w-full">
            <Label htmlFor="nome">Nome do jogo</Label>
            {form.nome ? (
              <div className="flex items-center gap-2 rounded-md bg-surface-2 p-2 w-full overflow-hidden">
                {selectedCover ? (
                  <img
                    src={selectedCover}
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
                  value={search}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setSugestoesAbertas(true);
                  }}
                  onFocus={() => setSugestoesAbertas(true)}
                  onBlur={() => {
                    if (blurTimerRef.current !== null) window.clearTimeout(blurTimerRef.current);
                    blurTimerRef.current = window.setTimeout(() => setSugestoesAbertas(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && form.nome) return; // allows submitting if game is already picked
                    if (e.key === "Enter" && !form.nome && search) {
                      e.preventDefault();
                    }
                    if (!suggestionsOpen || suggestions.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setFocusedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
                        const s = suggestions[focusedIndex];
                        set("nome")(s.nome);
                        set("genero")(s.genero || "");
                        setCapaSelecionada(s.imagem ?? null);
                        setSugestoesAbertas(false);
                      }
                    }
                  }}
                  placeholder="Buscar jogo"
                  className="bg-surface-2 w-full"
                />
                {suggestionsOpen && (isSearching || suggestions.length > 0 || searchTerm.length >= 2) ? (
                  <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto overflow-x-hidden rounded-md border border-border bg-surface-2 p-1 shadow-lg">
                    {isSearching && suggestions.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">Buscando games…</p>
                    ) : !isSearching && suggestions.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">Nenhum jogo encontrado.</p>
                    ) : null}
                    {suggestions.map((s, idx) => (
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
                          set("genero")(s.genero || "");
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

          {duplicatedGame && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-500 mt-2">
              Aviso: Você já tem <strong>{duplicatedGame.nome}</strong> cadastrado no status "<strong>{duplicatedGame.status}</strong>".
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select value={form.plataforma} onValueChange={set("plataforma")}>
                <SelectTrigger className="bg-surface-2">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(val) => {
                  set("status")(val);
                  if (val === "Platinado" && !form.data_platinado && form.data_zerado) {
                    set("data_platinado")(form.data_zerado);
                  }
                }}
              >
                <SelectTrigger className="bg-surface-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.status === "Zerado" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 flex flex-col pt-1">
                <Label>Zerado em</Label>
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
                    {form.data_zerado && (
                      <div className="p-2 border-t border-border flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-muted-foreground hover:text-foreground"
                          onClick={() => set("data_zerado")("")}
                        >
                          Limpar data
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
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
          )}

          {form.status === "Platinado" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 flex flex-col pt-1">
                  <Label>Zerado em</Label>
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
                      {form.data_zerado && (
                        <div className="p-2 border-t border-border flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-muted-foreground hover:text-foreground"
                            onClick={() => set("data_zerado")("")}
                          >
                            Limpar data
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5 flex flex-col pt-1">
                  <Label>
                    Platinado em <span className="text-destructive">*</span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`justify-start text-left font-normal bg-surface-2 px-3 ${!form.data_platinado ? "text-muted-foreground" : ""}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <span className="truncate">{form.data_platinado ? format(new Date(form.data_platinado + "T12:00:00"), "dd/MM/yyyy") : "Selecione"}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.data_platinado ? new Date(form.data_platinado + "T12:00:00") : undefined}
                        onSelect={(d) => set("data_platinado")(d ? format(d, "yyyy-MM-dd") : "")}
                        initialFocus
                      />
                      {form.data_platinado && (
                        <div className="p-2 border-t border-border flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-muted-foreground hover:text-foreground"
                            onClick={() => set("data_platinado")("")}
                          >
                            Limpar data
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
            </>
          )}

          {form.status === "Jogando" && (
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

          <div className="mt-4 flex gap-2">
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando…" : "Salvar Log"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
