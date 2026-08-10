// Verificador de senha LOCAL, pra login offline.
//
// O servidor nunca entrega o hash bcrypt do usuário (nem deveria) — então
// "salvar o hash pra login offline" só pode significar um hash que o
// PRÓPRIO app calcula, no momento em que a senha já foi validada online
// pela API. Da próxima vez sem internet, refaz o mesmo cálculo em cima do
// que foi digitado e compara com o que ficou salvo. Web Crypto (PBKDF2),
// nativo do Chromium — sem dependência nenhuma.

const ITERATIONS = 100_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function pbkdf2Hex(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return toHex(new Uint8Array(bits));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface LocalPasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

/** Chamado logo após um login ONLINE bem-sucedido, pra guardar o verificador local. */
export async function hashPasswordForOfflineLogin(password: string): Promise<LocalPasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Hex(password, salt, ITERATIONS);
  return { hash, salt: toHex(salt), iterations: ITERATIONS };
}

/** Chamado num login OFFLINE, contra o verificador salvo no login online anterior. */
export async function verifyPasswordOffline(password: string, stored: LocalPasswordHash): Promise<boolean> {
  const salt = hexToBytes(stored.salt);
  const hash = await pbkdf2Hex(password, salt, stored.iterations);
  return timingSafeEqual(hash, stored.hash);
}
