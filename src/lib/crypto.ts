// Utilitários de criptografia para dados sensíveis
// Usa AES-256-GCM para criptografia autenticada

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  // Derivar chave de 256 bits do segredo usando SHA-256
  const hash = await crypto.subtle.digest("SHA-256", keyData);
  
  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(plaintext: string, secret: string): Promise<string> {
  const key = await getKey(secret);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // Gerar IV aleatório de 12 bytes
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Criptografar
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  // Combinar IV + ciphertext e converter para base64
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(ciphertext: string, secret: string): Promise<string | null> {
  try {
    const key = await getKey(secret);
    
    // Decodificar base64
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    
    // Extrair IV (12 primeiros bytes)
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Descriptografar
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}
