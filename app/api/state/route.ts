import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  INITIAL_ACCESSORIES,
  INITIAL_ADMIN_USERS,
  INITIAL_FILAMENTS,
  INITIAL_ORDERS,
  INITIAL_PRINTERS,
  INITIAL_PRODUCTS,
} from "@/lib/seedData";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "cmlab-db.json");
const SYS_CONFIG_ACC_ID = "__cmlab_system_config__";

function ensureMasterAdmin(users: any[] | undefined) {
  const list = Array.isArray(users) ? [...users] : [];
  for (const seedUser of INITIAL_ADMIN_USERS) {
    const exists = list.some(
      (u) => u.username?.toLowerCase() === seedUser.username.toLowerCase()
    );
    if (!exists) {
      if (seedUser.is_master) {
        list.unshift(seedUser);
      } else {
        list.push(seedUser);
      }
    }
  }
  return list.map((u) => {
    const isMaster =
      u.is_master || u.username?.toLowerCase() === "conradosmn";
    if (isMaster) {
      return { ...u, is_master: true, role: "admin" };
    }
    return {
      ...u,
      role: u.role || "gerente",
    };
  });
}

function readLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = {
        adminUsers: INITIAL_ADMIN_USERS,
        printers: INITIAL_PRINTERS,
        filaments: INITIAL_FILAMENTS,
        accessories: INITIAL_ACCESSORIES,
        products: INITIAL_PRODUCTS,
        orders: INITIAL_ORDERS,
        updatedAt: Date.now(),
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.printers) || parsed.printers.length === 0) {
      parsed.printers = INITIAL_PRINTERS;
    }
    parsed.adminUsers = ensureMasterAdmin(parsed.adminUsers);
    return parsed;
  } catch {
    return {
      adminUsers: INITIAL_ADMIN_USERS,
      printers: INITIAL_PRINTERS,
      filaments: INITIAL_FILAMENTS,
      accessories: INITIAL_ACCESSORIES,
      products: INITIAL_PRODUCTS,
      orders: INITIAL_ORDERS,
      updatedAt: Date.now(),
    };
  }
}

function writeLocalDb(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = { ...data, updatedAt: Date.now() };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf-8");
    return payload;
  } catch (e) {
    console.error("Failed to write local db", e);
    return data;
  }
}

export async function GET() {
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

        return NextResponse.json({
          adminUsers: remoteAdminUsers,
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
          orders: (ordRes.data || []).map((o: any) => ({
            ...o,
            total_price: Number(o.total_price),
          })),
          pixSettings: remotePixSettings,
          source: "supabase",
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
  return NextResponse.json({ ...db, source: "local" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const local = readLocalDb();
    const next = writeLocalDb({
      adminUsers: ensureMasterAdmin(body.adminUsers ?? local.adminUsers),
      printers: body.printers ?? local.printers,
      filaments: body.filaments ?? local.filaments,
      accessories: body.accessories ?? local.accessories,
      products: body.products ?? local.products,
      orders: body.orders ?? local.orders,
      pixSettings: body.pixSettings ?? local.pixSettings,
    });

    if (isSupabaseConfigured && supabase) {
      try {
        // Lê config atual do Supabase para não sobrescrever em ambientes serverless (Netlify)
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
            body.adminUsers ?? prevSys.adminUsers ?? next.adminUsers
          ),
          printers: body.printers ?? prevSys.printers ?? next.printers,
          pixSettings: body.pixSettings ?? prevSys.pixSettings ?? next.pixSettings,
        };

        if (
          body.adminUsers !== undefined ||
          body.printers !== undefined ||
          body.pixSettings !== undefined ||
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

    return NextResponse.json({ ...next, source: isSupabaseConfigured ? "supabase" : "local" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
