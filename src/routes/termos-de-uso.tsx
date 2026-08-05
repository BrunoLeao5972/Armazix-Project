import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CURRENT_TERMS_VERSION, TERMS_UPDATED_AT } from "@/lib/legal";

export const Route = createFileRoute("/termos-de-uso")({
  component: TermsPage,
  head: () => ({
    meta: [{ title: "Termos de Uso — ARMAZIX" }],
  }),
});

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "definicoes",
    title: "1. Definições",
    body: (
      <>
        <p>Para os fins destes Termos de Uso ("Termos"), consideram-se:</p>
        <ul>
          <li><strong>Armazix:</strong> a plataforma de tecnologia para gestão de lojas virtuais, ponto de venda (PDV) e operações de e-commerce, de titularidade de Armazix Tecnologia (referida também como "nós" ou "Plataforma").</li>
          <li><strong>Lojista:</strong> a pessoa física ou jurídica que se cadastra na Armazix para criar e administrar sua própria loja virtual ("Usuário").</li>
          <li><strong>Loja:</strong> o ambiente virtual (vitrine, catálogo, checkout, subdomínio próprio) configurado e operado pelo Lojista dentro da Plataforma.</li>
          <li><strong>Cliente Final:</strong> a pessoa que realiza compras diretamente na Loja de um Lojista.</li>
          <li><strong>Conteúdo do Lojista:</strong> produtos, descrições, imagens, preços, políticas de entrega, dados fiscais e demais informações inseridas pelo Lojista na Plataforma.</li>
        </ul>
      </>
    ),
  },
  {
    id: "objeto",
    title: "2. Objeto e Natureza do Serviço",
    body: (
      <>
        <p>
          A Armazix é uma <strong>plataforma de tecnologia (Software as a Service)</strong> que fornece ao Lojista as
          ferramentas para criar, operar e gerenciar sua própria loja virtual: catálogo de produtos, carrinho e checkout,
          ponto de venda (PDV) para vendas presenciais, controle de estoque, gestão financeira, emissão de relatórios,
          atendimento ao Cliente Final via WhatsApp e integração com meios de pagamento.
        </p>
        <p>
          <strong>A Armazix não é um marketplace.</strong> A Armazix não reúne produtos de múltiplos lojistas em um
          catálogo único, não intermedeia diretamente a venda, não processa nem retém os valores pagos pelo Cliente
          Final, e não é parte na relação de compra e venda entre o Lojista e o Cliente Final. Cada Loja opera em
          endereço próprio (subdomínio), com identidade visual e identidade comercial exclusivas do Lojista.
        </p>
        <p>
          Os pagamentos realizados pelo Cliente Final na Loja são processados diretamente pela conta de meio de
          pagamento (ex: Mercado Pago) configurada e de titularidade do próprio Lojista. A Armazix não tem acesso aos
          valores movimentados nessas transações, nem atua como intermediária financeira entre Lojista e Cliente Final.
        </p>
      </>
    ),
  },
  {
    id: "cadastro",
    title: "3. Elegibilidade e Cadastro",
    body: (
      <>
        <p>Para se cadastrar na Armazix, o Lojista declara e garante que:</p>
        <ul>
          <li>É maior de 18 anos ou legalmente emancipado, e possui plena capacidade civil para contratar;</li>
          <li>Os dados fornecidos no cadastro (nome, e-mail, telefone, CPF/CNPJ, endereço) são verdadeiros, completos e atualizados;</li>
          <li>É o titular ou representante legal autorizado do CPF/CNPJ informado;</li>
          <li>É responsável por manter a confidencialidade de sua senha e por todas as atividades realizadas em sua conta.</li>
        </ul>
        <p>
          A Armazix pode recusar, suspender ou cancelar um cadastro que contenha informações falsas, incompletas ou que
          viole a lei ou estes Termos, a qualquer momento, mediante comunicação ao Lojista sempre que possível.
        </p>
      </>
    ),
  },
  {
    id: "planos",
    title: "4. Planos, Preços e Pagamento",
    body: (
      <>
        <p>
          A Armazix oferece diferentes planos de assinatura (incluindo um plano gratuito com período de teste
          limitado), cada um com seus próprios limites de funcionalidades e valores mensais, conforme informado na
          página de planos no momento da contratação.
        </p>
        <ul>
          <li>Os planos pagos são cobrados de forma <strong>recorrente e mensal</strong>, via cartão de crédito ou PIX, através do Mercado Pago;</li>
          <li>O plano gratuito ("Experimente") tem duração limitada; ao final do período, é necessário contratar um plano pago para manter a Loja ativa com todas as funcionalidades;</li>
          <li>O não pagamento de uma assinatura na data de vencimento pode acarretar a suspensão do acesso à Loja até a regularização, sem prejuízo da cobrança dos valores em aberto;</li>
          <li>Os preços vigentes podem ser reajustados pela Armazix mediante aviso prévio de, no mínimo, 30 (trinta) dias, publicado na Plataforma ou enviado por e-mail/WhatsApp ao Lojista.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cancelamento",
    title: "5. Cancelamento e Reembolso",
    body: (
      <>
        <p>
          O Lojista pode cancelar sua assinatura a qualquer momento pelo painel administrativo, sem multa. O
          cancelamento produz efeitos ao final do ciclo de cobrança em curso — não há reembolso proporcional de
          período já pago, salvo disposição legal em contrário ou decisão comercial expressa da Armazix.
        </p>
        <p>
          Encerrada a assinatura, os dados da Loja permanecerão armazenados em nuvem por um prazo de 90 (noventa)
          dias, contados a partir do cancelamento, para eventual reativação. Findo esse prazo, os dados poderão ser
          excluídos em definitivo a qualquer momento, sem aviso prévio, observadas as obrigações legais de retenção
          de dados aplicáveis (ex: fiscais).
        </p>
      </>
    ),
  },
  {
    id: "obrigacoes-lojista",
    title: "6. Obrigações do Lojista",
    body: (
      <>
        <p>Ao utilizar a Armazix para vender produtos ou serviços a Clientes Finais, o Lojista é o único responsável por:</p>
        <ul>
          <li>A veracidade, exatidão e legalidade das informações de produtos, preços, imagens e condições de entrega anunciadas em sua Loja;</li>
          <li>Cumprir integralmente o Código de Defesa do Consumidor (Lei nº 8.078/1990) e demais legislações aplicáveis à sua atividade comercial, incluindo direito de arrependimento, garantia legal e troca de produtos;</li>
          <li>Realizar a entrega, retirada ou prestação do serviço vendido, dentro dos prazos e condições informados ao Cliente Final;</li>
          <li>Prestar atendimento e suporte pós-venda aos seus próprios Clientes Finais;</li>
          <li>Não utilizar a Plataforma para comercializar produtos ilícitos, falsificados, roubados ou cuja venda seja proibida ou regulada por lei sem a devida licença;</li>
          <li>Manter a integração de WhatsApp e demais canais de comunicação em conformidade com os termos de uso dessas plataformas de terceiros e com a legislação de proteção de dados.</li>
        </ul>
        <p>
          A Armazix não verifica previamente o Conteúdo do Lojista antes de sua publicação e não se responsabiliza por
          eventuais danos causados a Clientes Finais ou terceiros decorrentes de informações falsas, produtos
          defeituosos ou descumprimento de obrigações comerciais pelo Lojista.
        </p>
      </>
    ),
  },
  {
    id: "suporte-acesso",
    title: "7. Suporte Técnico e Acesso à Conta",
    body: (
      <>
        <p>
          Para fins de suporte técnico, diagnóstico de problemas e assistência solicitada pelo Lojista (ou identificada
          proativamente pela equipe Armazix como necessária), a equipe autorizada da Armazix poderá acessar
          temporariamente o painel administrativo da Loja do Lojista, sem a necessidade de conhecer ou solicitar sua
          senha de acesso.
        </p>
        <p>
          Esse acesso é realizado por mecanismo técnico próprio, interno e restrito à equipe Armazix, é limitado no
          tempo, e cada ocorrência fica registrada internamente para fins de segurança e responsabilização — incluindo
          data, horário e identificação do responsável pelo acesso. O Lojista, ao aceitar estes Termos, autoriza
          expressamente esse tipo de acesso para as finalidades aqui descritas.
        </p>
      </>
    ),
  },
  {
    id: "propriedade-intelectual",
    title: "8. Propriedade Intelectual",
    body: (
      <>
        <p>
          A marca "Armazix", seu logotipo, layout, código-fonte, funcionalidades e demais elementos da Plataforma são
          de propriedade exclusiva da Armazix, protegidos pela legislação de propriedade intelectual, sendo vedada
          qualquer reprodução, engenharia reversa ou uso não autorizado.
        </p>
        <p>
          O Conteúdo do Lojista (marca, logotipo, fotos de produtos, textos) permanece de propriedade do Lojista. Ao
          publicá-lo na Plataforma, o Lojista concede à Armazix uma licença não exclusiva, gratuita e limitada para
          armazenar, exibir e processar esse conteúdo unicamente para operar a Loja e prestar o serviço contratado.
        </p>
      </>
    ),
  },
  {
    id: "dados-pessoais",
    title: "9. Proteção de Dados Pessoais",
    body: (
      <>
        <p>
          A Armazix trata dados pessoais do Lojista e dos Clientes Finais em conformidade com a Lei Geral de Proteção
          de Dados (Lei nº 13.709/2018 — LGPD). Os detalhes sobre quais dados são coletados, com quais finalidades,
          por quanto tempo são armazenados e como exercer os direitos do titular estão descritos na{" "}
          <span className="italic">Política de Privacidade</span> da Armazix, parte integrante destes Termos.
        </p>
        <p>
          O Lojista, ao coletar dados de seus Clientes Finais através da Loja (nome, telefone, endereço de entrega),
          atua como controlador desses dados para os fins de sua própria operação comercial, e é responsável por
          utilizá-los exclusivamente para processar e entregar os pedidos, respeitando a LGPD.
        </p>
      </>
    ),
  },
  {
    id: "uso-aceitavel",
    title: "10. Uso Aceitável",
    body: (
      <>
        <p>É vedado ao Lojista utilizar a Armazix para:</p>
        <ul>
          <li>Praticar fraude, estelionato ou qualquer conduta ilícita contra Clientes Finais, terceiros ou a própria Armazix;</li>
          <li>Enviar mensagens de WhatsApp não solicitadas (spam) ou em desacordo com a legislação e as políticas da Meta/WhatsApp;</li>
          <li>Realizar engenharia reversa, tentar acessar áreas restritas do sistema, ou comprometer a segurança da infraestrutura da Plataforma;</li>
          <li>Utilizar a Plataforma para revenda não autorizada do próprio software Armazix a terceiros.</li>
        </ul>
        <p>A violação destas regras pode resultar em suspensão ou cancelamento imediato da conta, sem prejuízo de outras medidas cabíveis.</p>
      </>
    ),
  },
  {
    id: "disponibilidade",
    title: "11. Disponibilidade e Manutenção",
    body: (
      <>
        <p>
          A Armazix envida seus melhores esforços para manter a Plataforma disponível de forma contínua, mas não
          garante disponibilidade ininterrupta (100% de uptime). Manutenções programadas, atualizações de segurança e
          eventos fora do controle razoável da Armazix (ex: falhas de provedores de infraestrutura, ataques
          cibernéticos, instabilidades de internet) podem causar indisponibilidades temporárias.
        </p>
      </>
    ),
  },
  {
    id: "limitacao-responsabilidade",
    title: "12. Limitação de Responsabilidade",
    body: (
      <>
        <p>
          Na máxima extensão permitida pela lei, a Armazix não se responsabiliza por: (i) danos decorrentes de
          decisões comerciais do Lojista; (ii) qualidade, legalidade, entrega ou garantia dos produtos e serviços
          vendidos pelo Lojista a seus Clientes Finais; (iii) lucros cessantes ou danos indiretos decorrentes do uso ou
          da impossibilidade de uso da Plataforma; (iv) atos de terceiros, incluindo provedores de pagamento,
          transportadoras ou serviços de mensageria integrados.
        </p>
        <p>
          A responsabilidade total da Armazix perante o Lojista, em qualquer hipótese, está limitada ao valor
          efetivamente pago pelo Lojista à Armazix nos 3 (três) meses anteriores ao evento que originou a reclamação.
        </p>
      </>
    ),
  },
  {
    id: "suspensao",
    title: "13. Suspensão e Encerramento da Conta",
    body: (
      <>
        <p>
          A Armazix poderá suspender ou encerrar o acesso do Lojista à Plataforma, a qualquer tempo, em caso de: (i)
          inadimplência não sanada; (ii) violação destes Termos; (iii) uso da Plataforma para fins ilícitos; (iv)
          determinação judicial ou de autoridade competente. Sempre que possível, o Lojista será notificado previamente.
        </p>
      </>
    ),
  },
  {
    id: "alteracoes",
    title: "14. Alterações destes Termos",
    body: (
      <>
        <p>
          A Armazix pode alterar estes Termos a qualquer momento, para refletir mudanças na Plataforma, na legislação
          ou em práticas de mercado. Alterações relevantes serão comunicadas ao Lojista com antecedência razoável, e o
          uso continuado da Plataforma após a entrada em vigor da nova versão implica concordância com os termos
          atualizados. A versão vigente e a data da última atualização estão sempre indicadas no topo desta página.
        </p>
      </>
    ),
  },
  {
    id: "disposicoes-gerais",
    title: "15. Disposições Gerais",
    body: (
      <>
        <p>
          Caso qualquer disposição destes Termos seja considerada nula ou ineficaz, as demais permanecem em pleno
          vigor. A tolerância de uma das partes quanto ao descumprimento de qualquer cláusula não implica renúncia ao
          direito de exigi-la posteriormente. Estes Termos, juntamente com a Política de Privacidade, constituem o
          acordo integral entre o Lojista e a Armazix quanto ao objeto aqui tratado.
        </p>
      </>
    ),
  },
  {
    id: "foro",
    title: "16. Legislação Aplicável e Foro",
    body: (
      <>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de
          domicílio da Armazix para dirimir quaisquer controvérsias oriundas destes Termos, com renúncia a qualquer
          outro, por mais privilegiado que seja, ressalvadas as regras de competência previstas em lei que não possam
          ser afastadas por eleição de foro (ex: foro do consumidor, quando aplicável).
        </p>
      </>
    ),
  },
  {
    id: "contato",
    title: "17. Canal de Atendimento",
    body: (
      <p>
        Dúvidas sobre estes Termos podem ser encaminhadas pelos canais de suporte disponíveis dentro do painel
        administrativo da Armazix.
      </p>
    ),
  },
];

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-surface/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg">
            <img src="/logo.png" alt="Armazix" className="w-9 h-9" />
            ARMAZIX
          </Link>
          <Link
            to="/register"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Versão {CURRENT_TERMS_VERSION} — última atualização em {TERMS_UPDATED_AT}
        </p>

        <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-800 dark:text-amber-200">
          Este documento descreve as condições de uso da plataforma Armazix por lojistas. Recomendamos a leitura
          completa antes de aceitar.
        </div>

        {/* Índice */}
        <nav className="mt-8 p-4 rounded-2xl border border-border/60 bg-surface">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Índice</p>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-primary hover:underline">{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Conteúdo */}
        <article className="mt-10 space-y-10 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-foreground/90 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_p+p]:mt-3 [&_p+ul]:mt-3">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <h2 className="text-lg font-bold tracking-tight mb-3">{s.title}</h2>
              {s.body}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
