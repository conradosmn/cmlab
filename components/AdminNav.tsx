"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "./BrandLogo";
import {
  Smartphone,
  Sparkles,
  PackageSearch,
  CalendarClock,
  Tablet,
  RotateCcw,
  Users,
  LogOut,
} from "lucide-react";
import { useCMLabStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

export function AdminNav() {
  const pathname = usePathname();
  const {
    orders,
    filaments,
    resetDemoData,
    currentAdminUser,
    logoutAdmin,
  } = useCMLabStore();

  const awaitingTapCount = orders.filter(
    (o) => o.payment_status === "awaiting_tap_to_pay"
  ).length;

  const restockAlertCount = filaments.filter(
    (f) => f.is_on_order_color || f.remaining_weight_grams < 150
  ).length;

  const queuedCount = orders.filter(
    (o) =>
      o.payment_status === "paid" &&
      (o.queue_status === "queued" || o.queue_status === "printing")
  ).length;

  const links = [
    {
      href: "/admin/caixa",
      label: "Caixa Mobile (Tap to Pay)",
      icon: Smartphone,
      badge: awaitingTapCount > 0 ? awaitingTapCount : undefined,
      badgeUrgent: true,
    },
    {
      href: "/admin/fila",
      label: "Fila A1 & Corujão",
      icon: CalendarClock,
      badge: queuedCount > 0 ? queuedCount : undefined,
    },
    {
      href: "/admin/catalogo",
      label: "Catálogo",
      icon: Sparkles,
    },
    {
      href: "/admin/insumos",
      label: "Insumos",
      icon: PackageSearch,
      badge: restockAlertCount > 0 ? restockAlertCount : undefined,
    },
    {
      href: "/admin/usuarios",
      label: "Usuários",
      icon: Users,
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-areia/95 backdrop-blur border-b border-borda">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <BrandLogo size="sm" showSubtitle={false} />
          </Link>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-linho text-oliva border border-borda">
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseConfigured ? "bg-emerald-600" : "bg-argila"
              }`}
            />
            <span>
              {isSupabaseConfigured
                ? "Supabase Cloud + Realtime Ativo"
                : "Modo Local • Feira TCE"}
            </span>
          </span>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
          {links.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  active
                    ? "bg-musgo text-linho shadow-sm"
                    : "text-musgo hover:bg-linho/80 border border-transparent hover:border-borda"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 text-[11px] rounded-full font-bold leading-none ${
                      item.badgeUrgent
                        ? "bg-terracota text-white animate-pulse"
                        : active
                        ? "bg-linho text-musgo"
                        : "bg-borda text-musgo"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/feira"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-terracota hover:bg-terracota-hover text-white transition shadow-sm"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Kiosk iPad (/feira)</span>
          </Link>
          <button
            onClick={() => {
              if (confirm("Deseja restaurar os dados de demonstração da Feira TCE?")) {
                resetDemoData();
              }
            }}
            title="Restaurar dados iniciais de demonstração"
            className="p-2 rounded-xl text-oliva hover:text-musgo hover:bg-linho border border-borda transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {currentAdminUser && (
            <button
              onClick={logoutAdmin}
              title={`Sair da conta (${currentAdminUser.username})`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-oliva hover:text-red-700 hover:bg-linho border border-borda transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
