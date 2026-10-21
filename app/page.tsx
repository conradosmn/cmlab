"use client";

import React from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { useCMLabStore } from "@/lib/store";
import {
  Tablet,
  Smartphone,
  CalendarClock,
  Sparkles,
  PackageSearch,
  ArrowRight,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Users,
  Lock,
} from "lucide-react";

export default function HomePage() {
  const { orders, products, filaments, currentAdminUser } = useCMLabStore();

  const paidOrders = orders.filter((o) => o.payment_status === "paid");
  const awaitingTap = orders.filter((o) => o.payment_status === "awaiting_tap_to_pay");
  const revenueTotal = paidOrders.reduce((acc, o) => acc + o.total_price, 0);
  const lowStockCount = filaments.filter(
    (f) => f.is_on_order_color || f.remaining_weight_grams < 150
  ).length;

  return (
    <div className="min-h-screen bg-linho flex flex-col justify-between">
      {/* Top Bar */}
      <header className="bg-areia/90 border-b border-borda">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <BrandLogo size="lg" />
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-linho border border-borda text-xs font-semibold text-musgo">
              <Printer className="w-4 h-4 text-terracota" />
              <span>Bambu Lab A1 (AMS Lite 4 Cores • 256³mm)</span>
            </span>
            <Link
              href="/feira"
              className="px-5 py-2.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white text-sm font-semibold shadow-sm transition flex items-center gap-2"
            >
              <Tablet className="w-4 h-4" />
              <span>Abrir Modo Kiosk iPad</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full px-6 py-10 space-y-10">
        {/* Hero Banner */}
        <div className="bg-areia border border-borda rounded-3xl p-8 shadow-atelier flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs uppercase tracking-widest text-terracota font-bold">
              Evento Alvo: Feira do Tribunal de Contas (TCE)
            </span>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-musgo">
              Sistema Kiosk de Encomendas & ERP Inteligente de Impressão 3D
            </h1>
            <p className="text-sm text-oliva leading-relaxed">
              Gerencie o catálogo da feira no iPad com simulador de chaveiros 2.5D ao vivo,
              recebimento 100% antecipado via PIX ou Tap to Pay no celular e fila automatizada
              da Bambu Lab A1 com Modo Corujão e regra de descanso de 2h após impressões longas.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full lg:w-auto shrink-0">
            <div className="bg-linho p-4 rounded-2xl border border-borda">
              <div className="text-xs text-oliva">Caixa Confirmado Feira</div>
              {currentAdminUser ? (
                <>
                  <div className="text-2xl font-serif font-bold text-musgo mt-0.5">
                    R$ {revenueTotal.toFixed(2).replace(".", ",")}
                  </div>
                  <div className="text-[11px] text-oliva mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-musgo" />
                    {paidOrders.length} pedidos pagos
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-serif font-bold text-musgo mt-1 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-terracota" />
                    <span>Restrito Admin</span>
                  </div>
                  <div className="text-[11px] text-oliva mt-1">
                    Faça login no Admin
                  </div>
                </>
              )}
            </div>
            <div className="bg-linho p-4 rounded-2xl border border-borda">
              <div className="text-xs text-oliva">Peças no Catálogo</div>
              <div className="text-2xl font-serif font-bold text-musgo mt-0.5">
                {products.length} itens
              </div>
              <div className="text-[11px] text-terracota mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {lowStockCount} bobina(s) p/ repor
              </div>
            </div>
          </div>
        </div>

        {/* Grid das 5 Telas da Especificação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* 1. /feira */}
          <Link
            href="/feira"
            className="group bg-areia hover:bg-areia/70 border-2 border-terracota/40 hover:border-terracota rounded-3xl p-6 shadow-atelier transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-terracota text-white">
                  <Tablet className="w-6 h-6" />
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-terracota/15 text-terracota">
                  Visão do Cliente (iPad)
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                1. Vitrine Kiosk & Simulador (/feira)
              </h2>
              <p className="text-xs text-oliva leading-relaxed">
                Catálogo aconchegante para o estande no TCE, Simulador de Chaveiro 2.5D ao vivo
                (R$ 15 + Pingente R$ 5) e Checkout rápido com PIX QR Code ou Tap to Pay.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-borda flex items-center justify-between text-xs font-semibold text-terracota">
              <span>Abrir Vitrine Kiosk no iPad</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 2. /admin/caixa */}
          <Link
            href="/admin/caixa"
            className="group bg-areia hover:bg-areia/70 border border-borda hover:border-argila rounded-3xl p-6 shadow-atelier transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-musgo text-linho">
                  <Smartphone className="w-6 h-6" />
                </span>
                {awaitingTap.length > 0 ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-terracota text-white animate-pulse">
                    {awaitingTap.length} aguardando Tap to Pay!
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-linho text-oliva border border-borda">
                    Visão Celular Bolso
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                2. Caixa Mobile Tap to Pay (/admin/caixa)
              </h2>
              <p className="text-xs text-oliva leading-relaxed">
                Tela de bolso para o seu celular na feira. Recebe alertas em tempo real do iPad e
                destrava a tela do cliente com 1 toque após passar o cartão no Mercado Pago.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-borda flex items-center justify-between text-xs font-semibold text-musgo">
              <span>Abrir Caixa Mobile</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 3. /admin/fila */}
          <Link
            href="/admin/fila"
            className="group bg-areia hover:bg-areia/70 border border-borda hover:border-argila rounded-3xl p-6 shadow-atelier transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-musgo text-linho">
                  <CalendarClock className="w-6 h-6" />
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-linho text-oliva border border-borda">
                  Regra &gt;6h + 2h & Corujão
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                3. Fila Inteligente A1 (/admin/fila)
              </h2>
              <p className="text-xs text-oliva leading-relaxed">
                Timeline cronológica da Bambu Lab A1 com Turno Corujão (20h-23h), folga automática
                de 2h após peças &gt;6h, exportador OpenSCAD e aviso de 1 clique no WhatsApp.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-borda flex items-center justify-between text-xs font-semibold text-musgo">
              <span>Ver Agenda de Impressão</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 4. /admin/catalogo */}
          <Link
            href="/admin/catalogo"
            className="group bg-areia hover:bg-areia/70 border border-borda hover:border-argila rounded-3xl p-6 shadow-atelier transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-musgo text-linho">
                  <Sparkles className="w-6 h-6" />
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-linho text-oliva border border-borda">
                  MakerWorld + .3MF
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                4. Catálogo & Custos 3D (/admin/catalogo)
              </h2>
              <p className="text-xs text-oliva leading-relaxed">
                Importador de links do MakerWorld (filtro exclusivo Bambu Lab A1) ou arquivo .3mf,
                com calculadora de engenharia de custos (energia 120W, depreciação, acessórios e taxa MP).
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-borda flex items-center justify-between text-xs font-semibold text-musgo">
              <span>Gerenciar Produtos & Custos</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 5. /admin/insumos */}
          <Link
            href="/admin/insumos"
            className="group bg-areia hover:bg-areia/70 border border-borda hover:border-argila rounded-3xl p-6 shadow-atelier transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-musgo text-linho">
                  <PackageSearch className="w-6 h-6" />
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-terracota/15 text-terracota">
                  Lista de Compras Ativa
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                5. Estoque, Impressoras & Insumos (/admin/insumos)
              </h2>
              <p className="text-xs text-oliva leading-relaxed">
                Controle de bobinas de filamento, pacotes de acessórios, frota de impressoras 3D
                e alerta automático de compras financiado pelos pedidos pagos na feira.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-borda flex items-center justify-between text-xs font-semibold text-musgo">
              <span>Gerenciar Bobinas, Insumos & Frota</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 6. /admin/usuarios */}
          <Link
            href="/admin/usuarios"
            className="group bg-areia hover:bg-areia/70 border border-borda hover:border-argila rounded-3xl p-6 shadow-atelier transition flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-3 rounded-2xl bg-musgo text-linho">
                  <Users className="w-6 h-6" />
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-linho text-oliva border border-borda">
                  Login & Equipe Admin
                </span>
              </div>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                6. Usuários & Acesso Admin (/admin/usuarios)
              </h2>
              <p className="text-xs text-oliva leading-relaxed">
                Gerencie os usuários com acesso ao painel administrativo (nome completo, e-mail,
                telefone e senha). A vitrine Kiosk (/feira) permanece aberta para os clientes.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-borda flex items-center justify-between text-xs font-semibold text-musgo">
              <span>Gerenciar Usuários Admin</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </main>

      <footer className="border-t border-borda bg-areia/60 py-4 px-6 text-center text-xs text-oliva">
        CM Casa Criativa (CMLab) • Atelier de Impressão 3D & Decoração • Produzido em Bambu Lab A1
      </footer>
    </div>
  );
}
