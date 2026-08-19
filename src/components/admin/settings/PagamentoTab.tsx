import { useEffect, useState } from "react";
import {
  Wallet, Banknote, CreditCard, QrCode, Check, Loader2, KeyRound,
  Eye, EyeOff, ShieldCheck, ShieldAlert, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { DEFAULT_PAYMENT_CONFIG, type PaymentConfig, type TipoChavePix } from "@/lib/store-context";
import type { StoreData } from "./types";

interface PagamentoTabProps {
  store: StoreData | null;
  setStore: (store: StoreData) => void;
}

const PIX_KEY_TYPES: { value: TipoChavePix; label: string }[] = [
  { value: "cpf",       label: "CPF" },
  { value: "cnpj",      label: "CNPJ" },
  { value: "email",     label: "E-mail" },
  { value: "celular",   label: "Celular" },
  { value: "aleatoria", label: "Chave aleatória" },
];

export function PagamentoTab({ store, setStore }: PagamentoTabProps) {
  const [cfg, setCfg] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // ── Conexão Mercado Pago (credenciais próprias, endpoint separado) ──────
  const [showMpForm, setShowMpForm] = useState(false);
  const [mpToken, setMpToken] = useState("");
  const [mpPublicKey, setMpPublicKey] = useState("");
  const [showMpToken, setShowMpToken] = useState(false);
  const [mpSaving, setMpSaving] = useState(false);
  const [mpError, setMpError] = useState("");
  const [mpSuccess, setMpSuccess] = useState(false);

  // paymentConfig só existe no banco depois da primeira gravação — antes
  // disso a loja já aceita pagamento na entrega com os padrões (mesmo
  // DEFAULT_PAYMENT_CONFIG que checkout.tsx e o rodapé da vitrine usam).
  useEffect(() => {
    if (store?.paymentConfig) setCfg(store.paymentConfig);
  }, [store?.paymentConfig]);

  const mpConnected = store?.mpConnected === true;

  const handleSave = async () => {
    if (!store) return;
    setSaving(true); setSuccess(false); setError("");
    try {
      const res = await api.post("/api/store/payment-config", { paymentConfig: cfg });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setStore({ ...store, paymentConfig: cfg });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Erro ao salvar");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectMp = async () => {
    if (!mpToken.trim()) { setMpError("Informe o Access Token"); return; }
    setMpSaving(true); setMpError(""); setMpSuccess(false);
    try {
      const res = await api.post("/api/payments/mp-token", {
        accessToken: mpToken.trim(),
        publicKey:   mpPublicKey.trim() || undefined,
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (res.ok && data.success) {
        setStore({
          ...store!,
          mpConnected: true,
          mpPublicKey: mpPublicKey.trim() || store?.mpPublicKey || null,
        });
        setMpToken(""); setMpPublicKey(""); setShowMpForm(false);
        setMpSuccess(true);
        setTimeout(() => setMpSuccess(false), 3000);
      } else {
        setMpError(data.error || "Erro ao conectar com o Mercado Pago");
      }
    } catch {
      setMpError("Erro de conexão");
    } finally {
      setMpSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/20 p-3 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-700 dark:text-blue-400" />
        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
          Isso configura o que o <strong>cliente</strong> vê na loja online (checkout e rodapé). As formas de
          pagamento do balcão/PDV são separadas — ficam em <strong>Financeiro → Formas de Pagamento</strong>.
        </p>
      </div>

      {/* ── Pagamento na Entrega ─────────────────────────────────────────── */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              Pagamento na Entrega
            </CardTitle>
            <Switch
              checked={cfg.delivery.enabled}
              onCheckedChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, enabled: v } }))}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Formas aceitas na maquininha do entregador ou na retirada no local.
          </p>
        </CardHeader>
        {cfg.delivery.enabled && (
          <CardContent className="space-y-3">
            {/* Dinheiro */}
            <div className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Banknote className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">Dinheiro</span>
                </div>
                <Switch
                  checked={cfg.delivery.cash.enabled}
                  onCheckedChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, cash: { ...prev.delivery.cash, enabled: v } } }))}
                />
              </div>
              {cfg.delivery.cash.enabled && (
                <label className="flex items-center justify-between gap-3 pl-6 cursor-pointer select-none">
                  <span className="text-xs text-muted-foreground">Perguntar se precisa de troco</span>
                  <Switch
                    checked={cfg.delivery.cash.changeEnabled}
                    onCheckedChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, cash: { ...prev.delivery.cash, changeEnabled: v } } }))}
                  />
                </label>
              )}
            </div>

            {/* Cartão de Crédito */}
            <div className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">Cartão de Crédito</span>
                </div>
                <Switch
                  checked={cfg.delivery.creditCard.enabled}
                  onCheckedChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, creditCard: { ...prev.delivery.creditCard, enabled: v } } }))}
                />
              </div>
              {cfg.delivery.creditCard.enabled && (
                <>
                  <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
                    <span className="text-xs text-muted-foreground">Maquininha aceita parcelamento</span>
                    <Switch
                      checked={cfg.delivery.creditCard.installmentsEnabled}
                      onCheckedChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, creditCard: { ...prev.delivery.creditCard, installmentsEnabled: v, maxInstallments: v ? Math.max(prev.delivery.creditCard.maxInstallments, 2) : 1 } } }))}
                    />
                  </label>
                  {cfg.delivery.creditCard.installmentsEnabled && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">Máximo de parcelas</Label>
                      <Input
                        type="number" min={2} max={12}
                        value={cfg.delivery.creditCard.maxInstallments}
                        onChange={(e) => {
                          const n = Math.min(12, Math.max(2, Number(e.target.value) || 2));
                          setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, creditCard: { ...prev.delivery.creditCard, maxInstallments: n } } }));
                        }}
                        className="h-9 rounded-lg w-20"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Cartão de Débito */}
            <div className="rounded-xl border border-border/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">Cartão de Débito</span>
                </div>
                <Switch
                  checked={cfg.delivery.debitCard.enabled}
                  onCheckedChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, debitCard: { enabled: v } } }))}
                />
              </div>
            </div>

            {/* PIX */}
            <div className="rounded-xl border border-border/50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <QrCode className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">PIX</span>
                </div>
                <Switch
                  checked={cfg.delivery.pix.enabled}
                  onCheckedChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, pix: { ...prev.delivery.pix, enabled: v } } }))}
                />
              </div>
              {cfg.delivery.pix.enabled && (
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <Select
                    value={cfg.delivery.pix.pixKeyType}
                    onValueChange={(v) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, pix: { ...prev.delivery.pix, pixKeyType: v as TipoChavePix } } }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PIX_KEY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={cfg.delivery.pix.pixKey}
                    onChange={(e) => setCfg(prev => ({ ...prev, delivery: { ...prev.delivery, pix: { ...prev.delivery.pix, pixKey: e.target.value } } }))}
                    placeholder="Chave PIX"
                    className="h-10 rounded-lg text-sm"
                  />
                  {!cfg.delivery.pix.pixKey && (
                    <p className="col-span-2 text-[11px] text-amber-600 dark:text-amber-400">
                      Sem uma chave cadastrada, o PIX não aparece pro cliente mesmo estando ativado aqui.
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Pagamento Online (Mercado Pago) ──────────────────────────────── */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Pagamento Online
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#009ee3]/10 text-[#009ee3]">
                Mercado Pago
              </span>
            </CardTitle>
            {mpConnected ? (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-full px-2.5 py-1">
                <ShieldCheck className="w-3.5 h-3.5" />Conectado
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-full px-2.5 py-1">
                <ShieldAlert className="w-3.5 h-3.5" />Não conectado
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            O cliente paga direto no checkout do Mercado Pago (PIX, cartão, boleto), sem precisar de maquininha.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!mpConnected || showMpForm ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/20 p-3 text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                Acesse <span className="font-mono bg-blue-100 dark:bg-blue-900 px-1 rounded">mercadopago.com.br</span> →
                Sua conta → Ferramentas de integração → Credenciais, e copie a Public Key e o Access Token de produção.
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Public Key</Label>
                <Input
                  value={mpPublicKey}
                  onChange={(e) => setMpPublicKey(e.target.value)}
                  placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="mt-1 h-10 rounded-xl font-mono text-xs"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  Access Token
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-normal">
                    <KeyRound className="w-2.5 h-2.5" />privado, salvo criptografado
                  </span>
                </Label>
                <div className="relative mt-1">
                  <Input
                    type={showMpToken ? "text" : "password"}
                    value={mpToken}
                    onChange={(e) => setMpToken(e.target.value)}
                    placeholder="APP_USR-0000000000000000-000000-xxxx…"
                    className="h-10 rounded-xl font-mono text-xs pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMpToken(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showMpToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {mpError && <p className="text-xs text-destructive">{mpError}</p>}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleConnectMp}
                  disabled={mpSaving}
                  className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
                >
                  {mpSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Conectar Mercado Pago"}
                </Button>
                {mpConnected && (
                  <Button variant="ghost" onClick={() => { setShowMpForm(false); setMpError(""); }} className="h-10 rounded-xl">
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-secondary/20 p-3">
              <p className="text-xs text-muted-foreground">Credenciais conectadas e verificadas junto ao Mercado Pago.</p>
              <Button variant="outline" size="sm" onClick={() => setShowMpForm(true)} className="h-8 rounded-lg text-xs shrink-0">
                Trocar credenciais
              </Button>
            </div>
          )}

          {mpSuccess && (
            <div className="flex items-center gap-2 text-sm text-emerald-600">
              <Check className="w-4 h-4" />Mercado Pago conectado com sucesso!
            </div>
          )}

          <div className={`space-y-3 pt-1 ${!mpConnected ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <div>
                <p className="text-sm font-medium">Aceitar pagamento online</p>
                <p className="text-xs text-muted-foreground">
                  {mpConnected ? "Mostra a opção Mercado Pago no checkout da loja." : "Conecte sua conta acima primeiro."}
                </p>
              </div>
              <Switch
                checked={cfg.online.enabled}
                onCheckedChange={(v) => setCfg(prev => ({ ...prev, online: { ...prev.online, enabled: v } }))}
              />
            </label>
            {cfg.online.enabled && (
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: "pix",        label: "PIX" },
                  { key: "creditCard", label: "Crédito" },
                  { key: "debitCard",  label: "Débito" },
                ] as const).map(m => (
                  <label
                    key={m.key}
                    className={`flex items-center justify-center gap-1.5 h-10 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                      cfg.online.methods[m.key]
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border/50 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={cfg.online.methods[m.key]}
                      onChange={(e) => setCfg(prev => ({ ...prev, online: { ...prev.online, methods: { ...prev.online.methods, [m.key]: e.target.checked } } }))}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Check className="w-4 h-4" />Formas de pagamento salvas com sucesso!
        </div>
      )}
      <Button
        onClick={handleSave}
        disabled={saving || !store}
        className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar formas de pagamento"}
      </Button>
    </div>
  );
}
