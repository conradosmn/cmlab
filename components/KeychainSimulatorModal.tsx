"use client";

import React, { useState, useMemo } from "react";
import {
  CustomKeychainData,
  Filament,
  KeychainCharm,
  KeychainFont,
  SelectedColorChoice,
} from "@/lib/types";
import { calculateCustomKeychainMetrics } from "@/lib/costCalculator";
import { X, Sparkles, Check, AlertCircle, Tag } from "lucide-react";

interface KeychainSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  filaments: Filament[];
  onProceedToCheckout: (payload: {
    customKeychainData: CustomKeychainData;
    selectedColors: SelectedColorChoice[];
    totalPrice: number;
    weightGrams: number;
    printTimeMinutes: number;
    materialReady: boolean;
    restockBufferDays: number;
  }) => void;
}

const FONT_OPTIONS: { id: KeychainFont; label: string; sampleClass: string; svgFont: string }[] = [
  {
    id: "rounded",
    label: "Redonda Fofa (Fredoka)",
    sampleClass: "font-fredoka font-bold",
    svgFont: "var(--font-fredoka), Fredoka, sans-serif",
  },
  {
    id: "modern",
    label: "Moderna Forte (Montserrat)",
    sampleClass: "font-montserrat font-extrabold uppercase tracking-wide",
    svgFont: "var(--font-montserrat), Montserrat, sans-serif",
  },
  {
    id: "script",
    label: "Cursiva Atelier (Pacifico)",
    sampleClass: "font-pacifico",
    svgFont: "var(--font-pacifico), Pacifico, cursive",
  },
];

const CHARM_OPTIONS: { id: KeychainCharm; label: string; price: number }[] = [
  { id: "none", label: "Sem Pingente", price: 0 },
  { id: "star", label: "Estrela Vazada", price: 5 },
  { id: "flower", label: "Flor Vazada", price: 5 },
  { id: "heart", label: "Coração Vazado", price: 5 },
  { id: "butterfly", label: "Borboleta Vazada", price: 5 },
  { id: "cat", label: "Gatinho Vazado", price: 5 },
  { id: "cross", label: "Cruz Vazada", price: 5 },
];

/**
 * Renderiza os pingentes 3D VAZADOS (outline grosso arredondado + olhal superior com furinho para o elo),
 * idênticos à foto de referência dos pingentes impressos em 3D!
 */
