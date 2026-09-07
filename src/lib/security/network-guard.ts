// ─────────────────────────────────────────────────────────────────────────
// Guarda de SSRF para conexões TCP de saída disparadas pelo Worker (hoje só
// o fluxo de teste/impressão de impressora de rede em print-handler.ts).
//
// Bloqueia os alvos clássicos de SSRF — loopback, link-local (inclui o
// metadata endpoint de várias clouds), CGNAT, faixas de documentação/teste,
// multicast e reservado — mas NÃO bloqueia RFC1918 (10/8, 172.16/12,
// 192.168/16): essa é a faixa legítima de impressora de rede dentro da loja,
// bloqueá-la quebraria o próprio recurso.
//
// Auditoria de segurança — achado F1 (SSRF autenticado no teste de
// impressora de rede). Ver docs/security-audit/relatorio-auditoria-seguranca.pdf.
// ─────────────────────────────────────────────────────────────────────────

const BLOCKED_IPV4_RANGES: Array<[base: string, bits: number]> = [
  ["0.0.0.0", 8],       // "this network"
  ["127.0.0.0", 8],     // loopback
  ["100.64.0.0", 10],   // CGNAT
  ["169.254.0.0", 16],  // link-local — inclui o metadata endpoint de várias clouds (169.254.169.254)
  ["192.0.0.0", 24],    // IETF protocol assignments
  ["192.0.2.0", 24],    // TEST-NET-1
  ["198.18.0.0", 15],   // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24],  // TEST-NET-3
  ["224.0.0.0", 4],     // multicast
  ["240.0.0.0", 4],     // reservado
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

/** true = IP inválido OU dentro de uma faixa bloqueada (trata inválido como bloqueado). */
export function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  for (const [base, bits] of BLOCKED_IPV4_RANGES) {
    const baseInt = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (0xFFFFFFFF << (32 - bits)) >>> 0;
    if ((n & mask) === (baseInt & mask)) return true;
  }
  return false;
}

export interface SafeTarget {
  host: string;
  port: number;
}

// IPv4 literal: 192.168.1.10 ou 192.168.1.10:9100 (cada octeto 0-255).
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?::(\d+))?$/;
// Hostname com pelo menos um ponto: impressora.local ou servidor.empresa.com:9100.
const HOST_RE = /^([\w-]+(?:\.[\w-]+)+)(?::(\d+))?$/;

/** true quando o texto tem cara de alvo de rede (IP ou hostname com ponto) — não resolve nem valida, só reconhece o formato. Usado para decidir se vale a pena checar o alvo ao salvar um path (um nome de impressora local ou caminho UNC nunca passa por aqui). */
export function looksLikeNetworkTarget(path: string): boolean {
  const t = path.trim();
  return IPV4_RE.test(t) || HOST_RE.test(t);
}

/**
 * Valida um "Caminho / IP" de impressora e devolve um alvo seguro para
 * conectar, ou null se for UNC/Windows (não é alvo de rede), malformado, ou
 * resolver para um endereço bloqueado.
 *
 * Para hostname, resolve via DNS e valida o(s) IP(s) já resolvido(s) — a
 * conexão de verdade (sendViaTcp) deve usar o IP devolvido aqui, nunca
 * deixar o socket re-resolver o hostname, para não abrir uma janela de DNS
 * rebinding entre a checagem e a conexão.
 *
 * dns.promises.lookup() não tem precedente de uso neste runtime (Cloudflare
 * Workers, nodejs_compat) — qualquer falha na resolução recusa o alvo
 * (fail closed) em vez de deixar passar sem checar.
 */
export async function resolveSafeTarget(path: string): Promise<SafeTarget | null> {
  const t = path.trim();
  if (t.startsWith("\\\\")) return null;

  const ipMatch = t.match(IPV4_RE);
  if (ipMatch) {
    const ip = `${ipMatch[1]}.${ipMatch[2]}.${ipMatch[3]}.${ipMatch[4]}`;
    if (isBlockedIPv4(ip)) return null;
    return { host: ip, port: parseInt(ipMatch[5] ?? "9100", 10) };
  }

  const hostMatch = t.match(HOST_RE);
  if (hostMatch) {
    const hostname = hostMatch[1];
    const port = parseInt(hostMatch[2] ?? "9100", 10);
    try {
      const dns = await import("dns");
      const result = await dns.promises.lookup(hostname, { all: true });
      const addrs = (Array.isArray(result) ? result : [result]).filter(a => a.family === 4);
      if (addrs.length === 0) return null;
      if (addrs.some(a => isBlockedIPv4(a.address))) return null;
      return { host: addrs[0].address, port };
    } catch {
      return null;
    }
  }

  return null;
}
