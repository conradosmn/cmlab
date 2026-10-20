import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  INITIAL_ACCESSORIES,
  INITIAL_FILAMENTS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
} from "@/lib/seedData";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "cmlab-db.json");

function readLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial = {
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
    return JSON.parse(raw);
  } catch {
    return {
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
        // Se o banco no Supabase acabou de ser criado e está vazio, popula automaticamente com os seeds iniciais!
        if (
          (filRes.data?.length ?? 0) === 0 &&
          (accRes.data?.length ?? 0) === 0 &&
          (prodRes.data?.length ?? 0) === 0
        ) {
          const cleanFilaments = INITIAL_FILAMENTS.map(
            ({ cost_per_gram, ...rest }) => rest
          );
          const cleanAccessories = INITIAL_ACCESSORIES.map(
            ({ unit_cost, ...rest }) => rest
          );

          await supabase.from("filaments").upsert(cleanFilaments);
          await supabase.from("accessories").upsert(cleanAccessories);
          await supabase.from("products").upsert(INITIAL_PRODUCTS);
          await supabase.from("print_queue_orders").upsert(INITIAL_ORDERS);

          return NextResponse.json({
            filaments: INITIAL_FILAMENTS,
            accessories: INITIAL_ACCESSORIES,
            products: INITIAL_PRODUCTS,
            orders: INITIAL_ORDERS,
            source: "supabase_seeded",
            updatedAt: Date.now(),
          });
        }

        const local = readLocalDb();
        return NextResponse.json({
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
      filaments: body.filaments ?? local.filaments,
      accessories: body.accessories ?? local.accessories,
      products: body.products ?? local.products,
      orders: body.orders ?? local.orders,
      pixSettings: body.pixSettings ?? local.pixSettings,
    });

    if (isSupabaseConfigured && supabase) {
      try {
        if (Array.isArray(body.filaments)) {
          const cleanFilaments = body.filaments.map(
            ({ cost_per_gram, ...rest }: any) => rest
          );
          await supabase.from("filaments").upsert(cleanFilaments);
          const ids = cleanFilaments.map((f: any) => f.id);
          if (ids.length > 0) {
            await supabase.from("filaments").delete().not("id", "in", `(${ids.join(",")})`);
          }
        }
        if (Array.isArray(body.accessories)) {
          const cleanAccessories = body.accessories.map(
            ({ unit_cost, ...rest }: any) => rest
          );
          await supabase.from("accessories").upsert(cleanAccessories);
          const ids = cleanAccessories.map((a: any) => a.id);
          if (ids.length > 0) {
            await supabase
              .from("accessories")
              .delete()
              .not("id", "in", `(${ids.join(",")})`);
          }
        }
        if (Array.isArray(body.products)) {
          await supabase.from("products").upsert(body.products);
          const ids = body.products.map((p: any) => p.id);
          if (ids.length > 0) {
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
