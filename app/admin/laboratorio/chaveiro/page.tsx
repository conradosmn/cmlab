"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AdminNav } from "@/components/AdminNav";
import { MasterOnly } from "@/components/lab/MasterOnly";
import {
  DEFAULT_KEYCHAIN,
  KEYCHAIN_MAX_CHARS,
  KeychainParams,
  KeychainResult,
  buildKeychain,
  sanitizeName,
} from "@/lib/lab/nameKeychain";
import { KEYCHAIN_FONTS, fontUrl } from "@/lib/lab/keychainFonts";
import { loadFont, loadManifold } from "@/lib/lab/labRuntime";
import { layoutKeychains } from "@/lib/lab/keychainLayout";
import { exportPlates3mf } from "@/lib/lab/threeMfExport";
import {
  ArrowLeft,
  Download,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Palette,
  ChevronDown,
} from "lucide-react";

const Plate3DPreview = dynamic(
  () => import("@/components/lab/Plate3DPreview").then((m) => m.Plate3DPreview),
  { ssr: false, loading: () => <div className="h-full min-h-[420px]" /> }
);

const MAX_NAMES = 12;

type Shape = Omit<KeychainParams, "name">;

interface Generated {
  name: string;
  result: KeychainResult;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-musgo">{label}</label>
        <span className="text-xs font-bold text-terracota tabular-nums">
          {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-musgo"
      />
      {hint && <p className="text-[11px] text-oliva mt-1">{hint}</p>}
    </div>
  );
}

