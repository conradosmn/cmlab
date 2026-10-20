export interface QueueOrderInput {
  id: string;
  order_number?: number;
  customer_name?: string;
  product_name: string;
  print_time_minutes: number;
  weight_grams?: number;
  material_ready: boolean;
  created_at: Date;
}

export interface ScheduledOrderOutput extends QueueOrderInput {
  estimated_start_at: Date;
  estimated_finish_at: Date;
  cooldown_after_minutes: number;
  is_night_owl_slot: boolean;
}

/**
 * Agendador Inteligente da Bambu Lab A1:
 * - Regra das 6h (360 min) + 2h (120 min) de folga obrigatória da impressora.
 * - Peças <= 6h recebem buffer padrão de 15 min para limpeza de mesa PEI.
 * - Janela de Operação Humana: nenhuma impressão nova se inicia entre 23h00 e 07h30.
 * - Modo Corujão (20h00 às 23h00): prioriza peças longas (>= 5h / 300 min) para rodarem na madrugada.
 * - Pulo de Peça Sem Material: pedidos com material_ready = false aguardam reposição sem travar a fila.
 */
export function buildSmartScheduleA1(
  paidOrders: QueueOrderInput[],
  startFrom: Date = new Date()
): ScheduledOrderOutput[] {
  const readyPool = paidOrders
    .filter((o) => o.material_ready)
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

  const schedule: ScheduledOrderOutput[] = [];
  let cursor = normalizeToAwakeHours(new Date(startFrom));

  while (readyPool.length > 0) {
    const currentHour = cursor.getHours();
    let selectedIndex = 0;
    let isNightOwl = false;

    // 1. Janela Noturna (20h às 23h): Prioriza peças longas (>= 5h / 300m) para rodar de madrugada
    if (currentHour >= 20 && currentHour < 23) {
      const longPrintIdx = readyPool.findIndex((item) => item.print_time_minutes >= 300);
      if (longPrintIdx !== -1) {
        selectedIndex = longPrintIdx;
        isNightOwl = true;
      }
    } else {
      // 2. Turno Diurno (07h30 às 19h59): Se a 1ª da fila for longa (>6h), tenta adiantar peças curtas que caibam antes das 20h
      const firstItem = readyPool[0];
      const hoursUntilNight = 20 - currentHour - cursor.getMinutes() / 60;
      if (firstItem.print_time_minutes > 360 && hoursUntilNight > 2) {
        const shortIdx = readyPool.findIndex(
          (item) => item.print_time_minutes <= hoursUntilNight * 60
        );
        if (shortIdx !== -1) selectedIndex = shortIdx;
      }
    }

    const [job] = readyPool.splice(selectedIndex, 1);
    const startAt = new Date(cursor);
    const finishAt = new Date(startAt.getTime() + job.print_time_minutes * 60000);

    // REGRA OFICIAL: Impressão > 6h (360 min) exige 2h (120 min) de folga para a A1. Caso contrário, 15 min.
    const cooldownMinutes = job.print_time_minutes > 360 ? 120 : 15;

    schedule.push({
      ...job,
      estimated_start_at: startAt,
      estimated_finish_at: finishAt,
      cooldown_after_minutes: cooldownMinutes,
      is_night_owl_slot: isNightOwl,
    });

    const nextAvailable = new Date(finishAt.getTime() + cooldownMinutes * 60000);
    cursor = normalizeToAwakeHours(nextAvailable);
  }

  return schedule;
}

// Impede que uma nova peça seja agendada para começar enquanto o operador está dormindo (23h00 às 07h30)
export function normalizeToAwakeHours(date: Date): Date {
  const d = new Date(date);
  const hour = d.getHours();
  const minutes = d.getMinutes();

  if (hour >= 23) {
    d.setDate(d.getDate() + 1);
    d.setHours(7, 30, 0, 0);
  } else if (hour < 7 || (hour === 7 && minutes < 30)) {
    d.setHours(7, 30, 0, 0);
  }
  return d;
}
