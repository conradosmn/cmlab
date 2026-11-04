"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AdminNav } from "@/components/AdminNav";
import { MasterOnly } from "@/components/lab/MasterOnly";
import {
  LoadedArt,
  MIN_LINE_MM,
  PlateParams,
  PlateResult,
  defaultParams,
  loadArt,
  processPlate,
} from "@/lib/lab/coloringPlate";
import { ArtPieces, buildArtPieces, layoutOnPlate } from "@/lib/lab/plateGeometry";
import { exportPlates3mf } from "@/lib/lab/threeMfExport";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
  Box,
  Square,
  Palette,
  ChevronDown,
} from "lucide-react";

const Plate3DPreview = dynamic(
  () => import("@/components/lab/Plate3DPreview").then((m) => m.Plate3DPreview),
  { ssr: false, loading: () => <div className="h-full min-h-[420px]" /> }
);

interface ArtItem {
  id: string;
  art: LoadedArt;
  params: PlateParams;
  result?: PlateResult;
  pieces?: ArtPieces;
  processing: boolean;
  error?: string;
}

const MAX_ARTS = 6;
const ACCEPT = ".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp";

function disposePieces(p?: ArtPieces) {
  p?.pieces.forEach((piece) => {
    piece.base.dispose();
    piece.lines.dispose();
  });
}

/* ------------------------------------------------------------------------ */
/* Controles                                                                 */
/* ------------------------------------------------------------------------ */

