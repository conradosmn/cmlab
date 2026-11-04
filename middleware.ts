import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/authServer";

/**
 * Barra escritas administrativas no servidor. Roda no edge, então só verifica a
 * assinatura do JWT de sessão (bcrypt não roda aqui).
 *
 * As páginas /admin/* não são bloqueadas de propósito: elas não carregam dado
 * algum por conta própria — tudo vem da API. Sem sessão, o layout mostra o
 * formulário de login e a API recusa, que é onde a proteção precisa estar.
 *
 * A vitrine /feira cria pedidos por POST /api/orders, que é público e validado
 * separadamente — por isso não entra aqui.
 */
export async function middleware(req: NextRequest) {
  // Laboratório: ferramentas pessoais, só para o usuário master. Aqui a página
  // em si é barrada, não só a API.
  if (req.nextUrl.pathname.startsWith("/admin/laboratorio")) {
    const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session?.is_master) {
      return NextResponse.redirect(new URL("/admin/caixa", req.url));
    }
    return NextResponse.next();
  }

  // GET é público: a vitrine lê o catálogo por ele. A própria rota se encarrega
  // de omitir usuários e dados pessoais de pedidos para quem não tem sessão.
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return NextResponse.next();
  }

  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login no painel administrativo." },
      { status: 401 }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/state/:path*", "/admin/laboratorio/:path*", "/admin/laboratorio"],
};
