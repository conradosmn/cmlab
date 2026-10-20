"use client";

import React, { useState, useMemo } from "react";
import JSZip from "jszip";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";
import { calculate3DCosts } from "@/lib/costCalculator";
import {
  Accessory,
  Filament,
  Product,
  ProductAccessoryItem,
  ProductCategory,
} from "@/lib/types";
import {
  Sparkles,
  Link2,
  Upload,
  Calculator,
  Plus,
  Trash2,
  Check,
  Clock,
  Weight,
  Palette,
  AlertCircle,
  Wrench,
  Minus,
} from "lucide-react";

const DEMO_MAKERWORLD_PRESETS = [
  {
    title: "Cachepot Textura Tricô Nórdico (Perfil A1)",
    category: "decoracao" as ProductCategory,
    weight_grams: 185,
    print_time_minutes: 265,
    image:
      "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=900&q=80",
    defaultAccessories: [{ accessory_id: "acc-silicone", quantity: 4 }],
  },
  {
    title: "Luminária Cúpula Origami Zen (Perfil A1 >6h)",
    category: "decoracao" as ProductCategory,
    weight_grams: 260,
    print_time_minutes: 430,
    image:
      "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=80",
    defaultAccessories: [
      { accessory_id: "acc-led", quantity: 1 },
      { accessory_id: "acc-silicone", quantity: 4 },
    ],
  },
  {
    title: "Chaveiro Medalha São Bento Bicolor (Perfil A1)",
    category: "chaveiros" as ProductCategory,
    weight_grams: 14,
    print_time_minutes: 28,
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
    defaultAccessories: [
      { accessory_id: "acc-corrente", quantity: 1 },
      { accessory_id: "acc-ilha", quantity: 1 },
    ],
  },
];