function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  left,
  right,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  left?: string;
  right?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-musgo">{label}</label>
        <span className="text-xs font-bold text-terracota tabular-nums">
          {Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1)}
          {unit ? ` ${unit}` : ""}
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
      {(left || right) && (
        <div className="flex justify-between text-[10px] text-oliva">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
      {hint && <p className="text-[11px] text-oliva mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-musgo font-medium cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-musgo"
      />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------------ */
/* Prévia 2D                                                                 */
/* ------------------------------------------------------------------------ */

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function Plate2DPreview({
  result,
  baseColor,
  lineColor,
  showThin,
}: {
  result: PlateResult;
  baseColor: string;
  lineColor: string;
  showThin: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(result.width, result.height);
    const b = hexToRgb(baseColor);
    const l = hexToRgb(lineColor);
    for (let i = 0; i < result.width * result.height; i++) {
      let c: [number, number, number] | null = null;
      if (result.lines.data[i]) c = showThin && result.thin.data[i] ? [220, 38, 38] : l;
      else if (result.base.data[i]) c = b;
      if (c) {
        img.data[i * 4] = c[0];
        img.data[i * 4 + 1] = c[1];
        img.data[i * 4 + 2] = c[2];
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [result, baseColor, lineColor, showThin]);
  return (
    <canvas
      ref={ref}
      className="max-w-full max-h-[520px] w-auto h-auto mx-auto drop-shadow-md"
      style={{ imageRendering: "auto" }}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Página                                                                    */
/* ------------------------------------------------------------------------ */

export default function PlaquinhaPage() {
  const [items, setItems] = useState<ArtItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [baseColor, setBaseColor] = useState("#ffffff");
  const [lineColor, setLineColor] = useState("#1f1f1f");
  const [showThin, setShowThin] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const itemsRef = useRef<ArtItem[]>([]);
  itemsRef.current = items;

  const selected = items.find((i) => i.id === selectedId) || null;

  const runProcessing = useCallback((id: string, delay: number) => {
    clearTimeout(timersRef.current[id]);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, processing: true } : it)));
    timersRef.current[id] = setTimeout(() => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      try {
        const result = processPlate(item.art, item.params);
        const pieces = buildArtPieces(result, item.params, item.art.name.replace(/\.[^.]+$/, ""));
        setItems((prev) =>
          prev.map((it) => {
            if (it.id !== id) return it;
            disposePieces(it.pieces);
            return { ...it, result, pieces, processing: false, error: undefined };
          })
        );
      } catch (e) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === id
              ? { ...it, processing: false, error: e instanceof Error ? e.message : String(e) }
              : it
          )
        );
      }
    }, delay);
  }, []);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setMessage(null);
      const list = Array.from(files).slice(0, MAX_ARTS - itemsRef.current.length);
      if (list.length === 0) {
        setMessage({ type: "info", text: `Limite de ${MAX_ARTS} artes por arquivo.` });
        return;
      }
      for (const file of list) {
        try {
          const art = await loadArt(file);
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setItems((prev) => [...prev, { id, art, params: defaultParams(art.suggestedMode), processing: true }]);
          setSelectedId(id);
          // Espera o estado assentar antes de processar.
          setTimeout(() => runProcessing(id, 0), 0);
        } catch (e) {
          setMessage({
            type: "error",
            text: `${file.name}: ${e instanceof Error ? e.message : "não foi possível abrir."}`,
          });
        }
      }
    },
    [runProcessing]
  );

  const updateParams = (patch: Partial<PlateParams>) => {
    if (!selected) return;
    const id = selected.id;
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, params: { ...it.params, ...patch } } : it))
    );
    setTimeout(() => runProcessing(id, 350), 0);
  };

  const removeItem = (id: string) => {
    clearTimeout(timersRef.current[id]);
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      disposePieces(target?.pieces);
      if (target) URL.revokeObjectURL(target.art.previewUrl);
      const next = prev.filter((i) => i.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return next;
    });
  };

  // Libera tudo ao sair da página.
  useEffect(
    () => () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      itemsRef.current.forEach((it) => {
        disposePieces(it.pieces);
        URL.revokeObjectURL(it.art.previewUrl);
      });
    },
    []
  );

  const layout = useMemo(
    () => layoutOnPlate(items.map((i) => i.pieces).filter((p): p is ArtPieces => Boolean(p))),
    [items]
  );
  const totalPieces = layout.pieces.length;
  const anyProcessing = items.some((i) => i.processing);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      // Perfil de impressão da A1 (qualidade, resistência e velocidade copiadas
      // do kit de referência), reduzido a 2 filamentos: 1 = base, 2 = linhas.
      const { default: projectSettings } = await import("@/lib/lab/bambu-a1-plate-settings.json");
      const blob = await exportPlates3mf(layout.pieces, {
        title: "Plaquinhas de colorir",
        projectSettings,
        baseExtruder: 1,
        lineExtruder: 2,
        layerHeightMm: 0.2,
        baseColor,
        lineColor,
      });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `plaquinhas-${stamp}.3mf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setExporting(false);
    }
  };

  const p = selected?.params;
  const r = selected?.result;

  return (
    <MasterOnly>
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
                <h1 className="text-2xl font-serif font-bold text-musgo">Plaquinha de Colorir</h1>
                <p className="text-xs text-oliva">
                  SVG de contorno ou ilustração colorida → plaquinha com base e relevo, pronta para o
                  Bambu Studio.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={totalPieces === 0 || anyProcessing || exporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-musgo text-linho text-sm font-bold shadow-sm disabled:opacity-40"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Gerar 3MF{totalPieces > 0 ? ` (${totalPieces} ${totalPieces === 1 ? "peça" : "peças"})` : ""}
            </button>
          </header>

          {message && (
            <div
              className={`text-sm px-4 py-2.5 rounded-xl border ${
                message.type === "error"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-areia border-borda text-oliva"
              }`}
            >
              {message.text}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {items.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-3xl border-2 border-dashed p-16 text-center transition ${
                dragOver ? "border-musgo bg-areia" : "border-borda bg-areia/60 hover:bg-areia"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-terracota/15 text-terracota flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-serif font-bold text-musgo">Arraste a imagem aqui</h2>
              <p className="text-sm text-oliva mt-2 max-w-lg mx-auto">
                SVG de contorno (preto e branco) ou ilustração colorida em PNG/JPG — de preferência sem
                fundo. Até {MAX_ARTS} artes no mesmo arquivo; cada desenho separado vira uma plaquinha.
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-[300px_1fr] gap-5">
              {/* Painel lateral */}
              <aside className="space-y-4">
                <div className="bg-areia border border-borda rounded-3xl p-4 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-oliva">Artes</div>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div
                        key={it.id}
                        onClick={() => setSelectedId(it.id)}
                        className={`flex items-center gap-3 p-2 rounded-2xl border cursor-pointer transition ${
                          it.id === selectedId
                            ? "border-musgo bg-linho"
                            : "border-transparent hover:bg-linho/60"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={it.art.previewUrl}
                          alt=""
                          className="w-12 h-12 object-contain rounded-lg bg-white border border-borda"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-musgo truncate">{it.art.name}</div>
                          <div className="text-[11px] text-oliva">
                            {it.processing ? (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> processando…
                              </span>
                            ) : it.error ? (
                              <span className="text-red-600">erro</span>
                            ) : it.pieces ? (
                              `${it.pieces.pieces.length} ${it.pieces.pieces.length === 1 ? "peça" : "peças"} · ${Math.round(it.params.widthMm)} mm`
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeItem(it.id);
                          }}
                          className="p-1.5 text-oliva hover:text-red-600"
                          title="Remover arte"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {items.length < MAX_ARTS && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-borda text-xs font-semibold text-musgo hover:bg-linho"
                    >
                      <Upload className="w-3.5 h-3.5" /> Adicionar arte
                    </button>
                  )}
                </div>

                {selected && p && (
                  <div className="bg-areia border border-borda rounded-3xl p-4 space-y-4">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-oliva mb-2">
                        Tipo de imagem
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-linho border border-borda">
                        {(
                          [
                            ["lineart", "Contorno pronto"],
                            ["illustration", "Ilustração colorida"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              updateParams({
                                mode,
                                darkThreshold: mode === "lineart" ? 128 : 60,
                              })
                            }
                            className={`py-1.5 rounded-lg text-[11px] font-bold transition ${
                              p.mode === mode ? "bg-musgo text-linho" : "text-musgo hover:bg-areia"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Slider
                      label="Largura da arte"
                      value={p.widthMm}
                      min={20}
                      max={240}
                      step={1}
                      unit="mm"
                      onChange={(v) => updateParams({ widthMm: v })}
                      hint={r ? `Altura: ${r.heightMm.toFixed(1)} mm` : undefined}
                    />

                    {p.mode === "lineart" ? (
                      <Slider
                        label="O que vira linha"
                        value={p.darkThreshold}
                        min={10}
                        max={245}
                        step={1}
                        left="só o bem escuro"
                        right="até tons claros"
                        onChange={(v) => updateParams({ darkThreshold: v })}
                      />
                    ) : (
                      <>
                        <Slider
                          label="Cores na simplificação"
                          value={p.colors}
                          min={2}
                          max={16}
                          step={1}
                          left="menos áreas"
                          right="mais áreas"
                          onChange={(v) => updateParams({ colors: v })}
                        />
                        <Slider
                          label="Nível de detalhe"
                          value={p.detailMm2}
                          min={0.5}
                          max={40}
                          step={0.5}
                          unit="mm²"
                          left="mais detalhe"
                          right="mais limpo"
                          hint="Áreas menores que isso somem e viram parte da vizinha."
                          onChange={(v) => updateParams({ detailMm2: v })}
                        />
                        <Toggle
                          label="Manter partes escuras em relevo (óculos, pneus…)"
                          checked={p.keepDarkAreas}
                          onChange={(v) => updateParams({ keepDarkAreas: v })}
                        />
                        {p.keepDarkAreas && (
                          <Slider
                            label="O que conta como escuro"
                            value={p.darkThreshold}
                            min={10}
                            max={160}
                            step={1}
                            left="só o preto"
                            right="tons médios"
                            onChange={(v) => updateParams({ darkThreshold: v })}
                          />
                        )}
                      </>
                    )}

                    <Slider
                      label="Espessura da linha"
                      value={p.lineWidthMm}
                      min={0.6}
                      max={3}
                      step={0.1}
                      unit="mm"
                      onChange={(v) => updateParams({ lineWidthMm: v })}
                      hint={
                        p.lineWidthMm < MIN_LINE_MM
                          ? `Abaixo de ${MIN_LINE_MM} mm o bico 0,4 pode não imprimir.`
                          : undefined
                      }
                    />

                    <div className="space-y-2">
                      <Toggle
                        label="Contorno na borda da plaquinha"
                        checked={p.borderLine}
                        onChange={(v) => updateParams({ borderLine: v })}
                      />
                      <Toggle
                        label={`Engrossar linhas abaixo de ${MIN_LINE_MM} mm`}
                        checked={p.autoThicken}
                        onChange={(v) => updateParams({ autoThicken: v })}
                      />
                    </div>

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
                          label="Margem branca externa"
                          value={p.marginMm}
                          min={0}
                          max={6}
                          step={0.5}
                          unit="mm"
                          onChange={(v) => updateParams({ marginMm: v })}
                        />
                        <Slider
                          label="Espessura da base"
                          value={p.baseThicknessMm}
                          min={0.4}
                          max={3}
                          step={0.1}
                          unit="mm"
                          onChange={(v) => updateParams({ baseThicknessMm: v })}
                        />
                        <Slider
                          label="Altura do relevo"
                          value={p.reliefMm}
                          min={0.2}
                          max={1.6}
                          step={0.1}
                          unit="mm"
                          onChange={(v) => updateParams({ reliefMm: v })}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-areia border border-borda rounded-3xl p-4 space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-oliva flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" /> Cores da prévia
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-musgo font-medium">
                      <input
                        type="color"
                        value={baseColor}
                        onChange={(e) => setBaseColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-borda cursor-pointer"
                      />
                      Base (filamento 1)
                    </label>
                    <label className="flex items-center gap-2 text-xs text-musgo font-medium">
                      <input
                        type="color"
                        value={lineColor}
                        onChange={(e) => setLineColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-borda cursor-pointer"
                      />
                      Linhas (filamento 2)
                    </label>
                  </div>
                </div>
              </aside>

              {/* Área de prévia */}
              <section className="bg-areia border border-borda rounded-3xl p-4 space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-linho border border-borda">
                    <button
                      type="button"
                      onClick={() => setView("2d")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                        view === "2d" ? "bg-musgo text-linho" : "text-musgo"
                      }`}
                    >
                      <Square className="w-3.5 h-3.5" /> Arte em 2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("3d")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
                        view === "3d" ? "bg-musgo text-linho" : "text-musgo"
                      }`}
                    >
                      <Box className="w-3.5 h-3.5" /> Mesa em 3D
                    </button>
                  </div>
                  {view === "2d" && (
                    <Toggle label="Destacar linhas finas em vermelho" checked={showThin} onChange={setShowThin} />
                  )}
                </div>

                {view === "2d" ? (
                  selected ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-borda bg-white p-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-oliva mb-2">
                          Original
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={selected.art.previewUrl}
                          alt={selected.art.name}
                          className="max-h-[520px] w-auto mx-auto object-contain"
                          style={{
                            backgroundImage:
                              "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%)",
                            backgroundSize: "16px 16px",
                          }}
                        />
                      </div>
                      <div className="rounded-2xl border border-borda bg-[#e9e4d8] p-3 relative">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-oliva mb-2 flex justify-between">
                          <span>Plaquinha</span>
                          {r && (
                            <span>
                              {r.widthMm.toFixed(1)} × {r.heightMm.toFixed(1)} mm
                            </span>
                          )}
                        </div>
                        {selected.error ? (
                          <div className="text-sm text-red-700 p-6 text-center">{selected.error}</div>
                        ) : r ? (
                          <Plate2DPreview
                            result={r}
                            baseColor={baseColor}
                            lineColor={lineColor}
                            showThin={showThin}
                          />
                        ) : (
                          <div className="h-64 flex items-center justify-center text-oliva">
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </div>
                        )}
                        {selected.processing && r && (
                          <div className="absolute top-3 right-3">
                            <Loader2 className="w-4 h-4 animate-spin text-oliva" />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null
                ) : (
                  <div className="h-[520px] rounded-2xl border border-borda bg-[#f3efe6] overflow-hidden">
                    <Plate3DPreview pieces={layout.pieces} baseColor={baseColor} lineColor={lineColor} />
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Plaquinhas" value={String(totalPieces)} />
                  <Stat
                    label="Espessura total"
                    value={p ? `${(p.baseThicknessMm + p.reliefMm).toFixed(1)} mm` : "—"}
                  />
                  <Stat
                    label="Linhas finas"
                    value={r ? `${r.thinPercent.toFixed(1)}%` : "—"}
                    warn={Boolean(r && r.thinPercent > 2)}
                  />
                  <Stat label="Mesa" value="256 × 256 mm" />
                </div>

                {r && r.thinPercent > 2 && (
                  <div className="flex items-start gap-2 text-xs text-terracota bg-terracota/10 border border-terracota/30 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {r.thinPercent.toFixed(1)}% das linhas estão abaixo de {MIN_LINE_MM} mm (em
                      vermelho na prévia). Aumente a largura da arte, a espessura da linha ou ative
                      &quot;Engrossar linhas&quot;.
                    </span>
                  </div>
                )}
                {layout.overflow && (
                  <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>As plaquinhas não cabem numa mesa de 256 mm. Reduza a largura ou remova artes.</span>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </MasterOnly>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl bg-linho border border-borda px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-oliva">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${warn ? "text-terracota" : "text-musgo"}`}>
        {value}
      </div>
    </div>
  );
}
