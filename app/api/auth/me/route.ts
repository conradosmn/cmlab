import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  isAuthConfigured,
  readSessionToken,
  toPublicAdminUser,
} from "@/lib/authServer";
import { readAdminUsers } from "@/lib/serverStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthConfigured()) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const store = await cookies();
  const session = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const users = await readAdminUsers();
  const found = users.find((u) => u.id === session.sub);
  if (!found) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({ user: toPublicAdminUser(found) });
}
