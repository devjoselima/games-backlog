import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trophy, Trash2 } from "lucide-react";

export type SyncResultDisplay = {
  id: string;
  localName: string;
  steamName: string;
  horas: number;
  platinou: boolean;
  status: string;
  trofeus_obtidos?: number | null;
  trofeus_totais?: number | null;
};

export function SteamSyncModal({ children, onSync, isSyncing, pendingResults, onConfirm, onCancel }: { 
  children: React.ReactNode; 
  onSync: (steamId: string) => void; 
  isSyncing: boolean;
  pendingResults: SyncResultDisplay[] | null;
  onConfirm: (results: SyncResultDisplay[]) => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [steamId, setSteamId] = useState("");
  const [editableResults, setEditableResults] = useState<SyncResultDisplay[]>([]);

  useEffect(() => {
    if (pendingResults && pendingResults.length > 0) {
      setEditableResults(pendingResults);
      setOpen(true);
    }
  }, [pendingResults]);

  const handleSync = () => {
    if (!steamId) return;
    onSync(steamId);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      onCancel();
    }
  };

  const removeItem = (id: string) => {
    setEditableResults(prev => prev.filter(r => r.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        {pendingResults ? (
          <>
            <DialogHeader>
              <DialogTitle>Revisar Sincronização</DialogTitle>
              <DialogDescription>
                Revise os jogos encontrados antes de salvar. Remova os que não quiser sincronizar.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[300px] overflow-y-auto space-y-3 py-4 pr-2">
              {editableResults.length === 0 && (
                <div className="text-sm text-center text-muted-foreground py-4">Nenhum jogo selecionado.</div>
              )}
              {editableResults.map((r, i) => (
                <div key={r.id} className="flex flex-col border border-border rounded-md p-3 bg-surface-2 text-sm relative pr-10">
                  <span className="font-semibold text-foreground line-clamp-1">{r.localName}</span>
                  <span className="text-xs text-muted-foreground mt-0.5 mb-2 line-clamp-1">Steam: {r.steamName}</span>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <span className="text-emerald-500">{r.horas} horas</span>
                    {r.platinou && (
                      <span className="flex items-center gap-1 text-platinum">
                        <Trophy className="w-3.5 h-3.5" /> Platinado
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => removeItem(r.id)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-md hover:bg-surface"
                    title="Remover da sincronização"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                onClick={() => {
                  onConfirm(editableResults);
                  setOpen(false);
                }}
                disabled={editableResults.length === 0}
              >
                Salvar ({editableResults.length})
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Sincronizar com a Steam</DialogTitle>
              <DialogDescription>
                Insira seu <strong>SteamID64</strong> (17 números) para buscarmos suas horas e conquistas na Steam. Certifique-se de que a aba "Detalhes dos Jogos" está pública no seu perfil.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="steamid" className="text-left">
                  Steam ID
                </Label>
                <Input
                  id="steamid"
                  value={steamId}
                  onChange={(e) => setSteamId(e.target.value)}
                  placeholder="Ex: 76561198000000000"
                  className="col-span-3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="button" onClick={handleSync} disabled={isSyncing || steamId.length !== 17}>
                {isSyncing ? "Buscando..." : "Buscar na Steam"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
