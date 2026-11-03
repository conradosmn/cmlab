import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  createSessionToken,
  hashPassword,
  isAuthConfigured,
  readSessionToken,
  sessionCookieOptions,
  toPublicAdminUser,
  verifyPassword,
} from "@/lib/authServer";
import { readAdminUsers, writeAdminUsers } from "@/lib/serverStore";

export const runtime = "nodejs";

const MIN_LENGTH = 8;

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Autenticação não configurada no servidor." },
      { status: 503 }
    );
  }

  const store = await cookies();
  const session = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  let body: { newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const newPassword = (body.newPassword || "").trim();
  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `A nova senha deve ter pelo menos ${MIN_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  const users = await readAdminUsers();
  const target = users.find((u) => u.id === session.sub);
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  // Impede "trocar" pela mesma senha temporária.
  if (await verifyPassword(newPassword, target.password_hash)) {
    return NextResponse.json(
      { error: "Escolha uma senha diferente da atual." },
      { status: 400 }
    );
  }

  const updated = {
    ...target,
    password_hash: await hashPassword(newPassword),
    must_change_password: false,
  };
  const nextUsers = await writeAdminUsers(
    users.map((u) => (u.id === updated.id ? updated : u))
  );

  const saved = nextUsers.find((u) => u.id === updated.id) || updated;
  const token = await createSessionToken({
    id: saved.id,
    username: saved.username,
    role: saved.is_master ? "admin" : saved.role || "gerente",
    is_master: Boolean(saved.is_master),
    must_change_password: false,
  });

  const res = NextResponse.json({ user: toPublicAdminUser(saved) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
