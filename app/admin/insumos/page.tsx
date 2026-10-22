"use client";

import React, { useState, useMemo } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";
import { Accessory, AccessoryCategory, Filament, Printer3D } from "@/lib/types";
import {
  ShoppingCart,
  Plus,
  RefreshCw,
  CheckCircle2,
  Layers,
  Wrench,
  Edit3,
  Trash2,
  KeyRound,
  Droplets,
  Lightbulb,
  Magnet,
  Package,
  Calculator,
  ChevronDown,
  Calendar,
  Check,
  Printer,
  Zap,
} from "lucide-react";

const DEFAULT_FILAMENT_BRANDS = [
  "Voolt3D",
  "3DLab",
  "Bambu Lab",
  "eSUN",
  "Creality",
  "GTMax3D",
  "F3D",
  "Cliever",
  "Elegoo",
  "Sunlu",
];

const RESOURCE_CATEGORIES: {
  id: AccessoryCategory;
  label: string;
  badgeColor: string;
}[] = [
  {
    id: "chaveiro",
    label: "Chaveiro & Ferragens (Argola, Corrente, Ilha, Mosquetão)",
    badgeColor: "bg-terracota/15 text-terracota",
  },
  {
    id: "silicone_acabamento",
    label: "Gota de Silicone, Feltro & Acabamento Base",
    badgeColor: "bg-musgo/15 text-musgo",
  },
  {
    id: "eletrica",
    label: "Elétrica & Iluminação (Kit LED, Soquete, Cabo)",
    badgeColor: "bg-argila/30 text-musgo",
  },
  {
    id: "fixacao",
    label: "Fixação & Ímãs (Neodímio, Dupla-Face 3M)",
    badgeColor: "bg-borda text-musgo",
  },
  {
    id: "embalagem",
    label: "Embalagem, Tags & Mimo Cliente",
    badgeColor: "bg-areia text-oliva border border-borda",
  },
  {
    id: "outros",
    label: "Outros Insumos",
    badgeColor: "bg-linho text-oliva",
  },
];

const QUICK_RESOURCE_PRESETS: {
  code: string;
  name: string;
  category: AccessoryCategory;
  unit_label: string;
  pack_price: number;
  pack_quantity: number;
  min_stock_alert: number;
}[] = [
  {
    code: "ACC-COR-01",
    name: "Argola Italiana 25mm + Corrente p/ Chaveiro",
    category: "chaveiro",
    unit_label: "un.",
    pack_price: 38.0,
    pack_quantity: 100,
    min_stock_alert: 25,
  },
  {
    code: "ACC-SIL-03",
    name: "Gota de Silicone Antiderrapante 10mm (Cartela)",
    category: "silicone_acabamento",
    unit_label: "gota",
    pack_price: 24.0,
    pack_quantity: 200,
    min_stock_alert: 40,
  },
  {
    code: "ACC-ILH-02",
    name: "Ilha / Elo de Junção Metálico p/ Pingente",
    category: "chaveiro",
    unit_label: "un.",
    pack_price: 18.0,
    pack_quantity: 100,
    min_stock_alert: 25,
  },
  {
    code: "ACC-MOS-07",
    name: "Mosquetão Lagosta Dourado p/ Bolsa/Chaveiro",
    category: "chaveiro",
    unit_label: "un.",
    pack_price: 42.0,
    pack_quantity: 50,
    min_stock_alert: 15,
  },
  {
    code: "ACC-IMA-04",
    name: "Ímã de Neodímio 8x3mm Super Forte",
    category: "fixacao",
    unit_label: "un.",
    pack_price: 45.0,
    pack_quantity: 50,
    min_stock_alert: 15,
  },
  {
    code: "ACC-LED-05",
    name: "Kit Elétrico Luminária (Cabo + Interruptor + LED Quente)",
    category: "eletrica",
    unit_label: "kit",
    pack_price: 165.0,
    pack_quantity: 10,
    min_stock_alert: 3,
  },
];