function renderHollowCharmShape(charm: KeychainCharm, fillHex: string) {
  const holeColor = "#FAF7F2";
  switch (charm) {
    case "star":
      return (
        <g>
          {/* Olhal superior para a argolinha */}
          <circle cx="0" cy="-22" r="4.5" fill={fillHex} />
          {/* Estrela vazada de borda espessa arredondada */}
          <polygon
            points="0,-19 5.5,-7 18.5,-5 9,4.5 11.5,17.5 0,11 -11.5,17.5 -9,4.5 -18.5,-5 -5.5,-7"
            fill="none"
            stroke={fillHex}
            strokeWidth="6.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Furinho do elo no topo */}
          <circle cx="0" cy="-22" r="1.8" fill={holeColor} />
        </g>
      );

    case "flower":
      return (
        <g>
          {/* Olhal superior na pétala do topo */}
          <circle cx="0" cy="-22" r="4.5" fill={fillHex} />
          {/* Flor de 5 pétalas vazada no centro */}
          <path
            d="M 0,-16
               C 5,-20 12,-15 10,-8
               C 17,-7 20,1 14,6
               C 17,13 10,19 4,15
               C 0,19 -4,15 -4,15
               C -10,19 -17,13 -14,6
               C -20,1 -17,-7 -10,-8
               C -12,-15 -5,-20 0,-16 Z"
            fill="none"
            stroke={fillHex}
            strokeWidth="6.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="0" cy="-22" r="1.8" fill={holeColor} />
        </g>
      );

    case "heart":
      return (
        <g>
          {/* Olhal superior */}
          <circle cx="-5" cy="-20" r="4.5" fill={fillHex} />
          {/* Coração vazado de parede espessa */}
          <path
            d="M 0,17
               C -4,13 -18,4 -18,-6
               C -18,-14 -11,-18 -4.5,-14.5
               C -1.5,-13 0,-10 0,-10
               C 0,-10 1.5,-13 4.5,-14.5
               C 11,-18 18,-14 18,-6
               C 18,4 4,13 0,17 Z"
            fill="none"
            stroke={fillHex}
            strokeWidth="6.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="-5" cy="-20" r="1.8" fill={holeColor} />
        </g>
      );

    case "butterfly":
      return (
        <g>
          {/* Olhal superior */}
          <circle cx="0" cy="-21" r="4.5" fill={fillHex} />
          {/* Borboleta vazada */}
          <path
            d="M 0,-11
               C 6,-20 19,-17 18,-6
               C 17,0 11,2 8,3
               C 14,5 16,14 9,17
               C 4,19 1,14 0,10
               C -1,14 -4,19 -9,17
               C -16,14 -14,5 -8,3
               C -11,2 -17,0 -18,-6
               C -19,-17 -6,-20 0,-11 Z"
            fill="none"
            stroke={fillHex}
            strokeWidth="5.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="0" cy="-21" r="1.8" fill={holeColor} />
        </g>
      );

    case "cat":
      return (
        <g>
          {/* Olhal superior */}
          <circle cx="0" cy="-22" r="4.5" fill={fillHex} />
          {/* Silhueta de Gatinho vazada com orelhas e bigodes */}
          <path
            d="M -13,-6
               L -15,-18 L -5,-12
               C -2,-13 2,-13 5,-12
               L 15,-18 L 13,-6
               C 17,-1 17,9 11,14
               C 5,18 -5,18 -11,14
               C -17,9 -17,-1 -13,-6 Z"
            fill="none"
            stroke={fillHex}
            strokeWidth="5.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Bigodinhos laterais */}
          <path
            d="M -19,-1 L -14,0 M -19,4 L -14,4 M 19,-1 L 14,0 M 19,4 L 14,4"
            stroke={fillHex}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="0" cy="-22" r="1.8" fill={holeColor} />
        </g>
      );

    case "cross":
      return (
        <g>
          <circle cx="0" cy="-22" r="4.5" fill={fillHex} />
          <path
            d="M -4.5,-17 L 4.5,-17 L 4.5,-5.5 L 15,-5.5 L 15,3.5 L 4.5,3.5 L 4.5,18 L -4.5,18 L -4.5,3.5 L -15,3.5 L -15,-5.5 L -4.5,-5.5 Z"
            fill="none"
            stroke={fillHex}
            strokeWidth="5.2"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="-22" r="1.8" fill={holeColor} />
        </g>
      );

    default:
      return null;
  }
}

