import { useEffect, useState } from "react";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";

const inputBase =
  "w-full h-11 rounded-xl border bg-background px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors";

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 10) return digits;
  const area = d.slice(0, 2);
  const rest = d.slice(2);
  return rest.length > 4
    ? `(${area}) ${rest.slice(0, -4)}-${rest.slice(-4)}`
    : `(${area}) ${rest}`;
}

export function PersonalDataView({
  token, customerName, onNameUpdated,
}: {
  token: string | null;
  customerName: string;
  onNameUpdated: (name: string) => void;
}) {
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState(customerName);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setName(customerName); }, [customerName]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let cancelled = false;
    fetch("/api/customer/profile", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: { customer?: { name: string; phone: string | null } }) => {
        if (!cancelled && data.customer?.phone) setPhone(data.customer.phone);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const submit = async () => {
    if (!name.trim()) { setError("Nome é obrigatório"); return; }
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json() as { customer?: { name: string }; error?: string };
      if (res.ok && data.customer) {
        onNameUpdated(data.customer.name);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(data.error || "Erro ao salvar dados");
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-1 space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Nome completo
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); setSaved(false); }}
          placeholder="Seu nome completo"
          className={inputBase + " border-border"}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Telefone
        </label>
        <div className="relative">
          <input
            type="text"
            value={phone ? formatPhone(phone) : ""}
            disabled
            readOnly
            className={inputBase + " border-border bg-secondary/50 text-muted-foreground cursor-not-allowed pr-10"}
          />
          <Lock className="w-3.5 h-3.5 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2" />
        </div>
        <p className="text-xs text-muted-foreground">
          Este é o telefone usado para entrar na sua conta — não pode ser alterado.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5">
          <p className="text-xs text-destructive font-medium">{error}</p>
        </div>
      )}

      <button
        onClick={submit}
        disabled={saving || name.trim() === customerName}
        className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {saved ? <><CheckCircle2 className="w-4 h-4" /> Salvo!</> : "Salvar alterações"}
      </button>
    </div>
  );
}