export default function AdminInsumosPage() {
  const {
    printers,
    filaments,
    accessories,
    products,
    orders,
    addOrUpdatePrinter,
    deletePrinter,
    addOrUpdateFilament,
    deleteFilament,
    restockFilament,
    addOrUpdateAccessory,
    deleteAccessory,
    restockAccessory,
  } = useCMLabStore();

  const [activeTab, setActiveTab] = useState<
    "all" | "printers" | "accessories" | "filaments"
  >("all");

  // Estados do Formulário de Impressora 3D (Parque de Máquinas)
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerCode, setPrinterCode] = useState("IMP-A1-02");
  const [printerName, setPrinterName] = useState("");
  const [printerBrand, setPrinterBrand] = useState("Bambu Lab");
  const [printerModel, setPrinterModel] = useState("A1 Combo (AMS Lite)");
  const [printerPurchaseDate, setPrinterPurchaseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [printerPrice, setPrinterPrice] = useState<number>(4500);
  const [printerLifespanHours, setPrinterLifespanHours] = useState<number>(8000);
  const [printerMaintPercent, setPrinterMaintPercent] = useState<number>(0);
  const [printerPowerWatts, setPrinterPowerWatts] = useState<number>(150);

  const previewPrinterHourlyCost = useMemo(() => {
    const hrs = Math.max(100, printerLifespanHours || 8000);
    const mult = 1 + (printerMaintPercent || 0) / 100;
    return Number(((printerPrice * mult) / hrs).toFixed(2));
  }, [printerPrice, printerLifespanHours, printerMaintPercent]);

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!printerName.trim()) return;
    const payload: Printer3D = {
      id: editingPrinterId || `printer-${Date.now()}`,
      code: printerCode.trim() || "IMP-A1",
      name: printerName.trim(),
      brand: printerBrand.trim() || "Bambu Lab",
      model: printerModel.trim() || "A1 Combo",
      purchase_date:
        printerPurchaseDate || new Date().toISOString().slice(0, 10),
      purchase_price: Number(printerPrice),
      lifespan_hours: Number(printerLifespanHours),
      maintenance_reserve_percent: Number(printerMaintPercent),
      average_power_watts: Number(printerPowerWatts),
      hourly_depreciation_cost: previewPrinterHourlyCost,
      active: true,
    };
    await addOrUpdatePrinter(payload);
    setEditingPrinterId(null);
    setPrinterName("");
    setPrinterCode(`IMP-A1-0${printers.length + 2}`);
  };

  const handleEditPrinter = (p: Printer3D) => {
    setEditingPrinterId(p.id);
    setPrinterCode(p.code);
    setPrinterName(p.name);
    setPrinterBrand(p.brand);
    setPrinterModel(p.model);
    setPrinterPurchaseDate(
      p.purchase_date || new Date().toISOString().slice(0, 10)
    );
    setPrinterPrice(p.purchase_price);
    setPrinterLifespanHours(p.lifespan_hours);
    setPrinterMaintPercent(p.maintenance_reserve_percent || 0);
    setPrinterPowerWatts(p.average_power_watts);
  };

  // Estados do Formulário de Recurso / Acessório (Chaveiro, Gota de Silicone, etc.)
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [accCode, setAccCode] = useState("ACC-REC-07");
  const [accName, setAccName] = useState("");
  const [accCategory, setAccCategory] = useState<AccessoryCategory>("chaveiro");
  const [accUnitLabel, setAccUnitLabel] = useState("un.");
  const [accSupplier, setAccSupplier] = useState("Mercado Livre");
  const [packPrice, setPackPrice] = useState(38);
  const [packQty, setPackQty] = useState(100);
  const [stockQty, setStockQty] = useState(100);
  const [minStockAlert, setMinStockAlert] = useState(20);

  // Estados do Formulário de Bobina de Filamento
  const [editingFilId, setEditingFilId] = useState<string | null>(null);
  const [code, setCode] = useState("PLA-VOO-09");
  const [brand, setBrand] = useState("Voolt3D");
  const [customBrands, setCustomBrands] = useState<string[]>([]);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [material, setMaterial] = useState("PLA");
  const [colorName, setColorName] = useState("");
  const [hexCode, setHexCode] = useState("#A3522B");
  const [colorInputMode, setColorInputMode] = useState<"hex" | "rgb" | "cmyk">("hex");
  const [hexTextInput, setHexTextInput] = useState("#A3522B");
  const [rgbInput, setRgbInput] = useState({ r: 163, g: 82, b: 43 });
  const [cmykInput, setCmykInput] = useState({ c: 0, m: 50, y: 74, k: 36 });
  const [purchasePrice, setPurchasePrice] = useState(115);

  const syncAllColorFormatsFromHex = (rawHex: string) => {
    const clean = rawHex.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    if (clean.length !== 6) return;
    const normalizedHex = `#${clean.toUpperCase()}`;
    setHexCode(normalizedHex);
    setHexTextInput(normalizedHex);
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    setRgbInput({ r, g, b });

    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const k = 1 - Math.max(rNorm, gNorm, bNorm);
    if (k >= 1) {
      setCmykInput({ c: 0, m: 0, y: 0, k: 100 });
    } else {
      const c = Math.round(((1 - rNorm - k) / (1 - k)) * 100);
      const m = Math.round(((1 - gNorm - k) / (1 - k)) * 100);
      const y = Math.round(((1 - bNorm - k) / (1 - k)) * 100);
      setCmykInput({ c, m, y, k: Math.round(k * 100) });
    }
  };

  const updateColorFromRgb = (nextRgb: { r: number; g: number; b: number }) => {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n || 0)));
    const r = clamp(nextRgb.r);
    const g = clamp(nextRgb.g);
    const b = clamp(nextRgb.b);
    setRgbInput({ r, g, b });
    const hex = `#${[r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
    setHexCode(hex);
    setHexTextInput(hex);

    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    const k = 1 - Math.max(rNorm, gNorm, bNorm);
    if (k >= 1) {
      setCmykInput({ c: 0, m: 0, y: 0, k: 100 });
    } else {
      const c = Math.round(((1 - rNorm - k) / (1 - k)) * 100);
      const m = Math.round(((1 - gNorm - k) / (1 - k)) * 100);
      const y = Math.round(((1 - bNorm - k) / (1 - k)) * 100);
      setCmykInput({ c, m, y, k: Math.round(k * 100) });
    }
  };

  const updateColorFromCmyk = (nextCmyk: {
    c: number;
    m: number;
    y: number;
    k: number;
  }) => {
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));
    const c = clamp(nextCmyk.c);
    const m = clamp(nextCmyk.m);
    const y = clamp(nextCmyk.y);
    const k = clamp(nextCmyk.k);
    setCmykInput({ c, m, y, k });

    const r = Math.round(255 * (1 - c / 100) * (1 - k / 100));
    const g = Math.round(255 * (1 - m / 100) * (1 - k / 100));
    const b = Math.round(255 * (1 - y / 100) * (1 - k / 100));
    setRgbInput({ r, g, b });

    const hex = `#${[r, g, b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`;
    setHexCode(hex);
    setHexTextInput(hex);
  };
  const [initialWeight, setInitialWeight] = useState(1000);
  const [remainingWeight, setRemainingWeight] = useState(1000);
  const [isOnOrder, setIsOnOrder] = useState(false);

  // Lista unificada de marcas em cascata (Principais + Marcas já salvas no banco + Marcas criadas pelo usuário)
  const availableBrands = useMemo(() => {
    const set = new Set<string>(DEFAULT_FILAMENT_BRANDS);
    filaments.forEach((f) => {
      if (f.brand && f.brand.trim()) set.add(f.brand.trim());
    });
    customBrands.forEach((b) => {
      if (b && b.trim()) set.add(b.trim());
    });
    return Array.from(set);
  }, [filaments, customBrands]);

  const brandExistsInList = useMemo(() => {
    const clean = brand.trim().toLowerCase();
    if (!clean) return true;
    return availableBrands.some((b) => b.toLowerCase() === clean);
  }, [brand, availableBrands]);

  const previewUnitCost = packQty > 0 ? packPrice / packQty : 0;
  const previewGramCost = initialWeight > 0 ? purchasePrice / initialWeight : 0;

  // Pedidos pagos ativos na feira
  const activePaidOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.payment_status === "paid" &&
          o.queue_status !== "done" &&
          o.queue_status !== "delivered"
      ),
    [orders]
  );

  // Lista de Compras Automática: Bobinas de Filamento
  const filamentShoppingList = useMemo(() => {
    return filaments
      .map((fil) => {
        const committedGrams = activePaidOrders.reduce((acc, ord) => {
          const matchGrams = ord.selected_colors
            .filter((sc) => sc.filament_id === fil.id)
            .reduce((s, sc) => s + sc.weight_grams, 0);
          return acc + matchGrams;
        }, 0);

        const ordersUsingThisColor = activePaidOrders.filter((ord) =>
          ord.selected_colors.some((sc) => sc.filament_id === fil.id)
        );

        const revenueGeneratedByColor = ordersUsingThisColor.reduce(
          (acc, o) => acc + o.total_price,
          0
        );

        const needsPurchase =
          fil.is_on_order_color ||
          fil.remaining_weight_grams < 150 ||
          committedGrams > fil.remaining_weight_grams;

        return {
          filament: fil,
          committedGrams,
          ordersCount: ordersUsingThisColor.length,
          revenueGeneratedByColor,
          needsPurchase,
        };
      })
      .filter((item) => item.needsPurchase);
  }, [filaments, activePaidOrders]);

  // Lista de Compras Automática: Recursos / Acessórios (Chaveiros, Gotas de Silicone, etc.)
  const accessoryShoppingList = useMemo(() => {
    return accessories
      .map((acc) => {
        const committedUnits = activePaidOrders.reduce((sum, ord) => {
          const prod = products.find((p) => p.id === ord.product_id);
          const spec = prod?.accessories.find((a) => a.accessory_id === acc.id);
          return sum + (spec ? spec.quantity : 0);
        }, 0);

        const minAlert = acc.min_stock_alert ?? 20;
        const needsPurchase =
          acc.stock_quantity <= minAlert || committedUnits > acc.stock_quantity;

        return {
          accessory: acc,
          committedUnits,
          needsPurchase,
        };
      })
      .filter((item) => item.needsPurchase);
  }, [accessories, activePaidOrders, products]);

  // Salvar ou Atualizar Recurso (Chaveiro, Gota de Silicone, etc.)
  const handleSaveAccessory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;

    const payload: Accessory = {
      id: editingAccId || `acc-${Date.now()}`,
      code: accCode.trim(),
      name: accName.trim(),
      category: accCategory,
      unit_label: accUnitLabel.trim() || "un.",
      supplier: accSupplier.trim() || "Fornecedor Padrão",
      purchase_date: new Date().toISOString().slice(0, 10),
      pack_price: Number(packPrice),
      pack_quantity: Number(packQty),
      stock_quantity: Number(stockQty),
      min_stock_alert: Number(minStockAlert),
      unit_cost: Number((packPrice / Math.max(1, packQty)).toFixed(4)),
      active: true,
    };

    await addOrUpdateAccessory(payload);
    setEditingAccId(null);
    setAccName("");
    setAccCode(`ACC-REC-0${accessories.length + 2}`);
  };

  const handleEditAccessory = (acc: Accessory) => {
    setEditingAccId(acc.id);
    setAccCode(acc.code);
    setAccName(acc.name);
    setAccCategory(acc.category || "chaveiro");
    setAccUnitLabel(acc.unit_label || "un.");
    setAccSupplier(acc.supplier || "");
    setPackPrice(acc.pack_price);
    setPackQty(acc.pack_quantity);
    setStockQty(acc.stock_quantity);
    setMinStockAlert(acc.min_stock_alert ?? 20);
  };

  const handleLoadResourcePreset = (preset: (typeof QUICK_RESOURCE_PRESETS)[0]) => {
    setEditingAccId(null);
    setAccCode(preset.code);
    setAccName(preset.name);
    setAccCategory(preset.category);
    setAccUnitLabel(preset.unit_label);
    setPackPrice(preset.pack_price);
    setPackQty(preset.pack_quantity);
    setStockQty(preset.pack_quantity);
    setMinStockAlert(preset.min_stock_alert);
  };

  // Salvar ou Atualizar Bobina de Filamento
  const handleSaveFilament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colorName.trim()) return;
    const cleanBrand = brand.trim() || "Voolt3D";

    // Se digitou uma marca nova que não existia, adiciona automaticamente à lista em cascata!
    if (
      !availableBrands.some((b) => b.toLowerCase() === cleanBrand.toLowerCase())
    ) {
      setCustomBrands((prev) => [...prev, cleanBrand]);
    }

    const newFil: Filament = {
      id: editingFilId || `fil-${Date.now()}`,
      code: code.trim(),
      brand: cleanBrand,
      material: material.trim(),
      color_name: colorName.trim(),
      hex_code: hexCode,
      purchase_date: purchaseDate || new Date().toISOString().slice(0, 10),
      purchase_price: Number(purchasePrice),
      initial_weight_grams: Number(initialWeight),
      remaining_weight_grams: isOnOrder ? 0 : Number(remainingWeight),
      cost_per_gram: Number((purchasePrice / Math.max(1, initialWeight)).toFixed(4)),
      is_on_order_color: isOnOrder,
      restock_lead_time_days: 3,
      active: true,
    };
    await addOrUpdateFilament(newFil);
    setEditingFilId(null);
    setColorName("");
    setIsBrandDropdownOpen(false);
    setCode(`PLA-${cleanBrand.slice(0, 3).toUpperCase()}-0${filaments.length + 2}`);
  };

  const handleEditFilament = (fil: Filament) => {
    setEditingFilId(fil.id);
    setCode(fil.code);
    setBrand(fil.brand);
    setPurchaseDate(fil.purchase_date || new Date().toISOString().slice(0, 10));
    setMaterial(fil.material);
    setColorName(fil.color_name);
    syncAllColorFormatsFromHex(fil.hex_code);
    setPurchasePrice(fil.purchase_price);
    setInitialWeight(fil.initial_weight_grams);
    setRemainingWeight(fil.remaining_weight_grams);
    setIsOnOrder(fil.is_on_order_color);
  };

  return (
    <div className="min-h-screen bg-linho">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Cabeçalho do Gerenciador de Recursos + Filtro Rápido */}
        <section className="bg-areia border border-borda rounded-3xl p-6 shadow-atelier flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-widest text-terracota font-bold">
              Gerenciador Central de Recursos • Impacto Automático no Custo dos Produtos
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-musgo">
              Recursos de Produção: Ferragens de Chaveiro, Gotas de Silicone & Filamentos
            </h1>
            <p className="text-xs text-oliva mt-1">
              Qualquer alteração no valor do pacote de argolas, gotas de silicone, ímãs ou
              bobinas recalcula automaticamente o custo de produção de todas as peças do
              catálogo!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === "all"
                  ? "bg-musgo text-linho shadow-sm"
                  : "bg-linho text-musgo border border-borda"
              }`}
            >
              Visão Completa
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("printers")}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === "printers"
                  ? "bg-musgo text-linho shadow-sm"
                  : "bg-linho text-musgo border border-borda"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Impressoras 3D ({printers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("accessories")}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === "accessories"
                  ? "bg-musgo text-linho shadow-sm"
                  : "bg-linho text-musgo border border-borda"
              }`}
            >
              Chaveiros, Silicone & Insumos ({accessories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("filaments")}
              className={`px-4 py-2.5 rounded-2xl text-xs font-semibold transition ${
                activeTab === "filaments"
                  ? "bg-musgo text-linho shadow-sm"
                  : "bg-linho text-musgo border border-borda"
              }`}
            >
              Bobinas de Filamento ({filaments.length})
            </button>
          </div>
        </section>

        {/* BLOCO 0: PARQUE DE IMPRESSORAS 3D (Cálculo Automático de Depreciação R$/h e Potência W) */}
        {(activeTab === "all" || activeTab === "printers") && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de Impressoras Cadastradas */}
            <div className="lg:col-span-7 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-4">
              <div className="flex items-center justify-between border-b border-borda pb-3">
                <div>
                  <h2 className="text-xl font-serif font-bold text-musgo flex items-center gap-2">
                    <Printer className="w-5 h-5 text-terracota" />
                    <span>Minhas Impressoras 3D (Parque de Máquinas)</span>
                  </h2>
                  <p className="text-xs text-oliva">
                    O valor pago na impressora dividido pela vida útil alimenta automaticamente a depreciação (R$/h) no Catálogo!
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {printers.map((p) => (
                  <div
                    key={p.id}
                    className="bg-linho border-2 border-argila/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-musgo text-linho text-[10px] font-bold">
                          {p.code}
                        </span>
                        <span className="text-base font-serif font-bold text-musgo">
                          {p.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-terracota/15 text-terracota text-[11px] font-semibold">
                          {p.brand} • {p.model}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-oliva">
                        <span>
                          Valor pago:{" "}
                          <strong className="text-musgo">
                            R$ {p.purchase_price.toFixed(2).replace(".", ",")}
                          </strong>
                        </span>
                        <span>
                          Vida útil:{" "}
                          <strong className="text-musgo">
                            {p.lifespan_hours.toLocaleString("pt-BR")} h
                          </strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-terracota" />
                          Potência média:{" "}
                          <strong className="text-musgo">
                            {p.average_power_watts} W
                          </strong>
                        </span>
                        {p.purchase_date && (
                          <span>
                            Compra:{" "}
                            <strong className="text-musgo">
                              {new Date(
                                p.purchase_date + "T12:00:00"
                              ).toLocaleDateString("pt-BR")}
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-borda">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-oliva">
                          Depreciação / Hora
                        </div>
                        <div className="text-xl font-serif font-bold text-terracota">
                          R$ {p.hourly_depreciation_cost.toFixed(2).replace(".", ",")}/h
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditPrinter(p)}
                          className="p-2 rounded-xl bg-areia hover:bg-borda/60 text-musgo border border-borda transition"
                          title="Editar Impressora"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {printers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deletePrinter(p.id)}
                            className="p-2 rounded-xl bg-areia hover:bg-terracota hover:text-white text-oliva border border-borda transition"
                            title="Remover Impressora"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Formulário de Cadastro / Edição de Impressora 3D */}
            <form
              onSubmit={handleSavePrinter}
              className="lg:col-span-5 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-4"
            >
              <div className="border-b border-borda pb-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-terracota font-bold">
                    {editingPrinterId
                      ? "Editando Máquina Selecionada"
                      : "Adicionar Nova Impressora ao Atelier"}
                  </span>
                  <h3 className="text-lg font-serif font-bold text-musgo">
                    {editingPrinterId
                      ? "Atualizar Impressora 3D"
                      : "Cadastrar Impressora 3D"}
                  </h3>
                </div>
                {editingPrinterId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPrinterId(null);
                      setPrinterName("");
                    }}
                    className="text-xs underline text-oliva hover:text-musgo"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    required
                    value={printerCode}
                    onChange={(e) => setPrinterCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs font-bold text-musgo"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Nome da Máquina no Atelier
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Bambu Lab A1 Combo #01"
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs font-bold text-musgo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={printerBrand}
                    onChange={(e) => setPrinterBrand(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={printerModel}
                    onChange={(e) => setPrinterModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Data Compra
                  </label>
                  <input
                    type="date"
                    value={printerPurchaseDate}
                    onChange={(e) => setPrinterPurchaseDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Valor Pago (R$)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step="50"
                    required
                    value={printerPrice}
                    onChange={(e) => setPrinterPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs font-bold text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Vida Útil (h)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step="500"
                    required
                    value={printerLifespanHours}
                    onChange={(e) => setPrinterLifespanHours(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs font-bold text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Manutenção (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={printerMaintPercent}
                    onChange={(e) => setPrinterMaintPercent(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs font-bold text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-oliva mb-1">
                    Potência (W)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={1000}
                    value={printerPowerWatts}
                    onChange={(e) => setPrinterPowerWatts(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs font-bold text-musgo"
                  />
                </div>
              </div>

              <div className="bg-linho p-3.5 rounded-2xl border border-borda flex items-center justify-between">
                <div className="text-xs text-oliva">
                  Depreciação calculada ({printerPrice.toLocaleString("pt-BR")} ÷{" "}
                  {printerLifespanHours}h):
                </div>
                <div className="text-lg font-serif font-bold text-terracota">
                  R$ {previewPrinterHourlyCost.toFixed(2).replace(".", ",")}/hora
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-terracota hover:bg-terracota-hover text-white text-xs font-bold shadow-sm transition"
              >
                {editingPrinterId
                  ? "Salvar Alterações da Impressora"
                  : "+ Cadastrar Impressora no Atelier"}
              </button>
            </form>
          </section>
        )}

        {/* BLOCO 1: GERENCIADOR DE RECURSOS / INSUMOS DE ACABAMENTO (CHAVEIRO, GOTA DE SILICONE, ETC.) */}
        {(activeTab === "all" || activeTab === "accessories") && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de Recursos Cadastrados e Vínculo com Custo dos Produtos */}
            <div className="lg:col-span-7 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-5">
              <div className="flex items-center justify-between border-b border-borda pb-3">
                <div>
                  <h2 className="text-xl font-serif font-bold text-musgo flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-terracota" />
                    <span>
                      Insumos & Componentes (Chaveiros, Gotas de Silicone, Ímãs, LED)
                    </span>
                  </h2>
                  <p className="text-xs text-oliva">
                    Estes itens entram diretamente na Ficha Técnica e no Custo de Produção
                    das peças
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {accessories.map((acc) => {
                  // Descobre quais produtos do catálogo utilizam este recurso
                  const linkedProducts = products.filter((p) =>
                    (p.accessories || []).some((pa) => pa.accessory_id === acc.id)
                  );
                  const isLowStock = acc.stock_quantity <= (acc.min_stock_alert ?? 20);

                  return (
                    <div
                      key={acc.id}
                      className={`bg-linho border rounded-2xl p-4 space-y-3 transition ${
                        editingAccId === acc.id
                          ? "border-2 border-terracota shadow-md"
                          : "border-borda"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-areia border border-borda text-oliva">
                              {acc.code}
                            </span>
                            <h3 className="font-serif font-bold text-lg text-musgo">
                              {acc.name}
                            </h3>
                            {isLowStock && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-terracota text-white">
                                Repor Estoque
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-oliva flex flex-wrap items-center gap-3">
                            <span>
                              Pacote:{" "}
                              <strong className="text-musgo">
                                R$ {acc.pack_price.toFixed(2).replace(".", ",")}
                              </strong>{" "}
                              c/ {acc.pack_quantity} {acc.unit_label || "un."}
                            </span>
                            <span>•</span>
                            <span className="px-2 py-0.5 rounded-lg bg-terracota/10 text-terracota font-bold">
                              Custo no Produto: R${" "}
                              {acc.unit_cost.toFixed(2).replace(".", ",")}/
                              {acc.unit_label || "un."}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right mr-2">
                            <span className="text-[10px] uppercase text-oliva block">
                              Saldo Atual
                            </span>
                            <span
                              className={`text-lg font-serif font-bold ${
                                isLowStock ? "text-terracota" : "text-musgo"
                              }`}
                            >
                              {acc.stock_quantity} {acc.unit_label || "un."}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => restockAccessory(acc.id, acc.pack_quantity)}
                            title={`Adicionar +1 pacote (+${acc.pack_quantity} un.) ao estoque`}
                            className="px-3 py-2 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-xs font-semibold text-musgo transition"
                          >
                            +{acc.pack_quantity}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEditAccessory(acc)}
                            title="Editar custo ou quantidade deste recurso"
                            className="p-2 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-musgo transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirm(
                                  `Excluir o recurso "${acc.name}"? Ele será removido da ficha técnica dos produtos.`
                                )
                              ) {
                                deleteAccessory(acc.id);
                              }
                            }}
                            title="Excluir recurso"
                            className="p-2 rounded-xl bg-areia hover:bg-terracota/15 border border-borda text-oliva hover:text-terracota transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Mostra em quais produtos este recurso entra no custo */}
                      <div className="pt-2 border-t border-borda/60 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-oliva font-medium">
                          Entra no custo de ({linkedProducts.length} produtos):
                        </span>
                        {linkedProducts.length === 0 ? (
                          <span className="text-oliva italic">
                            Ainda não vinculado — vincule em Catálogo & Custos
                          </span>
                        ) : (
                          linkedProducts.map((p) => {
                            const itemSpec = p.accessories.find(
                              (pa) => pa.accessory_id === acc.id
                            );
                            const q = itemSpec?.quantity || 1;
                            const totalItemCost = q * acc.unit_cost;
                            return (
                              <span
                                key={p.id}
                                className="px-2 py-0.5 rounded-full bg-areia border border-borda text-musgo font-medium"
                              >
                                {p.name.split(" ")[0]} ({q}x = R${" "}
                                {totalItemCost.toFixed(2).replace(".", ",")})
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Formulário Completo de Criação / Edição de Recurso (Chaveiro, Gota de Silicone, etc.) */}
            <form
              onSubmit={handleSaveAccessory}
              className="lg:col-span-5 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-4 h-fit"
            >
              <div className="flex items-center justify-between border-b border-borda pb-3">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-terracota font-bold">
                    {editingAccId ? "Editando Recurso" : "Novo Recurso de Custo"}
                  </span>
                  <h3 className="text-xl font-serif font-bold text-musgo">
                    {editingAccId
                      ? "Atualizar Recurso / Insumo"
                      : "Cadastrar Chaveiro, Silicone ou Insumo"}
                  </h3>
                </div>
                {editingAccId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccId(null);
                      setAccName("");
                    }}
                    className="text-xs text-terracota underline font-semibold"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              {/* Atalhos de 1 Clique para Recursos Típicos */}
              <div>
                <span className="text-[11px] text-oliva font-semibold block mb-1.5">
                  Modelos Rápidos (1 clique para preencher):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_RESOURCE_PRESETS.map((preset) => (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => handleLoadResourcePreset(preset)}
                      className="px-2.5 py-1 rounded-lg bg-linho hover:bg-borda/50 border border-borda text-[11px] font-medium text-musgo transition"
                    >
                      + {preset.name.split(" (")[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    required
                    value={accCode}
                    onChange={(e) => setAccCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Tipo de Recurso
                  </label>
                  <select
                    value={accCategory}
                    onChange={(e) => setAccCategory(e.target.value as AccessoryCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo font-semibold"
                  >
                    {RESOURCE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-oliva font-semibold mb-1">
                  Nome do Recurso (Ex: Argola Chaveiro, Gota de Silicone Base)
                </label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Ex: Gota de Silicone 10mm Antiderrapante"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-linho border border-borda text-sm text-musgo font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Preço Pago Pacote (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={packPrice}
                    onChange={(e) => setPackPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Qtd no Pacote
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={packQty}
                    onChange={(e) => setPackQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Unidade
                  </label>
                  <input
                    type="text"
                    value={accUnitLabel}
                    onChange={(e) => setAccUnitLabel(e.target.value)}
                    placeholder="un., gota, kit"
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Estoque Atual Disponível
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-sm font-bold text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Alerta Estoque Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minStockAlert}
                    onChange={(e) => setMinStockAlert(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-sm text-musgo"
                  />
                </div>
              </div>

              {/* Preview do Custo Unitário Calculado Automaticamente */}
              <div className="bg-linho p-3.5 rounded-2xl border border-argila flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-musgo">
                  <Calculator className="w-4 h-4 text-terracota" />
                  <span>Custo Unitário Calculado Automaticamente:</span>
                </div>
                <span className="text-lg font-serif font-bold text-terracota">
                  R$ {previewUnitCost.toFixed(2).replace(".", ",")} /{" "}
                  {accUnitLabel || "un."}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white text-sm font-semibold shadow-sm transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {editingAccId
                    ? "Salvar Alterações e Recalcular Produtos"
                    : "Adicionar Recurso ao Gerenciador"}
                </span>
              </button>
            </form>
          </section>
        )}

        {/* BLOCO 2: LISTA DE COMPRAS AUTOMÁTICA UNIFICADA (BOBINAS + CHAVEIROS/SILICONE) */}
        <section className="bg-areia border-2 border-terracota/50 rounded-3xl p-6 shadow-atelier space-y-4">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-terracota text-white">
              <ShoppingCart className="w-6 h-6" />
            </span>
            <div>
              <span className="text-xs uppercase tracking-widest text-terracota font-bold">
                Alerta Inteligente de Reposição • Feira TCE
              </span>
              <h2 className="text-2xl font-serif font-bold text-musgo">
                Lista de Compras Automática (
                {filamentShoppingList.length + accessoryShoppingList.length} itens)
              </h2>
              <p className="text-xs text-oliva">
                Calcula gramas de filamento e unidades de chaveiro/silicone comprometidos
                nos pedidos já pagos na feira.
              </p>
            </div>
          </div>

          {filamentShoppingList.length === 0 && accessoryShoppingList.length === 0 ? (
            <div className="bg-linho p-4 rounded-2xl border border-borda text-xs text-musgo flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-musgo" />
              <span>
                Todos os filamentos, chaveiros e gotas de silicone possuem estoque suficiente
                para a fila atual!
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filamentShoppingList.map((item) => (
                <div
                  key={item.filament.id}
                  className="bg-linho border border-borda rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-8 h-8 rounded-full border-2 border-musgo/30 shrink-0 mt-0.5"
                      style={{ backgroundColor: item.filament.hex_code }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-base text-musgo">
                          Bobina: {item.filament.color_name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-terracota/15 text-terracota font-bold">
                          {item.filament.is_on_order_color ? "Sob Encomenda" : "Estoque Baixo"}
                        </span>
                      </div>
                      <div className="text-xs text-oliva mt-0.5">
                        Em casa: <strong>{item.filament.remaining_weight_grams}g</strong> •
                        Comprometido: <strong>{item.committedGrams}g</strong>
                      </div>
                      <div className="text-xs text-musgo font-semibold mt-0.5">
                        Caixa recebido nestes pedidos: R${" "}
                        {item.revenueGeneratedByColor.toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => restockFilament(item.filament.id, 1000)}
                    className="px-3.5 py-2 rounded-xl bg-musgo text-linho text-xs font-semibold shrink-0 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>+1kg Bobina</span>
                  </button>
                </div>
              ))}

              {accessoryShoppingList.map((item) => (
                <div
                  key={item.accessory.id}
                  className="bg-linho border border-borda rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-base text-musgo">
                        Recurso: {item.accessory.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-terracota/15 text-terracota font-bold">
                        Repor Pacote
                      </span>
                    </div>
                    <div className="text-xs text-oliva mt-0.5">
                      Saldo: <strong>{item.accessory.stock_quantity} un.</strong> •
                      Comprometido na fila: <strong>{item.committedUnits} un.</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      restockAccessory(item.accessory.id, item.accessory.pack_quantity)
                    }
                    className="px-3.5 py-2 rounded-xl bg-terracota text-white text-xs font-semibold shrink-0 flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>+{item.accessory.pack_quantity} un.</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* BLOCO 3: GERENCIADOR DE BOBINAS DE FILAMENTO */}
        {(activeTab === "all" || activeTab === "filaments") && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-4">
              <h2 className="text-xl font-serif font-bold text-musgo flex items-center gap-2">
                <Layers className="w-5 h-5 text-terracota" />
                <span>Bobinas de Filamento ({filaments.length})</span>
              </h2>

              <div className="space-y-3">
                {filaments.map((fil) => {
                  const pct = Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round(
                        (fil.remaining_weight_grams / (fil.initial_weight_grams || 1000)) *
                          100
                      )
                    )
                  );
                  return (
                    <div
                      key={fil.id}
                      className={`bg-linho border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 ${
                        editingFilId === fil.id
                          ? "border-2 border-terracota"
                          : "border-borda"
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className="w-8 h-8 rounded-full border-2 border-musgo/25 shrink-0"
                          style={{ backgroundColor: fil.hex_code }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-oliva">{fil.code}</span>
                            <span className="font-serif font-bold text-lg text-musgo">
                              {fil.color_name}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-areia border border-borda text-oliva">
                              {fil.brand} • {fil.material}
                            </span>
                          </div>
                          <div className="text-xs text-oliva mt-0.5 flex flex-wrap items-center gap-2">
                            <span>
                              Rolo: R$ {fil.purchase_price.toFixed(2).replace(".", ",")}
                            </span>
                            <span>•</span>
                            <span>
                              Compra:{" "}
                              {fil.purchase_date
                                ? fil.purchase_date.split("-").reverse().join("/")
                                : "—"}
                            </span>
                            <span>•</span>
                            <strong className="text-terracota">
                              Custo no Produto: R${" "}
                              {fil.cost_per_gram.toFixed(3).replace(".", ",")}/g
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="w-32 mr-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-oliva">Saldo:</span>
                            <span className="font-bold text-musgo">
                              {fil.remaining_weight_grams}g
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-areia overflow-hidden border border-borda">
                            <div
                              className={`h-full ${
                                pct < 20 ? "bg-terracota" : "bg-musgo"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => restockFilament(fil.id, 1000)}
                          className="px-3 py-2 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-xs font-semibold text-musgo"
                        >
                          +1kg
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditFilament(fil)}
                          className="p-2 rounded-xl bg-areia hover:bg-borda/50 border border-borda text-musgo"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remover a bobina "${fil.color_name}"?`)) {
                              deleteFilament(fil.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-areia hover:bg-terracota/15 border border-borda text-oliva hover:text-terracota"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <form
              onSubmit={handleSaveFilament}
              className="lg:col-span-4 bg-areia border border-borda rounded-3xl p-6 shadow-atelier space-y-4 h-fit"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-serif font-bold text-musgo">
                  {editingFilId ? "Editar Bobina" : "Nova Bobina de Filamento"}
                </h3>
                {editingFilId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFilId(null);
                      setColorName("");
                    }}
                    className="text-xs text-terracota underline font-semibold"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-terracota" />
                    <span>Data da Compra</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo font-medium"
                  />
                </div>
              </div>

              {/* Campo Marca com Cascata das Principais + Criação Automática ao Digitar */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-oliva font-semibold">
                    Marca do Filamento (Selecione ou Digite uma Nova)
                  </label>
                  {!brandExistsInList && brand.trim() && (
                    <span className="text-[10px] font-bold text-terracota">
                      ✨ Nova marca será adicionada à lista!
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    value={brand}
                    onFocus={() => setIsBrandDropdownOpen(true)}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      setIsBrandDropdownOpen(true);
                    }}
                    placeholder="Escolha na lista ou digite nova marca..."
                    className="w-full pl-3 pr-9 py-2.5 rounded-xl bg-linho border border-borda text-xs font-semibold text-musgo focus:outline-none focus:ring-2 focus:ring-argila"
                  />
                  <button
                    type="button"
                    onClick={() => setIsBrandDropdownOpen((v) => !v)}
                    className="absolute right-2 top-2 p-1 text-oliva hover:text-musgo"
                    title="Abrir lista de marcas"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {isBrandDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-2xl bg-linho border-2 border-borda shadow-atelier-lg p-1.5 space-y-1">
                    {!brandExistsInList && brand.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          const newB = brand.trim();
                          setCustomBrands((prev) => [...prev, newB]);
                          setBrand(newB);
                          setIsBrandDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-terracota text-white text-xs font-bold flex items-center justify-between"
                      >
                        <span>+ Criar marca &quot;{brand.trim()}&quot;</span>
                        <span className="text-[10px] opacity-90">Salvar na cascata</span>
                      </button>
                    )}

                    {availableBrands.map((b) => {
                      const isSelected = b.toLowerCase() === brand.trim().toLowerCase();
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setBrand(b);
                            setIsBrandDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                            isSelected
                              ? "bg-musgo text-linho font-semibold"
                              : "text-musgo hover:bg-areia"
                          }`}
                        >
                          <span>{b}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Nome da Cor
                  </label>
                  <input
                    type="text"
                    required
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    placeholder="Ex: Verde Sálvia Silk"
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo"
                  />
                </div>

                {/* Seletor Multi-Formato de Cor da Bobina: HEX, RGB e CMYK */}
                <div className="p-3 rounded-2xl bg-linho border border-borda space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-oliva">
                      Cor da Bobina ({hexCode})
                    </span>
                    <div className="flex items-center gap-1 bg-areia p-0.5 rounded-xl border border-borda">
                      {(["hex", "rgb", "cmyk"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setColorInputMode(mode)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition ${
                            colorInputMode === mode
                              ? "bg-musgo text-linho shadow-sm"
                              : "text-oliva hover:text-musgo"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Seletor visual de cor + Amostra ao vivo */}
                    <input
                      type="color"
                      value={hexCode}
                      onChange={(e) => syncAllColorFormatsFromHex(e.target.value)}
                      title="Clique para abrir a paleta visual"
                      className="w-11 h-10 rounded-xl bg-areia border border-borda cursor-pointer shrink-0 p-0.5"
                    />

                    {/* Modo 1: Digitar/Colar HEX direto */}
                    {colorInputMode === "hex" && (
                      <div className="flex-1">
                        <input
                          type="text"
                          value={hexTextInput}
                          maxLength={7}
                          onChange={(e) => {
                            const val = e.target.value;
                            setHexTextInput(val);
                            const clean = val.replace(/[^0-9a-fA-F]/g, "");
                            if (clean.length === 6) {
                              syncAllColorFormatsFromHex(clean);
                            }
                          }}
                          placeholder="#A3522B"
                          className="w-full px-3 py-2 rounded-xl bg-areia border border-borda text-xs font-mono font-bold text-musgo uppercase"
                        />
                      </div>
                    )}

                    {/* Modo 2: Digitar R, G, B (0-255) */}
                    {colorInputMode === "rgb" && (
                      <div className="flex-1 grid grid-cols-3 gap-1.5">
                        <div>
                          <span className="block text-[9px] text-oliva font-bold uppercase mb-0.5">
                            R
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={rgbInput.r}
                            onChange={(e) =>
                              updateColorFromRgb({
                                ...rgbInput,
                                r: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-areia border border-borda text-xs font-mono font-bold text-musgo text-center"
                          />
                        </div>
                        <div>
                          <span className="block text-[9px] text-oliva font-bold uppercase mb-0.5">
                            G
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={rgbInput.g}
                            onChange={(e) =>
                              updateColorFromRgb({
                                ...rgbInput,
                                g: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-areia border border-borda text-xs font-mono font-bold text-musgo text-center"
                          />
                        </div>
                        <div>
                          <span className="block text-[9px] text-oliva font-bold uppercase mb-0.5">
                            B
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={rgbInput.b}
                            onChange={(e) =>
                              updateColorFromRgb({
                                ...rgbInput,
                                b: Number(e.target.value),
                              })
                            }
                            className="w-full px-2 py-1.5 rounded-lg bg-areia border border-borda text-xs font-mono font-bold text-musgo text-center"
                          />
                        </div>
                      </div>
                    )}

                    {/* Modo 3: Digitar C, M, Y, K (0-100%) */}
                    {colorInputMode === "cmyk" && (
                      <div className="flex-1 grid grid-cols-4 gap-1">
                        <div>
                          <span className="block text-[9px] text-oliva font-bold uppercase mb-0.5">
                            C%
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={cmykInput.c}
                            onChange={(e) =>
                              updateColorFromCmyk({
                                ...cmykInput,
                                c: Number(e.target.value),
                              })
                            }
                            className="w-full px-1.5 py-1.5 rounded-lg bg-areia border border-borda text-xs font-mono font-bold text-musgo text-center"
                          />
                        </div>
                        <div>
                          <span className="block text-[9px] text-oliva font-bold uppercase mb-0.5">
                            M%
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={cmykInput.m}
                            onChange={(e) =>
                              updateColorFromCmyk({
                                ...cmykInput,
                                m: Number(e.target.value),
                              })
                            }
                            className="w-full px-1.5 py-1.5 rounded-lg bg-areia border border-borda text-xs font-mono font-bold text-musgo text-center"
                          />
                        </div>
                        <div>
                          <span className="block text-[9px] text-oliva font-bold uppercase mb-0.5">
                            Y%
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={cmykInput.y}
                            onChange={(e) =>
                              updateColorFromCmyk({
                                ...cmykInput,
                                y: Number(e.target.value),
                              })
                            }
                            className="w-full px-1.5 py-1.5 rounded-lg bg-areia border border-borda text-xs font-mono font-bold text-musgo text-center"
                          />
                        </div>
                        <div>
                          <span className="block text-[9px] text-oliva font-bold uppercase mb-0.5">
                            K%
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={cmykInput.k}
                            onChange={(e) =>
                              updateColorFromCmyk({
                                ...cmykInput,
                                k: Number(e.target.value),
                              })
                            }
                            className="w-full px-1.5 py-1.5 rounded-lg bg-areia border border-borda text-xs font-mono font-bold text-musgo text-center"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-oliva flex items-center justify-between pt-0.5">
                    <span>HEX: {hexCode}</span>
                    <span>
                      RGB({rgbInput.r}, {rgbInput.g}, {rgbInput.b})
                    </span>
                    <span>
                      CMYK({cmykInput.c}%, {cmykInput.m}%, {cmykInput.y}%, {cmykInput.k}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Material
                  </label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo"
                  >
                    <option value="PLA">PLA</option>
                    <option value="PLA Silk">PLA Silk</option>
                    <option value="PETG">PETG</option>
                    <option value="TPU">TPU</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Valor do Rolo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Peso Inicial (g)
                  </label>
                  <input
                    type="number"
                    value={initialWeight}
                    onChange={(e) => setInitialWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Gramas Restantes
                  </label>
                  <input
                    type="number"
                    disabled={isOnOrder}
                    value={isOnOrder ? 0 : remainingWeight}
                    onChange={(e) => setRemainingWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-linho border border-borda text-xs text-musgo disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="bg-linho p-3 rounded-xl border border-borda flex items-center justify-between text-xs">
                <span className="text-oliva">Custo por grama:</span>
                <strong className="text-terracota">
                  R$ {previewGramCost.toFixed(3).replace(".", ",")}/g
                </strong>
              </div>

              <label className="flex items-center gap-2 text-xs text-musgo cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOnOrder}
                  onChange={(e) => setIsOnOrder(e.target.checked)}
                  className="rounded text-terracota"
                />
                <span>Cor Sob Encomenda (0g em casa)</span>
              </label>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-musgo hover:bg-musgo/90 text-linho text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{editingFilId ? "Salvar Bobina" : "Adicionar Bobina"}</span>
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
