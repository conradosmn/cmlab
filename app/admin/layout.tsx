"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { useCMLabStore } from "@/lib/store";
import { Lock, User, KeyRound, Eye, EyeOff, Tablet, AlertCircle } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentAdminUser, loginAdmin } = useCMLabStore();

  const [hydrated, setHydrated] = useState(false);
  const [loginInput, setLoginInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const ok = loginAdmin(loginInput, passwordInput);
    if (!ok) {
      setErrorMsg("Usuário/e-mail ou senha inválidos. Verifique e tente novamente.");
    } else {
      setPasswordInput("");
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-linho flex items-center justify-center text-oliva text-sm">
        Carregando painel administrativo...
      </div>
    );
  }

  if (!currentAdminUser) {
    return (
      <div className="min-h-screen bg-linho flex flex-col justify-between p-4 sm:p-8">
        {/* Top bar com atalho para a Loja/Kiosk */}
        <div className="max-w-5xl w-full mx-auto flex items-center justify-between">
          <BrandLogo size="sm" />
          <Link
            href="/feira"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-areia hover:bg-borda/50 border border-borda text-musgo text-xs font-semibold transition"
          >
            <Tablet className="w-4 h-4 text-terracota" />
            <span>Ir para Loja Kiosk (/feira)</span>
          </Link>
        </div>

        {/* Card Central de Login Admin */}
        <div className="max-w-md w-full mx-auto bg-areia border border-borda rounded-3xl p-6 sm:p-8 shadow-atelier-lg space-y-6 my-8">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-terracota/15 border border-terracota/30 text-terracota flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-musgo">
              Acesso Restrito • Admin
            </h1>
            <p className="text-xs text-oliva">
              Entre com seu usuário ou e-mail administrativo para gerenciar o CMLab.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1.5">
                Usuário ou E-mail
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-oliva absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Ex: conradosmn ou seu@email.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-linho border border-borda text-musgo text-sm focus:outline-none focus:ring-2 focus:ring-argila"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1.5">
                Senha
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-oliva absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-linho border border-borda text-musgo text-sm focus:outline-none focus:ring-2 focus:ring-argila"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-oliva hover:text-musgo p-0.5"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-sm shadow-md transition flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Entrar no Painel Admin</span>
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-oliva">
          CM Casa Criativa • A vitrine de vendas (<Link href="/feira" className="underline text-terracota font-semibold">/feira</Link>) permanece aberta para clientes sem necessidade de login.
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
