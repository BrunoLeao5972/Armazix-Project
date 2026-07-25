import { useState, useEffect } from "react";
import { api } from "@/lib/api-client";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Sector } from "./setores";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#64748b",
];

export default function SectorModal({
  open, onClose, onSaved, editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (sector: Sector, isNew: boolean) => void;
  editing: Sector | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setColor(editing.color ?? PRESET_COLORS[0]);
    } else {
      setName("");
      setDescription("");
      setColor(PRESET_COLORS[0]);
    }
    setError(null);
  }, [editing, open]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome obrigatório"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, color };
      const res = editing
        ? await api.post("/api/sectors/update", { sectorId: editing.id, ...payload })
        : await api.post("/api/sectors/create", payload);
      const data = await res.json();
      if (res.ok && data.sector) {
        onSaved(data.sector, !editing);
        onClose();
      } else {
        setError(data?.error ?? "Erro ao salvar setor");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar setor" : "Novo setor"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              placeholder="Ex: Prateleira A, Refrigerados..."
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-10 rounded-xl"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              placeholder="Localização ou observação"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Cor de identificação</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editing ? "Salvar" : "Criar setor")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
