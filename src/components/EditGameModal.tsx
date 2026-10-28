import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Award, CalendarIcon, Clock, Medal, RefreshCw, Sparkles, Trash2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  PLATFORM_OPTIONS,
  STATUS_OPTIONS,
  saveGameDetailsToDb,
  type Game,
  type PsnTrophyBreakdown,
} from "@/lib/games";
import { getGameModalDetails } from "@/lib/game-details.server";

function getHighResCover(url?: string | null): string | null {
  if (!url) return null;
  return url.replace(
    /\/t_(?:cover_big|cover_small|thumb|logo_med)\//i,
    "/t_cover_big_2x/",
  );
}

export function EditGameModal({ jogo, capa, children }: { jogo: Game; capa?: string | null; children: React.ReactNode }) {
  const highResCapa = getHighResCover(capa ?? jogo.imagem);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    plataforma: jogo.plataforma || "",
    status: jogo.status || "Zerado",
    data_zerado: jogo.data_zerado || (jogo.ano_jogado && jogo.status !== "Platinado" ? `${jogo.ano_jogado}-01-01` : ""),
    data_platinado:
      jogo.data_platinado ||
      (jogo.status === "Platinado"
        ? (jogo.data_zerado || (jogo.ano_jogado ? `${jogo.ano_jogado}-01-01` : ""))
        : ""),
    nota: jogo.nota ? String(jogo.nota) : "",
    horas_jogadas: jogo.horas_jogadas ? String(jogo.horas_jogadas) : "",
  });

  const [details, setDetails] = useState<{
    tempo_zerar: number | null;
    tempo_platinar: number | null;
    trofeus_obtidos: number | null;
    trofeus_totais: number | null;
    trofeus_psn: PsnTrophyBreakdown | null;
  }>({
    tempo_zerar: jogo.tempo_zerar ?? null,
    tempo_platinar: jogo.tempo_platinar ?? null,
    trofeus_obtidos: jogo.trofeus_obtidos ?? null,
    trofeus_totais: jogo.trofeus_totais ?? null,
    trofeus_psn: jogo.trofeus_psn ?? null,
  });
  const [loadingTime, setLoadingTime] = useState(false);
  const [loadingTrophies, setLoadingTrophies] = useState(false);
  const queryClient = useQueryClient();

  const showTrophiesSection =
    form.status === "Jogando" || form.status === "Zerado" || form.status === "Platinado";
  const supportsTrophiesPlatform =
    form.plataforma === "PSN" || form.plataforma === "Steam";

  const fetchAndPersistDetails = async (opts: {
    forceTime?: boolean;
    forceTrophies?: boolean;
    plataformaAtual?: string;
    statusAtual?: string;
  }) => {
    const plat = opts.plataformaAtual ?? form.plataforma;
    const st = opts.statusAtual ?? form.status;
    const canShowTrophies =
      (st === "Jogando" || st === "Zerado" || st === "Platinado") &&
      (plat === "PSN" || plat === "Steam");

    const needTime =
      Boolean(opts.forceTime) ||
      (details.tempo_zerar === null && details.tempo_platinar === null);
    const needAch =
      canShowTrophies &&
      (Boolean(opts.forceTrophies) ||
        details.trofeus_totais === null ||
        (plat === "PSN" && !details.trofeus_psn));

    if (!needTime && !needAch) return;

    if (needTime && details.tempo_zerar === null && details.tempo_platinar === null) {
      setLoadingTime(true);
    }
    if (needAch && details.trofeus_totais === null) {
      setLoadingTrophies(true);
    }

    try {
      const res = await getGameModalDetails({
        data: {
          nome: jogo.nome,
          imagem: jogo.imagem,
          plataforma: plat || null,
          includeAchievements: needAch,
          needTimeToBeat: needTime,
        },
      });

      const patch: Partial<typeof details> = {};
      if (needTime && res.timeToBeat) {
        patch.tempo_zerar = res.timeToBeat.mainHours;
        patch.tempo_platinar = res.timeToBeat.completionistHours;
      }
      if (needAch && res.achievements) {
        patch.trofeus_obtidos = res.achievements.unlocked;
        patch.trofeus_totais = res.achievements.total;
        patch.trofeus_psn = res.achievements.breakdown ?? null;
      }

      if (Object.keys(patch).length > 0) {
        setDetails((prev) => ({ ...prev, ...patch }));
        await saveGameDetailsToDb(jogo.id, patch);
        queryClient.setQueryData<Game[]>(["games"], (old) =>
          old ? old.map((g) => (g.id === jogo.id ? { ...g, ...patch } : g)) : old,
        );
      }
    } catch {
      // silent fallback
    } finally {
      if (needTime) setLoadingTime(false);
      if (needAch) setLoadingTrophies(false);
    }
  };

  useEffect(() => {
    if (open) {
      const initialForm = {
        plataforma: jogo.plataforma || "",
        status: jogo.status || "Zerado",
        data_zerado: jogo.data_zerado || (jogo.ano_jogado && jogo.status !== "Platinado" ? `${jogo.ano_jogado}-01-01` : ""),
        data_platinado:
          jogo.data_platinado ||
          (jogo.status === "Platinado"
            ? (jogo.data_zerado || (jogo.ano_jogado ? `${jogo.ano_jogado}-01-01` : ""))
            : ""),
        nota: jogo.nota ? String(jogo.nota) : "",
        horas_jogadas: jogo.horas_jogadas ? String(jogo.horas_jogadas) : "",
      };
      setForm(initialForm);
      setDetails({
        tempo_zerar: jogo.tempo_zerar ?? null,
        tempo_platinar: jogo.tempo_platinar ?? null,
        trofeus_obtidos: jogo.trofeus_obtidos ?? null,
        trofeus_totais: jogo.trofeus_totais ?? null,
        trofeus_psn: jogo.trofeus_psn ?? null,
      });

      const needTime = jogo.tempo_zerar === null && jogo.tempo_platinar === null;
      const canShowTrophies =
        (initialForm.status === "Jogando" ||
          initialForm.status === "Zerado" ||
          initialForm.status === "Platinado") &&
        (initialForm.plataforma === "PSN" || initialForm.plataforma === "Steam");
      const needAch =
        canShowTrophies &&
        (jogo.trofeus_totais === null ||
          (initialForm.plataforma === "PSN" && !jogo.trofeus_psn));

      if (needTime || needAch) {
        void fetchAndPersistDetails({
          plataformaAtual: initialForm.plataforma,
          statusAtual: initialForm.status,
        });
      }
    }
  }, [open, jogo]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const atualizar = useMutation({
    mutationFn: async () => {
      const isConcluido = form.status === "Zerado" || form.status === "Platinado";
      const isPlatinado = form.status === "Platinado";
      const isJogando = form.status === "Jogando";
      const dataZeradoFinal = isConcluido ? (form.data_zerado || null) : null;
      const dataPlatinadoFinal = isPlatinado ? (form.data_platinado || null) : null;
      const dataReferencia = dataPlatinadoFinal || dataZeradoFinal;
      const anoJogadoFinal = dataReferencia ? Number(dataReferencia.split("-")[0]) : (isConcluido ? jogo.ano_jogado : null);
      const notaFinal = isConcluido && form.nota ? Number(form.nota.replace(",", ".")) : null;
      const horasFinal = (isConcluido || isJogando) && form.horas_jogadas ? Number(form.horas_jogadas.replace(",", ".")) : null;

      const payload: {
        plataforma?: string | null;
        status?: string;
        data_zerado?: string | null;
        data_platinado?: string | null;
        ano_jogado?: number | null;
        nota?: number | null;
        horas_jogadas?: number | null;
      } = {
        plataforma: form.plataforma || null,
        status: form.status,
        data_zerado: dataZeradoFinal,
        data_platinado: dataPlatinadoFinal,
        ano_jogado: anoJogadoFinal,
        nota: notaFinal,
        horas_jogadas: horasFinal,
      };

      const { error } = await supabase
        .from("jogos")
        .update(payload)
        .eq("id", jogo.id);
      if (error) {
        if (error.message?.includes("data_platinado") || (error as any).code === "42703") {
          delete payload.data_platinado;
          const retry = await supabase.from("jogos").update(payload).eq("id", jogo.id);
          if (retry.error) throw retry.error;
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast.success("Game atualizado!");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("jogos").delete().eq("id", jogo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      toast.success("Game excluído!");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[540px] bg-background p-6 gap-0 border-border">
        <form
          className="flex flex-col gap-4 w-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.status === "Platinado" && !form.data_platinado) {
              toast.error("Informe a data em que o jogo foi platinado");
              return;
            }
            atualizar.mutate();
          }}
        >
          {/* Topo: Capa 3:4 à esquerda + (Título, Tempo Zerar/Platinar e Status/Plataforma) à direita */}
          <div className="flex items-start gap-4">
            {highResCapa && (
              <div className="w-28 sm:w-32 aspect-[3/4] shrink-0 rounded-lg overflow-hidden border border-border/80 bg-surface-2 shadow-md">
                <img
                  src={highResCapa}
                  alt={jogo.nome}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-2.5">
              <DialogHeader className="text-left pr-6">
                <DialogTitle className="text-lg sm:text-xl font-bold line-clamp-2 leading-tight" title={jogo.nome}>
                  {jogo.nome}
                </DialogTitle>
              </DialogHeader>

              {/* Cards de Tempo (Zerar / Platinar) logo abaixo do título */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-surface-2/70 px-2.5 py-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ember/15 text-ember">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground leading-none">
                      Zerar
                    </p>
                    {loadingTime ? (
                      <Skeleton className="mt-1 h-4 w-12" />
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-foreground leading-none">
                        {details.tempo_zerar !== null
                          ? `~${String(details.tempo_zerar).replace(".", ",")}h`
                          : "—"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-lg border border-border/80 bg-surface-2/70 px-2.5 py-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-platinum/15 text-platinum">
                    <Trophy className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground leading-none">
                      Platinar
                    </p>
                    {loadingTime ? (
                      <Skeleton className="mt-1 h-4 w-12" />
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-foreground leading-none">
                        {details.tempo_platinar !== null
                          ? `~${String(details.tempo_platinar).replace(".", ",")}h`
                          : "—"}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Status e Plataforma preenchendo a base ao lado da capa */}
              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(val) => {
                      set("status")(val);
                      if (val === "Platinado" && !form.data_platinado && form.data_zerado) {
                        set("data_platinado")(form.data_zerado);
                      }
                      if (
                        (val === "Jogando" || val === "Zerado" || val === "Platinado") &&
                        details.trofeus_totais === null
                      ) {
                        void fetchAndPersistDetails({ statusAtual: val });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-surface-2 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Plataforma</Label>
                  <Select
                    value={form.plataforma}
                    disabled={form.status === "Zerado" || form.status === "Platinado"}
                    onValueChange={(val) => {
                      set("plataforma")(val);
                      if (val === "PSN" || val === "Steam") {
                        void fetchAndPersistDetails({
                          plataformaAtual: val,
                          forceTrophies: val !== jogo.plataforma,
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="bg-surface-2 h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Progresso de Troféus / Conquistas (Largura total abaixo do topo) */}
          {showTrophiesSection && supportsTrophiesPlatform && (
            <div className="rounded-lg border border-border/80 bg-surface-2/60 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Award className="h-3.5 w-3.5 text-ember" />
                  <span>
                    {form.plataforma === "PSN" ? "Troféus PSN" : "Conquistas Steam"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {loadingTrophies ? (
                    <Skeleton className="h-4 w-24" />
                  ) : details.trofeus_totais !== null && details.trofeus_totais > 0 ? (
                    <span className="text-xs font-semibold text-foreground">
                      {details.trofeus_obtidos ?? 0} / {details.trofeus_totais}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({Math.min(100, Math.round(((details.trofeus_obtidos ?? 0) / details.trofeus_totais) * 100))}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem dados</span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void fetchAndPersistDetails({
                        forceTrophies: true,
                        forceTime: details.tempo_zerar === null && details.tempo_platinar === null,
                      })
                    }
                    disabled={loadingTrophies}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
                    title="Atualizar progresso de troféus"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingTrophies ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {loadingTrophies ? (
                <Skeleton className="mt-2 h-2 w-full rounded-full" />
              ) : (
                details.trofeus_totais !== null &&
                details.trofeus_totais > 0 && (
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-background/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (details.trofeus_obtidos ?? 0) >= details.trofeus_totais
                          ? "bg-platinum"
                          : "bg-ember"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((details.trofeus_obtidos ?? 0) / details.trofeus_totais) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                )
              )}

              {/* Incremento I2: Quebra por raridade quando for PSN */}
              {form.plataforma === "PSN" && !loadingTrophies && details.trofeus_psn && (
                <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                  <div className="flex items-center justify-between rounded border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[11px]">
                    <span className="flex items-center gap-1 font-medium text-sky-300" title="Platina">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span>Plat.</span>
                    </span>
                    <span className="font-semibold text-foreground">
                      {details.trofeus_psn.platinum.earned}/{details.trofeus_psn.platinum.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[11px]">
                    <span className="flex items-center gap-1 font-medium text-amber-300" title="Ouro">
                      <Trophy className="h-3 w-3 shrink-0" />
                      <span>Ouro</span>
                    </span>
                    <span className="font-semibold text-foreground">
                      {details.trofeus_psn.gold.earned}/{details.trofeus_psn.gold.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-slate-300/20 bg-slate-400/10 px-2 py-1 text-[11px]">
                    <span className="flex items-center gap-1 font-medium text-slate-300" title="Prata">
                      <Medal className="h-3 w-3 shrink-0" />
                      <span>Prata</span>
                    </span>
                    <span className="font-semibold text-foreground">
                      {details.trofeus_psn.silver.earned}/{details.trofeus_psn.silver.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[11px]">
                    <span className="flex items-center gap-1 font-medium text-orange-300" title="Bronze">
                      <Medal className="h-3 w-3 shrink-0" />
                      <span>Bronze</span>
                    </span>
                    <span className="font-semibold text-foreground">
                      {details.trofeus_psn.bronze.earned}/{details.trofeus_psn.bronze.total}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

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

            <div className="mt-1 flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                disabled={excluir.isPending || atualizar.isPending}
                onClick={() => excluir.mutate()}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
              <Button type="submit" className="flex-1" disabled={excluir.isPending || atualizar.isPending}>
                {atualizar.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