export default function AdminCatalogoPage() {
  const {
    products,
    filaments,
    accessories,
    addOrUpdateProduct,
    addOrUpdateFilament,
    addOrUpdateAccessory,
    deleteProduct,
    clearDemoOrdersAndProducts,
  } = useCMLabStore();

  const [makerworldUrl, setMakerworldUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    type: "info" | "error" | "success";
    text: string;
  } | null>(null);

  // Estados do Produto + Recursos Vinculados (Chaveiro, Gota de Silicone, etc.)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Vaso Cerâmico Texturizado A1");
  const [category, setCategory] = useState<ProductCategory>("decoracao");
  const [description, setDescription] = useState(
    "Peça produzida em impressão 3D de alta precisão na Bambu Lab A1 com acabamento orgânico fosco."
  );
  const [imageUrl, setImageUrl] = useState(
    "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=900&q=80"
  );
  const [printTimeMinutes, setPrintTimeMinutes] = useState<number>(210);
  const [weightGrams, setWeightGrams] = useState<number>(130);
  const [maxColors, setMaxColors] = useState<number>(1);
  const [allowedFilamentIds, setAllowedFilamentIds] = useState<string[]>(() =>
    filaments.slice(0, 4).map((f) => f.id)
  );
  const [selectedAccessories, setSelectedAccessories] = useState<
    ProductAccessoryItem[]
  >([
    { accessory_id: "acc-silicone", quantity: 4 },
    { accessory_id: "acc-tag-embalagem", quantity: 1 },
  ]);
  const [readyStockQty, setReadyStockQty] = useState<number>(2);
  const [salePrice, setSalePrice] = useState<number>(68.0);

  // Mini-modal inline para criar um novo recurso rápido (ex: novo tipo de chaveiro ou gota de silicone) sem sair da tela
  const [showQuickResourceForm, setShowQuickResourceForm] = useState(false);
  const [quickResName, setQuickResName] = useState("");
  const [quickResPackPrice, setQuickResPackPrice] = useState(30);
  const [quickResPackQty, setQuickResPackQty] = useState(100);

  // Parâmetros de Engenharia de Custos da A1
  const [powerWatts, setPowerWatts] = useState<number>(120);
  const [kwhTariff, setKwhTariff] = useState<number>(0.95);
  const [machineHourCost, setMachineHourCost] = useState<number>(1.5);
  const [failureMarginPercent, setFailureMarginPercent] = useState<number>(8);
  const [mpFeePercent, setMpFeePercent] = useState<number>(3.19);

  // Detalhamento linha a linha dos recursos selecionados para exibir na Calculadora de Custos
  const selectedResourceDetails = useMemo(() => {
    return selectedAccessories
      .filter((sa) => sa.quantity > 0)
      .map((sa) => {
        const found = accessories.find((a) => a.id === sa.accessory_id);
        const unitCost = found?.unit_cost || 0;
        return {
          accessory_id: sa.accessory_id,
          name: found?.name || "Recurso",
          unit_label: found?.unit_label || "un.",
          quantity: sa.quantity,
          unitCost,
          subtotal: Number((sa.quantity * unitCost).toFixed(2)),
        };
      });
  }, [selectedAccessories, accessories]);

  const costBreakdown = useMemo(() => {
    const chosenFils = filaments.filter((f) => allowedFilamentIds.includes(f.id));
    const avgCostPerGram =
      chosenFils.length > 0
        ? chosenFils.reduce((acc, f) => acc + f.cost_per_gram, 0) / chosenFils.length
        : 0.12;

    const accInputs = selectedResourceDetails.map((item) => ({
      quantity: item.quantity,
      unitCost: item.unitCost,
    }));

    return calculate3DCosts({
      filamentSegments: [{ weightGrams, costPerGram: avgCostPerGram }],
      printTimeMinutes,
      a1AveragePowerWatts: powerWatts,
      kwhTariffBrl: kwhTariff,
      machineHourCostBrl: machineHourCost,
      accessories: accInputs,
      failureMarginPercent,
      salePriceBrl: salePrice,
      mpFeePercent,
    });
  }, [
    filaments,
    allowedFilamentIds,
    selectedResourceDetails,
    weightGrams,
    printTimeMinutes,
    powerWatts,
    kwhTariff,
    machineHourCost,
    failureMarginPercent,
    salePrice,
    mpFeePercent,
  ]);

  const handleQuickAddResource = async () => {
    if (!quickResName.trim()) return;
    const newId = `acc-quick-${Date.now()}`;
    const unitCost = Number(
      (quickResPackPrice / Math.max(1, quickResPackQty)).toFixed(4)
    );
    const newAcc: Accessory = {
      id: newId,
      code: `ACC-${Math.floor(10 + Math.random() * 89)}`,
      name: quickResName.trim(),
      category: "outros",
      unit_label: "un.",
      purchase_date: new Date().toISOString().slice(0, 10),
      pack_price: Number(quickResPackPrice),
      pack_quantity: Number(quickResPackQty),
      stock_quantity: Number(quickResPackQty),
      min_stock_alert: 15,
      unit_cost: unitCost,
      active: true,
    };
    await addOrUpdateAccessory(newAcc);
    setSelectedAccessories((prev) => [...prev, { accessory_id: newId, quantity: 1 }]);
    setQuickResName("");
    setShowQuickResourceForm(false);
  };

  const handleImportMakerWorld = async () => {
    if (!makerworldUrl.trim()) return;
    setImportLoading(true);
    setImportMessage(null);
    try {
      const res = await fetch("/api/import-makerworld", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: makerworldUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMessage({
          type: "error",
          text:
            data.error ||
            "Proteção Cloudflare detectada no MakerWorld. Suba o arquivo .3mf ou use um preset A1 abaixo!",
        });
        setImportLoading(false);
        return;
      }

      setName(data.title || "Modelo MakerWorld A1");
      if (data.images?.[0]) setImageUrl(data.images[0]);
      if (data.weight_grams) setWeightGrams(data.weight_grams);
      if (data.print_time_minutes) setPrintTimeMinutes(data.print_time_minutes);

      if (Array.isArray(data.required_filaments) && data.required_filaments.length > 0) {
        const linkedIds: string[] = [];
        for (const reqFil of data.required_filaments) {
          const existing = filaments.find(
            (f) => f.hex_code.toLowerCase() === (reqFil.hexColor || "").toLowerCase()
          );
          if (existing) {
            linkedIds.push(existing.id);
          } else {
            const newId = `fil-mw-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
            const newFil: Filament = {
              id: newId,
              code: `MW-${reqFil.material || "PLA"}-${Math.floor(10 + Math.random() * 89)}`,
              brand: "Bambu Lab / MakerWorld",
              material: reqFil.material || "PLA",
              color_name: `Cor Catálogo (${reqFil.hexColor})`,
              hex_code: reqFil.hexColor || "#A3522B",
              purchase_date: new Date().toISOString().slice(0, 10),
              purchase_price: 115,
              initial_weight_grams: 1000,
              remaining_weight_grams: 0,
              cost_per_gram: 0.115,
              is_on_order_color: true,
              restock_lead_time_days: 3,
              active: true,
            };
            await addOrUpdateFilament(newFil);
            linkedIds.push(newId);
          }
        }
        if (linkedIds.length > 0) {
          setAllowedFilamentIds(linkedIds);
          setMaxColors(linkedIds.length);
        }
      }

      setImportMessage({
        type: "success",
        text: `Perfil Bambu Lab A1 importado: ${data.profile_name} (${data.weight_grams}g • ${data.print_time_minutes} min).`,
      });
    } catch (err: any) {
      setImportMessage({
        type: "error",
        text: err.message || "Erro ao consultar MakerWorld.",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleUpload3mfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportMessage(null);

    try {
      const zip = await JSZip.loadAsync(file);
      const cleanTitle = file.name.replace(/\.3mf$/i, "").replace(/[-_]/g, " ");
      setName(cleanTitle);

      let extractedWeight = 0;
      let extractedMinutes = 0;

      const sliceInfoFile =
        zip.file("Metadata/slice_info.config") ||
        zip.file("Metadata/model_settings.config");

      if (sliceInfoFile) {
        const xmlText = await sliceInfoFile.async("string");
        const weightMatch =
          xmlText.match(/weight"\s+value="([\d.]+)"/i) ||
          xmlText.match(/used_g="([\d.]+)"/i);
        const timeMatch =
          xmlText.match(/prediction"\s+value="([\d.]+)"/i) ||
          xmlText.match(/print_time="([\d.]+)"/i);

        if (weightMatch?.[1]) extractedWeight = Math.ceil(parseFloat(weightMatch[1]));
        if (timeMatch?.[1]) extractedMinutes = Math.ceil(parseFloat(timeMatch[1]) / 60);
      }

      // Extrai automaticamente a miniatura renderizada da mesa dentro do .3mf do Bambu Studio!
      const thumbFile =
        zip.file("Metadata/plate_1.png") ||
        zip.file("Metadata/top_1.png") ||
        zip.file("Metadata/thumbnail.png");

      if (thumbFile) {
        const base64Img = await thumbFile.async("base64");
        if (base64Img) {
          setImageUrl(`data:image/png;base64,${base64Img}`);
        }
      }

      if (extractedWeight > 0) setWeightGrams(extractedWeight);
      if (extractedMinutes > 0) setPrintTimeMinutes(extractedMinutes);

      setImportMessage({
        type: "success",
        text:
          extractedWeight > 0
            ? `Arquivo .3MF Bambu Studio lido com sucesso! Peso A1: ${extractedWeight}g • Tempo: ${extractedMinutes} min${
                thumbFile ? " • Foto da peça extraída!" : "."
              }`
            : `Arquivo "${file.name}" carregado${
                thumbFile ? " com miniatura 3D extraída" : ""
              }! Confirme os gramas e minutos abaixo (dica: salve o .3mf após clicar em 'Slice Plate' no Bambu Studio para puxar peso e tempo exatos).`,
      });
    } catch {
      setImportMessage({
        type: "error",
        text: "Não foi possível descompactar o arquivo .3mf. Verifique se é um .3mf válido do Bambu Studio.",
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleLoadPreset = (preset: (typeof DEMO_MAKERWORLD_PRESETS)[0]) => {
    setEditingId(null);
    setName(preset.title);
    setCategory(preset.category);
    setWeightGrams(preset.weight_grams);
    setPrintTimeMinutes(preset.print_time_minutes);
    setImageUrl(preset.image);
    setSelectedAccessories(preset.defaultAccessories);
    const suggestedPrice =
      Math.ceil((preset.weight_grams * 0.35 + preset.print_time_minutes * 0.12) / 5) * 5;
    setSalePrice(Math.max(20, suggestedPrice));
    setImportMessage({
      type: "info",
      text: `Preset Bambu Lab A1 carregado: "${preset.title}" com recursos (chaveiro/gotas de silicone) pré-selecionados!`,
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const productPayload: Product = {
      id: editingId || `prod-${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim(),
      makerworld_url: makerworldUrl.trim() || undefined,
      images: [imageUrl.trim()],
      print_time_minutes: Number(printTimeMinutes),
      weight_grams: Number(weightGrams),
      max_colors: Number(maxColors),
      allowed_filament_ids:
        allowedFilamentIds.length > 0
          ? allowedFilamentIds
          : filaments.slice(0, 3).map((f) => f.id),
      accessories: selectedAccessories.filter((a) => a.quantity > 0),
      production_cost: costBreakdown.totalProductionCost,
      price: Number(salePrice),
      is_custom_keychain:
        category === "chaveiros" && name.toLowerCase().includes("personalizado"),
      ready_stock_qty: Number(readyStockQty),
      active: true,
    };

    await addOrUpdateProduct(productPayload);
    setEditingId(null);
    setImportMessage({
      type: "success",
      text: `Produto "${productPayload.name}" salvo com custo calculado de R$ ${costBreakdown.totalProductionCost
        .toFixed(2)
        .replace(".", ",")}!`,
    });
  };

  const handleEditExisting = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setDescription(p.description || "");
    setMakerworldUrl(p.makerworld_url || "");
    setImageUrl(p.images?.[0] || "");
    setPrintTimeMinutes(p.print_time_minutes);
    setWeightGrams(p.weight_grams);
    setMaxColors(p.max_colors || 1);
    setAllowedFilamentIds(p.allowed_filament_ids || []);
    setSelectedAccessories(p.accessories || []);
    setReadyStockQty(p.ready_stock_qty || 0);
    setSalePrice(p.price);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleAllowedFilament = (filId: string) => {
    setAllowedFilamentIds((prev) =>
      prev.includes(filId) ? prev.filter((id) => id !== filId) : [...prev, filId]
    );
  };

  const updateAccessoryQty = (accId: string, qty: number) => {
    const safeQty = Math.max(0, qty);
    setSelectedAccessories((prev) => {
      const exists = prev.some((item) => item.accessory_id === accId);
      if (safeQty <= 0) {
        return prev.filter((item) => item.accessory_id !== accId);
      }
      if (exists) {
        return prev.map((item) =>
          item.accessory_id === accId ? { ...item, quantity: safeQty } : item
        );
      }
      return [...prev, { accessory_id: accId, quantity: safeQty }];
    });
  };

  return (
    <div className="min-h-screen bg-linho">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Bloco 1: Importador MakerWorld (Filtro Exclusivo Bambu Lab A1) + Upload .3MF */}
        <section className="bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-widest text-terracota font-bold">
                Importador Inteligente • Perfil Exclusivo Bambu Lab A1
              </span>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-musgo">
                Importar Modelo do MakerWorld ou Arquivo .3MF
              </h1>
              <p className="text-xs text-oliva mt-0.5">
                Ignora automaticamente perfis exclusivos de A1 mini e extrai peso, tempo de
                impressão e cores necessárias para o catálogo.
              </p>
            </div>

            <label className="cursor-pointer px-4 py-3 rounded-2xl bg-linho hover:bg-borda/50 border border-borda text-musgo text-xs font-semibold flex items-center gap-2 transition shadow-sm">
              <Upload className="w-4 h-4 text-terracota" />
              <span>Subir Arquivo .3MF Fatiado (A1)</span>
              <input
                type="file"
                accept=".3mf"
                onChange={handleUpload3mfFile}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-oliva absolute left-4 top-3.5" />
              <input
                type="url"
                value={makerworldUrl}
                onChange={(e) => setMakerworldUrl(e.target.value)}
                placeholder="Cole aqui o link do modelo no MakerWorld (ex: https://makerworld.com/en/models/...)"
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-linho border border-borda text-sm text-musgo focus:outline-none focus:ring-2 focus:ring-argila"
              />
            </div>
            <button
              type="button"
              disabled={importLoading}
              onClick={handleImportMakerWorld}
              className="px-6 py-3 rounded-2xl bg-terracota hover:bg-terracota-hover text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{importLoading ? "Extraindo Perfil A1..." : "Puxar Dados da A1"}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-oliva font-medium">
              Testar com Perfis Reais A1:
            </span>
            {DEMO_MAKERWORLD_PRESETS.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleLoadPreset(preset)}
                className="px-3 py-1.5 rounded-xl bg-linho hover:bg-borda/40 border border-borda text-xs text-musgo font-medium transition"
              >
                + {preset.title} ({preset.weight_grams}g / {preset.print_time_minutes}m)
              </button>
            ))}
          </div>

          {importMessage && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 ${
                importMessage.type === "error"
                  ? "bg-terracota/10 border-terracota text-terracota"
                  : "bg-linho border-borda text-musgo"
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{importMessage.text}</span>
            </div>
          )}
        </section>

        {/* Bloco 2: Formulário de Ficha Técnica + Composição de Recursos + Calculadora 3D */}
        <form
          onSubmit={handleSaveProduct}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Coluna Esquerda (7 cols): Produto, Filamentos e Composição de Recursos (Chaveiro, Gota Silicone, etc.) */}
          <div className="lg:col-span-7 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-5">
            <div className="flex items-center justify-between border-b border-borda pb-3">
              <h2 className="text-xl font-serif font-bold text-musgo">
                {editingId
                  ? "Editando Peça & Recursos do Produto"
                  : "Configurar Peça & Recursos no Catálogo"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-xs text-terracota underline font-semibold"
                >
                  Cancelar Edição
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold uppercase text-oliva mb-1">
                  Nome da Peça na Vitrine iPad
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-oliva mb-1">
                  Categoria Feira TCE
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    const nextCat = e.target.value as ProductCategory;
                    setCategory(nextCat);
                    // Se mudar para chaveiros, sugere automaticamente 1x Corrente+Argola e 1x Ilha!
                    if (nextCat === "chaveiros") {
                      setSelectedAccessories([
                        { accessory_id: "acc-corrente", quantity: 1 },
                        { accessory_id: "acc-ilha", quantity: 1 },
                      ]);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo font-semibold"
                >
                  <option value="decoracao">Vasos & Luminárias</option>
                  <option value="religioso">Artigos Religiosos</option>
                  <option value="fidgets">Fidgets & Mimos</option>
                  <option value="chaveiros">Chaveiros</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-oliva mb-1">
                Descrição Aconchegante
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-linho border border-borda text-sm text-musgo"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-oliva mb-1 flex items-center gap-1">
                  <Weight className="w-3.5 h-3.5 text-terracota" />
                  <span>Peso A1 (g)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-oliva mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-terracota" />
                  <span>Tempo (min)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={printTimeMinutes}
                  onChange={(e) => setPrintTimeMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-oliva mb-1">
                  Máx. Cores AMS
                </label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={maxColors}
                  onChange={(e) => setMaxColors(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-oliva mb-1">
                  Pronta-Entrega
                </label>
                <input
                  type="number"
                  min={0}
                  value={readyStockQty}
                  onChange={(e) => setReadyStockQty(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                />
              </div>
            </div>

            {/* Seleção de Cores de Filamento */}
            <div>
              <label className="block text-xs font-semibold uppercase text-oliva mb-2 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-terracota" />
                <span>Filamentos Permitidos para o Cliente Escolher no iPad</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {filaments.map((fil) => {
                  const active = allowedFilamentIds.includes(fil.id);
                  return (
                    <button
                      key={fil.id}
                      type="button"
                      onClick={() => toggleAllowedFilament(fil.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                        active
                          ? "bg-musgo text-linho border-musgo shadow-sm"
                          : "bg-linho text-musgo border-borda opacity-70 hover:opacity-100"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/50"
                        style={{ backgroundColor: fil.hex_code }}
                      />
                      <span>{fil.color_name}</span>
                      {active && <Check className="w-3.5 h-3.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* COMPOSIÇÃO DE RECURSOS DA PEÇA (CHAVEIRO, GOTA DE SILICONE, ÍMÃ, KIT LED) */}
            <div className="bg-linho p-4 rounded-2xl border-2 border-argila/60 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-sm font-serif font-bold text-musgo flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-terracota" />
                    <span>
                      Recursos Extras do Produto (Chaveiro, Gota de Silicone, Ímã, LED)
                    </span>
                  </label>
                  <p className="text-[11px] text-oliva">
                    Defina quantas unidades de cada recurso entram nesta peça para somar no
                    custo de produção
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickResourceForm((v) => !v)}
                    className="px-2.5 py-1.5 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-xs font-semibold text-terracota transition"
                  >
                    + Criar Recurso Rápido
                  </button>
                  <Link
                    href="/admin/insumos"
                    className="px-2.5 py-1.5 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-xs font-semibold text-musgo transition"
                  >
                    Gerenciar Todos
                  </Link>
                </div>
              </div>

              {/* Mini-formulário inline para criar um novo recurso sem sair da tela */}
              {showQuickResourceForm && (
                <div className="bg-areia p-3.5 rounded-xl border border-borda space-y-2.5">
                  <div className="text-xs font-bold text-musgo">
                    Novo Recurso Rápido (ex: Mosquetão, Fita Dupla-Face, Saquinho):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={quickResName}
                      onChange={(e) => setQuickResName(e.target.value)}
                      placeholder="Nome do recurso..."
                      className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-linho border border-borda text-xs text-musgo"
                    />
                    <input
                      type="number"
                      value={quickResPackPrice}
                      onChange={(e) => setQuickResPackPrice(Number(e.target.value))}
                      placeholder="Preço Pacote R$"
                      className="px-3 py-1.5 rounded-lg bg-linho border border-borda text-xs text-musgo"
                    />
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        value={quickResPackQty}
                        onChange={(e) => setQuickResPackQty(Number(e.target.value))}
                        placeholder="Qtd"
                        className="w-full px-2 py-1.5 rounded-lg bg-linho border border-borda text-xs text-musgo"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddResource}
                        className="px-3 py-1.5 rounded-lg bg-terracota text-white text-xs font-bold shrink-0"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {accessories.map((acc) => {
                  const currentQty =
                    selectedAccessories.find((a) => a.accessory_id === acc.id)
                      ?.quantity || 0;
                  const subtotal = currentQty * acc.unit_cost;
                  const isLowStock = acc.stock_quantity <= (acc.min_stock_alert ?? 15);
                  const maxPiecesFromStock =
                    currentQty > 0 ? Math.floor(acc.stock_quantity / currentQty) : null;

                  return (
                    <div
                      key={acc.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 transition ${
                        currentQty > 0
                          ? "bg-areia border-terracota/60 shadow-sm"
                          : "bg-linho/60 border-borda opacity-85"
                      }`}
                    >
                      <div className="text-xs min-w-0 space-y-0.5">
                        <div className="font-semibold text-musgo truncate">
                          {acc.name}
                        </div>
                        <div className="text-oliva flex items-center gap-1.5">
                          <span>
                            R$ {acc.unit_cost.toFixed(2).replace(".", ",")}/
                            {acc.unit_label || "un."}
                          </span>
                          {currentQty > 0 && (
                            <span className="font-bold text-terracota">
                              (= R$ {subtotal.toFixed(2).replace(".", ",")})
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[11px] font-medium flex items-center gap-1.5 ${
                            isLowStock ? "text-terracota font-semibold" : "text-oliva"
                          }`}
                        >
                          <span>
                            Estoque: <strong>{acc.stock_quantity}</strong>{" "}
                            {acc.unit_label || "un."}
                          </span>
                          {maxPiecesFromStock !== null && (
                            <span className="text-musgo/80">
                              • rende <strong>{maxPiecesFromStock}</strong> peças
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateAccessoryQty(acc.id, currentQty - 1)}
                          className="w-7 h-7 rounded-lg bg-linho border border-borda flex items-center justify-center text-musgo hover:bg-borda/40"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={currentQty}
                          onChange={(e) =>
                            updateAccessoryQty(acc.id, Number(e.target.value))
                          }
                          className="w-11 py-1 rounded-lg bg-linho border border-borda text-center text-xs font-bold text-musgo"
                        />
                        <button
                          type="button"
                          onClick={() => updateAccessoryQty(acc.id, currentQty + 1)}
                          className="w-7 h-7 rounded-lg bg-linho border border-borda flex items-center justify-center text-musgo hover:bg-borda/40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Coluna Direita (5 cols): Calculadora de Engenharia de Custos 3D com Detalhamento de Recursos */}
          <div className="lg:col-span-5 bg-areia border border-borda rounded-3xl p-6 shadow-atelier flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-borda pb-3">
                <Calculator className="w-5 h-5 text-terracota" />
                <div>
                  <h2 className="text-xl font-serif font-bold text-musgo">
                    Engenharia de Custos 3D (Bambu Lab A1)
                  </h2>
                  <p className="text-xs text-oliva">
                    Filamento + Energia 120W + Hora-Máquina + Recursos (Chaveiro / Silicone)
                  </p>
                </div>
              </div>

              {/* Parâmetros Ajustáveis */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block">Potência Média A1 (W)</label>
                  <input
                    type="number"
                    value={powerWatts}
                    onChange={(e) => setPowerWatts(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>
                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block">Tarifa Energia (R$/kWh)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={kwhTariff}
                    onChange={(e) => setKwhTariff(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>
                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block">Depreciação A1 (R$/h)</label>
                  <input
                    type="number"
                    step="0.10"
                    value={machineHourCost}
                    onChange={(e) => setMachineHourCost(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>
                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block">Margem Falha (%)</label>
                  <input
                    type="number"
                    value={failureMarginPercent}
                    onChange={(e) => setFailureMarginPercent(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* Demonstrativo Detalhado da Fórmula */}
              <div className="bg-linho p-4 rounded-2xl border border-borda space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-oliva">
                    1. Custo de Filamento ({weightGrams}g):
                  </span>
                  <span className="font-semibold text-musgo">
                    R$ {costBreakdown.filamentCost.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-oliva">
                    2. Energia Elétrica A1 ({(printTimeMinutes / 60).toFixed(1)}h @{" "}
                    {powerWatts}W):
                  </span>
                  <span className="font-semibold text-musgo">
                    R$ {costBreakdown.energyCost.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-oliva">
                    3. Depreciação / Manutenção A1:
                  </span>
                  <span className="font-semibold text-musgo">
                    R${" "}
                    {costBreakdown.machineDepreciationCost
                      .toFixed(2)
                      .replace(".", ",")}
                  </span>
                </div>

                {/* Detalhamento de cada recurso (Chaveiro, Gota de Silicone, etc.) */}
                <div className="border-t border-borda/60 pt-2 space-y-1">
                  <div className="flex justify-between font-semibold text-musgo">
                    <span>4. Recursos & Acabamentos da Ficha Técnica:</span>
                    <span>
                      R$ {costBreakdown.accessoriesCost.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  {selectedResourceDetails.length === 0 ? (
                    <div className="text-[11px] text-oliva italic pl-2">
                      Nenhum recurso extra marcado
                    </div>
                  ) : (
                    selectedResourceDetails.map((item) => (
                      <div
                        key={item.accessory_id}
                        className="flex justify-between text-[11px] text-oliva pl-2"
                      >
                        <span>
                          • {item.quantity}x {item.name}
                        </span>
                        <span>R$ {item.subtotal.toFixed(2).replace(".", ",")}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-between border-t border-borda pt-2">
                  <span className="text-oliva">
                    + Margem de Segurança/Falha ({failureMarginPercent}%):
                  </span>
                  <span className="font-semibold text-musgo">
                    R$ {costBreakdown.failureBufferCost.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-musgo border-t border-borda pt-2">
                  <span>Custo Total de Produção:</span>
                  <span>
                    R${" "}
                    {costBreakdown.totalProductionCost.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>

              {/* Preço de Venda Feira e Lucro Líquido */}
              <div className="bg-linho p-4 rounded-2xl border-2 border-argila space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-terracota block">
                      Preço de Venda na Feira (R$)
                    </label>
                    <span className="text-[11px] text-oliva">
                      Markup atual: {costBreakdown.markupMultiplier}x sobre o custo
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.50"
                    value={salePrice}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-28 px-3 py-2 rounded-xl bg-areia border border-borda text-right text-xl font-serif font-bold text-musgo"
                  />
                </div>

                <div className="flex justify-between text-xs text-oliva">
                  <span>Taxa Tap to Pay Mercado Pago ({mpFeePercent}%):</span>
                  <span>- R$ {costBreakdown.mpFeeCost.toFixed(2).replace(".", ",")}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-borda">
                  <span className="text-sm font-bold text-musgo">
                    Lucro Líquido por Peça:
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-serif font-bold text-musgo">
                      R$ {costBreakdown.netProfit.toFixed(2).replace(".", ",")}
                    </span>
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-musgo text-linho">
                      {costBreakdown.profitMarginPercent}% margem
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-base shadow-md transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>
                {editingId
                  ? "Atualizar Peça e Custos no Catálogo"
                  : "Publicar Peça no Catálogo do iPad"}
              </span>
            </button>
          </div>
        </form>

        {/* Lista de Produtos Atuais no Catálogo mostrando os Recursos que entram no Custo */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-serif font-bold text-musgo">
              Peças Publicadas no Catálogo & Composição de Custos ({products.length})
            </h2>
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Deseja remover os produtos e pedidos de demonstração para iniciar o cadastro apenas das suas peças reais da Feira TCE? (O Simulador de Chaveiro e seus insumos serão mantidos)"
                  )
                ) {
                  clearDemoOrdersAndProducts();
                }
              }}
              className="px-4 py-2 rounded-xl bg-areia hover:bg-terracota/15 border border-borda text-xs font-semibold text-terracota transition"
            >
              🧹 Limpar Peças/Pedidos Demo (Iniciar Meu Catálogo Real)
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => {
              const prodResources = (p.accessories || [])
                .map((pa) => {
                  const found = accessories.find((a) => a.id === pa.accessory_id);
                  return found ? `${pa.quantity}x ${found.name.split(" (")[0]}` : null;
                })
                .filter(Boolean);

              return (
                <div
                  key={p.id}
                  className="bg-areia border border-borda rounded-2xl p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {p.images?.[0] && (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-16 h-16 rounded-xl object-cover border border-borda shrink-0"
                        />
                      )}
                      <div className="truncate">
                        <div className="font-serif font-bold text-lg text-musgo truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-oliva">
                          {p.weight_grams}g • {p.print_time_minutes} min •{" "}
                          <strong className="text-musgo">
                            Custo: R$ {p.production_cost.toFixed(2).replace(".", ",")}
                          </strong>
                        </div>
                        <div className="text-sm font-bold text-terracota mt-0.5">
                          Venda Feira: R$ {p.price.toFixed(2).replace(".", ",")}
                        </div>
                        <div className="text-[11px] text-oliva font-medium mt-0.5">
                          Estoque pronta-entrega:{" "}
                          <strong className="text-musgo">{p.ready_stock_qty} un.</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditExisting(p)}
                        className="px-3 py-1.5 rounded-xl bg-linho border border-borda text-xs font-semibold text-musgo hover:bg-borda/40"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover "${p.name}" do catálogo?`)) {
                            deleteProduct(p.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-oliva hover:text-terracota flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badges dos Recursos (Chaveiro, Gota de Silicone, etc.) inclusos no custo */}
                  <div className="pt-2 border-t border-borda/60 flex flex-wrap gap-1.5">
                    {prodResources.length > 0 ? (
                      prodResources.map((label, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg bg-linho border border-borda text-[11px] text-musgo font-medium"
                        >
                          + {label}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-oliva italic">
                        Apenas filamento + energia
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
