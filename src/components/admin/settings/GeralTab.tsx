import { useState } from "react";
import {
  Store, Globe, Link2, ExternalLink, Fingerprint, Pencil, Check, Loader2,
  MapPin, Mail, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { CopyStoreUrlButton } from "./CopyStoreUrlButton";
import type { StoreData } from "./types";

interface GeralTabProps {
  store: StoreData | null;
  setStore: (store: StoreData) => void;
  storeName: string; setStoreName: (v: string) => void;
  ownerName: string; setOwnerName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  primaryColor: string;
  setError: (v: string) => void;
  addressCep: string; setAddressCep: (v: string) => void;
  addressStreet: string; setAddressStreet: (v: string) => void;
  addressNumber: string; setAddressNumber: (v: string) => void;
  addressNeighborhood: string; setAddressNeighborhood: (v: string) => void;
  addressCity: string; setAddressCity: (v: string) => void;
  addressState: string; setAddressState: (v: string) => void;
  addressComplement: string; setAddressComplement: (v: string) => void;
  addressSaving: boolean; setAddressSaving: (v: boolean) => void;
  addressSuccess: boolean; setAddressSuccess: (v: boolean) => void;
}

export function GeralTab({
  store, setStore, storeName, setStoreName, ownerName, setOwnerName,
  description, setDescription, phone, setPhone, email, setEmail, primaryColor, setError,
  addressCep, setAddressCep, addressStreet, setAddressStreet, addressNumber, setAddressNumber,
  addressNeighborhood, setAddressNeighborhood, addressCity, setAddressCity, addressState, setAddressState,
  addressComplement, setAddressComplement, addressSaving, setAddressSaving, addressSuccess, setAddressSuccess,
}: GeralTabProps) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  // Email edit states — sempre bloqueado (emailLocked=true): a única forma de
  // trocar o email é pelo modal com verificação por código.
  const emailLocked = true;
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailStep, setEmailStep] = useState<"idle" | "input" | "code">("idle");
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");

  const handleSave = async () => {
    if (!store) return;
    setSaving(true);
    setSuccess(false);
    try {
      const res = await api.post("/api/store/update", {
        storeId: store.id,
        name: storeName,
        ownerName,
        description,
        phone,
        email,
        primaryColor,
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        setStore(data.store);
      } else {
        setError(data.error || "Erro ao salvar");
      }
    } catch (err) {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  };

  const lookupCep = async (cep: string) => {
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`/api/validate-cep?cep=${cep}`);
      const data = await res.json();
      if (res.ok) {
        setAddressStreet(data.street || "");
        setAddressNeighborhood(data.neighborhood || "");
        setAddressCity(data.city || "");
        setAddressState(data.state || "");
      } else {
        setCepError(data.error || "CEP não encontrado");
      }
    } catch {
      setCepError("Erro ao buscar CEP");
    } finally {
      setCepLoading(false);
    }
  };

  const handleSaveAddress = async () => {
    if (!store) return;
    setAddressSaving(true);
    setAddressSuccess(false);
    try {
      const address = {
        street: addressStreet,
        number: addressNumber,
        neighborhood: addressNeighborhood,
        city: addressCity,
        state: addressState,
        zip: addressCep,
        complement: addressComplement || undefined,
      };
      const res = await api.post("/api/store/update-address", { storeId: store.id, address });
      const data = await res.json();
      if (res.ok) {
        setAddressSuccess(true);
        setStore({ ...store, address });
      } else {
        setError(data.error || "Erro ao salvar endereço");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setAddressSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Store Info */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Store className="w-4 h-4" />
            Dados da loja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da loja</Label>
              <Input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input value={store?.slug || ""} disabled className="h-11 rounded-xl bg-muted" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome do titular</Label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Nome completo do responsável pela conta"
              className="h-11 rounded-xl"
            />
          </div>

          {/* Store Link */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5" />
              Link da sua loja
            </Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  value={`https://${store?.slug}.armazix.com.br`}
                  disabled
                  className="h-11 rounded-xl bg-muted pr-10 font-mono text-sm"
                />
                <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <CopyStoreUrlButton url={`https://${store?.slug}.armazix.com.br`} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => window.open(`https://${store?.slug}.armazix.com.br`, "_blank")}
                className="h-11 w-11 rounded-xl shrink-0"
                title="Abrir loja em nova guia"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Padrão limpo, sem hífens ou caracteres especiais.
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Descrição</Label>
              <span className={`text-[11px] tabular-nums ${description.length >= 250 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                {description.length}/250
              </span>
            </div>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 250))}
              maxLength={250}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">Email da loja</Label>
              <div className="relative">
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl pr-10"
                  disabled={emailLocked}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setNewEmail(email);
                    setEmailStep("input");
                    setShowEmailModal(true);
                    setEmailError("");
                    setEmailSuccess("");
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          {/* Store ID */}
          <div className="flex items-center justify-between py-1">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Fingerprint className="w-3 h-3" />
              Store ID:
              <span className="font-mono">{store?.id ?? "—"}</span>
            </span>
            <CopyStoreUrlButton url={store?.id ?? ""} />
          </div>

          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Alterações salvas com sucesso!
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar alterações"}
          </Button>
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* CEP field first */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">CEP</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={addressCep}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setAddressCep(val);
                    setCepError("");
                    if (val.length === 8) {
                      lookupCep(val);
                    }
                  }}
                  placeholder="00000000"
                  className="h-11 rounded-xl font-mono"
                  maxLength={8}
                />
                {cepLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                variant="outline"
                className="h-11 rounded-xl"
                disabled={cepLoading || addressCep.length !== 8}
                onClick={() => lookupCep(addressCep)}
              >
                Buscar
              </Button>
            </div>
            {cepError && <p className="text-xs text-red-500">{cepError}</p>}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Rua</Label>
                <span className={`text-[11px] tabular-nums ${addressStreet.length >= 50 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{addressStreet.length}/50</span>
              </div>
              <Input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value.slice(0, 50))} maxLength={50} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Número</Label>
                <span className={`text-[11px] tabular-nums ${addressNumber.length >= 5 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{addressNumber.length}/5</span>
              </div>
              <Input value={addressNumber} onChange={(e) => setAddressNumber(e.target.value.slice(0, 5))} maxLength={5} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Bairro</Label>
                <span className={`text-[11px] tabular-nums ${addressNeighborhood.length >= 50 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{addressNeighborhood.length}/50</span>
              </div>
              <Input value={addressNeighborhood} onChange={(e) => setAddressNeighborhood(e.target.value.slice(0, 50))} maxLength={50} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Complemento</Label>
                <span className={`text-[11px] tabular-nums ${addressComplement.length >= 100 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{addressComplement.length}/100</span>
              </div>
              <Input value={addressComplement} onChange={(e) => setAddressComplement(e.target.value.slice(0, 100))} maxLength={100} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cidade</Label>
                <span className={`text-[11px] tabular-nums ${addressCity.length >= 50 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{addressCity.length}/50</span>
              </div>
              <Input value={addressCity} onChange={(e) => setAddressCity(e.target.value.slice(0, 50))} maxLength={50} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Estado</Label>
                <span className={`text-[11px] tabular-nums ${addressState.length >= 2 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{addressState.length}/2</span>
              </div>
              <Input value={addressState} onChange={(e) => setAddressState(e.target.value.slice(0, 2).toUpperCase())} maxLength={2} className="h-11 rounded-xl" />
            </div>
          </div>
          {addressSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Endereço salvo com sucesso!
            </div>
          )}
          <Button
            onClick={handleSaveAddress}
            disabled={addressSaving}
            className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            {addressSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar endereço"}
          </Button>
        </CardContent>
      </Card>

      {/* Email Change Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-card rounded-2xl border border-border shadow-lg p-6 w-full max-w-md mx-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Alterar Email
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailStep("idle");
                  setEmailError("");
                  setEmailSuccess("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {emailStep === "input" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Digite o novo email. Enviaremos um código de verificação para confirmar a alteração.
                </p>
                <div className="space-y-2">
                  <Label>Novo email</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo@email.com"
                    className="h-11 rounded-xl"
                  />
                </div>
                {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl"
                    onClick={() => {
                      setShowEmailModal(false);
                      setEmailStep("idle");
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground"
                    disabled={emailSending || !newEmail || newEmail === email}
                    onClick={async () => {
                      if (!newEmail || newEmail === email) return;
                      setEmailSending(true);
                      setEmailError("");
                      try {
                        const userId = localStorage.getItem("userId");
                        const res = await fetch("/api/user/send-email-code", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ userId, newEmail: newEmail }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setEmailStep("code");
                        } else {
                          setEmailError(data.error || "Erro ao enviar código");
                        }
                      } catch {
                        setEmailError("Erro de conexão");
                      } finally {
                        setEmailSending(false);
                      }
                    }}
                  >
                    {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar código"}
                  </Button>
                </div>
              </div>
            )}

            {emailStep === "code" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Digite o código de 6 dígitos enviado para <strong>{newEmail}</strong>.
                </p>
                <div className="space-y-2">
                  <Label>Código de verificação</Label>
                  <Input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="h-11 rounded-xl text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                </div>
                {emailError && <p className="text-sm text-red-500">{emailError}</p>}
                {emailSuccess && <p className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" />{emailSuccess}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-xl"
                    onClick={() => {
                      setEmailStep("input");
                      setEmailError("");
                    setVerificationCode("");
                    }}
                  >
                    Voltar
                  </Button>
                  <Button
                    className="flex-1 h-10 rounded-xl bg-gradient-primary text-primary-foreground"
                    disabled={emailSending || verificationCode.length !== 6}
                    onClick={async () => {
                      setEmailSending(true);
                      setEmailError("");
                      try {
                        const userId = localStorage.getItem("userId");
                        const res = await fetch("/api/user/verify-email-change", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ userId, newEmail, code: verificationCode }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setEmail(newEmail);
                          setEmailSuccess("Email atualizado com sucesso!");
                          setTimeout(() => {
                            setShowEmailModal(false);
                            setEmailStep("idle");
                            setVerificationCode("");
                            setEmailSuccess("");
                          }, 1500);
                        } else {
                          setEmailError(data.error || "Código inválido");
                        }
                      } catch {
                        setEmailError("Erro de conexão");
                      } finally {
                        setEmailSending(false);
                      }
                    }}
                  >
                    {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
