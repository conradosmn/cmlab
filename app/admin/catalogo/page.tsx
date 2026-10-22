"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";
import { calculate3DCosts } from "@/lib/costCalculator";
import { compressImageBlobToDataUrl } from "@/lib/imageUtils";
import {
  parseBambu3mfFile,
  calculateScaled3DMetrics,
} from "@/lib/threeMfParser";
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
  ImagePlus,
  Star,
  ClipboardPaste,
  Maximize2,
  Printer,
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
    currentAdminUser,
    printers,
    products,
    filaments,
    accessories,
    addOrUpdateProduct,
    addOrUpdateFilament,
    addOrUpdateAccessory,
    deleteProduct,
    clearDemoOrdersAndProducts,
  } = useCMLabStore();

  const currentUserRole =
    currentAdminUser?.is_master ||
    currentAdminUser?.username?.toLowerCase() === "conradosmn"
      ? "admin"
      : currentAdminUser?.role || "gerente";
  const isAdminRole = !currentAdminUser || currentUserRole === "admin";

  const [makerworldUrl, setMakerworldUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    type: "info" | "error" | "success";
    text: string;
  } | null>(null);
  const [publishedConfirmation, setPublishedConfirmation] = useState<{
    name: string;
    image?: string;
    weightGrams: number;
    printTimeMinutes: number;
    price: number;
    wasUpdate: boolean;
  } | null>(null);

  // Estados do Produto + Recursos Vinculados (Chaveiro, Gota de Silicone, etc.)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("decoracao");
  const [description, setDescription] = useState("");
  const [productImages, setProductImages] = useState<string[]>([]);
  const [externalImageUrlInput, setExternalImageUrlInput] = useState("");
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [printTimeMinutes, setPrintTimeMinutes] = useState<number>(60);
  const [weightGrams, setWeightGrams] = useState<number>(50);
  const [baseWeight100, setBaseWeight100] = useState<number>(50);
  const [baseTime100, setBaseTime100] = useState<number>(60);
  const [catalogScaleDelta, setCatalogScaleDelta] = useState<number>(0);
  const [maxColors, setMaxColors] = useState<number>(1);
  const [allowedFilamentIds, setAllowedFilamentIds] = useState<string[]>([]);
  const [selectedAccessories, setSelectedAccessories] = useState<
    ProductAccessoryItem[]
  >([]);
  const [readyStockQty, setReadyStockQty] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(35.0);

  const resetCatalogForm = () => {
    setEditingId(null);
    setName("");
    setCategory("decoracao");
    setDescription("");
    setMakerworldUrl("");
    setProductImages([]);
    setExternalImageUrlInput("");
    setPrintTimeMinutes(60);
    setWeightGrams(50);
    setBaseWeight100(50);
    setBaseTime100(60);
    setCatalogScaleDelta(0);
    setMaxColors(1);
    setAllowedFilamentIds([]);
    setSelectedAccessories([]);
    setReadyStockQty(0);
    setSalePrice(35.0);
  };

  // Mini-modal inline para criar um novo recurso rápido (ex: novo tipo de chaveiro ou gota de silicone) sem sair da tela
  const [showQuickResourceForm, setShowQuickResourceForm] = useState(false);
  const [quickResName, setQuickResName] = useState("");
  const [quickResPackPrice, setQuickResPackPrice] = useState(30);
  const [quickResPackQty, setQuickResPackQty] = useState(100);

  // Impressora selecionada e Parâmetros de Engenharia de Custos da A1
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("");
  const activePrinter = useMemo(
    () =>
      printers.find((p) => p.id === selectedPrinterId) ||
      printers.find((p) => p.active) ||
      printers[0],
    [printers, selectedPrinterId]
  );

  const [powerWatts, setPowerWatts] = useState<number>(150);
  const [kwhTariff, setKwhTariff] = useState<number>(0.95);
  const [machineHourCost, setMachineHourCost] = useState<number>(0.56); // R$ 4.500 / 8.000h = R$ 0,56/h
  const [manualLaborMinutes, setManualLaborMinutes] = useState<number>(10);
  const [manualLaborHourlyRate, setManualLaborHourlyRate] = useState<number>(20);
  const [failureMarginPercent, setFailureMarginPercent] = useState<number>(8);
  const [desiredMarkupPercent, setDesiredMarkupPercent] = useState<number>(120);
  const [mpFeePercent, setMpFeePercent] = useState<number>(3.19);

  // Sincroniza potência e custo-hora quando a impressora cadastrada carrega ou muda
  useEffect(() => {
    if (activePrinter) {
      if (!selectedPrinterId) setSelectedPrinterId(activePrinter.id);
      setPowerWatts(activePrinter.average_power_watts || 150);
      setMachineHourCost(activePrinter.hourly_depreciation_cost || 0.56);
    }
  }, [activePrinter, selectedPrinterId]);

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
      manualLaborMinutes,
      manualLaborHourlyRateBrl: manualLaborHourlyRate,
      accessories: accInputs,
      failureMarginPercent,
      desiredMarkupPercent,
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
    manualLaborMinutes,
    manualLaborHourlyRate,
    failureMarginPercent,
    desiredMarkupPercent,
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
      if (Array.isArray(data.images) && data.images.length > 0) {
        setProductImages(data.images);
      }
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

  // Upload de 1 ou várias fotos do Computador / Celular
  const handleUploadPhotoFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (fileArr.length === 0) return;
    setUploadingPhotos(true);
    try {
      const compressedList: string[] = [];
      for (const file of fileArr) {
        const dataUrl = await compressImageBlobToDataUrl(file, 1000, 0.84);
        compressedList.push(dataUrl);
      }
      setProductImages((prev) => {
        // Se só tinha a foto default do Unsplash e subiu foto real, coloca as novas na frente!
        const withoutDefault =
          prev.length === 1 && prev[0].includes("images.unsplash.com") ? [] : prev;
        return [...compressedList, ...withoutDefault];
      });
    } catch (err) {
      console.error("Erro ao processar fotos:", err);
    } finally {
      setUploadingPhotos(false);
    }
  };

  // Colar imagem direto da área de transferência (Ctrl+V)
  const handlePasteImage = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const blob = items[i].getAsFile();
        if (blob) imageFiles.push(blob);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleUploadPhotoFiles(imageFiles);
      setImportMessage({
        type: "success",
        text: "📸 Foto colada da área de transferência e adicionada à galeria da peça!",
      });
    }
  };

  const handleSetCoverImage = (idx: number) => {
    setProductImages((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const chosen = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      return [chosen, ...rest];
    });
  };

  const handleRemoveImage = (idx: number) => {
    setProductImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApplyCatalogScale = (deltaPercent: number) => {
    setCatalogScaleDelta(deltaPercent);
    const baseW = baseWeight100 > 0 ? baseWeight100 : weightGrams;
    const baseT = baseTime100 > 0 ? baseTime100 : printTimeMinutes;
    const scaled = calculateScaled3DMetrics({
      baseWeightGrams: baseW,
      basePrintTimeMinutes: baseT,
      basePriceBrl: salePrice,
      scaleDeltaPercent: deltaPercent,
    });
    setWeightGrams(scaled.scaledWeightGrams);
    setPrintTimeMinutes(scaled.scaledPrintTimeMinutes);
  };

  const handleUpload3mfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportMessage(null);

    try {
      const parsed = await parseBambu3mfFile(file);
      setName(parsed.title);
      if (!description.trim()) {
        setDescription(
          "Peça produzida em impressão 3D de alta precisão na Bambu Lab A1 com acabamento orgânico fosco."
        );
      }
      setCatalogScaleDelta(0);

      if (parsed.photos.length > 0) {
        setProductImages(parsed.photos);
      } else {
        setProductImages([]);
      }

      if (parsed.weightGrams > 0) {
        setWeightGrams(parsed.weightGrams);
        setBaseWeight100(parsed.weightGrams);
      }
      if (parsed.printTimeMinutes > 0) {
        setPrintTimeMinutes(parsed.printTimeMinutes);
        setBaseTime100(parsed.printTimeMinutes);
      }

      if (parsed.filamentHexColors.length > 0) {
        setMaxColors(parsed.maxColors);
        const matchedFilIds: string[] = [];
        for (let i = 0; i < Math.min(4, parsed.filamentHexColors.length); i++) {
          const hex = parsed.filamentHexColors[i];
          if (!hex) continue;
          const existing = filaments.find(
            (f) => f.hex_code.toLowerCase() === hex.toLowerCase()
          );
          if (existing) {
            matchedFilIds.push(existing.id);
          }
        }
        if (matchedFilIds.length > 0) {
          setAllowedFilamentIds(matchedFilIds);
        }
      }

      // Sugere um preço comercial justo automático caso tenha extraído peso e tempo
      if (parsed.weightGrams > 0 && parsed.printTimeMinutes > 0) {
        const autoSuggestedPrice =
          Math.ceil((parsed.weightGrams * 0.34 + parsed.printTimeMinutes * 0.11) / 5) * 5;
        setSalePrice(Math.max(25, autoSuggestedPrice));
      }

      const sourceLabel =
        parsed.weightSource === "slice_info"
          ? `fatiamento Bambu Studio (${parsed.plateCount || 1} placa(s))`
          : parsed.weightSource === "mesh_geometry"
          ? "geometria 3D da malha do modelo (arquivo .3mf não fatiado)"
          : "arquivo .3mf";

      setImportMessage({
        type: "success",
        text:
          parsed.weightGrams > 0
            ? `✅ .3MF "${parsed.title}" importado via ${sourceLabel}: Peso ${parsed.weightGrams}g • Tempo ${parsed.printTimeMinutes} min • ${parsed.photos.length} foto(s) única(s)! Se você escalou a peça (ex: +20%), clique na barra de escala abaixo.`
            : `Arquivo "${file.name}" carregado com ${parsed.photos.length} foto(s) extraída(s)! Confirme o peso e tempo abaixo.`,
      });
    } catch {
      setImportMessage({
        type: "error",
        text: "Não foi possível descompactar o arquivo .3mf. Verifique se é um .3mf válido do Bambu Studio / MakerWorld.",
      });
    } finally {
      setImportLoading(false);
      e.target.value = "";
    }
  };

  const handleLoadPreset = (preset: (typeof DEMO_MAKERWORLD_PRESETS)[0]) => {
    setEditingId(null);
    setName(preset.title);
    setCategory(preset.category);
    setWeightGrams(preset.weight_grams);
    setPrintTimeMinutes(preset.print_time_minutes);
    setBaseWeight100(preset.weight_grams);
    setBaseTime100(preset.print_time_minutes);
    setCatalogScaleDelta(0);
    setProductImages([preset.image]);
    setSelectedAccessories(preset.defaultAccessories);
    const suggestedPrice =
      Math.ceil((preset.weight_grams * 0.35 + preset.print_time_minutes * 0.12) / 5) * 5;
    setSalePrice(Math.max(20, suggestedPrice));
    setImportMessage({
      type: "info",
      text: `Preset Bambu Lab A1 carregado: "${preset.title}" com recursos pré-selecionados!`,
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const validImages =
      productImages.filter((img) => img && img.trim().length > 0).length > 0
        ? productImages.filter((img) => img && img.trim().length > 0)
        : [
            "https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=900&q=80",
          ];

    const productPayload: Product = {
      id: editingId || `prod-${Date.now()}`,
      name: name.trim(),
      category,
      description: description.trim(),
      makerworld_url: makerworldUrl.trim() || undefined,
      images: validImages,
      print_time_minutes: Number(printTimeMinutes),
      weight_grams: Number(weightGrams),
      max_colors: Number(maxColors),
      allowed_filament_ids: allowedFilamentIds,
      accessories: selectedAccessories.filter((a) => a.quantity > 0),
      production_cost: costBreakdown.totalProductionCost,
      price: Number(salePrice),
      is_custom_keychain:
        category === "chaveiros" && name.toLowerCase().includes("personalizado"),
      ready_stock_qty: Number(readyStockQty),
      active: true,
    };

    const wasUpdate = Boolean(editingId);
    await addOrUpdateProduct(productPayload);
    resetCatalogForm();
    setPublishedConfirmation({
      name: productPayload.name,
      image: validImages[0],
      weightGrams: productPayload.weight_grams,
      printTimeMinutes: productPayload.print_time_minutes,
      price: productPayload.price,
      wasUpdate,
    });
    setImportMessage({
      type: "success",
      text: isAdminRole
        ? `✅ Produto "${productPayload.name}" publicado com ${validImages.length} foto(s) e custo de R$ ${costBreakdown.totalProductionCost
            .toFixed(2)
            .replace(".", ",")}! Formulário limpo e pronto para o próximo upload.`
        : `✅ Produto "${productPayload.name}" publicado no catálogo com ${validImages.length} foto(s)! Formulário limpo e pronto para o próximo upload.`,
    });
  };

  const handleEditExisting = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setDescription(p.description || "");
    setMakerworldUrl(p.makerworld_url || "");
    setProductImages(p.images && p.images.length > 0 ? p.images : []);
    setPrintTimeMinutes(p.print_time_minutes);
    setWeightGrams(p.weight_grams);
    setBaseWeight100(p.weight_grams);
    setBaseTime100(p.print_time_minutes);
    setCatalogScaleDelta(0);
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
          {/* Coluna Esquerda: Produto, Galeria de Fotos e Filamentos */}
          <div
            className={`${
              isAdminRole ? "lg:col-span-7" : "lg:col-span-12"
            } bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-5`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-borda pb-3">
              <div>
                <h2 className="text-xl font-serif font-bold text-musgo">
                  {editingId
                    ? "Editando Peça do Catálogo"
                    : "Cadastrar Peça no Catálogo"}
                </h2>
                {!isAdminRole && (
                  <p className="text-xs text-oliva mt-0.5">
                    Perfil Gerente: cadastre/edite dados da peça, galeria de fotos, nome,
                    descrição e cores de filamento (custos restritos ao Admin).
                  </p>
                )}
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={resetCatalogForm}
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
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setWeightGrams(val);
                    if (catalogScaleDelta === 0) setBaseWeight100(val);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-oliva mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-terracota" />
                    <span>Tempo (h : min)</span>
                  </span>
                  <span className="text-[10px] font-normal text-oliva">
                    ({printTimeMinutes}m)
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={Math.floor(printTimeMinutes / 60)}
                      onChange={(e) => {
                        const h = Math.max(0, Number(e.target.value) || 0);
                        const m = printTimeMinutes % 60;
                        const total = Math.max(1, h * 60 + m);
                        setPrintTimeMinutes(total);
                        if (catalogScaleDelta === 0) setBaseTime100(total);
                      }}
                      className="w-full pl-2.5 pr-5 py-2.5 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                    />
                    <span className="absolute right-2 top-2.5 text-[11px] text-oliva font-semibold">
                      h
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={printTimeMinutes % 60}
                      onChange={(e) => {
                        const h = Math.floor(printTimeMinutes / 60);
                        const m = Math.max(0, Number(e.target.value) || 0);
                        const total = Math.max(1, h * 60 + m);
                        setPrintTimeMinutes(total);
                        if (catalogScaleDelta === 0) setBaseTime100(total);
                      }}
                      className="w-full pl-2.5 pr-7 py-2.5 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                    />
                    <span className="absolute right-1.5 top-2.5 text-[10px] text-oliva font-semibold">
                      min
                    </span>
                  </div>
                </div>
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

            {/* SIMULADOR RÁPIDO DE ESCALA 3D NO CATÁLOGO (Ex: Presépio escalado +20%) */}
            <div className="bg-linho px-3.5 py-2.5 rounded-2xl border border-borda flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-musgo">
                <Maximize2 className="w-3.5 h-3.5 text-terracota shrink-0" />
                <span className="font-bold">Escala da Peça no Bambu Studio:</span>
                <span className="text-[11px] text-oliva">
                  (Base 100%: {baseWeight100}g • {baseTime100} min)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {[-15, 0, 10, 20, 30, 50].map((delta) => {
                  const active = catalogScaleDelta === delta;
                  return (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => handleApplyCatalogScale(delta)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        active
                          ? "bg-terracota text-white border-terracota shadow-sm"
                          : "bg-areia text-musgo border-borda hover:border-argila"
                      }`}
                    >
                      {delta === 0
                        ? "100% (Padrão)"
                        : delta > 0
                        ? `+${delta}% (${100 + delta}%)`
                        : `${delta}% (${100 + delta}%)`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* GALERIA FUNCIONAL DE FOTOS DA PEÇA (Upload do PC/Celular + Ctrl+V + .3MF + Link) */}
            <div
              onPaste={handlePasteImage}
              className="bg-linho p-4 rounded-2xl border-2 border-dashed border-argila/70 space-y-3 focus-within:border-terracota transition"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-sm font-serif font-bold text-musgo flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-terracota" />
                    <span>
                      Fotos Reais da Peça ({productImages.length} na galeria)
                    </span>
                  </label>
                  <p className="text-[11px] text-oliva">
                    Suba fotos do seu computador/celular, cole prints direto com{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-areia border border-borda font-mono text-[10px] text-musgo">
                      Ctrl+V
                    </kbd>{" "}
                    ou extraia automaticamente do arquivo <code>.3mf</code>!
                  </p>
                </div>

                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-terracota hover:bg-terracota-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {uploadingPhotos ? "Otimizando..." : "+ Subir Foto(s) do PC/Celular"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) handleUploadPhotoFiles(e.target.files);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Grade de Miniaturas das Fotos da Peça */}
              {productImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {productImages.map((imgSrc, idx) => (
                    <div
                      key={idx}
                      className={`relative group rounded-2xl overflow-hidden border-2 bg-areia h-28 ${
                        idx === 0
                          ? "border-terracota ring-2 ring-terracota/20"
                          : "border-borda"
                      }`}
                    >
                      <img
                        src={imgSrc}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 ? (
                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-terracota text-white flex items-center gap-1 shadow">
                          <Star className="w-2.5 h-2.5 fill-current" />
                          Capa
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetCoverImage(idx)}
                          className="opacity-0 group-hover:opacity-100 absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-musgo/90 text-linho transition"
                        >
                          Definir Capa
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        title="Remover esta foto"
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-linho/90 hover:bg-terracota hover:text-white text-musgo transition shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-oliva">
                  Nenhuma foto adicionada ainda. Clique em &quot;+ Subir Foto(s)&quot; ou
                  pressione <strong>Ctrl+V</strong> para colar uma imagem!
                </div>
              )}

              {/* Campo rápido opcional para colar link ou usar Ctrl+V */}
              <div className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <ClipboardPaste className="w-3.5 h-3.5 text-oliva absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={externalImageUrlInput}
                    onChange={(e) => setExternalImageUrlInput(e.target.value)}
                    placeholder="Clique aqui e aperte Ctrl+V para colar um print, ou cole o link de uma imagem..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-areia border border-borda text-xs text-musgo focus:outline-none focus:ring-1 focus:ring-terracota"
                  />
                </div>
                {externalImageUrlInput.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductImages((prev) => [
                        externalImageUrlInput.trim(),
                        ...prev,
                      ]);
                      setExternalImageUrlInput("");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-musgo text-linho text-xs font-semibold shrink-0"
                  >
                    + Adicionar Link
                  </button>
                )}
              </div>
            </div>

            {/* Seleção de Cores de Filamento */}
            <div className="bg-linho p-4 rounded-2xl border border-borda space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase text-oliva flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-terracota" />
                  <span>Cor do Filamento (ou deixe sem marcar p/ escolha na reserva)</span>
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAllowedFilamentIds([])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                      allowedFilamentIds.length === 0
                        ? "bg-terracota text-white border-terracota shadow-sm"
                        : "bg-areia text-musgo border-borda hover:border-terracota"
                    }`}
                  >
                    Não marcar cor nenhuma (Cliente escolhe na reserva)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedFilamentIds(filaments.map((f) => f.id))}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-areia text-oliva hover:text-musgo border border-borda transition"
                  >
                    Marcar todas
                  </button>
                </div>
              </div>

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
                          : "bg-areia text-musgo border-borda opacity-75 hover:opacity-100"
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

              <div className="text-[11px] text-oliva pt-0.5">
                {allowedFilamentIds.length === 0 ? (
                  <span className="text-terracota font-semibold">
                    ✓ Nenhuma cor fixada: o cliente escolherá a cor de sua preferência no ato da reserva no iPad.
                  </span>
                ) : (
                  <span>
                    {allowedFilamentIds.length} cor(es) marcada(s) para esta peça. Clique novamente nas cores ou no botão acima se preferir não marcar nenhuma.
                  </span>
                )}
              </div>
            </div>

            {!isAdminRole && (
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-base shadow-md transition flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>
                  {editingId
                    ? "Salvar Alterações da Peça no Catálogo"
                    : "Publicar Peça no Catálogo"}
                </span>
              </button>
            )}

            {/* COMPOSIÇÃO DE RECURSOS DA PEÇA (EXCLUSIVO ADMIN CUSTOS) */}
            {isAdminRole && (
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
            )}
          </div>

          {/* Coluna Direita (5 cols): Calculadora de Engenharia de Custos 3D (Exclusivo Admin) */}
          {isAdminRole && (
          <div className="lg:col-span-5 bg-areia border border-borda rounded-3xl p-6 shadow-atelier flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-borda pb-3">
                <Calculator className="w-5 h-5 text-terracota" />
                <div>
                  <h2 className="text-xl font-serif font-bold text-musgo">
                    Engenharia de Custos 3D (Bambu Lab A1)
                  </h2>
                  <p className="text-xs text-oliva">
                    Filamento + Energia + Máquina + Trabalho Manual + Recursos Extras
                  </p>
                </div>
              </div>

              {/* Seletor da Impressora Cadastrada no Atelier */}
              <div className="bg-linho p-3 rounded-2xl border border-borda space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-musgo flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-terracota" />
                    <span>Impressora Base do Cálculo:</span>
                  </span>
                  <Link
                    href="/admin/insumos"
                    className="text-terracota underline font-semibold"
                  >
                    Gerenciar Máquinas →
                  </Link>
                </div>
                <select
                  value={activePrinter?.id || ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPrinterId(id);
                    const found = printers.find((p) => p.id === id);
                    if (found) {
                      setPowerWatts(found.average_power_watts);
                      setMachineHourCost(found.hourly_depreciation_cost);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-areia border border-borda text-xs font-bold text-musgo"
                >
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — R$ {p.purchase_price.toFixed(0)} ÷ {p.lifespan_hours}h = R${" "}
                      {p.hourly_depreciation_cost.toFixed(2).replace(".", ",")}/h ({p.average_power_watts}W)
                    </option>
                  ))}
                </select>
              </div>

              {/* Parâmetros Ajustáveis (Máquina, Energia, Mão de Obra e Falha) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block text-[11px]">Potência A1 (W)</label>
                  <input
                    type="number"
                    value={powerWatts}
                    onChange={(e) => setPowerWatts(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>
                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block text-[11px]">Energia (R$/kWh)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={kwhTariff}
                    onChange={(e) => setKwhTariff(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>
                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <div className="flex items-center justify-between">
                    <label className="text-oliva block text-[11px]">Máquina (R$/h)</label>
                    <button
                      type="button"
                      onClick={() =>
                        setMachineHourCost((prev) => (prev < 1 ? 1.5 : 0.44))
                      }
                      title="Alternar entre R$ 0,44/h (8.000h) e R$ 1,50/h (2.000h)"
                      className="text-[10px] text-terracota underline font-semibold"
                    >
                      {machineHourCost < 1 ? "8000h" : "2000h"}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.05"
                    value={machineHourCost}
                    onChange={(e) => setMachineHourCost(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>

                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block text-[11px]">
                    Seu Tempo (min)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={manualLaborMinutes}
                    onChange={(e) => setManualLaborMinutes(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>

                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block text-[11px]">
                    Sua Hora (R$/h)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={manualLaborHourlyRate}
                    onChange={(e) => setManualLaborHourlyRate(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>

                <div className="bg-linho p-2.5 rounded-xl border border-borda">
                  <label className="text-oliva block text-[11px]">Risco Falha (%)</label>
                  <input
                    type="number"
                    value={failureMarginPercent}
                    onChange={(e) => setFailureMarginPercent(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-musgo text-sm mt-0.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* Demonstrativo Detalhado da Fórmula (Anatomia do Custo) */}
              <div className="bg-linho p-4 rounded-2xl border border-borda space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-oliva">
                    1. Filamento ({weightGrams}g):
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
                    3. Desgaste / Depreciação Máquina (R${" "}
                    {machineHourCost.toFixed(2).replace(".", ",")}/h):
                  </span>
                  <span className="font-semibold text-musgo">
                    R${" "}
                    {costBreakdown.machineDepreciationCost
                      .toFixed(2)
                      .replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-oliva">
                    4. Seu Trabalho Manual ({manualLaborMinutes} min @ R${" "}
                    {manualLaborHourlyRate}/h):
                  </span>
                  <span className="font-semibold text-musgo">
                    R$ {costBreakdown.manualLaborCost.toFixed(2).replace(".", ",")}
                  </span>
                </div>

                {/* Detalhamento de cada recurso (Chaveiro, Gota de Silicone, etc.) */}
                <div className="border-t border-borda/60 pt-2 space-y-1">
                  <div className="flex justify-between font-semibold text-musgo">
                    <span>5. Embalagem & Recursos da Ficha Técnica:</span>
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
                    6. Reserva de Falhas ({failureMarginPercent}%):
                  </span>
                  <span className="font-semibold text-musgo">
                    R$ {costBreakdown.failureBufferCost.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-musgo border-t border-borda pt-2">
                  <span>Custo Real Unitário:</span>
                  <span>
                    R${" "}
                    {costBreakdown.totalProductionCost.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>

              {/* Simulador de Margem sobre o Custo + Preço Sugerido Automático */}
              <div className="bg-linho p-4 rounded-2xl border border-borda space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-musgo">
                    Margem de Lucro Sobre o Custo (Markup)
                  </span>
                  <div className="flex items-center gap-1 bg-areia px-2.5 py-1 rounded-xl border border-borda">
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      step={1}
                      value={desiredMarkupPercent}
                      onChange={(e) =>
                        setDesiredMarkupPercent(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-14 bg-transparent text-right text-sm font-bold text-terracota focus:outline-none"
                    />
                    <span className="text-xs font-bold text-terracota">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={1}
                  value={Math.min(300, desiredMarkupPercent)}
                  onChange={(e) => setDesiredMarkupPercent(Number(e.target.value))}
                  className="w-full accent-terracota cursor-pointer"
                />
                <div className="flex flex-wrap gap-1">
                  {[60, 100, 120, 150, 180, 200].map((mk) => (
                    <button
                      key={mk}
                      type="button"
                      onClick={() => setDesiredMarkupPercent(mk)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                        desiredMarkupPercent === mk
                          ? "bg-musgo text-linho border-musgo"
                          : "bg-areia text-oliva border-borda hover:text-musgo"
                      }`}
                    >
                      {mk}%
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-borda flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-oliva">
                      Preço Sugerido ({desiredMarkupPercent}% lucro + taxa)
                    </div>
                    <div className="text-lg font-serif font-bold text-musgo">
                      R${" "}
                      {costBreakdown.suggestedSalePriceBrl
                        .toFixed(2)
                        .replace(".", ",")}
                    </div>
                    <div className="text-[10px] text-oliva">
                      Só peso + margem: R${" "}
                      {costBreakdown.onlyFilamentTimes3PriceBrl
                        .toFixed(2)
                        .replace(".", ",")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSalePrice(Math.ceil(costBreakdown.suggestedSalePriceBrl))
                    }
                    className="px-3 py-2 rounded-xl bg-musgo hover:bg-musgo/90 text-linho text-xs font-semibold transition shrink-0"
                  >
                    Aplicar R$ {Math.ceil(costBreakdown.suggestedSalePriceBrl)}
                  </button>
                </div>
              </div>

              {/* Preço de Venda Feira (Digitável) e Lucro Líquido */}
              <div className="bg-linho p-4 rounded-2xl border-2 border-argila space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase text-terracota block">
                      Preço Final de Venda (Digite o Valor R$)
                    </label>
                    <span className="text-[11px] text-oliva">
                      Markup efetivo: {costBreakdown.markupMultiplier}x (
                      {costBreakdown.realMarkupPercent}% s/ custo)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-areia px-3 py-2 rounded-xl border-2 border-terracota/50 focus-within:border-terracota">
                    <span className="text-sm font-bold text-oliva">R$</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={salePrice || ""}
                      placeholder="0,00"
                      onChange={(e) => {
                        const raw = e.target.value;
                        setSalePrice(raw === "" ? 0 : Number(raw));
                      }}
                      className="w-24 bg-transparent text-right text-xl font-serif font-bold text-musgo focus:outline-none"
                    />
                  </div>
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
                      {costBreakdown.profitMarginPercent}% do preço
                    </span>
                  </div>
                </div>

                {costBreakdown.netProfit > 0 && activePrinter && (
                  <div className="p-2.5 rounded-xl bg-areia border border-borda text-center text-xs text-musgo">
                    💡 Com esse lucro líquido, cerca de{" "}
                    <strong className="text-terracota">
                      {Math.ceil(activePrinter.purchase_price / costBreakdown.netProfit)}{" "}
                      peças
                    </strong>{" "}
                    pagam a sua{" "}
                    <strong>
                      {activePrinter.name} (R${" "}
                      {activePrinter.purchase_price.toLocaleString("pt-BR")})
                    </strong>
                    .
                  </div>
                )}
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
          )}
        </form>

        {/* Lista de Produtos Atuais no Catálogo */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-serif font-bold text-musgo">
              {isAdminRole
                ? `Peças Publicadas no Catálogo & Custos (${products.length})`
                : `Peças Publicadas no Catálogo (${products.length})`}
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
                          {p.weight_grams}g • {p.print_time_minutes} min
                          {isAdminRole && (
                            <>
                              {" • "}
                              <strong className="text-musgo">
                                Custo: R$ {p.production_cost.toFixed(2).replace(".", ",")}
                              </strong>
                            </>
                          )}
                        </div>
                        {isAdminRole && (
                          <div className="text-sm font-bold text-terracota mt-0.5">
                            Venda Feira: R$ {p.price.toFixed(2).replace(".", ",")}
                          </div>
                        )}
                        <div className="text-[11px] text-oliva font-medium mt-0.5">
                          Estoque pronta-entrega:{" "}
                          <strong className="text-musgo">{p.ready_stock_qty} un.</strong>
                          {" • "}
                          <span className="text-terracota font-semibold">
                            {p.allowed_filament_ids?.length > 0
                              ? `${p.allowed_filament_ids.length} cor(es)`
                              : "Cliente escolhe a cor na reserva"}
                          </span>
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

        {/* Modal de Confirmação ao Publicar / Atualizar Peça */}
        {publishedConfirmation && (
          <div
            onClick={() => setPublishedConfirmation(null)}
            className="fixed inset-0 z-50 bg-musgo/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-areia border-2 border-musgo rounded-3xl max-w-md w-full p-6 shadow-atelier-lg text-center space-y-4 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-md">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                  {publishedConfirmation.wasUpdate
                    ? "Catálogo Atualizado"
                    : "Peça Adicionada com Sucesso!"}
                </span>
                <h3 className="text-2xl font-serif font-bold text-musgo">
                  {publishedConfirmation.name}
                </h3>
                <p className="text-xs text-oliva">
                  {publishedConfirmation.weightGrams}g •{" "}
                  {publishedConfirmation.printTimeMinutes} min
                  {isAdminRole &&
                    ` • R$ ${publishedConfirmation.price
                      .toFixed(2)
                      .replace(".", ",")}`}
                </p>
              </div>

              {publishedConfirmation.image && (
                <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-borda mx-auto shadow-sm bg-linho">
                  <img
                    src={publishedConfirmation.image}
                    alt={publishedConfirmation.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <p className="text-xs text-oliva">
                A peça já está disponível na vitrine do iPad e os campos foram limpos
                para o próximo cadastro.
              </p>

              <button
                type="button"
                onClick={() => {
                  setPublishedConfirmation(null);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full py-3.5 rounded-2xl bg-musgo hover:bg-musgo/90 text-linho font-semibold text-sm shadow-md transition"
              >
                OK • Cadastrar Próxima Peça
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
