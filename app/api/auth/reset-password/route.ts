import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  generateTemporaryPassword,
  hashPassword,
  isAuthConfigured,
  readSessionToken,
} from "@/lib/authServer";
import { readAdminUsers, writeAdminUsers } from "@/lib/serverStore";

export const runtime = "nodejs";

/**
 * Gera uma senha temporária para outro usuário. Só um admin pode chamar.
 * A senha em claro é devolvida UMA ÚNICA VEZ, para quem está criando a conta
 * repassar ao titular; o que fica guardado é apenas o hash.
 */
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
  if (session.role !== "admin" && !session.is_master) {
    return NextResponse.json(
      { error: "Apenas administradores podem redefinir senhas." },
      { status: 403 }
    );
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const userId = (body.userId || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Informe o usuário." }, { status: 400 });
  }

  const users = await readAdminUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const updated = {
    ...target,
    password_hash: await hashPassword(temporaryPassword),
    must_change_password: true,
  };
  await writeAdminUsers(users.map((u) => (u.id === userId ? updated : u)));

  return NextResponse.json({
    temporaryPassword,
    username: updated.username,
    note: "Anote agora: esta senha não será exibida novamente.",
  });
}
