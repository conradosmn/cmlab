import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  INITIAL_ACCESSORIES,
  INITIAL_ADMIN_USERS,
  INITIAL_FILAMENTS,
  INITIAL_ORDERS,
  INITIAL_PRINTERS,
  INITIAL_PRODUCTS,
} from "@/lib/seedData";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { supabaseAdmin as supabase } from "@/lib/supabaseAdmin";
import { SESSION_COOKIE, readSessionToken, toPublicAdminUsers } from "@/lib/authServer";
import {
  SYS_CONFIG_ACC_ID,
  ensureMasterAdmin,
  readLocalDb,
  writeLocalDb,
} from "@/lib/serverStore";
import { AdminUser, PrintQueueOrder } from "@/lib/types";

export const runtime = "nodejs";

async function hasAdminSession(): Promise<boolean> {
  const store = await cookies();
  const session = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  return Boolean(session);
}

/**
 * A vitrine pública precisa dos pedidos para estimar a fila, mas não dos dados
 * pessoais de quem comprou. Sem sessão, some tudo que identifica o cliente.
 */
function stripOrderPii(orders: PrintQueueOrder[]): PrintQueueOrder[] {
  return (orders || []).map((o) => ({
    ...o,
    customer_name: "",
    customer_whatsapp: "",
    delivery_sector: "",
    mp_payment_id: undefined,
  }));
}

/**
 * O cliente nunca recebe nem envia password_hash. Num POST, o hash gravado é
 * sempre o que já existia no servidor — caso contrário uma atualização de
 * cadastro apagaria a senha de todos os usuários.
 */
function mergeAdminUsersPreservingHashes(
  incoming: AdminUser[] | undefined,
  existing: AdminUser[]
): AdminUser[] {
  if (!Array.isArray(incoming)) return existing;
  const byId = new Map(existing.map((u) => [u.id, u]));
  return incoming.map((u) => {
    const prev = byId.get(u.id);
    const { password_hash: _ignored, ...clean } = u as AdminUser & {
      password_hash?: string;
    };
    return { ...clean, password_hash: prev?.password_hash };
  });
}

export async function GET() {
  const authed = await hasAdminSession();

  if (isSupabaseConfigured && supabase) {
    try {
      const [filRes, accRes, prodRes, ordRes] = await Promise.all([
        supabase.from("filaments").select("*"),
        supabase.from("accessories").select("*"),
        supabase.from("products").select("*"),
        supabase
          .from("print_queue_orders")
          .select("*")
          .order("created_at", { ascending: true }),
      ]);

      if (!filRes.error && !accRes.error && !prodRes.error && !ordRes.error) {
        const local = readLocalDb();
        const allAccRows = accRes.data || [];
        const sysConfigRow = allAccRows.find((a: any) => a.id === SYS_CONFIG_ACC_ID);
        const visibleAccRows = allAccRows.filter((a: any) => a.id !== SYS_CONFIG_ACC_ID);

        let parsedSysConfig: any = {};
        if (sysConfigRow?.supplier) {
          try {
            parsedSysConfig = JSON.parse(sysConfigRow.supplier);
          } catch {
            parsedSysConfig = {};
          }
        }

        const remoteAdminUsers = ensureMasterAdmin(
          parsedSysConfig.adminUsers || local.adminUsers || INITIAL_ADMIN_USERS
        );
        const remotePrinters =
          Array.isArray(parsedSysConfig.printers) && parsedSysConfig.printers.length > 0
            ? parsedSysConfig.printers
            : local.printers || INITIAL_PRINTERS;
        const remotePixSettings = parsedSysConfig.pixSettings || local.pixSettings;
        const remoteProductCategories =
          parsedSysConfig.productCategories || local.productCategories || [];

        const orders = (ordRes.data || []).map((o: any) => ({
          ...o,
          total_price: Number(o.total_price),
        }));

        return NextResponse.json({
          // Lista de usuários só para quem está autenticado, e sempre sem hash.
          adminUsers: authed ? toPublicAdminUsers(remoteAdminUsers) : [],
          printers: remotePrinters,
          filaments: (filRes.data || []).map((f: any) => ({
            ...f,
            purchase_price: Number(f.purchase_price),
            cost_per_gram: Number(
              f.cost_per_gram ??
                f.purchase_price / (f.initial_weight_grams || 1000)
            ),
          })),
          accessories: visibleAccRows.map((a: any) => ({
            ...a,
            pack_price: Number(a.pack_price),
            unit_cost: Number(
              a.unit_cost ?? a.pack_price / (a.pack_quantity || 1)
            ),
          })),
          products: (prodRes.data || []).map((p: any) => ({
            ...p,
            production_cost: Number(p.production_cost),
            price: Number(p.price),
            accessories: p.accessories || [],
          })),
          orders: authed ? orders : stripOrderPii(orders),
          pixSettings: remotePixSettings,
          productCategories: remoteProductCategories,
          source: "supabase",
          authenticated: authed,
          updatedAt: Date.now(),
        });
      } else {
        console.error("Supabase query errors:", {
          fil: filRes.error,
          acc: accRes.error,
          prod: prodRes.error,
          ord: ordRes.error,
        });
      }
    } catch (e) {
      console.error("Supabase GET fallback to local:", e);
    }
  }

  const db = readLocalDb();
  return NextResponse.json({
    ...db,
    adminUsers: authed ? toPublicAdminUsers(db.adminUsers || []) : [],
    orders: authed ? db.orders || [] : stripOrderPii(db.orders || []),
    source: "local",
    authenticated: authed,
  });
}

