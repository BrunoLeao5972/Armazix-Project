import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Store,
  User,
  Bell,
  Shield,
  CreditCard,
  Palette,
  Globe,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [{ title: "Configurações — ARMAZIX" }],
  }),
});

function SettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="space-y-6 max-w-2xl"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua loja e preferências</p>
      </div>

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
              <Input defaultValue="Mercadinho do João" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input defaultValue="Mercadinho" className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input defaultValue="O melhor mercadinho do bairro" className="h-11 rounded-xl" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input defaultValue="(11) 99999-0000" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Email da loja</Label>
              <Input defaultValue="contato@mercadinhojoao.com" className="h-11 rounded-xl" />
            </div>
          </div>
          <Button className="h-10 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow">
            Salvar alterações
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
              <div className="text-sm font-medium">Estoque baixo</div>
              <div className="text-xs text-muted-foreground">Alertar quando produto atingir mínimo</div>
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

      {/* Security */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Senha atual</Label>
              <Input type="password" placeholder="••••••••" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" placeholder="Mínimo 8 caracteres" className="h-11 rounded-xl" />
            </div>
          </div>
          <Button variant="outline" className="h-10 rounded-xl font-medium">
            Alterar senha
          </Button>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="rounded-2xl border-border/50 shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Plano atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">Pro</div>
              <div className="text-sm text-muted-foreground">R$ 79/mês • Renova em 01/Jun</div>
            </div>
            <Button variant="outline" className="rounded-xl font-medium">
              Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Links */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <Palette className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Personalização</div>
              <div className="text-xs text-muted-foreground">Cores e logo da loja</div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Domínio</div>
              <div className="text-xs text-muted-foreground">Configurar URL personalizada</div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Equipe</div>
              <div className="text-xs text-muted-foreground">Gerenciar acessos</div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50 shadow-soft hover:shadow-ambient transition-shadow cursor-pointer">
          <CardContent className="p-4 flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Suporte</div>
              <div className="text-xs text-muted-foreground">Central de ajuda</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
