import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { AdminUser, AdminUserRole } from "./types";

export const SESSION_COOKIE = "cmlab_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12h — uma jornada de feira
const BCRYPT_ROUNDS = 10;

export interface SessionPayload {
  sub: string; // id do usuário
  username: string;
  role: AdminUserRole;
  is_master: boolean;
  must_change_password: boolean;
}

/**
 * Segredo de assinatura da sessão. Diferente das chaves do Supabase, este NUNCA
 * pode ter o prefixo NEXT_PUBLIC_ — ele fica só no servidor.
 * Sem ele a aplicação recusa a autenticar, em vez de cair num padrão previsível.
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres). Configure a variável de ambiente no servidor."
    );
  }
  return new TextEncoder().encode(secret);
}

export function isAuthConfigured(): boolean {
  const secret = process.env.AUTH_SECRET;
  return Boolean(secret && secret.length >= 32);
}

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_ROUNDS);
}

/**
 * Confere a senha contra o hash bcrypt. Aceita também hashes "$2a$"/"$2y$"
 * gerados por outras ferramentas, que o bcryptjs entende nativamente.
 */
export async function verifyPassword(
  plain: string,
  passwordHash: string | undefined
): Promise<boolean> {
  if (!plain || !passwordHash) return false;
  if (!passwordHash.startsWith("$2")) return false;
  try {
    return await compare(plain, passwordHash);
  } catch {
    return false;
  }
}

export async function createSessionToken(user: {
  id: string;
  username: string;
  role?: AdminUserRole;
  is_master?: boolean;
  must_change_password?: boolean;
}): Promise<string> {
  return new SignJWT({
    username: user.username,
    role: user.role || "gerente",
    is_master: Boolean(user.is_master),
    must_change_password: Boolean(user.must_change_password),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function readSessionToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      username: String(payload.username || ""),
      role: (payload.role as AdminUserRole) || "gerente",
      is_master: Boolean(payload.is_master),
      must_change_password: Boolean(payload.must_change_password),
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Remove qualquer material de senha antes de um usuário trafegar para o cliente.
 * Toda resposta que carregue AdminUser passa por aqui.
 */
export function toPublicAdminUser(user: AdminUser): AdminUser {
  const { password_hash, ...safe } = user as AdminUser & {
    password_hash?: string;
    password?: string;
  };
  delete (safe as Record<string, unknown>).password;
  return safe as AdminUser;
}

export function toPublicAdminUsers(users: AdminUser[]): AdminUser[] {
  return (users || []).map(toPublicAdminUser);
}

/**
 * Senha temporária legível para entregar a um novo usuário. Mostrada uma única
 * vez a quem cria a conta; o banco guarda apenas o hash.
 */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
