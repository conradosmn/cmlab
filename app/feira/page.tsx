"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { useCMLabStore } from "@/lib/store";
import {
  CustomKeychainData,
  Product,
  ProductCategory,
  SelectedColorChoice,
} from "@/lib/types";
import { KeychainSimulatorModal } from "@/components/KeychainSimulatorModal";
import { CheckoutModal } from "@/components/CheckoutModal";
import { KioskPortraitFrameModal } from "@/components/KioskPortraitFrameModal";
import {
  Sparkles,
  Clock,
  Tag,
  CheckCircle2,
  Layers,
  Lock,
  Palette,
  ChevronLeft,
  ChevronRight,
  Frame,
} from "lucide-react";

const KIOSK_IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos ocioso -> Modo Porta-Retrato

const CATEGORY_TABS: { id: "all" | ProductCategory; label: string }[] = [
  { id: "all", label: "Coleção Completa" },
  { id: "decoracao", label: "Vasos & Luminárias" },
  { id: "religioso", label: "Artigos Religiosos" },
  { id: "fidgets", label: "Fidgets & Mimos" },
  { id: "chaveiros", label: "Chaveiros Personalizados" },
];

export default function FeiraKioskPage() {
  const { products, filaments, nextDeliveryEstimate } = useCMLabStore();

  const [selectedCategory, setSelectedCategory] = useState<"all" | ProductCategory>("all");
  const [activeImageIdxMap, setActiveImageIdxMap] = useState<Record<string, number>>({});
  const [isKeychainModalOpen, setIsKeychainModalOpen] = useState(false);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [isPortraitModeOpen, setIsPortraitModeOpen] = useState(false);
  const [preconfiguredKeychain, setPreconfiguredKeychain] = useState<{
    customKeychainData: CustomKeychainData;
    selectedColors: SelectedColorChoice[];
    totalPrice: number;
    weightGrams: number;
    printTimeMinutes: number;
    materialReady: boolean;
    restockBufferDays: number;
  } | null>(null);

  // Monitora ociosidade do Kiosk (3 minutos sem toque/movimento -> ativa Modo Porta-Retrato)
  useEffect(() => {
    if (isPortraitModeOpen) return;

    let idleTimer: ReturnType<typeof setTimeout>;

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setIsPortraitModeOpen(true);
      }, KIOSK_IDLE_TIMEOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "pointermove",
      "touchstart",
      "touchmove",
      "keydown",
      "wheel",
      "scroll",
      "click",
    ];

    events.forEach((evt) =>
      window.addEventListener(evt, resetIdleTimer, { passive: true })
    );
    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);
      events.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
  }, [isPortraitModeOpen]);

  const handleSelectProductFromPortrait = useCallback((product: Product) => {
    setIsPortraitModeOpen(false);
    if (product.is_custom_keychain) {
      setIsKeychainModalOpen(true);
    } else {
      setPreconfiguredKeychain(null);
      setCheckoutProduct(product);
    }
  }, []);

  const visibleProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p.active &&
        (selectedCategory === "all" || p.category === selectedCategory)
    );
  }, [products, selectedCategory]);

  const keychainProduct = useMemo<Product>(
    () =>
      products.find((p) => p.is_custom_keychain) ||
      products[products.length - 1] || {
        id: "prod-chaveiro-personalizado",
        name: "Chaveiro Personalizado com Nome (2.5D AMS)",
        category: "chaveiros",
        description:
          "Personalize na hora com seu nome, escolha a fonte, combinação de cores da base e letras, e adicione pingente exclusivo pendurado na argola.",
        images: [],
        print_time_minutes: 24,
        weight_grams: 12,
        max_colors: 3,
        allowed_filament_ids: [],
        accessories: [],
        production_cost: 3.85,
        price: 15.0,
        is_custom_keychain: true,
        ready_stock_qty: 0,
        active: true,
      },
    [products]
  );

  const handleOpenRegularCheckout = (product: Product) => {
    if (product.is_custom_keychain) {
      setIsKeychainModalOpen(true);
      return;
    }
    setPreconfiguredKeychain(null);
    setCheckoutProduct(product);
  };

  const handleProceedFromKeychainSimulator = (payload: {
    customKeychainData: CustomKeychainData;
    selectedColors: SelectedColorChoice[];
    totalPrice: number;
    weightGrams: number;
    printTimeMinutes: number;
    materialReady: boolean;
    restockBufferDays: number;
  }) => {
    setIsKeychainModalOpen(false);
    setPreconfiguredKeychain(payload);
    setCheckoutProduct(keychainProduct);
  };

  const formattedNextSlot = nextDeliveryEstimate.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-linho flex flex-col">
      {/* Header Kiosk iPad Aconchegante */}
      <header className="sticky top-0 z-30 bg-areia/95 backdrop-blur border-b border-borda shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <BrandLogo size="md" />

          <div className="flex items-center gap-3">
            {/* Badge ao vivo da próxima janela de entrega da fila */}
            <div className="flex items-center gap-2.5 bg-linho px-4 py-2 rounded-2xl border border-borda shadow-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-terracota animate-pulse" />
              <div className="text-xs">
                <span className="text-oliva block leading-none">
                  Próxima janela de entrega (Fila A1):
                </span>
                <strong className="text-musgo font-semibold capitalize">
                  {formattedNextSlot}
                </strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPortraitModeOpen(true)}
              title="Ativar Modo Porta-Retrato (entra automaticamente após 3 min ocioso)"
              className="p-2.5 rounded-xl bg-linho hover:bg-borda/40 border border-borda text-oliva hover:text-musgo transition flex items-center gap-1.5 text-xs font-medium"
            >
              <Frame className="w-4 h-4 text-terracota" />
              <span className="hidden md:inline">Porta-Retrato</span>
            </button>

            <Link
              href="/admin/caixa"
              title="Acesso discreto da equipe ao painel Admin"
              className="p-2.5 rounded-xl bg-linho hover:bg-borda/40 border border-borda text-oliva hover:text-musgo transition"
            >
              <Lock className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 space-y-8 flex-1">
        {/* Banner Destaque: Simulador de Chaveiro Personalizado com Nome (R$ 15 + Adereço R$ 5) */}
        <section className="relative overflow-hidden rounded-3xl bg-areia border-2 border-argila/60 p-6 sm:p-8 shadow-atelier flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-terracota text-white text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sucesso da Feira TCE • Personalize na Hora</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-musgo leading-tight">
              Monte seu Chaveiro 3D com Nome & Pingente ao Vivo
            </h1>
            <p className="text-sm sm:text-base text-oliva leading-relaxed">
              Escolha a fonte, combine as cores da base e das letras em relevo e veja como
              fica na tela! Preço único de{" "}
              <strong className="text-musgo">R$ 15,00</strong> (até 12 letras) + opção de
              pingente pendurado na argola por{" "}
              <strong className="text-terracota">+ R$ 5,00</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-musgo font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-terracota" />
                Acabamento Multicolor AMS Lite
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-terracota" />
                Argola + Corrente Italiana Inclusa
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-terracota" />
                Entrega diretamente no seu setor do TCE
              </span>
            </div>
          </div>

          <div className="shrink-0 w-full lg:w-auto flex flex-col items-center gap-3 bg-linho p-5 rounded-2xl border border-borda shadow-sm">
            <div className="text-center">
              <span className="text-xs text-oliva uppercase tracking-wider font-semibold">
                Chaveiro Personalizado
              </span>
              <div className="text-3xl font-serif font-bold text-musgo">
                R$ 15,00
              </div>
              <span className="text-[11px] text-terracota font-semibold">
                + R$ 5,00 com pingente (Estrela, Flor, Coração ou Cruz)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsKeychainModalOpen(true)}
              className="w-full lg:w-auto px-7 py-4 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-base shadow-md transition flex items-center justify-center gap-2.5"
            >
              <Palette className="w-5 h-5" />
              <span>Montar Chaveiro Agora</span>
            </button>
          </div>
        </section>

        {/* Abas de Filtro Rápido da Coleção */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-borda pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition whitespace-nowrap ${
                    active
                      ? "bg-musgo text-linho shadow-sm"
                      : "bg-areia text-musgo hover:bg-borda/50 border border-borda"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="text-xs text-oliva flex items-center gap-2">
            <Palette className="w-4 h-4 text-terracota" />
            <span>Toque em qualquer peça para escolher a cor do mostruário e reservar</span>
          </div>
        </div>

        {/* Grade de Produtos do Atelier */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleProducts.map((product) => {
            const productColors = filaments.filter(
              (f) => f.active && product.allowed_filament_ids.includes(f.id)
            );
            const displayColors =
              productColors.length > 0
                ? productColors
                : filaments.filter((f) => f.active).slice(0, 5);

            const hours = Math.floor(product.print_time_minutes / 60);
            const mins = product.print_time_minutes % 60;
            const timeFormatted = hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ""}` : `${mins} min`;
            const imgs = product.images && product.images.length > 0 ? product.images : [];
            const currentImgIdx = activeImageIdxMap[product.id] || 0;
            const currentImgSrc = imgs[currentImgIdx] || imgs[0];

            return (
              <div
                key={product.id}
                className="bg-areia border border-borda rounded-3xl overflow-hidden shadow-atelier hover:shadow-atelier-lg transition flex flex-col justify-between group"
              >
                <div>
                  {/* Foto Real da Peça com Carrossel p/ Múltiplas Fotos */}
                  <div className="relative h-64 bg-linho overflow-hidden border-b border-borda">
                    {currentImgSrc ? (
                      <img
                        src={currentImgSrc}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-oliva text-sm">
                        Peça Artesanal 3D
                      </div>
                    )}

                    {imgs.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIdxMap((prev) => ({
                              ...prev,
                              [product.id]:
                                ((prev[product.id] || 0) - 1 + imgs.length) % imgs.length,
                            }));
                          }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-linho/90 hover:bg-linho border border-borda text-musgo flex items-center justify-center shadow"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIdxMap((prev) => ({
                              ...prev,
                              [product.id]: ((prev[product.id] || 0) + 1) % imgs.length,
                            }));
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-linho/90 hover:bg-linho border border-borda text-musgo flex items-center justify-center shadow"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-linho/85 px-2 py-1 rounded-full border border-borda">
                          {imgs.map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImageIdxMap((prev) => ({
                                  ...prev,
                                  [product.id]: i,
                                }));
                              }}
                              className={`w-2 h-2 rounded-full transition ${
                                i === currentImgIdx ? "bg-terracota w-4" : "bg-borda"
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {product.ready_stock_qty > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-linho/95 text-musgo border border-borda shadow-sm">
                          {product.ready_stock_qty} un. na mesa ou Sob Medida
                        </span>
                      )}
                      {product.is_custom_keychain && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-terracota text-white shadow-sm">
                          Simulador 2.5D ao Vivo
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-medium bg-linho/90 text-musgo border border-borda backdrop-blur-sm flex items-center gap-1">
                      <Clock className="w-3 h-3 text-terracota" />
                      <span>Produção A1: {timeFormatted}</span>
                    </div>
                  </div>

                  {/* Corpo do Card */}
                  <div className="p-6 space-y-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-oliva font-semibold">
                        {product.category === "decoracao" && "Vasos & Luminárias"}
                        {product.category === "religioso" && "Espiritualidade & Fé"}
                        {product.category === "fidgets" && "Mimos & Fidgets"}
                        {product.category === "chaveiros" && "Personalizados com Nome"}
                      </div>
                      <h3 className="text-2xl font-serif font-bold text-musgo mt-0.5">
                        {product.name}
                      </h3>
                      <p className="text-xs text-oliva mt-1.5 line-clamp-2 leading-relaxed">
                        {product.description}
                      </p>
                    </div>

                    {/* Amostras de Filamento Disponíveis para esta Peça */}
                    <div>
                      <div className="text-[11px] text-oliva font-medium mb-1.5 flex items-center justify-between">
                        <span>Cores disponíveis sob encomenda:</span>
                        {product.max_colors > 1 && (
                          <span className="inline-flex items-center gap-1 text-musgo font-semibold">
                            <Layers className="w-3 h-3 text-terracota" />
                            Até {product.max_colors} cores
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {displayColors.map((fil) => (
                          <span
                            key={fil.id}
                            title={`${fil.color_name} (${fil.material})`}
                            className="w-6 h-6 rounded-full border-2 border-linho shadow-sm ring-1 ring-borda"
                            style={{ backgroundColor: fil.hex_code }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rodapé: Preço e CTA Terracota */}
                <div className="px-6 pb-6 pt-3 border-t border-borda/70 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-oliva block">Valor Feira TCE</span>
                    <span className="text-2xl font-serif font-bold text-musgo">
                      R$ {product.price.toFixed(2).replace(".", ",")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenRegularCheckout(product)}
                    className="px-5 py-3.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white text-sm font-semibold shadow-sm transition flex items-center gap-2"
                  >
                    <Tag className="w-4 h-4" />
                    <span>
                      {product.is_custom_keychain ? "Montar Chaveiro" : "Fazer Reserva"}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      </main>

      {/* Modal 1: Simulador de Chaveiro 2.5D ao Vivo */}
      <KeychainSimulatorModal
        isOpen={isKeychainModalOpen}
        onClose={() => setIsKeychainModalOpen(false)}
        filaments={filaments}
        onProceedToCheckout={handleProceedFromKeychainSimulator}
      />

      {/* Modal 2: Checkout e Reserva TCE */}
      <CheckoutModal
        isOpen={Boolean(checkoutProduct)}
        onClose={() => {
          setCheckoutProduct(null);
          setPreconfiguredKeychain(null);
        }}
        product={checkoutProduct}
        filaments={filaments}
        preconfiguredKeychain={preconfiguredKeychain}
      />

      {/* Modal 3: Modo Porta-Retrato (Descanso de Tela Kiosk após 3 min ocioso) */}
      <KioskPortraitFrameModal
        isOpen={isPortraitModeOpen}
        onDismiss={() => setIsPortraitModeOpen(false)}
        onSelectProduct={handleSelectProductFromPortrait}
        products={products}
        filaments={filaments}
        formattedNextSlot={formattedNextSlot}
      />
    </div>
  );
}
