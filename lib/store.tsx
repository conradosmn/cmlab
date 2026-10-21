"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  Accessory,
  Filament,
  PaymentStatus,
  PixSettings,
  Printer3D,
  PrintQueueOrder,
  Product,
  QueueStatus,
} from "./types";
import {
  INITIAL_ACCESSORIES,
  INITIAL_FILAMENTS,
  INITIAL_ORDERS,
  INITIAL_PRINTERS,
  INITIAL_PRODUCTS,
} from "./seedData";
import { buildSmartScheduleA1 } from "./queueScheduler";
import { calculate3DCosts } from "./costCalculator";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

interface CMLabStoreContextValue {
  printers: Printer3D[];
  filaments: Filament[];
  accessories: Accessory[];
  products: Product[];
  orders: PrintQueueOrder[];
  scheduledOrders: PrintQueueOrder[];
  nextDeliveryEstimate: Date;
  pixSettings: PixSettings;
  isLoaded: boolean;

  // Actions
  updatePixSettings: (settings: PixSettings) => Promise<void>;
  clearDemoOrdersAndProducts: () => Promise<void>;
  addOrder: (
    orderInput: Omit<
      PrintQueueOrder,
      "id" | "order_number" | "created_at" | "cooldown_minutes" | "is_night_owl_slot"
    >
  ) => Promise<PrintQueueOrder>;
  confirmOrderPayment: (orderId: string, mpPaymentId?: string) => Promise<void>;
  updateOrderQueueStatus: (orderId: string, status: QueueStatus) => Promise<void>;
  markOrderMaterialReady: (orderId: string) => Promise<void>;

  addOrUpdatePrinter: (printer: Printer3D) => Promise<void>;
  deletePrinter: (printerId: string) => Promise<void>;

  addOrUpdateFilament: (filament: Filament) => Promise<void>;
  deleteFilament: (filamentId: string) => Promise<void>;
  restockFilament: (filamentId: string, addedGrams: number, newPrice?: number) => Promise<void>;

  addOrUpdateAccessory: (accessory: Accessory) => Promise<void>;
  deleteAccessory: (accessoryId: string) => Promise<void>;
  restockAccessory: (accessoryId: string, addedUnits: number, newPackPrice?: number) => Promise<void>;

  addOrUpdateProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

const CMLabStoreContext = createContext<CMLabStoreContextValue | null>(null);

function recalculateProductsCost(
  currentProducts: Product[],
  currentFilaments: Filament[],
  currentAccessories: Accessory[],
  currentPrinters: Printer3D[] = INITIAL_PRINTERS
): Product[] {
  const activePrinter =
    currentPrinters.find((p) => p.active) || currentPrinters[0] || INITIAL_PRINTERS[0];
  const machineHourCost = activePrinter?.hourly_depreciation_cost ?? 0.56;
  const powerWatts = activePrinter?.average_power_watts ?? 150;

  return currentProducts.map((prod) => {
    const allowedFils = currentFilaments.filter((f) =>
      prod.allowed_filament_ids.includes(f.id)
    );
    const avgCostPerGram =
      allowedFils.length > 0
        ? allowedFils.reduce((acc, f) => acc + f.cost_per_gram, 0) / allowedFils.length
        : currentFilaments[0]?.cost_per_gram || 0.12;

    const accInputs = (prod.accessories || []).map((pa) => {
      const found = currentAccessories.find((a) => a.id === pa.accessory_id);
      return {
        quantity: pa.quantity,
        unitCost: found?.unit_cost || 0,
      };
    });

    const breakdown = calculate3DCosts({
      filamentSegments: [{ weightGrams: prod.weight_grams, costPerGram: avgCostPerGram }],
      printTimeMinutes: prod.print_time_minutes,
      a1AveragePowerWatts: powerWatts,
      machineHourCostBrl: machineHourCost,
      accessories: accInputs,
      salePriceBrl: prod.price,
    });

    return {
      ...prod,
      production_cost: breakdown.totalProductionCost,
    };
  });
}

function applySmartScheduleToOrders(allOrders: PrintQueueOrder[]): PrintQueueOrder[] {
  const activeQueueInputs = allOrders
    .filter(
      (o) =>
        o.payment_status === "paid" &&
        (o.queue_status === "queued" || o.queue_status === "printing")
    )
    .map((o) => ({
      id: o.id,
      product_name: o.product_title_snapshot,
      print_time_minutes: o.print_time_minutes,
      material_ready: o.material_ready,
      created_at: new Date(o.created_at),
    }));

  const scheduled = buildSmartScheduleA1(activeQueueInputs, new Date());
  const scheduleMap = new Map(scheduled.map((s) => [s.id, s]));

  return allOrders.map((order) => {
    const slot = scheduleMap.get(order.id);
    const cooldown = order.print_time_minutes > 360 ? 120 : 15;
    if (slot) {
      return {
        ...order,
        cooldown_minutes: slot.cooldown_after_minutes,
        is_night_owl_slot: slot.is_night_owl_slot,
        estimated_start_at: slot.estimated_start_at.toISOString(),
        estimated_finish_at: slot.estimated_finish_at.toISOString(),
      };
    }
    return {
      ...order,
      cooldown_minutes: cooldown,
    };
  });
}

export function CMLabProvider({ children }: { children: React.ReactNode }) {
  const [printers, setPrinters] = useState<Printer3D[]>(INITIAL_PRINTERS);
  const [filaments, setFilaments] = useState<Filament[]>(INITIAL_FILAMENTS);
  const [accessories, setAccessories] = useState<Accessory[]>(INITIAL_ACCESSORIES);
  const [products, setProducts] = useState<Product[]>(() =>
    recalculateProductsCost(
      INITIAL_PRODUCTS,
      INITIAL_FILAMENTS,
      INITIAL_ACCESSORIES,
      INITIAL_PRINTERS
    )
  );
  const [orders, setOrders] = useState<PrintQueueOrder[]>(() =>
    applySmartScheduleToOrders(INITIAL_ORDERS)
  );
  const [pixSettings, setPixSettings] = useState<PixSettings>({
    pixKey: process.env.NEXT_PUBLIC_PIX_KEY || "eng.conradosmn@gmail.com",
    keyType: "email",
    merchantName: "Conrado de Sampaio Machado Neto",
    merchantCity: "Teresina",
  });
  const [isLoaded, setIsLoaded] = useState(false);

  const syncFromServer = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const loadedPrinters =
        Array.isArray(data.printers) && data.printers.length > 0
          ? data.printers
          : INITIAL_PRINTERS;
      const loadedFils = data.filaments || INITIAL_FILAMENTS;
      const loadedAccs = data.accessories || INITIAL_ACCESSORIES;
      const loadedProds = data.products || INITIAL_PRODUCTS;
      setPrinters(loadedPrinters);
      setFilaments(loadedFils);
      setAccessories(loadedAccs);
      setProducts(
        recalculateProductsCost(loadedProds, loadedFils, loadedAccs, loadedPrinters)
      );
      if (data.orders) setOrders(applySmartScheduleToOrders(data.orders));
      if (data.pixSettings) setPixSettings(data.pixSettings);
      setIsLoaded(true);
    } catch {
      setIsLoaded(true);
    }
  }, []);

  const persistState = useCallback(
    async (next: {
      printers?: Printer3D[];
      filaments?: Filament[];
      accessories?: Accessory[];
      products?: Product[];
      orders?: PrintQueueOrder[];
      pixSettings?: PixSettings;
    }) => {
      try {
        await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (typeof window !== "undefined" && "BroadcastChannel" in window) {
          const bc = new BroadcastChannel("cmlab_realtime_sync");
          bc.postMessage({ type: "STATE_UPDATED", timestamp: Date.now() });
          bc.close();
        }
      } catch (e) {
        console.error("Failed to persist state", e);
      }
    },
    []
  );

  useEffect(() => {
    syncFromServer();

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      bc = new BroadcastChannel("cmlab_realtime_sync");
      bc.onmessage = () => {
        syncFromServer();
      };
    }

    // Assinatura Realtime via WebSocket do Supabase (sincroniza iPad e Celular instantaneamente!)
    let realtimeChannel: any = null;
    if (isSupabaseConfigured && supabase) {
      realtimeChannel = supabase
        .channel("cmlab-feira-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "print_queue_orders" },
          () => syncFromServer()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "filaments" },
          () => syncFromServer()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "accessories" },
          () => syncFromServer()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "products" },
          () => syncFromServer()
        )
        .subscribe();
    }

    const interval = setInterval(() => {
      syncFromServer();
    }, 3000);

    return () => {
      if (bc) bc.close();
      if (realtimeChannel && supabase) {
        supabase.removeChannel(realtimeChannel);
      }
      clearInterval(interval);
    };
  }, [syncFromServer]);

  const scheduledOrders = useMemo(() => applySmartScheduleToOrders(orders), [orders]);

  const nextDeliveryEstimate = useMemo(() => {
    const active = scheduledOrders.filter(
      (o) =>
        o.payment_status === "paid" &&
        (o.queue_status === "queued" || o.queue_status === "printing") &&
        o.estimated_finish_at
    );
    if (active.length === 0) {
      return new Date(Date.now() + 1000 * 60 * 60);
    }
    const lastFinish = active.reduce((max, o) => {
      const t = new Date(o.estimated_finish_at!).getTime();
      return t > max ? t : max;
    }, Date.now());
    return new Date(lastFinish);
  }, [scheduledOrders]);

  const deductStockOnPayment = useCallback(
    (
      order: PrintQueueOrder,
      currentFilaments: Filament[],
      currentAccessories: Accessory[],
      currentProducts: Product[]
    ) => {
      const updatedFilaments = currentFilaments.map((fil) => {
        const usedInOrder = order.selected_colors
          .filter((c) => c.filament_id === fil.id)
          .reduce((acc, c) => acc + c.weight_grams, 0);
        if (usedInOrder > 0) {
          return {
            ...fil,
            remaining_weight_grams: fil.remaining_weight_grams - usedInOrder,
          };
        }
        return fil;
      });

      const product = currentProducts.find((p) => p.id === order.product_id);
      const updatedAccessories = currentAccessories.map((acc) => {
        const specItem = product?.accessories.find((a) => a.accessory_id === acc.id);
        let usedQty = specItem ? specItem.quantity : 0;
        // Se for chaveiro personalizado com pingente extra, consome +1 ilha/elo
        if (
          order.custom_keychain_data?.charm &&
          order.custom_keychain_data.charm !== "none" &&
          acc.id === "acc-ilha"
        ) {
          usedQty += 1;
        }
        if (usedQty > 0) {
          return {
            ...acc,
            stock_quantity: Math.max(0, acc.stock_quantity - usedQty),
          };
        }
        return acc;
      });

      return { updatedFilaments, updatedAccessories };
    },
    []
  );

  const addOrder = useCallback(
    async (
      orderInput: Omit<
        PrintQueueOrder,
        "id" | "order_number" | "created_at" | "cooldown_minutes" | "is_night_owl_slot"
      >
    ) => {
      const maxNum = orders.reduce((m, o) => Math.max(m, o.order_number || 100), 100);
      const cooldown = orderInput.print_time_minutes > 360 ? 120 : 15;
      const newOrder: PrintQueueOrder = {
        ...orderInput,
        id: `ord-${Date.now()}`,
        order_number: maxNum + 1,
        cooldown_minutes: cooldown,
        is_night_owl_slot: false,
        created_at: new Date().toISOString(),
      };

      let nextFilaments = filaments;
      let nextAccessories = accessories;

      if (newOrder.payment_status === "paid") {
        const deducted = deductStockOnPayment(newOrder, filaments, accessories, products);
        nextFilaments = deducted.updatedFilaments;
        nextAccessories = deducted.updatedAccessories;
        setFilaments(nextFilaments);
        setAccessories(nextAccessories);
      }

      const nextOrders = applySmartScheduleToOrders([...orders, newOrder]);
      setOrders(nextOrders);
      await persistState({
        orders: nextOrders,
        filaments: nextFilaments,
        accessories: nextAccessories,
      });
      return newOrder;
    },
    [orders, filaments, accessories, products, deductStockOnPayment, persistState]
  );

  const confirmOrderPayment = useCallback(
    async (orderId: string, mpPaymentId?: string) => {
      const targetOrder = orders.find((o) => o.id === orderId);
      if (!targetOrder) return;

      const updatedOrder: PrintQueueOrder = {
        ...targetOrder,
        payment_status: "paid" as PaymentStatus,
        mp_payment_id: mpPaymentId || `MP-${Date.now()}`,
        queue_status: targetOrder.material_ready ? "queued" : "awaiting_material",
      };

      const { updatedFilaments, updatedAccessories } = deductStockOnPayment(
        updatedOrder,
        filaments,
        accessories,
        products
      );

      const nextOrders = applySmartScheduleToOrders(
        orders.map((o) => (o.id === orderId ? updatedOrder : o))
      );

      setFilaments(updatedFilaments);
      setAccessories(updatedAccessories);
      setOrders(nextOrders);

      await persistState({
        orders: nextOrders,
        filaments: updatedFilaments,
        accessories: updatedAccessories,
      });
    },
    [orders, filaments, accessories, products, deductStockOnPayment, persistState]
  );

  const updateOrderQueueStatus = useCallback(
    async (orderId: string, status: QueueStatus) => {
      const nextOrders = applySmartScheduleToOrders(
        orders.map((o) => (o.id === orderId ? { ...o, queue_status: status } : o))
      );
      setOrders(nextOrders);
      await persistState({ orders: nextOrders });
    },
    [orders, persistState]
  );

  const markOrderMaterialReady = useCallback(
    async (orderId: string) => {
      const nextOrders = applySmartScheduleToOrders(
        orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                material_ready: true,
                queue_status: o.payment_status === "paid" ? "queued" : o.queue_status,
              }
            : o
        )
      );
      setOrders(nextOrders);
      await persistState({ orders: nextOrders });
    },
    [orders, persistState]
  );

  const addOrUpdateFilament = useCallback(
    async (filament: Filament) => {
      const costPerGram =
        filament.initial_weight_grams > 0
          ? Number((filament.purchase_price / filament.initial_weight_grams).toFixed(4))
          : 0.11;
      const normalized = { ...filament, cost_per_gram: costPerGram };
      const exists = filaments.some((f) => f.id === normalized.id);
      const nextFilaments = exists
        ? filaments.map((f) => (f.id === normalized.id ? normalized : f))
        : [...filaments, normalized];
      const nextProducts = recalculateProductsCost(products, nextFilaments, accessories);
      setFilaments(nextFilaments);
      setProducts(nextProducts);
      await persistState({ filaments: nextFilaments, products: nextProducts });
    },
    [filaments, products, accessories, persistState]
  );

  const deleteFilament = useCallback(
    async (filamentId: string) => {
      const nextFilaments = filaments.filter((f) => f.id !== filamentId);
      const nextProducts = recalculateProductsCost(products, nextFilaments, accessories);
      setFilaments(nextFilaments);
      setProducts(nextProducts);
      await persistState({ filaments: nextFilaments, products: nextProducts });
    },
    [filaments, products, accessories, persistState]
  );

  const restockFilament = useCallback(
    async (filamentId: string, addedGrams: number, newPrice?: number) => {
      const nextFilaments = filaments.map((f) => {
        if (f.id !== filamentId) return f;
        const price = newPrice ?? f.purchase_price;
        const nextRemaining = Math.max(0, f.remaining_weight_grams) + addedGrams;
        return {
          ...f,
          purchase_price: price,
          remaining_weight_grams: nextRemaining,
          is_on_order_color: false,
          cost_per_gram: Number((price / (f.initial_weight_grams || 1000)).toFixed(4)),
        };
      });

      const nextOrders = applySmartScheduleToOrders(
        orders.map((order) => {
          if (order.queue_status !== "awaiting_material") return order;
          const allColorsNowAvailable = order.selected_colors.every((sc) => {
            const fil = nextFilaments.find((f) => f.id === sc.filament_id);
            return fil && !fil.is_on_order_color && fil.remaining_weight_grams >= sc.weight_grams;
          });
          if (allColorsNowAvailable) {
            return {
              ...order,
              material_ready: true,
              queue_status: "queued" as QueueStatus,
            };
          }
          return order;
        })
      );

      const nextProducts = recalculateProductsCost(products, nextFilaments, accessories);
      setFilaments(nextFilaments);
      setProducts(nextProducts);
      setOrders(nextOrders);
      await persistState({
        filaments: nextFilaments,
        products: nextProducts,
        orders: nextOrders,
      });
    },
    [filaments, orders, products, accessories, persistState]
  );

  const addOrUpdateAccessory = useCallback(
    async (accessory: Accessory) => {
      const unitCost =
        accessory.pack_quantity > 0
          ? Number((accessory.pack_price / accessory.pack_quantity).toFixed(4))
          : 0;
      const normalized = { ...accessory, unit_cost: unitCost };
      const exists = accessories.some((a) => a.id === normalized.id);
      const nextAccessories = exists
        ? accessories.map((a) => (a.id === normalized.id ? normalized : a))
        : [...accessories, normalized];
      const nextProducts = recalculateProductsCost(products, filaments, nextAccessories);
      setAccessories(nextAccessories);
      setProducts(nextProducts);
      await persistState({ accessories: nextAccessories, products: nextProducts });
    },
    [accessories, products, filaments, persistState]
  );

  const deleteAccessory = useCallback(
    async (accessoryId: string) => {
      const nextAccessories = accessories.filter((a) => a.id !== accessoryId);
      const cleanedProducts = products.map((p) => ({
        ...p,
        accessories: (p.accessories || []).filter((pa) => pa.accessory_id !== accessoryId),
      }));
      const nextProducts = recalculateProductsCost(cleanedProducts, filaments, nextAccessories);
      setAccessories(nextAccessories);
      setProducts(nextProducts);
      await persistState({ accessories: nextAccessories, products: nextProducts });
    },
    [accessories, products, filaments, persistState]
  );

  const restockAccessory = useCallback(
    async (accessoryId: string, addedUnits: number, newPackPrice?: number) => {
      const nextAccessories = accessories.map((acc) => {
        if (acc.id !== accessoryId) return acc;
        const packPrice = newPackPrice ?? acc.pack_price;
        const unitCost =
          acc.pack_quantity > 0 ? Number((packPrice / acc.pack_quantity).toFixed(4)) : acc.unit_cost;
        return {
          ...acc,
          pack_price: packPrice,
          unit_cost: unitCost,
          stock_quantity: Math.max(0, acc.stock_quantity) + addedUnits,
        };
      });
      const nextProducts = recalculateProductsCost(products, filaments, nextAccessories);
      setAccessories(nextAccessories);
      setProducts(nextProducts);
      await persistState({ accessories: nextAccessories, products: nextProducts });
    },
    [accessories, products, filaments, persistState]
  );

  const addOrUpdateProduct = useCallback(
    async (product: Product) => {
      const exists = products.some((p) => p.id === product.id);
      const updatedList = exists
        ? products.map((p) => (p.id === product.id ? product : p))
        : [product, ...products];
      const nextProducts = recalculateProductsCost(updatedList, filaments, accessories);
      setProducts(nextProducts);
      await persistState({ products: nextProducts });
    },
    [products, filaments, accessories, persistState]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      const nextProducts = products.filter((p) => p.id !== productId);
      setProducts(nextProducts);
      await persistState({ products: nextProducts });
    },
    [products, persistState]
  );

  const addOrUpdatePrinter = useCallback(
    async (printer: Printer3D) => {
      const lifespan = Math.max(100, printer.lifespan_hours || 8000);
      const maintMult = 1 + (printer.maintenance_reserve_percent || 0) / 100;
      const hourlyCost = Number(
        ((printer.purchase_price * maintMult) / lifespan).toFixed(2)
      );
      const normalized: Printer3D = {
        ...printer,
        lifespan_hours: lifespan,
        hourly_depreciation_cost: hourlyCost,
      };
      const exists = printers.some((p) => p.id === normalized.id);
      const nextPrinters = exists
        ? printers.map((p) => (p.id === normalized.id ? normalized : p))
        : [...printers, normalized];
      const nextProducts = recalculateProductsCost(
        products,
        filaments,
        accessories,
        nextPrinters
      );
      setPrinters(nextPrinters);
      setProducts(nextProducts);
      await persistState({ printers: nextPrinters, products: nextProducts });
    },
    [printers, products, filaments, accessories, persistState]
  );

  const deletePrinter = useCallback(
    async (printerId: string) => {
      if (printers.length <= 1) return; // Mantém pelo menos 1 impressora ativa no atelier
      const nextPrinters = printers.filter((p) => p.id !== printerId);
      const nextProducts = recalculateProductsCost(
        products,
        filaments,
        accessories,
        nextPrinters
      );
      setPrinters(nextPrinters);
      setProducts(nextProducts);
      await persistState({ printers: nextPrinters, products: nextProducts });
    },
    [printers, products, filaments, accessories, persistState]
  );

  const updatePixSettings = useCallback(
    async (settings: PixSettings) => {
      setPixSettings(settings);
      await persistState({ pixSettings: settings });
    },
    [persistState]
  );

  const clearDemoOrdersAndProducts = useCallback(async () => {
    // Mantém apenas o produto do Simulador de Chaveiro Personalizado (para o banner da feira) e zera pedidos de demonstração
    const keychainOnly = products.filter((p) => p.is_custom_keychain);
    setOrders([]);
    setProducts(keychainOnly);
    await persistState({
      orders: [],
      products: keychainOnly,
    });
  }, [products, persistState]);

  const resetDemoData = useCallback(async () => {
    const initialScheduled = applySmartScheduleToOrders(INITIAL_ORDERS);
    const recalcProds = recalculateProductsCost(
      INITIAL_PRODUCTS,
      INITIAL_FILAMENTS,
      INITIAL_ACCESSORIES,
      INITIAL_PRINTERS
    );
    setPrinters(INITIAL_PRINTERS);
    setFilaments(INITIAL_FILAMENTS);
    setAccessories(INITIAL_ACCESSORIES);
    setProducts(recalcProds);
    setOrders(initialScheduled);
    await persistState({
      printers: INITIAL_PRINTERS,
      filaments: INITIAL_FILAMENTS,
      accessories: INITIAL_ACCESSORIES,
      products: recalcProds,
      orders: initialScheduled,
    });
  }, [persistState]);

  return (
    <CMLabStoreContext.Provider
      value={{
        printers,
        filaments,
        accessories,
        products,
        orders: scheduledOrders,
        scheduledOrders,
        nextDeliveryEstimate,
        pixSettings,
        isLoaded,
        updatePixSettings,
        clearDemoOrdersAndProducts,
        addOrder,
        confirmOrderPayment,
        updateOrderQueueStatus,
        markOrderMaterialReady,
        addOrUpdatePrinter,
        deletePrinter,
        addOrUpdateFilament,
        deleteFilament,
        restockFilament,
        addOrUpdateAccessory,
        deleteAccessory,
        restockAccessory,
        addOrUpdateProduct,
        deleteProduct,
        resetDemoData,
      }}
    >
      {children}
    </CMLabStoreContext.Provider>
  );
}

export function useCMLabStore() {
  const ctx = useContext(CMLabStoreContext);
  if (!ctx) {
    throw new Error("useCMLabStore deve ser usado dentro de CMLabProvider");
  }
  return ctx;
}
