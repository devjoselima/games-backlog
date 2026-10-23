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
import { format } from "date-fns";
import { CalendarIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_OPTIONS, STATUS_OPTIONS, type Game } from "@/lib/games";

export function EditGameModal({ jogo, capa, children }: { jogo: Game; capa?: string | null; children: React.ReactNode }) {
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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setForm({
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
      <DialogContent className="sm:max-w-[650px] bg-background p-0 overflow-hidden gap-0 border-border">
        <div className="flex flex-col sm:flex-row h-full w-full">
          {capa && (
            <div className="hidden sm:block w-[160px] shrink-0 bg-surface-2 relative">
              <img src={capa} alt={jogo.nome} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
            </div>
          )}
          <div className="flex-1 flex flex-col p-6">
            <DialogHeader>
              <DialogTitle className="line-clamp-2 leading-tight" title={jogo.nome}>{jogo.nome}</DialogTitle>
            </DialogHeader>
            <form
              className="flex flex-col gap-4 pt-4 w-full h-full"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.status === "Platinado" && !form.data_platinado) {
              toast.error("Informe a data em que o jogo foi platinado");
              return;
            }
            atualizar.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
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

            <div className="mt-auto flex gap-2 pt-4">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
