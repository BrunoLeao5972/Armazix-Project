import { useRef, useState } from "react";
import { User, Camera, Check, Loader2, Shield, Bell, Package, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import type { StoreData } from "./types";

interface PerfilTabProps {
  store: StoreData | null;
  setStore: (store: StoreData) => void;
  profileName: string; setProfileName: (v: string) => void;
  profileAvatar: string; setProfileAvatar: (v: string) => void;
  highlightLowStock: boolean; setHighlightLowStock: (v: boolean) => void;
  allowNegativeStock: boolean; setAllowNegativeStock: (v: boolean) => void;
}

export function PerfilTab({
  store, setStore, profileName, setProfileName, profileAvatar, setProfileAvatar,
  highlightLowStock, setHighlightLowStock, allowNegativeStock, setAllowNegativeStock,
}: PerfilTabProps) {
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");

  const [estoqueSaving, setEstoqueSaving] = useState(false);
  const [estoqueSuccess, setEstoqueSuccess] = useState(false);
  const [estoqueError, setEstoqueError] = useState("");

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      setProfileError("Nome é obrigatório");
      return;
    }
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError("");
    try {
      const res = await api.post("/api/user/update-data", {
        name: profileName,
        avatarUrl: profileAvatar || null,
      });
      const data = await res.json() as { error?: string };
      if (res.ok) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      } else {
        setProfileError(data.error || "Erro ao salvar perfil");
      }
    } catch {
      setProfileError("Erro de conexão");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPwError("");
    setPwSuccess("");
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwError("Preencha todos os campos");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwError("As senhas não coincidem");
      return;
    }
    setPwSaving(true);
    try {
      const res = await api.post("/api/user/update-password", {
        currentPassword,
        newPassword,
      });
      const data = await res.json() as { error?: string; message?: string };
      if (res.ok) {
        setPwSuccess(data.message || "Senha alterada com sucesso!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        setPwError(data.error || "Erro ao alterar senha");
      }
    } catch {
      setPwError("Erro de conexão");
    } finally {
      setPwSaving(false);
    }
  };

  const handleSaveEstoque = async () => {
    if (!store) return;
    setEstoqueSaving(true);
    setEstoqueSuccess(false);
    setEstoqueError("");
    try {
      const res = await api.post("/api/store/update", { allowNegativeStock, highlightLowStock });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setEstoqueError(d.error || "Erro ao salvar");
        return;
      }
      const d = await res.json() as { store?: StoreData };
      if (d.store) setStore(d.store);
      setEstoqueSuccess(true);
      setTimeout(() => setEstoqueSuccess(false), 3000);
    } catch {
      setEstoqueError("Erro de conexão");
    } finally {
      setEstoqueSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* User Profile */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="w-4 h-4" />
            Meu Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                {profileAvatar && <AvatarImage src={profileAvatar} alt={profileName} />}
                <AvatarFallback className="bg-primary/15 text-primary text-2xl font-bold">
                  {profileName.trim().split(/\s+/).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    setProfileError("Imagem deve ter no máximo 2MB");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setProfileAvatar(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Foto de perfil</p>
              <p className="text-xs text-muted-foreground">JPG, PNG ou GIF — máx. 2MB</p>
              {profileAvatar && (
                <button
                  type="button"
                  onClick={() => setProfileAvatar("")}
                  className="text-xs text-destructive hover:underline"
                >
                  Remover foto
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Seu nome completo"
              className="h-11 rounded-xl"
            />
          </div>
          {profileError && <p className="text-sm text-red-500">{profileError}</p>}
          {profileSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Perfil atualizado com sucesso!
            </div>
          )}
          <Button
            onClick={handleSaveProfile}
            disabled={profileSaving}
            className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar perfil"}
          </Button>
        </CardContent>
      </Card>

      {/* Alterar Senha */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="h-11 rounded-xl"
            />
          </div>
          {pwError && <p className="text-sm text-red-500">{pwError}</p>}
          {pwSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              {pwSuccess}
            </div>
          )}
          <Button
            onClick={handlePasswordChange}
            disabled={pwSaving || !currentPassword || !newPassword || !confirmNewPassword}
            className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Alterar senha"}
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Novos pedidos</div>
              <div className="text-xs text-muted-foreground">Receber notificação a cada novo pedido</div>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Pagamentos</div>
              <div className="text-xs text-muted-foreground">Notificar sobre pagamentos recebidos</div>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Marketing</div>
              <div className="text-xs text-muted-foreground">Novidades e dicas por email</div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Estoque */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" />
            Estoque
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Estoque baixo</div>
              <div className="text-xs text-muted-foreground">Alertar quando produto atingir mínimo</div>
            </div>
            <Switch checked={highlightLowStock} onCheckedChange={setHighlightLowStock} />
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Permitir vender produto sem estoque</div>
              <div className="text-xs text-muted-foreground">
                Quando ativado, pedidos são aceitos mesmo com estoque zerado. Ideal para lojas que não controlam estoque.
              </div>
            </div>
            <Switch checked={allowNegativeStock} onCheckedChange={setAllowNegativeStock} />
          </div>
          {!allowNegativeStock && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Com esta opção desativada, pedidos de produtos com <strong>rastreio de estoque</strong> serão bloqueados quando o estoque for insuficiente.
              </p>
            </div>
          )}
          {estoqueError && <p className="text-sm text-destructive">{estoqueError}</p>}
          {estoqueSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Configuração salva com sucesso!
            </div>
          )}
          <Button
            onClick={handleSaveEstoque}
            disabled={estoqueSaving}
            className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
          >
            {estoqueSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar configuração"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
