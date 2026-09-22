// ─────────────────────────────────────────────────────────────────────────
// CNPJ/CPF da loja (o documento do titular da conta, não do cliente que
// compra) — módulo puro.
//
//   1. opcional   — a loja funciona normalmente sem documento cadastrado;
//   2. validado   — quando informado, precisa ser um CPF/CNPJ real (ver
//      cpf-cnpj.ts), não só uma string qualquer;
//   3. imutável   — uma vez vinculado, a tela de Configurações não deixa o
//      próprio lojista trocar; só o suporte corrige (edição direta, fora
//      desta rota).
// ─────────────────────────────────────────────────────────────────────────

import { apenasDigitos, tipoDocumento, validarCpfCnpj, type TipoDocumento } from "@/lib/customer/cpf-cnpj";

export type MotivoRejeicaoDocumentoLoja = "invalido" | "divergente";

export type ResultadoDocumentoLoja =
  | { ok: true; documento: string | null; tipo: TipoDocumento | null; jaEstavaVinculado: boolean }
  | { ok: false; motivo: MotivoRejeicaoDocumentoLoja };

export const MENSAGEM_REJEICAO_DOCUMENTO_LOJA: Record<MotivoRejeicaoDocumentoLoja, string> = {
  invalido: "CPF/CNPJ inválido. Confira os números digitados.",
  divergente: "O CNPJ/CPF da loja já foi vinculado e não pode ser alterado por aqui. Para corrigir, contate o suporte.",
};

/**
 * @param documentoAtual  O que já está gravado na loja (stores.cnpj ou stores.cpf), ou null/undefined se nunca vinculou.
 * @param documentoEnviado O que veio agora do formulário de Configurações.
 */
export function verificarDocumentoLoja(
  documentoAtual: string | null | undefined,
  documentoEnviado: string | null | undefined,
): ResultadoDocumentoLoja {
  const atual = documentoAtual ? apenasDigitos(documentoAtual) : "";
  const enviado = documentoEnviado ? apenasDigitos(documentoEnviado) : "";

  // Já vinculado: imutável por esta via. Reenviar o mesmo valor é um no-op
  // (o formulário reenvia o que já tinha); qualquer outro valor é rejeitado.
  if (atual) {
    if (enviado && enviado !== atual) return { ok: false, motivo: "divergente" };
    return { ok: true, documento: atual, tipo: tipoDocumento(atual), jaEstavaVinculado: true };
  }

  // Ainda não vinculado — campo opcional: nada enviado não é erro, só não vincula nada.
  if (!enviado) return { ok: true, documento: null, tipo: null, jaEstavaVinculado: false };
  if (!validarCpfCnpj(enviado)) return { ok: false, motivo: "invalido" };
  return { ok: true, documento: enviado, tipo: tipoDocumento(enviado), jaEstavaVinculado: false };
}
