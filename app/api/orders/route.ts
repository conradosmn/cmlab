import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { readLocalDb, writeLocalDb } from "@/lib/serverStore";
import { PrintQueueOrder } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_PAYMENT_METHODS = new Set(["pix", "credit_tap", "debit_tap"]);
/**
 * A vitrine só pode abrir um pedido aguardando pagamento. Marcar como "paid" é
 * atribuição do caixa, em /admin/caixa, que exige sessão — senão qualquer um
 * confirmaria o próprio pagamento e a baixa de estoque sairia de graça.
 */
const ALLOWED_INITIAL_STATUS = new Set(["pending", "awaiting_tap_to_pay"]);

function asPositiveNumber(value: unknown, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return n;
}

function asCleanString(value: unknown, maxLen: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLen);
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const customer_name = asCleanString(body.customer_name, 120);
  const customer_whatsapp = asCleanString(body.customer_whatsapp, 32);
  const delivery_sector = asCleanString(body.delivery_sector, 120);
  const product_id = asCleanString(body.product_id, 64);
  const product_title_snapshot = asCleanString(body.product_title_snapshot, 240);

  if (!customer_name || !customer_whatsapp || !product_id) {
    return NextResponse.json(
      { error: "Nome, WhatsApp e produto são obrigatórios." },
      { status: 400 }
    );
  }
  if (!ALLOWED_PAYMENT_METHODS.has(body.payment_method)) {
    return NextResponse.json(
      { error: "Forma de pagamento inválida." },
      { status: 400 }
    );
  }
  if (!ALLOWED_INITIAL_STATUS.has(body.payment_status)) {
    return NextResponse.json(
      { error: "Um pedido novo não pode já nascer pago." },
      { status: 400 }
    );
  }

  const total_price = asPositiveNumber(body.total_price, 100000);
  const print_time_minutes = asPositiveNumber(body.print_time_minutes, 100000);
  const weight_grams = asPositiveNumber(body.weight_grams, 100000);
  if (total_price === null || print_time_minutes === null || weight_grams === null) {
    return NextResponse.json(
      { error: "Valores de preço, tempo ou peso inválidos." },
      { status: 400 }
    );
  }

  const local = readLocalDb();
  const currentOrders: PrintQueueOrder[] = Array.isArray(local.orders)
    ? local.orders
    : [];

  let maxNumber = currentOrders.reduce(
    (m, o) => Math.max(m, o.order_number || 100),
    100
  );

  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase
      .from("print_queue_orders")
      .select("order_number")
      .order("order_number", { ascending: false })
      .limit(1);
    if (data?.[0]?.order_number) {
      maxNumber = Math.max(maxNumber, Number(data[0].order_number));
    }
  }

  const order: PrintQueueOrder = {
    id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order_number: maxNumber + 1,
    customer_name,
    customer_whatsapp,
    delivery_sector,
    product_id,
    product_title_snapshot,
    selected_colors: Array.isArray(body.selected_colors) ? body.selected_colors : [],
    custom_keychain_data: body.custom_keychain_data,
    total_price,
    payment_method: body.payment_method,
    payment_status: body.payment_status,
    print_time_minutes,
    weight_grams,
    cooldown_minutes: print_time_minutes > 360 ? 120 : 15,
    material_ready: Boolean(body.material_ready),
    restock_buffer_days: Number(body.restock_buffer_days) || 0,
    is_night_owl_slot: false,
    queue_status: "waiting_payment",
    created_at: new Date().toISOString(),
  };

  writeLocalDb({ ...local, orders: [...currentOrders, order] });

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("print_queue_orders").upsert([order]);
    if (error) {
      console.error("Falha ao gravar pedido no Supabase:", error);
      return NextResponse.json(
        { error: "Não foi possível registrar o pedido. Tente novamente." },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ order });
}
