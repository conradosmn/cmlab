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
  FlaskConical,
  Store,
  BookOpen,
  Palette,
  LayoutGrid,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { useCMLabStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

interface SubLink {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeUrgent?: boolean;
  /** Abre a vitrine (fora do /admin), com destaque. */
  external?: boolean;
}

interface Area {
  id: "feira" | "catalogo" | "laboratorio";
  label: string;
  icon: LucideIcon;
  /** Rotas que pertencem à área (prefixos). */
  matches: string[];
  links: SubLink[];
}

/**
 * Menu do admin em duas camadas: as áreas (Feira, Catálogo, Laboratório) e,
 * abaixo, as funções da área atual. Configurações da conta ficam à direita.
 */
export function AdminNav() {
  const pathname = usePathname() || "";
  const { orders, filaments, resetDemoData, currentAdminUser, logoutAdmin } =
    useCMLabStore();

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

  const isAdminRole =
    !currentAdminUser ||
    currentAdminUser.is_master ||
    currentAdminUser.username.toLowerCase() === "conradosmn" ||
    currentAdminUser.role === "admin";
  // O Laboratório é pessoal do master (o servidor também barra a rota).
  const isMaster = Boolean(currentAdminUser?.is_master);

  const areas: Area[] = [
    {
      id: "feira",
      label: "Feira",
      icon: Store,
      matches: ["/admin/caixa", "/admin/fila", "/admin/insumos"],
      links: [
        {
          href: "/admin/caixa",
          label: "Caixa Mobile",
          icon: Smartphone,
          badge: awaitingTapCount || undefined,
          badgeUrgent: true,
        },
        {
          href: "/admin/fila",
          label: "Fila de Impressão",
          icon: CalendarClock,
          badge: queuedCount || undefined,
        },
        ...(isAdminRole
          ? [
              {
                href: "/admin/insumos",
                label: "Insumos",
                icon: PackageSearch,
                badge: restockAlertCount || undefined,
              },
            ]
          : []),
        { href: "/feira", label: "Kiosk iPad", icon: Tablet, external: true },
      ],
    },
    {
      id: "catalogo",
      label: "Catálogo",
      icon: BookOpen,
      matches: ["/admin/catalogo"],
      links: [{ href: "/admin/catalogo", label: "Produtos", icon: Sparkles }],
    },
    ...(isMaster
      ? [
          {
            id: "laboratorio" as const,
            label: "Laboratório",
            icon: FlaskConical,
            matches: ["/admin/laboratorio"],
            links: [
              { href: "/admin/laboratorio", label: "Ferramentas", icon: LayoutGrid },
              {
                href: "/admin/laboratorio/plaquinha",
                label: "Plaquinha de Colorir",
                icon: Palette,
              },
              {
                href: "/admin/laboratorio/chaveiro",
                label: "Chaveiro Articulado",
                icon: KeyRound,
              },
            ],
          },
        ]
      : []),
  ];

  const currentArea = areas.find((a) => a.matches.some((m) => pathname.startsWith(m)));
  const areaBadge = (a: Area) => a.links.reduce((n, l) => n + (l.badge || 0), 0);
  const areaUrgent = (a: Area) => a.links.some((l) => l.badgeUrgent && l.badge);

  return (
    <header className="sticky top-0 z-30 bg-areia/95 backdrop-blur border-b border-borda">
      {/* Camada 1: marca, áreas e conta */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/">
            <BrandLogo size="sm" showSubtitle={false} />
          </Link>
          <span
            title={isSupabaseConfigured ? "Supabase Cloud + Realtime Ativo" : "Modo Local • Feira TCE"}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-linho text-oliva border border-borda whitespace-nowrap"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isSupabaseConfigured ? "bg-emerald-600" : "bg-argila"
              }`}
            />
            <span>{isSupabaseConfigured ? "Cloud Ativo" : "Modo Local"}</span>
          </span>
        </div>

        <nav className="flex items-center gap-1 p-1 rounded-2xl bg-linho border border-borda">
          {areas.map((area) => {
            const Icon = area.icon;
            const active = currentArea?.id === area.id;
            const badge = areaBadge(area);
            return (
              <Link
                key={area.id}
                href={area.links[0].href}
                className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  active ? "bg-musgo text-linho shadow-sm" : "text-musgo hover:bg-areia"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{area.label}</span>
                {badge > 0 && !active && (
                  <span
                    className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] rounded-full font-bold ${
                      areaUrgent(area) ? "bg-terracota text-white animate-pulse" : "bg-borda text-musgo"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 shrink-0">
          {isAdminRole && (
            <Link
              href="/admin/usuarios"
              title="Usuários"
              className={`p-2 rounded-xl border transition ${
                pathname.startsWith("/admin/usuarios")
                  ? "bg-musgo text-linho border-musgo"
                  : "text-oliva hover:text-musgo hover:bg-linho border-borda"
              }`}
            >
              <Users className="w-4 h-4" />
            </Link>
          )}
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
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-oliva hover:text-red-700 hover:bg-linho border border-borda transition whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Sair</span>
            </button>
          )}
        </div>
      </div>

      {/* Camada 2: funções da área atual */}
      {currentArea && (
        <div className="border-t border-borda/70 bg-linho/60">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center gap-1 overflow-x-auto">
            {currentArea.links.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                    item.external
                      ? "ml-auto bg-terracota hover:bg-terracota-hover text-white font-semibold shadow-sm"
                      : active
                      ? "bg-areia text-musgo font-semibold border border-borda shadow-sm"
                      : "text-oliva hover:text-musgo hover:bg-areia/70"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[11px] rounded-full font-bold leading-none ${
                        item.badgeUrgent ? "bg-terracota text-white animate-pulse" : "bg-borda text-musgo"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
