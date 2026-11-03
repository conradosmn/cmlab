import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  isAuthConfigured,
  sessionCookieOptions,
  toPublicAdminUser,
  verifyPassword,
} from "@/lib/authServer";
import { readAdminUsers } from "@/lib/serverStore";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Autenticação não configurada no servidor (AUTH_SECRET ausente)." },
      { status: 503 }
    );
  }

  let body: { login?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const login = (body.login || "").trim().toLowerCase();
  const password = body.password || "";
  if (!login || !password) {
    return NextResponse.json(
      { error: "Informe usuário/e-mail e senha." },
      { status: 400 }
    );
  }

  const users = await readAdminUsers();
  const found = users.find(
    (u) =>
      u.username?.trim().toLowerCase() === login ||
      u.email?.trim().toLowerCase() === login
  );

  // Mesma resposta para usuário inexistente e senha errada, para não revelar
  // quais logins existem.
  const ok = found ? await verifyPassword(password, found.password_hash) : false;
  if (!found || !ok) {
    return NextResponse.json(
      { error: "Usuário/e-mail ou senha inválidos." },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    id: found.id,
    username: found.username,
    role: found.is_master ? "admin" : found.role || "gerente",
    is_master: Boolean(found.is_master),
    must_change_password: Boolean(found.must_change_password),
  });

  const res = NextResponse.json({ user: toPublicAdminUser(found) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
