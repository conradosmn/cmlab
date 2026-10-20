"use client";

import React, { useState, useEffect } from "react";
import { AdminNav } from "@/components/AdminNav";
import { useCMLabStore } from "@/lib/store";
import { PixSettings } from "@/lib/types";
import {
  Smartphone,
  CheckCircle2,
  QrCode,
  Clock,
  Wallet,
  User,
  Building2,
  Settings,
  Check,
} from "lucide-react";

export default function AdminCaixaMobilePage() {
  const { orders, confirmOrderPayment, pixSettings, updatePixSettings } =
    useCMLabStore();

  const [showPixConfig, setShowPixConfig] = useState(false);
  const [pixKey, setPixKey] = useState(pixSettings.pixKey);
  const [keyType, setKeyType] = useState<PixSettings["keyType"]>(pixSettings.keyType);
  const [merchantName, setMerchantName] = useState(pixSettings.merchantName);
  const [merchantCity, setMerchantCity] = useState(pixSettings.merchantCity);
  const [savedPixFeedback, setSavedPixFeedback] = useState(false);

  useEffect(() => {
    setPixKey(pixSettings.pixKey);
    setKeyType(pixSettings.keyType);
    setMerchantName(pixSettings.merchantName);
    setMerchantCity(pixSettings.merchantCity);
  }, [pixSettings]);

  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    await updatePixSettings({
      pixKey: pixKey.trim(),
      keyType,
      merchantName: merchantName.trim() || "CM CASA CRIATIVA",
      merchantCity: merchantCity.trim() || "BRASILIA",
    });
    setSavedPixFeedback(true);
    setTimeout(() => {
      setSavedPixFeedback(false);
      setShowPixConfig(false);
    }, 1500);
  };

  // Pedidos aguardando Tap to Pay no celular do atendente ou PIX pendente
  const awaitingTapOrders = orders.filter(
    (o) => o.payment_status === "awaiting_tap_to_pay"
  );
  const pendingPixOrders = orders.filter(
    (o) => o.payment_status === "pending" && o.payment_method === "pix"
  );
  const paidOrders = orders
    .filter((o) => o.payment_status === "paid")
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const totalRevenue = paidOrders.reduce((acc, o) => acc + o.total_price, 0);
  const tapRevenue = paidOrders
    .filter((o) => o.payment_method !== "pix")
    .reduce((acc, o) => acc + o.total_price, 0);
  const pixRevenue = paidOrders
    .filter((o) => o.payment_method === "pix")
    .reduce((acc, o) => acc + o.total_price, 0);

  return (
    <div className="min-h-screen bg-linho">
      <AdminNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Mobile de Bolso + Atalho Configuração PIX Real */}
        <div className="bg-areia border border-borda rounded-3xl p-5 shadow-atelier space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 rounded-2xl bg-terracota text-white">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-widest text-oliva font-bold">
                  Tela Mobile de Bolso • Sincronizada com iPad
                </span>
                <h1 className="text-2xl font-serif font-bold text-musgo">
                  Caixa Tap to Pay & PIX Feira TCE
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPixConfig((v) => !v)}
                className="px-3.5 py-2.5 rounded-2xl bg-linho hover:bg-borda/50 border border-borda text-xs font-semibold text-musgo flex items-center gap-1.5 transition"
              >
                <Settings className="w-4 h-4 text-terracota" />
                <span>Chave PIX Real</span>
              </button>

              <div className="bg-linho px-4 py-2 rounded-2xl border border-borda text-right">
                <span className="text-[11px] text-oliva block">Total Recebido</span>
                <span className="text-2xl font-serif font-bold text-musgo">
                  R$ {totalRevenue.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>
          </div>

          {/* Painel Expansível: Configurar Minha Chave PIX Real (BR Code EMV Oficial) */}
          {showPixConfig && (
            <form
              onSubmit={handleSavePix}
              className="bg-linho p-4 rounded-2xl border-2 border-argila space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-terracota">
                  Configuração Oficial de QR Code PIX (Padrão Banco Central EMV)
                </span>
                <span className="text-[11px] text-oliva">
                  Gera o QR Code escaneável no iPad com o valor exato de cada pedido
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Tipo da Chave PIX
                  </label>
                  <select
                    value={keyType}
                    onChange={(e) =>
                      setKeyType(e.target.value as PixSettings["keyType"])
                    }
                    className="w-full px-3 py-2 rounded-xl bg-areia border border-borda text-xs font-semibold text-musgo"
                  >
                    <option value="cpf">CPF (11 dígitos)</option>
                    <option value="cnpj">CNPJ (14 dígitos)</option>
                    <option value="phone">Celular (+55 DDD Número)</option>
                    <option value="email">E-mail</option>
                    <option value="random">Chave Aleatória (UUID)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Sua Chave PIX Real
                  </label>
                  <input
                    type="text"
                    required
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="Digite seu CPF, CNPJ, Celular, E-mail ou Chave Aleatória"
                    className="w-full px-3.5 py-2 rounded-xl bg-areia border border-borda text-sm font-bold text-musgo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Nome do Recebedor (sem acentos, até 25 letras)
                  </label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="CM CASA CRIATIVA"
                    className="w-full px-3 py-2 rounded-xl bg-areia border border-borda text-xs text-musgo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-oliva font-semibold mb-1">
                    Cidade (sem acentos)
                  </label>
                  <input
                    type="text"
                    value={merchantCity}
                    onChange={(e) => setMerchantCity(e.target.value)}
                    placeholder="BRASILIA"
                    className="w-full px-3 py-2 rounded-xl bg-areia border border-borda text-xs text-musgo"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-terracota hover:bg-terracota-hover text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                >
                  {savedPixFeedback ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Chave PIX Salva & Ativa no iPad!</span>
                    </>
                  ) : (
                    <span>Salvar Minha Chave PIX Real</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ALERTA EM TEMPO REAL: PEDIDOS AGUARDANDO TAP TO PAY NO CELULAR */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-serif font-bold text-musgo flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-terracota animate-ping" />
              <span>Aguardando Tap to Pay no seu Celular ({awaitingTapOrders.length})</span>
            </h2>
            <span className="text-xs text-oliva">Atualização automática</span>
          </div>

          {awaitingTapOrders.length === 0 ? (
            <div className="bg-areia/60 border border-dashed border-borda rounded-3xl p-8 text-center space-y-2">
              <Smartphone className="w-8 h-8 text-oliva mx-auto opacity-60" />
              <div className="text-base font-serif font-semibold text-musgo">
                Nenhum cliente aguardando maquininha/celular no momento
              </div>
              <p className="text-xs text-oliva max-w-md mx-auto">
                Assim que um cliente escolher <strong>Cartão (Tap to Pay)</strong> no iPad em{" "}
                <code>/feira</code>, o pedido aparecerá aqui instantaneamente com o valor para
                você cobrar no app do Mercado Pago.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {awaitingTapOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-areia border-2 border-terracota rounded-3xl p-6 shadow-atelier-lg space-y-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-terracota text-white text-xs font-bold uppercase">
                        Pedido #{order.order_number} •{" "}
                        {order.payment_method === "credit_tap"
                          ? "PASSAR CRÉDITO TAP TO PAY"
                          : "PASSAR DÉBITO TAP TO PAY"}
                      </span>
                      <h3 className="text-2xl font-serif font-bold text-musgo mt-2">
                        {order.product_title_snapshot}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-oliva mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {order.customer_name} ({order.customer_whatsapp})
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {order.delivery_sector}
                        </span>
                      </div>
                    </div>

                    <div className="text-right bg-linho px-4 py-3 rounded-2xl border border-borda shrink-0">
                      <span className="text-[11px] text-oliva uppercase block">
                        Cobrar no App MP
                      </span>
                      <span className="text-3xl font-serif font-bold text-terracota">
                        R$ {order.total_price.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => confirmOrderPayment(order.id, `TAP-${Date.now()}`)}
                    className="w-full py-4 px-6 rounded-2xl bg-musgo hover:bg-musgo/90 text-linho font-bold text-base sm:text-lg shadow-md transition flex items-center justify-center gap-2.5"
                  >
                    <CheckCircle2 className="w-6 h-6 text-argila" />
                    <span>✅ Confirmar Recebimento Tap to Pay (Destravar iPad)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pedidos PIX Pendentes (para liberar pelo celular assim que cair na conta) */}
        {pendingPixOrders.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-serif font-bold text-musgo flex items-center gap-2">
              <QrCode className="w-4 h-4 text-terracota" />
              <span>Clientes com QR Code PIX Aberto no iPad ({pendingPixOrders.length})</span>
            </h2>
            {pendingPixOrders.map((order) => (
              <div
                key={order.id}
                className="bg-areia border border-borda rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-bold text-terracota">
                    Pedido #{order.order_number} • PIX R${" "}
                    {order.total_price.toFixed(2).replace(".", ",")}
                  </div>
                  <div className="text-sm font-semibold text-musgo">
                    {order.customer_name} — {order.product_title_snapshot}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => confirmOrderPayment(order.id, `PIX-MANUAL-${Date.now()}`)}
                  className="px-4 py-2.5 rounded-xl bg-terracota text-white text-xs font-semibold"
                >
                  ✅ Confirmar PIX Recebido (Destravar iPad)
                </button>
              </div>
            ))}
          </section>
        )}

        {/* Resumo Financeiro Rápido */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-areia p-4 rounded-2xl border border-borda">
            <div className="flex items-center gap-2 text-xs text-oliva">
              <QrCode className="w-4 h-4 text-musgo" />
              <span>Recebido via PIX ({pixSettings.pixKey})</span>
            </div>
            <div className="text-xl font-serif font-bold text-musgo mt-1">
              R$ {pixRevenue.toFixed(2).replace(".", ",")}
            </div>
          </div>
          <div className="bg-areia p-4 rounded-2xl border border-borda">
            <div className="flex items-center gap-2 text-xs text-oliva">
              <Wallet className="w-4 h-4 text-terracota" />
              <span>Recebido Tap to Pay</span>
            </div>
            <div className="text-xl font-serif font-bold text-musgo mt-1">
              R$ {tapRevenue.toFixed(2).replace(".", ",")}
            </div>
          </div>
        </section>

        {/* Histórico de Pedidos Pagos na Feira */}
        <section className="space-y-3">
          <h2 className="text-lg font-serif font-bold text-musgo">
            Histórico de Pagamentos Confirmados ({paidOrders.length})
          </h2>
          <div className="space-y-2.5">
            {paidOrders.map((order) => (
              <div
                key={order.id}
                className="bg-areia/80 border border-borda rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-musgo">
                      #{order.order_number}
                    </span>
                    <span className="text-sm font-semibold text-musgo">
                      {order.customer_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-linho border border-borda text-oliva uppercase">
                      {order.payment_method === "pix"
                        ? "PIX"
                        : order.payment_method === "credit_tap"
                        ? "Crédito Tap"
                        : "Débito Tap"}
                    </span>
                  </div>
                  <div className="text-xs text-oliva">
                    {order.product_title_snapshot} • {order.delivery_sector}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-serif font-bold text-musgo">
                    R$ {order.total_price.toFixed(2).replace(".", ",")}
                  </div>
                  <div className="text-[11px] text-oliva flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
