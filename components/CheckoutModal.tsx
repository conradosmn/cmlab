"use client";

import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import {
  CustomKeychainData,
  Filament,
  PaymentMethod,
  Product,
  SelectedColorChoice,
} from "@/lib/types";
import { useCMLabStore } from "@/lib/store";
import { generatePixBrCode } from "@/lib/pixGenerator";
import {
  X,
  QrCode,
  Smartphone,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  User,
  Phone,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  filaments: Filament[];
  preconfiguredKeychain?: {
    customKeychainData: CustomKeychainData;
    selectedColors: SelectedColorChoice[];
    totalPrice: number;
    weightGrams: number;
    printTimeMinutes: number;
    materialReady: boolean;
    restockBufferDays: number;
  } | null;
}

const TCE_QUICK_SECTORS = [
  "Gabinete Conselheiro",
  "DFINFRA",
  "SECEX",
  "Diretoria Geral / ADM",
  "TI / STI",
  "Combinar Retirada via WhatsApp",
];

export function CheckoutModal({
  isOpen,
  onClose,
  product,
  filaments,
  preconfiguredKeychain,
}: CheckoutModalProps) {
  const { addOrder, confirmOrderPayment, orders, pixSettings } = useCMLabStore();

  const [step, setStep] = useState<"details" | "payment_waiting" | "confirmed">("details");
  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [deliverySector, setDeliverySector] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [selectedFilamentIds, setSelectedFilamentIds] = useState<string[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [pixQrDataUrl, setPixQrDataUrl] = useState<string>("");

  const allowedFilaments = useMemo(() => {
    if (!product) return [];
    const allowed = filaments.filter(
      (f) => f.active && product.allowed_filament_ids.includes(f.id)
    );
    return allowed.length > 0 ? allowed : filaments.filter((f) => f.active);
  }, [product, filaments]);

  useEffect(() => {
    if (isOpen && product) {
      setStep("details");
      setActiveOrderId(null);
      if (!preconfiguredKeychain && allowedFilaments.length > 0) {
        const count = Math.min(product.max_colors || 1, 2);
        setSelectedFilamentIds(
          Array.from({ length: count }, (_, idx) =>
            allowedFilaments[idx % allowedFilaments.length]?.id
          ).filter(Boolean)
        );
      }
    }
  }, [isOpen, product, preconfiguredKeychain, allowedFilaments]);

  // Monitora em tempo real se o pedido 'awaiting_tap_to_pay' ou 'pending' foi confirmado no celular (/admin/caixa)
  const currentOrderInStore = useMemo(
    () => orders.find((o) => o.id === activeOrderId),
    [orders, activeOrderId]
  );

  useEffect(() => {
    if (
      step === "payment_waiting" &&
      currentOrderInStore &&
      currentOrderInStore.payment_status === "paid"
    ) {
      setStep("confirmed");
    }
  }, [step, currentOrderInStore]);

  if (!isOpen || !product) return null;

  // Monta as cores escolhidas (se veio do Simulador de Chaveiro ou da seleção do Produto)
  const resolvedColors: SelectedColorChoice[] = preconfiguredKeychain
    ? preconfiguredKeychain.selectedColors
    : selectedFilamentIds.map((fid, idx) => {
        const fil = allowedFilaments.find((f) => f.id === fid) || allowedFilaments[0];
        const splitWeight = Math.ceil(
          product.weight_grams / Math.max(1, selectedFilamentIds.length)
        );
        return {
          slot_label:
            selectedFilamentIds.length > 1 ? `Cor ${idx + 1}` : "Cor da Peça",
          filament_id: fil?.id || "fil-terracota",
          color_name: fil?.color_name || "Terracota Matte",
          hex_code: fil?.hex_code || "#A3522B",
          weight_grams: splitWeight,
        };
      });

  const totalPrice = preconfiguredKeychain
    ? preconfiguredKeychain.totalPrice
    : product.price;
  const weightGrams = preconfiguredKeychain
    ? preconfiguredKeychain.weightGrams
    : product.weight_grams;
  const printTimeMinutes = preconfiguredKeychain
    ? preconfiguredKeychain.printTimeMinutes
    : product.print_time_minutes;

  const chosenFilamentObjects = resolvedColors
    .map((rc) => filaments.find((f) => f.id === rc.filament_id))
    .filter(Boolean) as Filament[];

  const needsMaterialRestock = preconfiguredKeychain
    ? !preconfiguredKeychain.materialReady
    : chosenFilamentObjects.some(
        (f) => f.is_on_order_color || f.remaining_weight_grams < weightGrams / chosenFilamentObjects.length
      );

  const restockDays = preconfiguredKeychain
    ? preconfiguredKeychain.restockBufferDays
    : chosenFilamentObjects.reduce(
        (max, f) =>
          f.is_on_order_color || f.remaining_weight_grams < 50
            ? Math.max(max, f.restock_lead_time_days || 3)
            : max,
        0
      );

  const handleCreateOrderAndGoToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerWhatsapp.trim() || !deliverySector.trim()) {
      return;
    }

    const titleSnapshot = preconfiguredKeychain
      ? `Chaveiro Personalizado: '${preconfiguredKeychain.customKeychainData.text}'${
          preconfiguredKeychain.customKeychainData.charm !== "none"
            ? ` + Pingente`
            : ""
        }`
      : product.name;

    const initialPaymentStatus =
      paymentMethod === "pix" ? "pending" : "awaiting_tap_to_pay";

    const created = await addOrder({
      customer_name: customerName.trim(),
      customer_whatsapp: customerWhatsapp.trim(),
      delivery_sector: deliverySector.trim(),
      product_id: product.id,
      product_title_snapshot: titleSnapshot,
      selected_colors: resolvedColors,
      custom_keychain_data: preconfiguredKeychain?.customKeychainData,
      total_price: totalPrice,
      payment_method: paymentMethod,
      payment_status: initialPaymentStatus,
      print_time_minutes: printTimeMinutes,
      weight_grams: weightGrams,
      material_ready: !needsMaterialRestock,
      restock_buffer_days: needsMaterialRestock ? restockDays || 3 : 0,
      queue_status: "waiting_payment",
    });

    setActiveOrderId(created.id);
    setStep("payment_waiting");
  };

  const handleSimulatePixWebhook = async () => {
    if (!activeOrderId) return;
    await confirmOrderPayment(activeOrderId, `PIX-MP-${Date.now()}`);
    setStep("confirmed");
  };

  const pixPayload = useMemo(() => {
    return generatePixBrCode({
      pixKey: pixSettings.pixKey || "cmcasacriativa@gmail.com",
      keyType: pixSettings.keyType || "email",
      merchantName: pixSettings.merchantName || "CM CASA CRIATIVA",
      merchantCity: pixSettings.merchantCity || "BRASILIA",
      amount: totalPrice,
      txid: `PEDIDO${currentOrderInStore?.order_number || 100}`,
    });
  }, [pixSettings, totalPrice, currentOrderInStore?.order_number]);

  useEffect(() => {
    if (step === "payment_waiting" && paymentMethod === "pix" && pixPayload) {
      QRCode.toDataURL(pixPayload, {
        width: 260,
        margin: 1,
        color: {
          dark: "#4A4F3B",
          light: "#FFFFFF",
        },
      })
        .then((url) => setPixQrDataUrl(url))
        .catch((err) => console.error("QR Error:", err));
    }
  }, [step, paymentMethod, pixPayload]);

  return (
    <div className="fixed inset-0 z-50 bg-musgo/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-linho border border-borda rounded-3xl max-w-2xl w-full shadow-atelier-lg overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-areia px-6 py-4 border-b border-borda flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-oliva font-semibold">
              Reserva Garantida • Feira TCE
            </span>
            <h2 className="text-2xl font-serif font-bold text-musgo">
              {step === "details" && "Finalizar Encomenda no Atelier"}
              {step === "payment_waiting" &&
                (paymentMethod === "pix"
                  ? "Pagamento Instantâneo via PIX"
                  : "Aproxime o Cartão no Celular do Atendente")}
              {step === "confirmed" && "Reserva Confirmada & Na Fila da A1!"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-linho hover:bg-borda/50 text-musgo transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: DADOS DO CLIENTE TCE + ESCOLHA DE COR E PAGAMENTO */}
        {step === "details" && (
          <form onSubmit={handleCreateOrderAndGoToPayment} className="p-6 space-y-5">
            {/* Resumo da Peça */}
            <div className="bg-areia/70 p-4 rounded-2xl border border-borda flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-oliva font-medium">Peça Selecionada</div>
                <div className="text-lg font-serif font-bold text-musgo">
                  {preconfiguredKeychain
                    ? `Chaveiro "${preconfiguredKeychain.customKeychainData.text}"`
                    : product.name}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {resolvedColors.map((rc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-linho border border-borda text-musgo"
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-musgo/30"
                        style={{ backgroundColor: rc.hex_code }}
                      />
                      {rc.slot_label}: {rc.color_name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-oliva">Total</div>
                <div className="text-2xl font-serif font-bold text-terracota">
                  R$ {totalPrice.toFixed(2).replace(".", ",")}
                </div>
              </div>
            </div>

            {/* Seleção de Cores caso não venha do Simulador de Chaveiro */}
            {!preconfiguredKeychain && (
              <div className="space-y-3">
                {selectedFilamentIds.map((selectedId, slotIdx) => (
                  <div key={slotIdx}>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-2">
                      {selectedFilamentIds.length > 1
                        ? `Escolha a Cor ${slotIdx + 1} da Peça`
                        : "Escolha a Cor da Peça no Mostruário"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {allowedFilaments.map((fil) => {
                        const isSelected = fil.id === selectedId;
                        return (
                          <button
                            key={fil.id}
                            type="button"
                            onClick={() => {
                              const next = [...selectedFilamentIds];
                              next[slotIdx] = fil.id;
                              setSelectedFilamentIds(next);
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition ${
                              isSelected
                                ? "bg-musgo text-linho border-musgo shadow-sm"
                                : "bg-areia text-musgo border-borda hover:border-argila"
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full border border-white/40"
                              style={{ backgroundColor: fil.hex_code }}
                            />
                            <span>{fil.color_name}</span>
                            {(fil.is_on_order_color || fil.remaining_weight_grams <= 0) && (
                              <span className="text-[10px] opacity-75">(+3d)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {needsMaterialRestock && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-argila/20 border border-argila text-xs text-musgo">
                <AlertCircle className="w-4 h-4 text-terracota shrink-0 mt-0.5" />
                <div>
                  <strong>Cor sob encomenda:</strong> A venda é liberada normalmente e sua peça entra na lista prioritária de reposição de bobinas (+{restockDays || 3} dias no prazo).
                </div>
              </div>
            )}

            {/* Campos de Identificação Rápida TCE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1.5">
                  Seu Nome
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-oliva absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Ana Paula"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-areia border border-borda text-musgo text-sm focus:outline-none focus:ring-2 focus:ring-argila"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1.5">
                  WhatsApp (p/ aviso de pronta)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-oliva absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={customerWhatsapp}
                    onChange={(e) => setCustomerWhatsapp(e.target.value)}
                    placeholder="(61) 99999-9999"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-areia border border-borda text-musgo text-sm focus:outline-none focus:ring-2 focus:ring-argila"
                  />
                </div>
              </div>
            </div>

            {/* Setor / Sala no TCE */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-1.5">
                Setor / Sala no TCE (ou Retirada)
              </label>
              <div className="relative mb-2">
                <Building2 className="w-4 h-4 text-oliva absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={deliverySector}
                  onChange={(e) => setDeliverySector(e.target.value)}
                  placeholder="Ex: DFINFRA / Sala 202 ou Combinar via WhatsApp"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-areia border border-borda text-musgo text-sm focus:outline-none focus:ring-2 focus:ring-argila"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TCE_QUICK_SECTORS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDeliverySector(sec)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                      deliverySector === sec
                        ? "bg-musgo text-linho border-musgo"
                        : "bg-areia/70 text-oliva border-borda hover:text-musgo"
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            {/* Método de Pagamento 100% Antecipado */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-oliva mb-2">
                Forma de Pagamento (100% Antecipado na Reserva)
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                    paymentMethod === "pix"
                      ? "bg-musgo text-linho border-musgo shadow-sm"
                      : "bg-areia text-musgo border-borda hover:border-argila"
                  }`}
                >
                  <QrCode className="w-5 h-5 mb-1.5" />
                  <div className="font-semibold text-sm">PIX QR Code</div>
                  <div className="text-[11px] opacity-80">Na tela do iPad</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("credit_tap")}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                    paymentMethod === "credit_tap"
                      ? "bg-musgo text-linho border-musgo shadow-sm"
                      : "bg-areia text-musgo border-borda hover:border-argila"
                  }`}
                >
                  <Smartphone className="w-5 h-5 mb-1.5" />
                  <div className="font-semibold text-sm">Cartão Crédito</div>
                  <div className="text-[11px] opacity-80">Tap to Pay Celular</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("debit_tap")}
                  className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                    paymentMethod === "debit_tap"
                      ? "bg-musgo text-linho border-musgo shadow-sm"
                      : "bg-areia text-musgo border-borda hover:border-argila"
                  }`}
                >
                  <Smartphone className="w-5 h-5 mb-1.5" />
                  <div className="font-semibold text-sm">Cartão Débito</div>
                  <div className="text-[11px] opacity-80">Tap to Pay Celular</div>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3.5 rounded-2xl border border-borda text-musgo text-sm font-semibold hover:bg-areia transition"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="px-7 py-3.5 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-sm shadow-md transition flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  Ir para Pagamento (R$ {totalPrice.toFixed(2).replace(".", ",")})
                </span>
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: AGUARDANDO PAGAMENTO (PIX QR CODE OU TAP TO PAY MERCADO PAGO) */}
        {step === "payment_waiting" && (
          <div className="p-6 text-center space-y-6">
            {paymentMethod === "pix" ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-areia border border-borda text-xs font-semibold text-musgo">
                  <QrCode className="w-4 h-4 text-terracota" />
                  <span>Escaneie o QR Code PIX com o aplicativo do seu banco</span>
                </div>

                {/* QR Code Dinâmico Real Padrão BACEN (EMV BR Code) */}
                <div className="mx-auto w-60 h-60 bg-white p-3.5 rounded-3xl border-2 border-borda shadow-sm flex items-center justify-center">
                  {pixQrDataUrl ? (
                    <img
                      src={pixQrDataUrl}
                      alt="QR Code PIX Oficial"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <div className="text-xs text-oliva">Gerando QR Code PIX...</div>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="text-3xl font-serif font-bold text-musgo">
                    R$ {totalPrice.toFixed(2).replace(".", ",")}
                  </div>
                  <div className="text-[11px] text-oliva">
                    Chave PIX: <strong className="text-musgo">{pixSettings.pixKey}</strong> ({pixSettings.merchantName})
                  </div>
                </div>

                <div className="max-w-md mx-auto flex items-center gap-2 bg-areia p-2 rounded-xl border border-borda">
                  <input
                    type="text"
                    readOnly
                    value={pixPayload}
                    className="flex-1 bg-transparent text-xs text-oliva truncate px-2 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(pixPayload);
                      setCopiedPix(true);
                      setTimeout(() => setCopiedPix(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-linho border border-borda text-xs font-semibold text-musgo flex items-center gap-1"
                  >
                    {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPix ? "Copiado" : "Copia e Cola"}</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSimulatePixWebhook}
                    className="px-6 py-3.5 rounded-2xl bg-musgo hover:bg-musgo/90 text-linho text-sm font-semibold shadow transition"
                  >
                    ✅ Simular Confirmação Webhook PIX Mercado Pago
                  </button>
                </div>
              </div>
            ) : (
              /* MODO TAP TO PAY MERCADO PAGO SINCRONIZADO COM /admin/caixa */
              <div className="py-4 space-y-5">
                <div className="relative mx-auto w-28 h-28 rounded-full bg-terracota/15 border-2 border-terracota flex items-center justify-center">
                  <span className="absolute inset-0 rounded-full bg-terracota/20 animate-ping" />
                  <Smartphone className="w-12 h-12 text-terracota relative z-10" />
                </div>

                <div className="space-y-2">
                  <span className="px-3 py-1 rounded-full bg-areia border border-borda text-xs font-semibold text-musgo">
                    Pedido #{currentOrderInStore?.order_number ?? "..."} •{" "}
                    {paymentMethod === "credit_tap" ? "Crédito à Vista" : "Débito"}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-serif font-bold text-musgo">
                    Aproxime seu cartão ou celular no aparelho do atendente
                  </h3>
                  <p className="text-sm text-oliva max-w-md mx-auto">
                    O celular do atendente já recebeu o alerta de{" "}
                    <strong className="text-musgo">
                      R$ {totalPrice.toFixed(2).replace(".", ",")}
                    </strong>
                    . Assim que o pagamento Tap to Pay for confirmado lá, esta tela liberará automaticamente!
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-areia/80 border border-borda max-w-md mx-auto text-xs text-oliva flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-terracota animate-spin" />
                    Aguardando confirmação em tempo real de <code>/admin/caixa</code>...
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulatePixWebhook}
                    className="underline text-musgo font-semibold shrink-0"
                  >
                    Destravar daqui
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: TELA DE SUCESSO E POSIÇÃO NA FILA DA BAMBU LAB A1 */}
        {step === "confirmed" && currentOrderInStore && (
          <div className="p-8 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-musgo text-linho flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-11 h-11" />
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-terracota font-bold">
                Pagamento Confirmado • Pedido #{currentOrderInStore.order_number}
              </span>
              <h3 className="text-3xl font-serif font-bold text-musgo">
                Obrigada, {currentOrderInStore.customer_name}!
              </h3>
              <p className="text-sm text-oliva max-w-md mx-auto">
                Sua peça já entrou na programação da nossa impressora{" "}
                <strong>Bambu Lab A1</strong> e avisaremos no WhatsApp{" "}
                <strong>{currentOrderInStore.customer_whatsapp}</strong> assim que estiver pronta!
              </p>
            </div>

            <div className="bg-areia p-5 rounded-2xl border border-borda max-w-md mx-auto text-left space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-oliva">Item:</span>
                <span className="font-semibold text-musgo">
                  {currentOrderInStore.product_title_snapshot}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-oliva">Entrega / Setor TCE:</span>
                <span className="font-semibold text-musgo">
                  {currentOrderInStore.delivery_sector}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-oliva">Status na Fila A1:</span>
                <span className="font-semibold text-terracota">
                  {currentOrderInStore.material_ready
                    ? currentOrderInStore.estimated_finish_at
                      ? `Previsão: ${new Date(
                          currentOrderInStore.estimated_finish_at
                        ).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Agendado na Fila Inteligente"
                    : `Cor Sob Encomenda (+${currentOrderInStore.restock_buffer_days || 3} dias úteis)`}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-8 py-4 rounded-2xl bg-terracota hover:bg-terracota-hover text-white font-semibold text-base shadow-md transition"
            >
              Concluir e Voltar para a Vitrine
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
