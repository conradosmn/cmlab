export interface CostCalculationInput {
  filamentSegments: { weightGrams: number; costPerGram: number }[];
  printTimeMinutes: number;
  a1AveragePowerWatts?: number; // Padrão A1 PLA: 120W~150W
  kwhTariffBrl?: number; // Padrão: R$ 0,95
  machineHourCostBrl?: number; // Ex: R$ 3.500 / 8.000h = R$ 0,44/h (ou R$ 1,50/h)
  manualLaborMinutes?: number; // Tempo manual (setup, remoção de suporte, embalagem), ex: 10 min
  manualLaborHourlyRateBrl?: number; // Valor da hora de trabalho manual, ex: R$ 20,00/h
  accessories: { quantity: number; unitCost: number }[];
  failureMarginPercent?: number; // Padrão: 8% (0.08)
  desiredMarkupPercent?: number; // Ex: 100% ou 120% sobre o custo total
  salePriceBrl: number;
  mpFeePercent?: number; // Taxa Tap to Pay / PIX Mercado Pago (ex: 3.19% crédito / 0.99% PIX)
}

export interface CostCalculationBreakdown {
  filamentCost: number;
  energyCost: number;
  machineDepreciationCost: number;
  manualLaborCost: number;
  accessoriesCost: number;
  subtotalDirectCost: number;
  failureBufferCost: number;
  totalProductionCost: number;
  suggestedSalePriceBrl: number;
  onlyFilamentTimes3PriceBrl: number; // "Só peso x markup" (comparativo de mercado)
  mpFeeCost: number;
  netProfit: number;
  profitMarginPercent: number; // % do preço de venda que vira lucro líquido
  realMarkupPercent: number; // % de lucro sobre o custo de produção
  markupMultiplier: number;
}

export function calculate3DCosts(input: CostCalculationInput): CostCalculationBreakdown {
  const powerWatts = input.a1AveragePowerWatts ?? 120;
  const kwhTariff = input.kwhTariffBrl ?? 0.95;
  const machineHourCost = input.machineHourCostBrl ?? 0.45;
  const manualMinutes = input.manualLaborMinutes ?? 10;
  const manualHourlyRate = input.manualLaborHourlyRateBrl ?? 20;
  const failureMargin = (input.failureMarginPercent ?? 8) / 100;
  const desiredMarkup = (input.desiredMarkupPercent ?? 100) / 100;
  const mpFee = (input.mpFeePercent ?? 3.19) / 100;

  const hours = input.printTimeMinutes / 60;

  const filamentCost = input.filamentSegments.reduce(
    (acc, seg) => acc + seg.weightGrams * seg.costPerGram,
    0
  );

  const energyCost = (powerWatts / 1000) * hours * kwhTariff;
  const machineDepreciationCost = hours * machineHourCost;
  const manualLaborCost = (manualMinutes / 60) * manualHourlyRate;

  const accessoriesCost = input.accessories.reduce(
    (acc, item) => acc + item.quantity * item.unitCost,
    0
  );

  // Nota: nas calculadoras de referência, a reserva de falha (8%) incide sobre a impressão (Filamento + Energia + Máquina + Trabalho)
  const printableSubtotal =
    filamentCost + energyCost + machineDepreciationCost + manualLaborCost;
  const failureBufferCost = printableSubtotal * failureMargin;

  const subtotalDirectCost = printableSubtotal + accessoriesCost;
  const totalProductionCost = subtotalDirectCost + failureBufferCost;

  // Preço sugerido aplicando o Markup desejado sobre o custo real e compensando a taxa da maquininha/plataforma
  const rawSuggested =
    mpFee < 0.9
      ? (totalProductionCost * (1 + desiredMarkup)) / (1 - mpFee)
      : totalProductionCost * (1 + desiredMarkup);

  const suggestedSalePriceBrl = Number(rawSuggested.toFixed(2));
  const onlyFilamentTimes3PriceBrl = Number(
    (filamentCost * (1 + desiredMarkup)).toFixed(2)
  );

  const mpFeeCost = input.salePriceBrl * mpFee;
  const netProfit = input.salePriceBrl - totalProductionCost - mpFeeCost;
  const profitMarginPercent =
    input.salePriceBrl > 0 ? (netProfit / input.salePriceBrl) * 100 : 0;
  const realMarkupPercent =
    totalProductionCost > 0 ? (netProfit / totalProductionCost) * 100 : 0;
  const markupMultiplier =
    totalProductionCost > 0 ? input.salePriceBrl / totalProductionCost : 0;

  return {
    filamentCost: Number(filamentCost.toFixed(2)),
    energyCost: Number(energyCost.toFixed(2)),
    machineDepreciationCost: Number(machineDepreciationCost.toFixed(2)),
    manualLaborCost: Number(manualLaborCost.toFixed(2)),
    accessoriesCost: Number(accessoriesCost.toFixed(2)),
    subtotalDirectCost: Number(subtotalDirectCost.toFixed(2)),
    failureBufferCost: Number(failureBufferCost.toFixed(2)),
    totalProductionCost: Number(totalProductionCost.toFixed(2)),
    suggestedSalePriceBrl,
    onlyFilamentTimes3PriceBrl,
    mpFeeCost: Number(mpFeeCost.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    profitMarginPercent: Number(profitMarginPercent.toFixed(1)),
    realMarkupPercent: Number(realMarkupPercent.toFixed(0)),
    markupMultiplier: Number(markupMultiplier.toFixed(2)),
  };
}

/**
 * Fórmula oficial do Simulador de Chaveiro com Nome (Item 2.4 da Especificação):
 * - Preço base fixo: R$ 15,00 (até 12 letras)
 * - Adereço / Pingente pendurado: + R$ 5,00
 * - Peso = 5 + (letras * 1.1) + peso_adereco (2.5g se tiver pingente)
 * - Tempo = 14 + (letras * 1.5) + (4 min se tiver pingente)
 */
export function calculateCustomKeychainMetrics(text: string, charm: string) {
  const cleanText = (text || "CM").trim();
  const lettersCount = Math.max(1, Math.min(12, cleanText.length));
  const hasCharm = charm && charm !== "none";
  const charmWeight = hasCharm ? 2.5 : 0;
  const totalWeightGrams = Math.ceil(5 + lettersCount * 1.1 + charmWeight);
  const printTimeMinutes = Math.ceil(14 + lettersCount * 1.5 + (hasCharm ? 4 : 0));
  const priceBrl = 15 + (hasCharm ? 5 : 0);

  return {
    lettersCount,
    hasCharm,
    totalWeightGrams,
    printTimeMinutes,
    priceBrl,
  };
}