export function KeychainSimulatorModal({
  isOpen,
  onClose,
  filaments,
  onProceedToCheckout,
}: KeychainSimulatorModalProps) {
  const activeFilaments = useMemo(
    () => filaments.filter((f) => f.active),
    [filaments]
  );

  const [nameText, setNameText] = useState("Maria");
  const [selectedFont, setSelectedFont] = useState<KeychainFont>("rounded");
  const [baseFilamentId, setBaseFilamentId] = useState<string>(
    activeFilaments[0]?.id || "fil-terracota"
  );
  const [letterFilamentId, setLetterFilamentId] = useState<string>(
    activeFilaments[1]?.id || "fil-marmore"
  );
  const [charm, setCharm] = useState<KeychainCharm>("star");
  const [charmFilamentId, setCharmFilamentId] = useState<string>(
    activeFilaments[3]?.id || activeFilaments[0]?.id || "fil-dourado"
  );

  if (!isOpen) return null;

  const baseFilament =
    activeFilaments.find((f) => f.id === baseFilamentId) || activeFilaments[0];
  const letterFilament =
    activeFilaments.find((f) => f.id === letterFilamentId) ||
    activeFilaments[1] ||
    activeFilaments[0];
  const charmFilament =
    activeFilaments.find((f) => f.id === charmFilamentId) || activeFilaments[0];

  const displayName = (nameText || "Maria").slice(0, 12);
  const metrics = calculateCustomKeychainMetrics(displayName, charm);
  const activeFontConfig =
    FONT_OPTIONS.find((f) => f.id === selectedFont) || FONT_OPTIONS[0];

  const chosenFilaments = [
    baseFilament,
    letterFilament,
    ...(charm !== "none" ? [charmFilament] : []),
  ].filter(Boolean);

  const needsRestock = chosenFilaments.some(
    (f) => f.is_on_order_color || f.remaining_weight_grams < 15
  );
  const maxRestockDays = chosenFilaments.reduce(
    (max, f) =>
      f.is_on_order_color || f.remaining_weight_grams < 15
        ? Math.max(max, f.restock_lead_time_days || 3)
        : max,
    0
  );

  const handleConfirm = () => {
    const cleanText = displayName.trim() || "Maria";
    const baseWeight = Math.ceil(metrics.totalWeightGrams * 0.58);
    const letterWeight = Math.ceil(metrics.totalWeightGrams * 0.27);
    const charmWeight = charm !== "none" ? 2 : 0;

    const selectedColors: SelectedColorChoice[] = [
      {
        slot_label: "Base do Chaveiro",
        filament_id: baseFilament.id,
        color_name: baseFilament.color_name,
        hex_code: baseFilament.hex_code,
        weight_grams: baseWeight,
      },
      {
        slot_label: "Letras em Relevo",
        filament_id: letterFilament.id,
        color_name: letterFilament.color_name,
        hex_code: letterFilament.hex_code,
        weight_grams: letterWeight,
      },
    ];

    if (charm !== "none" && charmFilament) {
      selectedColors.push({
        slot_label: `Pingente (${CHARM_OPTIONS.find((c) => c.id === charm)?.label})`,
        filament_id: charmFilament.id,
        color_name: charmFilament.color_name,
        hex_code: charmFilament.hex_code,
        weight_grams: charmWeight,
      });
    }

    onProceedToCheckout({
      customKeychainData: {
        text: cleanText,
        font: selectedFont,
        base_filament_id: baseFilament.id,
        base_hex: baseFilament.hex_code,
        base_color_name: baseFilament.color_name,
        letter_filament_id: letterFilament.id,
        letter_hex: letterFilament.hex_code,
        letter_color_name: letterFilament.color_name,
        charm,
        charm_filament_id: charm !== "none" ? charmFilament?.id : undefined,
        charm_hex: charm !== "none" ? charmFilament?.hex_code : undefined,
        charm_color_name: charm !== "none" ? charmFilament?.color_name : undefined,
      },
      selectedColors,
      totalPrice: metrics.priceBrl,
      weightGrams: metrics.totalWeightGrams,
      printTimeMinutes: metrics.printTimeMinutes,
      materialReady: !needsRestock,
      restockBufferDays: maxRestockDays,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-musgo/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-linho border border-borda rounded-3xl max-w-5xl w-full shadow-atelier-lg overflow-hidden my-auto">
        {/* Top Header */}
        <div className="bg-areia px-6 py-4 border-b border-borda flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-terracota/10 text-terracota">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                Atelier de Chaveiros Personalizados 2.5D
              </h2>
              <p className="text-xs text-oliva">
                Simulador ao vivo • Preço fixo R$ 15,00 (até 12 letras) • Pingente Vazado +R$ 5,00
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-linho hover:bg-borda/50 text-musgo transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Coluna Esquerda: Preview 2.5D ao Vivo em SVG */}
          <div className="lg:col-span-6 flex flex-col justify-between bg-areia/70 border border-borda rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-oliva">
                Preview 2.5D em Tempo Real (Argola no Início + Pingente Vazado)
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-linho border border-borda text-musgo font-medium">
                ~{metrics.totalWeightGrams}g • {metrics.printTimeMinutes} min
              </span>
            </div>

            {/* Palco SVG com textura de linho e iluminação de bancada */}
            <div className="relative bg-linho border border-borda rounded-2xl h-80 flex items-center justify-center overflow-hidden shadow-inner">
              <div
                className="absolute inset-0 opacity-25 pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(#C89D7C 0.75px, transparent 0.75px)",
                  backgroundSize: "16px 16px",
                }}
              />

              <svg
                viewBox="0 0 560 250"
                className="w-full h-full max-h-72 select-none drop-shadow-md"
              >
                <defs>
                  {/* Filtro 2.5D para a Base e Pingente Vazado Extrudado (3mm) */}
                  <filter id="extrudeBase" x="-25%" y="-25%" width="160%" height="160%">
                    <feDropShadow
                      dx="0"
                      dy="4.5"
                      stdDeviation="0"
                      floodColor="#2E3124"
                      floodOpacity="0.45"
                    />
                    <feDropShadow
                      dx="0"
                      dy="9"
                      stdDeviation="5"
                      floodColor="#4A4F3B"
                      floodOpacity="0.22"
                    />
                  </filter>

                  {/* Filtro 2.5D para o Relevo das Letras (+1.6mm) */}
                  <filter id="extrudeLetters" x="-15%" y="-15%" width="130%" height="130%">
                    <feDropShadow
                      dx="0"
                      dy="2.5"
                      stdDeviation="0"
                      floodColor="#1F2218"
                      floodOpacity="0.38"
                    />
                  </filter>

                  <linearGradient id="metalRing" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F5E6C8" />
                    <stop offset="50%" stopColor="#C5A059" />
                    <stop offset="100%" stopColor="#8C6D32" />
                  </linearGradient>
                </defs>

                {/* Argola Italiana + Corrente Metálica no INÍCIO do Chaveiro (Esquerda) */}
                <g transform="translate(88, 102)">
                  {/* Argola Principal 25mm */}
                  <circle
                    cx="-36"
                    cy="0"
                    r="23"
                    fill="none"
                    stroke="url(#metalRing)"
                    strokeWidth="5.5"
                  />
                  {/* Elo da corrente conectando na base no início do chaveiro */}
                  <ellipse
                    cx="-12"
                    cy="0"
                    rx="11"
                    ry="6"
                    fill="none"
                    stroke="url(#metalRing)"
                    strokeWidth="4.2"
                  />

                  {/* Pingente Vazado Pendurado no Início (na Argola / Olhal) */}
                  {charm !== "none" && (
                    <g transform="translate(-36, 56)">
                      {/* Argolinha / Ilha metálica conectando o pingente vazado */}
                      <ellipse
                        cx="0"
                        cy="-28"
                        rx="3.5"
                        ry="8.5"
                        fill="none"
                        stroke="url(#metalRing)"
                        strokeWidth="3"
                      />
                      <g filter="url(#extrudeBase)">
                        {renderHollowCharmShape(
                          charm,
                          charmFilament?.hex_code || "#D4AF37"
                        )}
                      </g>
                    </g>
                  )}
                </g>

                {/* Corpo do Chaveiro: Olhal da Argola no Início + Offset Arredondado da Base */}
                <g filter="url(#extrudeBase)">
                  <path
                    d="M 88,82 A 20,20 0 1,0 88,122 L 118,122 L 118,82 Z"
                    fill={baseFilament?.hex_code || "#A3522B"}
                  />
                  <text
                    x="108"
                    y="116"
                    fontFamily={activeFontConfig.svgFont}
                    fontSize={selectedFont === "modern" ? "52" : "58"}
                    fontWeight={selectedFont === "script" ? "400" : "800"}
                    fill={baseFilament?.hex_code || "#A3522B"}
                    stroke={baseFilament?.hex_code || "#A3522B"}
                    strokeWidth="28"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    style={{
                      paintOrder: "stroke fill",
                      letterSpacing: selectedFont === "modern" ? "2px" : "0.5px",
                    }}
                  >
                    {selectedFont === "modern" ? displayName.toUpperCase() : displayName}
                  </text>
                  {/* Furo Real do Olhal no início do chaveiro */}
                  <circle
                    cx="85"
                    cy="102"
                    r="7.5"
                    fill="#FAF7F2"
                    stroke="#2E3124"
                    strokeWidth="1"
                  />
                </g>

                {/* Camada Superior: Letras Extrudadas em Relevo (+1.6mm) */}
                <g filter="url(#extrudeLetters)">
                  <text
                    x="108"
                    y="114"
                    fontFamily={activeFontConfig.svgFont}
                    fontSize={selectedFont === "modern" ? "52" : "58"}
                    fontWeight={selectedFont === "script" ? "400" : "800"}
                    fill={letterFilament?.hex_code || "#EFECE6"}
                    style={{
                      letterSpacing: selectedFont === "modern" ? "2px" : "0.5px",
                    }}
                  >
                    {selectedFont === "modern" ? displayName.toUpperCase() : displayName}
                  </text>
                </g>
              </svg>
            </div>

            {/* Resumo das Cores Selecionadas */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-linho p-2.5 rounded-xl border border-borda flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full border border-musgo/30 shrink-0"
                  style={{ backgroundColor: baseFilament?.hex_code }}
                />
                <div className="truncate">
                  <div className="text-[10px] text-oliva uppercase">Base</div>
                  <div className="font-semibold text-musgo truncate">
                    {baseFilament?.color_name}
                  </div>
                </div>
              </div>
              <div className="bg-linho p-2.5 rounded-xl border border-borda flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full border border-musgo/30 shrink-0"
                  style={{ backgroundColor: letterFilament?.hex_code }}
                />
                <div className="truncate">
                  <div className="text-[10px] text-oliva uppercase">Letras</div>
                  <div className="font-semibold text-musgo truncate">
                    {letterFilament?.color_name}
                  </div>
                </div>
              </div>
              <div className="bg-linho p-2.5 rounded-xl border border-borda flex items-center gap-2">
                {charm !== "none" ? (
                  <>
                    <span
                      className="w-5 h-5 rounded-full border border-musgo/30 shrink-0"
                      style={{ backgroundColor: charmFilament?.hex_code }}
                    />
                    <div className="truncate">
                      <div className="text-[10px] text-oliva uppercase">Pingente Vazado</div>
                      <div className="font-semibold text-musgo truncate">
                        {charmFilament?.color_name}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-oliva italic">Sem pingente</div>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita: Controles Interativos */}
          <div className="lg:col-span-6 space-y-5">
            {/* 1. Nome Personalizado */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-semibold text-musgo">
                  1. Digite o Nome ou Palavra (máx. 12 letras)
                </label>
                <span className="text-xs text-oliva">{displayName.length}/12 caracteres</span>
              </div>
              <input
                type="text"
                maxLength={12}
                value={nameText}
                onChange={(e) => setNameText(e.target.value)}
                placeholder="Ex: Maria, TCE, Alice..."
                className="w-full px-4 py-3 rounded-xl bg-areia border border-borda text-musgo font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-argila"
              />
            </div>

            {/* 2. Estilo da Fonte */}
            <div>
              <label className="block text-sm font-semibold text-musgo mb-1.5">
                2. Escolha a Tipografia 3D
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFont(f.id)}
                    className={`p-3 rounded-xl border text-center transition ${
                      selectedFont === f.id
                        ? "bg-musgo text-linho border-musgo shadow-sm"
                        : "bg-areia text-musgo border-borda hover:border-argila"
                    }`}
                  >
                    <div className={`text-lg ${f.sampleClass}`}>Abc</div>
                    <div className="text-[11px] opacity-85 mt-0.5">{f.label.split(" (")[0]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Cor da Base e Cor das Letras */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-2">
                  3. Cor da Base
                </label>
                <div className="flex flex-wrap gap-2">
                  {activeFilaments.map((fil) => {
                    const selected = fil.id === baseFilament?.id;
                    return (
                      <button
                        key={fil.id}
                        type="button"
                        onClick={() => setBaseFilamentId(fil.id)}
                        title={fil.color_name}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                          selected
                            ? "border-terracota scale-110 ring-2 ring-terracota/30"
                            : "border-borda hover:scale-105"
                        }`}
                        style={{ backgroundColor: fil.hex_code }}
                      >
                        {selected && (
                          <Check className="w-4 h-4 text-musgo drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-2">
                  4. Cor das Letras em Relevo
                </label>
                <div className="flex flex-wrap gap-2">
                  {activeFilaments.map((fil) => {
                    const selected = fil.id === letterFilament?.id;
                    return (
                      <button
                        key={fil.id}
                        type="button"
                        onClick={() => setLetterFilamentId(fil.id)}
                        title={fil.color_name}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition ${
                          selected
                            ? "border-terracota scale-110 ring-2 ring-terracota/30"
                            : "border-borda hover:scale-105"
                        }`}
                        style={{ backgroundColor: fil.hex_code }}
                      >
                        {selected && (
                          <Check className="w-4 h-4 text-musgo drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 5. Upsell: Pingente Vazado Pendurado na Argola do Início (+ R$ 5,00) */}
            <div className="bg-areia/80 p-4 rounded-2xl border border-borda space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-musgo flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-terracota" />
                  <span>5. Pingente 3D Vazado na Argola (+R$ 5,00)</span>
                </label>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {CHARM_OPTIONS.map((c) => {
                  const isSelected = charm === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCharm(c.id)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-terracota text-white border-terracota shadow-sm"
                          : "bg-linho text-musgo border-borda hover:border-argila"
                      }`}
                    >
                      {c.id !== "none" && (
                        <svg viewBox="-26 -28 52 52" className="w-5 h-5 shrink-0">
                          {renderHollowCharmShape(
                            c.id,
                            isSelected ? "#FAF7F2" : charmFilament?.hex_code || "#A3522B"
                          )}
                        </svg>
                      )}
                      <span className="truncate">{c.label.replace(" Vazada", "").replace(" Vazado", "")}</span>
                    </button>
                  );
                })}
              </div>

              {charm !== "none" && (
                <div className="pt-1 flex items-center justify-between gap-3">
                  <span className="text-xs text-oliva font-medium">
                    Cor do Pingente Vazado:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeFilaments.map((fil) => {
                      const selected = fil.id === charmFilament?.id;
                      return (
                        <button
                          key={fil.id}
                          type="button"
                          onClick={() => setCharmFilamentId(fil.id)}
                          title={fil.color_name}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            selected
                              ? "border-terracota scale-110 ring-2 ring-terracota/30"
                              : "border-borda"
                          }`}
                          style={{ backgroundColor: fil.hex_code }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {needsRestock && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-argila/20 border border-argila text-xs text-musgo">
                <AlertCircle className="w-4 h-4 text-terracota shrink-0 mt-0.5" />
                <div>
                  <strong>Cor sob encomenda selecionada:</strong> Sua reserva está garantida! Essa tonalidade adiciona{" "}
                  <strong>+{maxRestockDays} dias úteis</strong> ao prazo normal de entrega no TCE.
                </div>
              </div>
            )}

            {/* Rodapé de Preço e Botão CTA */}
            <div className="pt-2 border-t border-borda flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-oliva">Valor Total do Chaveiro</div>
                <div className="text-3xl font-serif font-bold text-musgo">
                  R$ {metrics.priceBrl.toFixed(2).replace(".", ",")}
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirm}
                className="px-6 py-4 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-base shadow-md transition flex items-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                <span>Fazer Reserva deste Chaveiro</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
