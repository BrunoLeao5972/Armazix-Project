import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  ArrowLeft,
  User,
  Phone,
  Store,
  MapPin,
  FileText,
  Check,
  Loader2,
  Upload,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  head: () => ({
    meta: [{ title: "Criar conta — ARMAZIX" }],
  }),
});

const STEPS = [
  { id: 1, title: "Identificação", icon: User },
  { id: 2, title: "Sua Loja", icon: Store },
  { id: 3, title: "Dados Fiscais", icon: FileText },
  { id: 4, title: "Endereço", icon: MapPin },
  { id: 5, title: "Pronto!", icon: Check },
];

const CATEGORIES = [
  "Mercadinho",
  "Restaurante",
  "Açougue",
  "Cosméticos",
  "Eletrônicos",
  "Conveniência",
  "Padaria",
  "Farmácia",
  "Pet Shop",
  "Moda",
];

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [storeColor, setStoreColor] = useState("#00C853");

  // Step 3
  const [docType, setDocType] = useState<"cpf" | "cnpj">("cpf");
  const [docNumber, setDocNumber] = useState("");
  const [companyName, setCompanyName] = useState("");

  // Step 4
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const progress = (step / STEPS.length) * 100;

  const formatCPF = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatCNPJ = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 14);
    return d
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  };

  const formatCEP = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.replace(/(\d{5})(\d)/, "$1-$2");
  };

  const handleDocChange = (v: string) => {
    setDocNumber(docType === "cpf" ? formatCPF(v) : formatCNPJ(v));
  };

  const [cepLoading, setCepLoading] = useState(false);

  const handleCepChange = async (v: string) => {
    const formatted = formatCEP(v);
    setCep(formatted);
    const raw = v.replace(/\D/g, "");
    if (raw.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
        }
      } catch (error) {
        console.error("Error fetching CEP:", error);
      } finally {
        setCepLoading(false);
      }
    }
  };

  const nextStep = () => {
    if (step < 5) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setStep(step + 1);
      }, 400);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          storeName,
          category,
          description,
          storeColor,
          docType,
          docNumber,
          address: cep ? { street, number, complement, neighborhood, city, state, zip: cep } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erro ao criar conta");
        setLoading(false);
        return;
      }
      navigate({ to: "/verify-email", search: { email } });
    } catch {
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-surface/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg">
            <img src="/logo.png" alt="Armazix" className="w-9 h-9" />
            ARMAZIX
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Já tenho conta
          </Link>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-8">
        <Progress value={progress} className="h-1.5 rounded-full" />
        <div className="flex items-center justify-between mt-4">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => s.id < step && setStep(s.id)}
              className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                s.id === step
                  ? "text-primary"
                  : s.id < step
                  ? "text-foreground"
                  : "text-muted-foreground/50"
              }`}
            >
              <span
                className={`grid place-items-center w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${
                  s.id === step
                    ? "bg-primary text-primary-foreground"
                    : s.id < step
                    ? "bg-primary/15 text-primary"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {s.id < step ? <Check className="w-3 h-3" /> : s.id}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center py-10 px-4 sm:px-6">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {step === 1 && (
                <StepWrapper
                  title="Dados pessoais"
                  subtitle="Informe seus dados para criar a conta"
                >
                  <div className="space-y-4">
                    <Field label="Nome completo" icon={User}>
                      <Input
                        placeholder="Seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="Email" icon={Mail}>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="WhatsApp" icon={Phone}>
                      <Input
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        className="pl-10 h-11 rounded-xl"
                      />
                    </Field>
                    <Field label="Senha" icon={Lock}>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 8 caracteres"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10 pr-10 h-11 rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                    <Field label="Confirmar senha" icon={Lock}>
                      <Input
                        type="password"
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                      />
                    </Field>
                  </div>
                </StepWrapper>
              )}

              {step === 2 && (
                <StepWrapper
                  title="Dados da loja"
                  subtitle="Como sua loja vai aparecer para os clientes"
                >
                  <div className="space-y-4">
                    <Field label="Nome da loja" icon={Store}>
                      <Input
                        placeholder="Ex: Mercadinho do João"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                      />
                    </Field>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCategory(cat)}
                            className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              category === cat
                                ? "bg-primary text-primary-foreground shadow-glow"
                                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição curta</Label>
                      <Input
                        placeholder="Uma frase sobre sua loja"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" /> Cor principal
                      </Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={storeColor}
                          onChange={(e) => setStoreColor(e.target.value)}
                          className="w-10 h-10 rounded-xl border border-border cursor-pointer"
                        />
                        <Input
                          value={storeColor}
                          onChange={(e) => setStoreColor(e.target.value)}
                          className="w-32 h-11 rounded-xl font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Logo</Label>
                        <label className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <input type="file" className="hidden" accept="image/*" />
                        </label>
                      </div>
                      <div className="space-y-2">
                        <Label>Banner</Label>
                        <label className="flex items-center justify-center h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors cursor-pointer">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <input type="file" className="hidden" accept="image/*" />
                        </label>
                      </div>
                    </div>
                  </div>
                </StepWrapper>
              )}

              {step === 3 && (
                <StepWrapper
                  title="Dados fiscais"
                  subtitle="Informações para emissão de notas"
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Tipo de documento</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDocType("cpf");
                            setDocNumber("");
                            setCompanyName("");
                          }}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            docType === "cpf"
                              ? "bg-primary text-primary-foreground shadow-glow"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          CPF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDocType("cnpj");
                            setDocNumber("");
                          }}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            docType === "cnpj"
                              ? "bg-primary text-primary-foreground shadow-glow"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          CNPJ
                        </button>
                      </div>
                    </div>
                    <Field label={docType === "cpf" ? "CPF" : "CNPJ"} icon={FileText}>
                      <Input
                        placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0001-00"}
                        value={docNumber}
                        onChange={(e) => handleDocChange(e.target.value)}
                        className="pl-10 h-11 rounded-xl"
                      />
                    </Field>
                    {docType === "cnpj" && (
                      <div className="space-y-2">
                        <Label>Razão social (opcional)</Label>
                        <Input
                          placeholder="Nome empresarial"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </StepWrapper>
              )}

              {step === 4 && (
                <StepWrapper
                  title="Endereço"
                  subtitle="Onde sua loja fica localizada"
                >
                  <div className="space-y-4">
                    <Field label="CEP" icon={MapPin}>
                      <div className="relative">
                        <Input
                          placeholder="00000-000"
                          value={cep}
                          onChange={(e) => handleCepChange(e.target.value)}
                          className="pl-10 h-11 rounded-xl"
                          disabled={cepLoading}
                        />
                        {cepLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </Field>
                    <div className="space-y-2">
                      <Label>Rua</Label>
                      <Input
                        placeholder="Nome da rua"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label>Número</Label>
                        <Input
                          placeholder="123"
                          value={number}
                          onChange={(e) => setNumber(e.target.value)}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="col-span-2 space-y-2">
                        <Label>Complemento</Label>
                        <Input
                          placeholder="Apto, sala..."
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input
                        placeholder="Bairro"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-2">
                        <Label>Cidade</Label>
                        <Input
                          placeholder="Cidade"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Input
                          placeholder="UF"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          className="h-11 rounded-xl"
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </div>
                </StepWrapper>
              )}

              {step === 5 && (
                <div className="text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                    className="grid place-items-center w-20 h-20 mx-auto rounded-full bg-gradient-primary text-primary-foreground shadow-glow mb-6"
                  >
                    <Check className="w-10 h-10" />
                  </motion.div>
                  <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-2xl font-bold tracking-tight"
                  >
                    Sua loja está pronta! 🎉
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-2 text-muted-foreground"
                  >
                    Tudo configurado. Comece a vender agora mesmo.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 flex flex-col gap-3"
                  >
                    <Button
                      onClick={handleFinish}
                      disabled={loading}
                      className="h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Preparando painel...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Acessar painel
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl font-medium"
                      onClick={handleFinish}
                    >
                      Configurar produtos depois
                    </Button>
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation buttons */}
          {step < 5 && (
            <div className="flex items-center justify-between mt-8">
              <Button
                variant="ghost"
                onClick={prevStep}
                disabled={step === 1}
                className="gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
              <Button
                onClick={nextStep}
                disabled={loading}
                className="h-11 px-6 rounded-xl bg-gradient-primary text-primary-foreground font-semibold shadow-glow hover:scale-[1.01] active:scale-[0.99] transition-transform gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">{children}</div>
    </div>
  );
}