/**
 * Mutações administrativas. O middleware já recusa esta rota sem sessão válida;
 * a verificação abaixo é a segunda tranca, caso o matcher mude.
 */
export async function POST(req: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login no painel administrativo." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const local = readLocalDb();
    const existingUsers = ensureMasterAdmin(local.adminUsers);

    const next = writeLocalDb({
      adminUsers: ensureMasterAdmin(
        mergeAdminUsersPreservingHashes(body.adminUsers, existingUsers)
      ),
      printers: body.printers ?? local.printers,
      filaments: body.filaments ?? local.filaments,
      accessories: body.accessories ?? local.accessories,
      products: body.products ?? local.products,
      orders: body.orders ?? local.orders,
      pixSettings: body.pixSettings ?? local.pixSettings,
      productCategories: body.productCategories ?? local.productCategories,
    });

    if (isSupabaseConfigured && supabase) {
      try {
        // Lê config atual do Supabase para não sobrescrever em ambientes serverless (Netlify/Vercel)
        const { data: existingSysRow } = await supabase
          .from("accessories")
          .select("supplier")
          .eq("id", SYS_CONFIG_ACC_ID)
          .maybeSingle();

        let prevSys: any = {};
        if (existingSysRow?.supplier) {
          try {
            prevSys = JSON.parse(existingSysRow.supplier);
          } catch {
            prevSys = {};
          }
        }

        const mergedSys = {
          adminUsers: ensureMasterAdmin(
            body.adminUsers !== undefined
              ? mergeAdminUsersPreservingHashes(
                  body.adminUsers,
                  ensureMasterAdmin(prevSys.adminUsers || existingUsers)
                )
              : prevSys.adminUsers ?? next.adminUsers
          ),
          printers: body.printers ?? prevSys.printers ?? next.printers,
          pixSettings: body.pixSettings ?? prevSys.pixSettings ?? next.pixSettings,
          productCategories:
            body.productCategories ?? prevSys.productCategories ?? next.productCategories,
        };

        if (
          body.adminUsers !== undefined ||
          body.printers !== undefined ||
          body.pixSettings !== undefined ||
          body.productCategories !== undefined ||
          !existingSysRow
        ) {
          await supabase.from("accessories").upsert([
            {
              id: SYS_CONFIG_ACC_ID,
              code: "__SYS_CFG__",
              name: "System Config",
              category: "outros",
              unit_label: "cfg",
              supplier: JSON.stringify(mergedSys),
              purchase_date: "2026-10-20",
              pack_price: 0,
              pack_quantity: 1,
              stock_quantity: 0,
              min_stock_alert: 0,
              active: false,
            },
          ]);
        }

        if (Array.isArray(body.filaments)) {
          if (body.filaments.length === 0) {
            await supabase.from("filaments").delete().neq("id", "__none__");
          } else {
            const usedCodes = new Set<string>();
            const cleanFilaments = body.filaments.map(
              ({ cost_per_gram, ...rest }: any, idx: number) => {
                let uniqueCode = (rest.code || `FIL-${idx + 1}`).trim();
                if (usedCodes.has(uniqueCode.toUpperCase())) {
                  uniqueCode = `${uniqueCode}-${String(rest.id || idx).slice(-4)}`;
                }
                usedCodes.add(uniqueCode.toUpperCase());
                return { ...rest, code: uniqueCode };
              }
            );
            await supabase.from("filaments").upsert(cleanFilaments);
            const ids = cleanFilaments.map((f: any) => f.id);
            await supabase.from("filaments").delete().not("id", "in", `(${ids.join(",")})`);
          }
        }
        if (Array.isArray(body.accessories)) {
          const filteredAccs = body.accessories.filter(
            (a: any) => a.id !== SYS_CONFIG_ACC_ID
          );
          if (filteredAccs.length === 0) {
            await supabase
              .from("accessories")
              .delete()
              .neq("id", SYS_CONFIG_ACC_ID);
          } else {
            const cleanAccessories = filteredAccs.map(
              ({ unit_cost, ...rest }: any) => rest
            );
            await supabase.from("accessories").upsert(cleanAccessories);
            const ids = [...cleanAccessories.map((a: any) => a.id), SYS_CONFIG_ACC_ID];
            await supabase
              .from("accessories")
              .delete()
              .not("id", "in", `(${ids.join(",")})`);
          }
        }
        if (Array.isArray(body.products)) {
          if (body.products.length === 0) {
            await supabase.from("products").delete().neq("id", "__none__");
          } else {
            await supabase.from("products").upsert(body.products);
            const ids = body.products.map((p: any) => p.id);
            await supabase.from("products").delete().not("id", "in", `(${ids.join(",")})`);
          }
        }
        if (Array.isArray(body.orders)) {
          if (body.orders.length === 0) {
            await supabase.from("print_queue_orders").delete().neq("id", "__none__");
          } else {
            await supabase.from("print_queue_orders").upsert(body.orders);
          }
        }
      } catch (supaErr) {
        console.error("Supabase upsert error:", supaErr);
      }
    }

    return NextResponse.json({
      ...next,
      adminUsers: toPublicAdminUsers(next.adminUsers || []),
      source: isSupabaseConfigured ? "supabase" : "local",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
