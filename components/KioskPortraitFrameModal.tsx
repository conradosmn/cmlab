"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Filament, Product } from "@/lib/types";
import {
  Sparkles,
  Hand,
  Clock,
  Tag,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";

interface KioskPortraitFrameModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSelectProduct: (product: Product) => void;
  products: Product[];
  filaments: Filament[];
  formattedNextSlot: string;
}

interface PortraitSlide {
  product: Product;
  imageUrl: string;
  imageIdx: number;
  totalProductImages: number;
}

const SLIDE_DURATION_MS = 6000;

export function KioskPortraitFrameModal({
  isOpen,
  onDismiss,
  onSelectProduct,
  products,
  filaments,
  formattedNextSlot,
}: KioskPortraitFrameModalProps) {
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);

  // Monta todos os slides a partir das imagens de todos os produtos ativos
  const slides = useMemo<PortraitSlide[]>(() => {
    const list: PortraitSlide[] = [];
    const activeProducts = products.filter((p) => p.active);

    for (const product of activeProducts) {
      const validImages = (product.images || []).filter(Boolean);
      if (validImages.length > 0) {
        validImages.forEach((imgUrl, idx) => {
          list.push({
            product,
            imageUrl: imgUrl,
            imageIdx: idx,
            totalProductImages: validImages.length,
          });
        });
      }
    }
    return list;
  }, [products]);

  useEffect(() => {
    if (!isOpen || slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlideIdx((prev) => (prev + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, [isOpen, slides.length]);

  useEffect(() => {
    if (isOpen) {
      setCurrentSlideIdx(0);
    }
  }, [isOpen]);

  if (!isOpen || slides.length === 0) return null;

  const safeIdx = currentSlideIdx % slides.length;
  const currentSlide = slides[safeIdx];
  const { product, imageUrl } = currentSlide;

  const productColors = filaments.filter(
    (f) => f.active && product.allowed_filament_ids.includes(f.id)
  );
  const displayColors =
    productColors.length > 0
      ? productColors
      : filaments.filter((f) => f.active).slice(0, 6);

  const hours = Math.floor(product.print_time_minutes / 60);
  const mins = product.print_time_minutes % 60;
  const timeFormatted =
    hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ""}` : `${mins} min`;

  const categoryLabel =
    product.category === "decoracao"
      ? "Vasos & Luminárias"
      : product.category === "religioso"
      ? "Espiritualidade & Fé"
      : product.category === "fidgets"
      ? "Mimos & Fidgets"
      : "Chaveiros Personalizados";

  return (
    <div
      onClick={onDismiss}
      className="fixed inset-0 z-50 bg-musgo text-linho overflow-hidden select-none cursor-pointer flex flex-col justify-between"
    >
      {/* Fundo Ambiência Desfocado com a própria imagem da peça */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img
          key={`blur-${safeIdx}-${imageUrl}`}
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover scale-110 blur-2xl opacity-45 transition-all duration-1000"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/20 to-black/80" />
      </div>

      {/* Imagem Principal em Destaque (Modo Porta-Retrato com leve zoom suave) */}
      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-10 pb-48 sm:pb-52 pt-24 pointer-events-none">
        <div className="relative w-full h-full max-w-5xl flex items-center justify-center">
          <img
            key={`main-${safeIdx}-${imageUrl}`}
            src={imageUrl}
            alt={product.name}
            className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl border border-white/15 transition-all duration-700"
          />
        </div>
      </div>

      {/* Topo do Porta-Retrato: Identidade CM Casa Criativa + Indicadores */}
      <div className="relative z-10 px-6 sm:px-10 pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 bg-linho/95 text-musgo px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-md border border-borda">
          <img
            src="/logo-cm-casa-criativa.png"
            alt="CM Casa Criativa"
            className="h-10 w-auto object-contain mix-blend-multiply"
          />
          <div>
            <div className="text-lg font-serif font-bold leading-none">
              CM Casa Criativa
            </div>
            <div className="text-[10px] text-oliva uppercase tracking-widest font-semibold mt-0.5">
              Atelier 3D • Mostruário Digital
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 text-xs text-linho">
            <span className="w-2.5 h-2.5 rounded-full bg-terracota animate-pulse" />
            <span className="text-linho/80">Próxima entrega Fila A1:</span>
            <strong className="font-semibold capitalize text-white">
              {formattedNextSlot}
            </strong>
          </div>

          <div className="bg-black/50 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 text-xs font-medium text-linho/90">
            {safeIdx + 1} / {slides.length}
          </div>
        </div>
      </div>

      {/* Controles Laterais Discretos para navegar nas fotos sem sair se quiser */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentSlideIdx((prev) => (prev - 1 + slides.length) % slides.length);
            }}
            className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/65 border border-white/20 text-white items-center justify-center backdrop-blur-md transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentSlideIdx((prev) => (prev + 1) % slides.length);
            }}
            className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/40 hover:bg-black/65 border border-white/20 text-white items-center justify-center backdrop-blur-md transition"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Rodapé do Porta-Retrato: Card da Peça + Convite para Tocar na Tela */}
      <div className="relative z-10 px-6 sm:px-10 pb-7 space-y-4">
        <div className="max-w-5xl mx-auto bg-linho/95 text-musgo backdrop-blur-md rounded-3xl p-5 sm:p-6 border border-borda shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-terracota text-white text-[11px] font-bold uppercase tracking-wider">
                {categoryLabel}
              </span>
              {product.ready_stock_qty > 0 && (
                <span className="px-3 py-0.5 rounded-full bg-areia text-musgo border border-borda text-[11px] font-semibold">
                  {product.ready_stock_qty} un. na mesa ou Sob Medida
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-areia text-oliva border border-borda text-[11px] font-medium inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-terracota" />
                Produção: {timeFormatted}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-musgo leading-tight">
              {product.name}
            </h2>

            <p className="text-xs sm:text-sm text-oliva line-clamp-2 leading-relaxed">
              {product.description}
            </p>

            {/* Cores disponíveis */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11px] text-oliva font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-terracota" />
                Cores sob encomenda:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {displayColors.map((fil) => (
                  <span
                    key={fil.id}
                    title={fil.color_name}
                    className="w-5 h-5 rounded-full border-2 border-white shadow-sm ring-1 ring-borda"
                    style={{ backgroundColor: fil.hex_code }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Preço + Botão direto para a peça */}
          <div className="w-full md:w-auto shrink-0 flex flex-row md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-borda">
            <div className="text-left md:text-right">
              <span className="text-[11px] text-oliva uppercase tracking-wider font-semibold block">
                Valor Feira TCE
              </span>
              <span className="text-3xl font-serif font-bold text-musgo">
                R$ {product.price.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectProduct(product);
              }}
              className="px-6 py-3.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white text-sm font-semibold shadow-md transition flex items-center gap-2"
            >
              {product.is_custom_keychain ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Simular Meu Nome</span>
                </>
              ) : (
                <>
                  <Tag className="w-4 h-4" />
                  <span>Quero Esta Peça</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Barra de convite interativo + indicadores de slide */}
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-white/90 text-xs">
          <div className="inline-flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/15 animate-pulse">
            <Hand className="w-4 h-4 text-terracota" />
            <span className="font-semibold tracking-wide">
              Toque em qualquer lugar da tela para abrir o catálogo interativo
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlideIdx(idx);
                }}
                className={`h-2 rounded-full transition-all ${
                  idx === safeIdx
                    ? "w-7 bg-terracota"
                    : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
