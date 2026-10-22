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

function ensureMasterAdmin(users: any[] | undefined) {
  const list = Array.isArray(users) ? [...users] : [];
  const master = INITIAL_ADMIN_USERS[0];
  const exists = list.some(
    (u) => u.username?.toLowerCase() === master.username.toLowerCase()
  );
  if (!exists) {
    list.unshift(master);
  }
  return list;
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
        let remoteAdminUsers = local.adminUsers || INITIAL_ADMIN_USERS;
        try {
          const usrRes = await supabase.from("admin_users").select("*");
          if (!usrRes.error && Array.isArray(usrRes.data) && usrRes.data.length > 0) {
            remoteAdminUsers = ensureMasterAdmin(usrRes.data);
          }
        } catch {
          // fallback silencioso caso a tabela admin_users ainda não exista no Supabase
        }

        return NextResponse.json({
          adminUsers: remoteAdminUsers,
          printers: local.printers || INITIAL_PRINTERS,
          filaments: (filRes.data || []).map((f: any) => ({
            ...f,
            purchase_price: Number(f.purchase_price),
            cost_per_gram: Number(
              f.cost_per_gram ??
                f.purchase_price / (f.initial_weight_grams || 1000)
            ),
          })),
          accessories: (accRes.data || []).map((a: any) => ({
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
          pixSettings: local.pixSettings,
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
        if (Array.isArray(body.adminUsers)) {
          try {
            const cleanUsers = ensureMasterAdmin(body.adminUsers);
            await supabase.from("admin_users").upsert(cleanUsers);
          } catch {
            // fallback caso tabela admin_users ainda não tenha sido criada
          }
        }
        if (Array.isArray(body.filaments)) {
          if (body.filaments.length === 0) {
            await supabase.from("filaments").delete().neq("id", "__none__");
          } else {
            const cleanFilaments = body.filaments.map(
              ({ cost_per_gram, ...rest }: any) => rest
            );
            await supabase.from("filaments").upsert(cleanFilaments);
            const ids = cleanFilaments.map((f: any) => f.id);
            await supabase.from("filaments").delete().not("id", "in", `(${ids.join(",")})`);
          }
        }
        if (Array.isArray(body.accessories)) {
          if (body.accessories.length === 0) {
            await supabase.from("accessories").delete().neq("id", "__none__");
          } else {
            const cleanAccessories = body.accessories.map(
              ({ unit_cost, ...rest }: any) => rest
            );
            await supabase.from("accessories").upsert(cleanAccessories);
            const ids = cleanAccessories.map((a: any) => a.id);
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
