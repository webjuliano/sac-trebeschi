import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

export type SankhyaCredentials = { url: string; token: string; clientId: string; clientSecret: string };

function encryptionKey() {
  const secret = process.env.SAC_CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("Chave de criptografia das credenciais não configurada.");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Credencial armazenada em formato inválido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function db() {
  return postgres({
    host: process.env.SAC_DB_HOST,
    port: 5432,
    database: process.env.SAC_DB_NAME || "trebeschi",
    username: "postgres",
    password: process.env.SAC_DB_PASSWORD,
    max: 1,
    connect_timeout: 20,
  });
}

export async function loadSankhyaCredentials(): Promise<SankhyaCredentials | null> {
  const sql = db();
  try {
    const rows = await sql`SELECT base_url, token_encrypted, client_id_encrypted, client_secret_encrypted FROM public.api_credentials WHERE provider = 'sankhya'`;
    const row = rows[0];
    if (!row) return null;
    return { url: row.base_url, token: decrypt(row.token_encrypted), clientId: decrypt(row.client_id_encrypted), clientSecret: decrypt(row.client_secret_encrypted) };
  } finally { await sql.end(); }
}

export async function saveSankhyaCredentials(credentials: SankhyaCredentials, userId: string) {
  const sql = db();
  try {
    await sql`
      INSERT INTO public.api_credentials (provider, base_url, token_encrypted, client_id_encrypted, client_secret_encrypted, updated_by, updated_at)
      VALUES ('sankhya', ${credentials.url}, ${encrypt(credentials.token)}, ${encrypt(credentials.clientId)}, ${encrypt(credentials.clientSecret)}, ${userId}, now())
      ON CONFLICT (provider) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        token_encrypted = EXCLUDED.token_encrypted,
        client_id_encrypted = EXCLUDED.client_id_encrypted,
        client_secret_encrypted = EXCLUDED.client_secret_encrypted,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
    `;
  } finally { await sql.end(); }
}

export async function sankhyaCredentialStatus() {
  const sql = db();
  try {
    const rows = await sql`SELECT base_url, updated_at FROM public.api_credentials WHERE provider = 'sankhya'`;
    return rows[0] ? { configured: true as const, baseUrl: rows[0].base_url as string, updatedAt: String(rows[0].updated_at) } : { configured: false as const, baseUrl: "", updatedAt: null };
  } finally { await sql.end(); }
}