export default function ChaveiroArticuladoPage() {
  const [names, setNames] = useState<string[]>(["SEU NOME"]);
  const [fontId, setFontId] = useState(KEYCHAIN_FONTS[0].id);
  const [shape, setShape] = useState<Shape>(DEFAULT_KEYCHAIN);
  const [bodyColor, setBodyColor] = useState("#8b6fd6");
  const [faceColor, setFaceColor] = useState("#f4a3c0");
  const [generated, setGenerated] = useState<Generated[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const runRef = useRef(0);

  const cleanNames = useMemo(
    () => names.map(sanitizeName).filter((n) => n.replace(/ /g, "").length >= 1),
    [names]
  );

  // Gera de novo a cada mudança (com pausa para não travar enquanto digita).
  useEffect(() => {
    const run = ++runRef.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const [wasm, font] = await Promise.all([loadManifold(), loadFont(fontId)]);
        const out: Generated[] = [];
        for (const name of cleanNames) {
          if (run !== runRef.current) return;
          out.push({ name, result: buildKeychain(wasm, font, { ...shape, name }) });
          // Devolve o controle à tela entre um nome e outro.
          await new Promise((r) => setTimeout(r, 0));
        }
        if (run !== runRef.current) return;
        setGenerated(out);
        setError(null);
      } catch (e) {
        if (run === runRef.current) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (run === runRef.current) setBusy(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [cleanNames, fontId, shape]);

  const layout = useMemo(() => layoutKeychains(generated), [generated]);

  // Libera da GPU as geometrias de cada geração quando ela é substituída.
  useEffect(
    () => () =>
      layout.pieces.forEach((p) => {
        p.base.dispose();
        p.lines.dispose();
      }),
    [layout.pieces]
  );

  const broken = generated.filter((g) => g.result.bodyParts !== g.result.segments);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { default: projectSettings } = await import("@/lib/lab/bambu-a1-plate-settings.json");
      const blob = await exportPlates3mf(layout.pieces, {
        title: "Chaveiros articulados",
        projectSettings,
        baseExtruder: 1,
        lineExtruder: 2,
        layerHeightMm: 0.2,
        partNames: ["Corpo", "Letras"],
        baseColor: bodyColor,
        lineColor: faceColor,
      });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `chaveiros-${stamp}.3mf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const update = (patch: Partial<Shape>) => setShape((s) => ({ ...s, ...patch }));
  const groups = Array.from(new Set(KEYCHAIN_FONTS.map((f) => f.group)));

  return (
    <MasterOnly>
      {/* Fontes para mostrar o nome de cada uma com a própria letra */}
      <style>
        {KEYCHAIN_FONTS.map(
          (f) =>
            `@font-face{font-family:"kc-${f.id}";src:url("${fontUrl(f.id)}") format("woff");font-display:swap;}`
        ).join("")}
      </style>
      <div className="min-h-screen bg-linho flex flex-col">
        <AdminNav />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/admin/laboratorio"
                className="p-2 rounded-xl bg-areia border border-borda text-musgo hover:bg-borda/40"
                title="Voltar ao Laboratório"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <h1 className="text-2xl font-serif font-bold text-musgo">Chaveiro de Nome Articulado</h1>
                <p className="text-xs text-oliva">
                  Letras que giram, impressas já montadas. Gera o 3MF pronto para a A1 em duas cores.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={layout.pieces.length === 0 || busy || exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-musgo text-linho text-sm font-bold shadow-sm disabled:opacity-40"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Gerar 3MF
              {layout.pieces.length > 0
                ? ` (${layout.pieces.length} ${layout.pieces.length === 1 ? "chaveiro" : "chaveiros"})`
                : ""}
            </button>
          </header>

          <div className="grid lg:grid-cols-[320px_1fr] gap-5">
            <aside className="space-y-4">
              <div className="bg-areia border border-borda rounded-3xl p-4 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-oliva">Nomes</div>
                {names.map((n, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-linho border border-borda text-[11px] font-bold text-oliva flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={n}
                      maxLength={KEYCHAIN_MAX_CHARS + 4}
                      onChange={(e) =>
                        setNames((prev) => prev.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))
                      }
                      placeholder="NOME"
                      className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo tracking-wide"
                    />
                    <button
                      type="button"
                      disabled={names.length === 1}
                      onClick={() => setNames((prev) => prev.filter((_, j) => j !== i))}
                      className="p-1.5 text-oliva hover:text-red-600 disabled:opacity-30"
                      title="Remover nome"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {names.length < MAX_NAMES && (
                  <button
                    type="button"
                    onClick={() => setNames((prev) => [...prev, ""])}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-borda text-xs font-semibold text-musgo hover:bg-linho"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar nome
                  </button>
                )}
                <p className="text-[11px] text-oliva">
                  Letras maiúsculas, números, acentos e Ç. Até {KEYCHAIN_MAX_CHARS} caracteres por nome.
                </p>
              </div>

              <div className="bg-areia border border-borda rounded-3xl p-4 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-oliva">Fonte</div>
                {groups.map((group) => (
                  <div key={group} className="space-y-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-oliva/80">{group}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {KEYCHAIN_FONTS.filter((f) => f.group === group).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFontId(f.id)}
                          title={f.label}
                          className={`px-2 py-2 rounded-xl border text-left transition ${
                            fontId === f.id
                              ? "bg-musgo text-linho border-musgo"
                              : "bg-linho text-musgo border-borda hover:border-musgo"
                          }`}
                        >
                          <div className="text-base leading-tight truncate" style={{ fontFamily: `"kc-${f.id}"` }}>
                            {cleanNames[0]?.slice(0, 8) || "NOME"}
                          </div>
                          <div className="text-[10px] opacity-70 truncate">{f.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {KEYCHAIN_FONTS.find((f) => f.id === fontId)?.group === "Cursivas" && (
                  <p className="text-[11px] text-terracota">
                    Em fontes cursivas as letras são separadas para poderem girar; a ligação entre elas some.
                  </p>
                )}
              </div>

              <div className="bg-areia border border-borda rounded-3xl p-4 space-y-4">
                <div className="text-[11px] font-bold uppercase tracking-wider text-oliva">Medidas</div>
                <Slider
                  label="Altura das letras"
                  value={shape.heightMm}
                  min={10}
                  max={30}
                  step={0.5}
                  unit="mm"
                  onChange={(v) => update({ heightMm: v })}
                />
                <Slider
                  label="Espaço entre letras"
                  value={shape.letterGapMm}
                  min={0.3}
                  max={3}
                  step={0.1}
                  unit="mm"
                  onChange={(v) => update({ letterGapMm: v })}
                />
                <Slider
                  label="Folga das dobradiças"
                  value={shape.clearanceMm}
                  min={0.25}
                  max={0.7}
                  step={0.05}
                  unit="mm"
                  hint="Se sair travado, aumente; se ficar frouxo, diminua."
                  onChange={(v) => update({ clearanceMm: v })}
                />
                <label className="flex items-center gap-2 text-xs text-musgo font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shape.ring}
                    onChange={(e) => update({ ring: e.target.checked })}
                    className="w-4 h-4 accent-musgo"
                  />
                  Argola para chaveiro
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-oliva"
                >
                  Avançado
                  <ChevronDown className={`w-4 h-4 transition ${showAdvanced ? "rotate-180" : ""}`} />
                </button>
                {showAdvanced && (
                  <div className="space-y-4">
                    <Slider
                      label="Espessura total"
                      value={shape.thicknessMm}
                      min={7.5}
                      max={14}
                      step={0.5}
                      unit="mm"
                      onChange={(v) => update({ thicknessMm: v })}
                    />
                    <Slider
                      label="Camada colorida das letras"
                      value={shape.faceMm}
                      min={0.6}
                      max={3}
                      step={0.2}
                      unit="mm"
                      onChange={(v) => update({ faceMm: v })}
                    />
                  </div>
                )}
              </div>

              <div className="bg-areia border border-borda rounded-3xl p-4 space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-oliva flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Cores
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-musgo font-medium">
                    <input
                      type="color"
                      value={bodyColor}
                      onChange={(e) => setBodyColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-borda cursor-pointer"
                    />
                    Corpo (filamento 1)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-musgo font-medium">
                    <input
                      type="color"
                      value={faceColor}
                      onChange={(e) => setFaceColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-borda cursor-pointer"
                    />
                    Letras (filamento 2)
                  </label>
                </div>
              </div>
            </aside>

            <section className="bg-areia border border-borda rounded-3xl p-4 space-y-4 min-w-0">
              <div className="h-[520px] rounded-2xl border border-borda bg-[#f3efe6] overflow-hidden relative">
                <Plate3DPreview pieces={layout.pieces} baseColor={bodyColor} lineColor={faceColor} />
                {busy && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 text-xs text-oliva bg-linho/90 border border-borda rounded-full px-3 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> gerando…
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {layout.overflow && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Os chaveiros não cabem numa mesa de 256 mm. Diminua a altura ou o número de nomes.</span>
                </div>
              )}

              <div className="space-y-2">
                {generated.map((g, i) => {
                  const ok = g.result.bodyParts === g.result.segments;
                  const piece = layout.pieces[i];
                  return (
                    <div
                      key={`${g.name}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-linho border border-borda px-4 py-2.5"
                    >
                      <div className="font-bold text-musgo tracking-wide">{g.name}</div>
                      <div className="flex items-center gap-4 text-xs text-oliva">
                        {piece && (
                          <span className="tabular-nums">
                            {piece.widthMm.toFixed(1)} × {piece.heightMm.toFixed(1)} × {g.result.heightMm.toFixed(1)} mm
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            ok ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          {ok
                            ? `${g.result.segments} partes articuladas`
                            : `${g.result.bodyParts} de ${g.result.segments} partes soltas`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {broken.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-terracota bg-terracota/10 border border-terracota/30 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Algumas letras ficaram coladas e não vão girar. Aumente o espaço entre letras ou a folga.
                  </span>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </MasterOnly>
  );
}
