import { useState } from "react";
import { FileText, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { maskCpfCnpjDigitado, validarCpfCnpj } from "@/lib/customer/cpf-cnpj";

// ─────────────────────────────────────────────────────────────────────────
// Tela de bloqueio "CNPJ/CPF pendente" — mesmo espírito da tela de plano
// vencido (admin.tsx): substitui o conteúdo da página inteira até o lojista
// resolver. Só aparece pra contas antigas, de antes dessa exigência entrar
// no cadastro (registerHandler já pede documento desde então); depois de
// salvo aqui, é a MESMA trava de Configurações → Geral — uma vez vinculado,
// só o suporte corrige.
// ─────────────────────────────────────────────────────────────────────────
export function CompleteDocumentoLoja({ storeId, onResolved }: { storeId: string; onResolved: () => void }) {
  const [documento, setDocumento] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valido = validarCpfCnpj(documento);
  const tocado = documento.trim() !== "";

  const handleSave = async () => {
    if (!valido) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/api/store/update", { storeId, documentoTitular: documento });
      const data = await res.json();
      if (res.ok) {
        onResolved();
      } else {
        setError(data.error || "Erro ao salvar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-2">
      <Label className="flex items-center gap-1.5 text-sm">
        <FileText className="w-3.5 h-3.5" />
        CNPJ ou CPF do titular da conta
      </Label>
      <Input
        value={documento}
        onChange={(e) => setDocumento(maskCpfCnpjDigitado(e.target.value))}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        placeholder="000.000.000-00"
        inputMode="numeric"
        autoFocus
        className={`h-11 rounded-xl ${tocado && !valido ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
      />
      {tocado && !valido && <p className="text-xs text-destructive">CPF/CNPJ inválido. Confira os números digitados.</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Depois de salvo, só o suporte pode alterar — confira bem antes de continuar.
      </p>
      <Button
        onClick={handleSave}
        disabled={!valido || saving}
        className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow mt-1"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Confirmar e continuar</>}
      </Button>
    </div>
  );
}
