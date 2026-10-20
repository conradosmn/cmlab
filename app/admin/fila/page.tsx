"use client";

import React, { useState } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";
import { generateKeychainOpenSCAD } from "@/lib/openscadGenerator";
import { PrintQueueOrder } from "@/lib/types";
import {
  CalendarClock,
  Moon,
  Sun,
  Coffee,
  MessageCircle,
  Code2,
  CheckCircle2,
  Play,
  PackageCheck,
  AlertTriangle,
  Copy,
  Check,
  Download,
} from "lucide-react";

export default function AdminFilaPage() {
  const {
    scheduledOrders,
    updateOrderQueueStatus,
    markOrderMaterialReady,
  } = useCMLabStore();

  const [openScadModalOrder, setOpenScadModalOrder] =
    useState<PrintQueueOrder | null>(null);
  const [copiedScad, setCopiedScad] = useState(false);

  // Pedidos ativos agendados na Bambu Lab A1 (com material em casa)
  const activeQueue = scheduledOrders
    .filter(
      (o) =>
        o.payment_status === "paid" &&
        o.material_ready &&
        (o.queue_status === "queued" || o.queue_status === "printing")
    )
    .sort((a, b) => {
      const ta = a.estimated_start_at ? new Date(a.estimated_start_at).getTime() : 0;
      const tb = b.estimated_start_at ? new Date(b.estimated_start_at).getTime() : 0;
      return ta - tb;
    });

  // Pedidos pagos que pularam na fila porque aguardam compra/chegada de bobina (Regra 2.6)
  const awaitingMaterialOrders = scheduledOrders.filter(
    (o) =>
      o.payment_status === "paid" &&
      (!o.material_ready || o.queue_status === "awaiting_material")
  );

  // Pedidos já impressos / entregues no TCE
  const completedOrders = scheduledOrders.filter(
    (o) => o.queue_status === "done" || o.queue_status === "delivered"
  );

  const buildWhatsAppLink = (order: PrintQueueOrder) => {
    const cleanPhone = order.customer_whatsapp.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const msg = `Olá, ${order.customer_name}! Tudo bem? 🌿 Aqui é da *CM Casa Criativa* (Feira do TCE). Sua encomenda *#${order.order_number} (${order.product_title_snapshot})* acabou de sair da nossa impressora 3D e já está prontinha para entrega/retirada (${order.delivery_sector})!`;
    return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
  };

  const scadContent = openScadModalOrder?.custom_keychain_data
    ? generateKeychainOpenSCAD(
        openScadModalOrder.custom_keychain_data,
        openScadModalOrder.order_number
      )
    : "";

  const handleDownloadScad = () => {
    if (!openScadModalOrder || !scadContent) return;
    const blob = new Blob([scadContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chaveiro-pedido-${openScadModalOrder.order_number}-${openScadModalOrder.custom_keychain_data?.text}.scad`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-linho">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Cabeçalho de Regras de Engenharia da Fila da Bambu Lab A1 */}
        <section className="bg-areia border border-borda rounded-3xl p-6 shadow-atelier flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <span className="text-xs uppercase tracking-widest text-terracota font-bold">
              Agendador Inteligente • Bambu Lab A1 (256x256x256mm)
            </span>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-musgo">
              Timeline de Produção, Modo Corujão & Exportador OpenSCAD
            </h1>
            <p className="text-xs text-oliva max-w-3xl">
              Respeita automaticamente a janela humana (sem início entre 23h00 e 07h30),
              prioriza peças longas (&ge;5h) no <strong>Turno Corujão (20h-23h)</strong> e
              insere <strong>2h (120 min) de folga obrigatória</strong> após qualquer
              impressão superior a 6h (360 min).
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0 text-xs">
            <div className="bg-linho px-3.5 py-2.5 rounded-2xl border border-borda flex items-center gap-2">
              <Sun className="w-4 h-4 text-terracota" />
              <span>Dia: 07h30–20h (Peças Curtas/Médias)</span>
            </div>
            <div className="bg-musgo text-linho px-3.5 py-2.5 rounded-2xl flex items-center gap-2">
              <Moon className="w-4 h-4 text-argila" />
              <span>Corujão: 20h–23h (Peças &ge; 5h)</span>
            </div>
          </div>
        </section>

        {/* TIMELINE CRONOLÓGICA DA FILA ATIVA */}
        <section className="space-y-4">
          <h2 className="text-xl font-serif font-bold text-musgo flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-terracota" />
            <span>Fila Cronológica da Impressora A1 ({activeQueue.length} na sequência)</span>
          </h2>

          {activeQueue.length === 0 ? (
            <div className="bg-areia/60 border border-dashed border-borda rounded-3xl p-8 text-center text-sm text-oliva">
              Nenhuma peça aguardando impressão imediata na Bambu Lab A1.
            </div>
          ) : (
            <div className="space-y-4">
              {activeQueue.map((order, idx) => {
                const isLongPrint = order.print_time_minutes > 360;
                const hours = Math.floor(order.print_time_minutes / 60);
                const mins = order.print_time_minutes % 60;
                const durationLabel =
                  hours > 0 ? `${hours}h${mins > 0 ? `${mins}m` : ""}` : `${mins} min`;

                const startStr = order.estimated_start_at
                  ? new Date(order.estimated_start_at).toLocaleString("pt-BR", {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Agora";
                const finishStr = order.estimated_finish_at
                  ? new Date(order.estimated_finish_at).toLocaleString("pt-BR", {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";

                return (
                  <div key={order.id} className="space-y-2">
                    <div
                      className={`rounded-3xl p-5 border transition shadow-atelier ${
                        order.queue_status === "printing"
                          ? "bg-areia border-2 border-terracota"
                          : order.is_night_owl_slot
                          ? "bg-areia border-2 border-musgo"
                          : "bg-areia border-borda"
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-linho border border-borda text-musgo">
                              {idx + 1}º da Fila • Pedido #{order.order_number}
                            </span>

                            {order.queue_status === "printing" && (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-terracota text-white animate-pulse">
                                🖨️ Imprimindo Agora na A1
                              </span>
                            )}

                            {order.is_night_owl_slot ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-musgo text-linho">
                                <Moon className="w-3.5 h-3.5 text-argila" />
                                <span>Turno Corujão (Madrugada)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-linho text-oliva border border-borda">
                                <Sun className="w-3.5 h-3.5 text-terracota" />
                                <span>Turno Diurno</span>
                              </span>
                            )}

                            <span className="text-xs font-semibold text-musgo bg-linho px-3 py-1 rounded-full border border-borda">
                              ⏱️ {startStr} → {finishStr} ({durationLabel} •{" "}
                              {order.weight_grams}g)
                            </span>
                          </div>

                          <h3 className="text-2xl font-serif font-bold text-musgo">
                            {order.product_title_snapshot}
                          </h3>

                          <div className="text-xs text-oliva">
                            Cliente: <strong className="text-musgo">{order.customer_name}</strong>{" "}
                            ({order.customer_whatsapp}) • Entrega TCE:{" "}
                            <strong className="text-musgo">{order.delivery_sector}</strong>
                          </div>

                          {/* Cores de Filamento para colocar no AMS Lite */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {order.selected_colors.map((sc, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs bg-linho border border-borda text-musgo font-medium"
                              >
                                <span
                                  className="w-3.5 h-3.5 rounded-full border border-musgo/30"
                                  style={{ backgroundColor: sc.hex_code }}
                                />
                                <span>
                                  AMS {i + 1} ({sc.slot_label}): {sc.color_name} (
                                  {sc.weight_grams}g)
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Botões de Ação Operacional + OpenSCAD + WhatsApp */}
                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                          {order.custom_keychain_data && (
                            <button
                              type="button"
                              onClick={() => setOpenScadModalOrder(order)}
                              className="px-3.5 py-2.5 rounded-xl bg-linho hover:bg-borda/50 border border-borda text-xs font-semibold text-musgo flex items-center gap-1.5 transition"
                            >
                              <Code2 className="w-4 h-4 text-terracota" />
                              <span>Gerar Script OpenSCAD</span>
                            </button>
                          )}

                          {order.queue_status === "queued" && (
                            <button
                              type="button"
                              onClick={() => updateOrderQueueStatus(order.id, "printing")}
                              className="px-4 py-2.5 rounded-xl bg-terracota hover:bg-terracota-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Iniciar na A1</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => updateOrderQueueStatus(order.id, "done")}
                            className="px-4 py-2.5 rounded-xl bg-musgo hover:bg-musgo/90 text-linho text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Peça Pronta</span>
                          </button>

                          <a
                            href={buildWhatsAppLink(order)}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3.5 py-2.5 rounded-xl bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 text-musgo text-xs font-bold flex items-center gap-1.5 transition"
                          >
                            <MessageCircle className="w-4 h-4 text-[#1da851]" />
                            <span>Avisar no WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* BLOCO VISUAL DE DESCANSO / FOLGA DA IMPRESSORA A1 */}
                    {isLongPrint ? (
                      <div className="mx-6 px-4 py-2.5 rounded-2xl bg-terracota/15 border border-terracota/40 text-xs text-musgo flex items-center justify-between">
                        <span className="flex items-center gap-2 font-semibold">
                          <Coffee className="w-4 h-4 text-terracota" />
                          <span>
                            Regra das 6h + 2h de Folga Ativada: Pausa obrigatória de{" "}
                            <strong>120 minutos (2 horas)</strong> para resfriamento e
                            descanso da Bambu Lab A1 após peça de {durationLabel}.
                          </span>
                        </span>
                        <span className="font-bold text-terracota">+2h00m Cooldown</span>
                      </div>
                    ) : (
                      <div className="mx-6 px-4 py-1.5 rounded-xl bg-areia/60 border border-borda text-[11px] text-oliva flex items-center justify-between">
                        <span>
                          Intervalo padrão de limpeza de mesa PEI Texturizada e remoção da
                          peça
                        </span>
                        <span>+15 min buffer</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ABA DE PEDIDOS AGUARDANDO CHEGADA DE FILAMENTO (PULO DE PEÇA SEM TRAVAR A FILA) */}
        <section className="space-y-3">
          <h2 className="text-xl font-serif font-bold text-musgo flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-terracota" />
            <span>
              Pedidos Aguardando Reposição de Bobina — Não Travam a Fila (
              {awaitingMaterialOrders.length})
            </span>
          </h2>

          {awaitingMaterialOrders.length === 0 ? (
            <div className="bg-areia/50 border border-borda rounded-2xl p-4 text-xs text-oliva">
              Nenhum pedido retido por falta de material.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {awaitingMaterialOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-areia border border-argila rounded-2xl p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-terracota">
                        Pedido #{order.order_number} • Aguardando Bobina (+
                        {order.restock_buffer_days || 3} dias)
                      </span>
                      <span className="text-xs font-semibold text-musgo">
                        Pago: R$ {order.total_price.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <h3 className="text-lg font-serif font-bold text-musgo mt-1">
                      {order.product_title_snapshot}
                    </h3>
                    <div className="text-xs text-oliva mt-0.5">
                      {order.customer_name} • {order.delivery_sector}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {order.selected_colors.map((sc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-linho border border-borda text-musgo"
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: sc.hex_code }}
                          />
                          {sc.color_name} ({sc.weight_grams}g)
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-borda">
                    <span className="text-[11px] text-oliva">
                      Bobina chegou? Libere para a fila da A1:
                    </span>
                    <button
                      type="button"
                      onClick={() => markOrderMaterialReady(order.id)}
                      className="px-4 py-2 rounded-xl bg-musgo text-linho text-xs font-semibold hover:bg-musgo/90 transition"
                    >
                      ✅ Bobina em Mãos (Enviar p/ Fila)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PEDIDOS CONCLUÍDOS & AVISO WHATSAPP TCE */}
        {completedOrders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-musgo flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-musgo" />
              <span>Peças Prontas / Entregues no TCE ({completedOrders.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {completedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-areia/70 border border-borda rounded-2xl p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs font-bold text-musgo">
                      #{order.order_number} • {order.customer_name} ({order.delivery_sector})
                    </div>
                    <div className="text-sm font-serif font-bold text-musgo">
                      {order.product_title_snapshot}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={buildWhatsAppLink(order)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-xl bg-terracota text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp TCE</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* MODAL EXPORTADOR OPENSCAD PARAMETRIZADO */}
      {openScadModalOrder && (
        <div className="fixed inset-0 z-50 bg-musgo/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-linho border border-borda rounded-3xl max-w-2xl w-full p-6 shadow-atelier-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-widest text-terracota font-bold">
                  Exportador Paramétrico 3D • Bambu Studio AMS
                </span>
                <h3 className="text-2xl font-serif font-bold text-musgo">
                  Script OpenSCAD — Pedido #{openScadModalOrder.order_number} (
                  {openScadModalOrder.custom_keychain_data?.text})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenScadModalOrder(null)}
                className="px-3 py-1.5 rounded-xl bg-areia border border-borda text-xs font-semibold text-musgo"
              >
                Fechar
              </button>
            </div>

            <pre className="bg-areia border border-borda rounded-2xl p-4 text-xs font-mono text-musgo overflow-x-auto max-h-80">
              {scadContent}
            </pre>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(scadContent);
                  setCopiedScad(true);
                  setTimeout(() => setCopiedScad(false), 2000);
                }}
                className="px-4 py-2.5 rounded-xl bg-areia border border-borda text-xs font-semibold text-musgo flex items-center gap-1.5"
              >
                {copiedScad ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedScad ? "Código Copiado!" : "Copiar Script .SCAD"}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadScad}
                className="px-5 py-2.5 rounded-xl bg-terracota text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Arquivo .SCAD</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
