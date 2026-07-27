import { useCallback, useState } from "react";
import { MapPin, Loader2, Plus, Star, Trash2, CheckCircle2, Search, X } from "lucide-react";
import {
  useCustomerAddresses, MAX_CUSTOMER_ADDRESSES,
  type AddressFormInput,
} from "@/lib/customer-profile-hooks";

const inputBase =
  "w-full h-11 rounded-xl border bg-background px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors";
const iNormal = `${inputBase} border-border`;
const iFilled = `${inputBase} border-primary/40 bg-primary/5`;

const EMPTY_FORM = { label: "", cep: "", street: "", number: "", neighborhood: "", city: "", state: "", complement: "" };

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function AddressesView({ token }: { token: string | null }) {
  const { addresses, loading, saving, error, setError, create, remove, setDefault } = useCustomerAddresses(token);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepFilled, setCepFilled] = useState(false);
  const [cepError, setCepError] = useState("");

  const atLimit = addresses.length >= MAX_CUSTOMER_ADDRESSES;

  const lookupCep = useCallback(async (digits: string) => {
    if (digits.length !== 8) return;
    setCepLoading(true); setCepError(""); setCepFilled(false);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (data.erro) { setCepError("CEP não encontrado."); return; }
      setForm(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      setCepFilled(true);
    } catch { setCepError("Não foi possível buscar o CEP."); }
    finally { setCepLoading(false); }
  }, []);

  const handleCepChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const masked = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setForm(prev => ({ ...prev, cep: masked }));
    setCepError(""); setCepFilled(false);
    if (digits.length === 8) lookupCep(digits);
  };

  const setField = (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const submit = async () => {
    if (!form.street.trim() || !form.number.trim() || !form.city.trim() || !form.state.trim()) {
      setError("Preencha rua, número, cidade e estado");
      return;
    }
    const input: AddressFormInput = {
      label: form.label.trim() || undefined,
      cep: form.cep,
      street: form.street.trim(),
      number: form.number.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      complement: form.complement.trim() || undefined,
    };
    const ok = await create(input);
    if (ok) {
      setForm(EMPTY_FORM); setCepFilled(false); setShowForm(false);
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
    <div className="px-1 space-y-3">
      {addresses.length === 0 && !showForm && (
        <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
          <MapPin className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm font-medium">Nenhum endereço salvo</p>
          <p className="text-xs text-muted-foreground">Adicione um endereço para agilizar seus próximos pedidos</p>
        </div>
      )}

      {addresses.map(addr => (
        <div key={addr.id} className="p-3.5 rounded-2xl border border-border bg-surface">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold">{addr.label || "Endereço"}</p>
                  {addr.isDefault && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Padrão</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {addr.neighborhood} · {addr.city}/{addr.state} · {addr.zip}
                </p>
              </div>
            </div>
            <button
              onClick={() => remove(addr.id)}
              aria-label="Remover endereço"
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {!addr.isDefault && (
            <button
              onClick={() => setDefault(addr.id)}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Star className="w-3.5 h-3.5" /> Definir como padrão
            </button>
          )}
        </div>
      ))}

      {showForm ? (
        <div className="p-4 rounded-2xl border border-border bg-surface space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Novo endereço</p>
            <button onClick={() => { setShowForm(false); setError(""); }} aria-label="Cancelar" className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <Field label="Apelido">
            <input type="text" placeholder="Casa, Trabalho..." value={form.label} onChange={setField("label")} className={iNormal} />
          </Field>

          <Field label="CEP" required>
            <div className="relative">
              <input type="text" inputMode="numeric" placeholder="00000-000" value={form.cep}
                onChange={(e) => handleCepChange(e.target.value)} className={cepFilled ? iFilled : iNormal} maxLength={9} autoFocus />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {cepLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!cepLoading && cepFilled && <CheckCircle2 className="w-4 h-4 text-primary" />}
                {!cepLoading && !cepFilled && form.cep.replace(/\D/g, "").length < 8 && <Search className="w-4 h-4 text-muted-foreground/40" />}
              </div>
            </div>
            {cepError && <p className="text-xs text-destructive mt-1">{cepError}</p>}
          </Field>

          <Field label="Rua / Logradouro" required>
            <input type="text" placeholder="Nome da rua" value={form.street} onChange={setField("street")}
              className={cepFilled && form.street ? iFilled : iNormal} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Número" required>
              <input type="text" inputMode="numeric" placeholder="Ex: 123" value={form.number} onChange={setField("number")} className={iNormal} />
            </Field>
            <Field label="Complemento">
              <input type="text" placeholder="Apto, Bloco..." value={form.complement} onChange={setField("complement")} className={iNormal} />
            </Field>
          </div>

          <Field label="Bairro">
            <input type="text" placeholder="Nome do bairro" value={form.neighborhood} onChange={setField("neighborhood")}
              className={cepFilled && form.neighborhood ? iFilled : iNormal} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field label="Cidade" required>
                <input type="text" placeholder="Cidade" value={form.city} onChange={setField("city")}
                  className={cepFilled && form.city ? iFilled : iNormal} />
              </Field>
            </div>
            <Field label="Estado" required>
              <input type="text" placeholder="UF" value={form.state} onChange={setField("state")} maxLength={2}
                className={`uppercase ${cepFilled && form.state ? iFilled : iNormal}`} />
            </Field>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-2.5">
              <p className="text-xs text-destructive font-medium">{error}</p>
            </div>
          )}

          <button onClick={submit} disabled={saving}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar endereço
          </button>
        </div>
      ) : (
        <button
          onClick={() => { if (!atLimit) setShowForm(true); }}
          disabled={atLimit}
          className="w-full h-11 rounded-xl border border-dashed border-border flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
        >
          <Plus className="w-4 h-4" />
          {atLimit ? `Limite de ${MAX_CUSTOMER_ADDRESSES} endereços atingido` : "Adicionar endereço"}
        </button>
      )}
    </div>
  );
}
