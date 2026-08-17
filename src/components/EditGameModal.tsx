import { useState } from "react";
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
import { PLATAFORMA_OPCOES, STATUS_OPCOES, type Jogo } from "@/lib/jogos";

export function EditGameModal({ jogo, capa, children }: { jogo: Jogo; capa?: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    plataforma: jogo.plataforma || "",
    status: jogo.status || "Zerado",
    data_zerado: jogo.data_zerado || (jogo.ano_jogado ? `${jogo.ano_jogado}-01-01` : ""),
    nota: jogo.nota ? String(jogo.nota) : "",
    horas_jogadas: jogo.horas_jogadas ? String(jogo.horas_jogadas) : "",
  });
  const queryClient = useQueryClient();

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const atualizar = useMutation({
    mutationFn: async () => {
      const isConcluido = form.status === "Zerado" || form.status === "Platinado";
      const dataFinal = isConcluido ? (form.data_zerado || null) : null;
      const notaFinal = isConcluido && form.nota ? Number(form.nota.replace(",", ".")) : null;
      const horasFinal = isConcluido && form.horas_jogadas ? Number(form.horas_jogadas.replace(",", ".")) : null;

      const { error } = await supabase
        .from("jogos")
        .update({
          plataforma: form.plataforma || null,
          status: form.status,
          data_zerado: dataFinal,
          ano_jogado: dataFinal ? Number(dataFinal.split("-")[0]) : null,
          nota: notaFinal,
          horas_jogadas: horasFinal,
        })
        .eq("id", jogo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jogos"] });
      toast.success("Jogo atualizado!");
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
      queryClient.invalidateQueries({ queryKey: ["jogos"] });
      toast.success("Jogo excluído!");
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
            atualizar.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
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

            <div className="mt-auto flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10 hover:text-red-500"
                disabled={excluir.isPending || atualizar.isPending}
                onClick={() => {
                  if (window.confirm("Tem certeza que deseja excluir este jogo?")) {
                    excluir.mutate();
                  }
                }}
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
