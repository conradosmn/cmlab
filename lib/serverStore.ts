import fs from "fs";
import path from "path";
import { AdminUser } from "./types";
import {
  INITIAL_ACCESSORIES,
  INITIAL_ADMIN_USERS,
  INITIAL_FILAMENTS,
  INITIAL_ORDERS,
  INITIAL_PRINTERS,
  INITIAL_PRODUCTS,
} from "./seedData";
import { isSupabaseConfigured } from "./supabaseClient";
import { supabaseAdmin as supabase } from "./supabaseAdmin";

export const DATA_DIR = path.join(process.cwd(), ".data");
export const DB_FILE = path.join(DATA_DIR, "cmlab-db.json");
export const SYS_CONFIG_ACC_ID = "__cmlab_system_config__";

/**
 * Garante que o usuário master exista e normaliza papéis. Preserva o
 * password_hash já gravado e, quando o master ainda não tem hash, usa o de
 * ADMIN_MASTER_PASSWORD_HASH — variável só de servidor, nunca NEXT_PUBLIC_.
 */
export function ensureMasterAdmin(users: AdminUser[] | undefined): AdminUser[] {
  const list: AdminUser[] = Array.isArray(users) ? [...users] : [];
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

  const masterHashFromEnv = process.env.ADMIN_MASTER_PASSWORD_HASH;

  return list.map((u) => {
    const isMaster = u.is_master || u.username?.toLowerCase() === "conradosmn";
    if (isMaster) {
      return {
        ...u,
        is_master: true,
        role: "admin" as const,
        password_hash: u.password_hash || masterHashFromEnv,
      };
    }
    return { ...u, role: u.role || "gerente" };
  });
}

export function readLocalDb(): any {
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
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    if (!Array.isArray(parsed.printers) || parsed.printers.length === 0) {
      parsed.printers = INITIAL_PRINTERS;
    }
    parsed.adminUsers = ensureMasterAdmin(parsed.adminUsers);
    return parsed;
  } catch {
    return {
      adminUsers: ensureMasterAdmin(undefined),
      printers: INITIAL_PRINTERS,
      filaments: INITIAL_FILAMENTS,
      accessories: INITIAL_ACCESSORIES,
      products: INITIAL_PRODUCTS,
      orders: INITIAL_ORDERS,
    };
  }
}

export function writeLocalDb(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = { ...data, updatedAt: Date.now() };
    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), "utf-8");
    return payload;
  } catch {
    // Em serverless (Vercel/Netlify) o filesystem é somente leitura: o Supabase
    // é a fonte de verdade e a escrita local é só um cache de desenvolvimento.
    return data;
  }
}

/** Lê o JSON de configuração guardado na linha de sistema do Supabase. */
export async function readRemoteSysConfig(): Promise<any> {
  if (!isSupabaseConfigured || !supabase) return {};
  try {
    const { data } = await supabase
      .from("accessories")
      .select("supplier")
      .eq("id", SYS_CONFIG_ACC_ID)
      .maybeSingle();
    if (!data?.supplier) return {};
    return JSON.parse(data.supplier);
  } catch {
    return {};
  }
}

export async function writeRemoteSysConfig(next: {
  adminUsers?: AdminUser[];
  printers?: any[];
  pixSettings?: any;
  productCategories?: any[];
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const prev = await readRemoteSysConfig();
  const merged = {
    adminUsers: next.adminUsers ?? prev.adminUsers,
    printers: next.printers ?? prev.printers,
    pixSettings: next.pixSettings ?? prev.pixSettings,
    // Precisa constar aqui: esta função regrava o JSON inteiro, e uma chave
    // esquecida some (ex: trocar senha apagaria as categorias).
    productCategories: next.productCategories ?? prev.productCategories,
  };
  await supabase.from("accessories").upsert([
    {
      id: SYS_CONFIG_ACC_ID,
      code: "__SYS_CFG__",
      name: "System Config",
      category: "outros",
      unit_label: "cfg",
      supplier: JSON.stringify(merged),
      purchase_date: "2026-10-20",
      pack_price: 0,
      pack_quantity: 1,
      stock_quantity: 0,
      min_stock_alert: 0,
      active: false,
    },
  ]);
}

/** Lista de usuários COM hash — uso exclusivo do servidor. */
export async function readAdminUsers(): Promise<AdminUser[]> {
  const local = readLocalDb();
  const remote = await readRemoteSysConfig();
  return ensureMasterAdmin(remote.adminUsers || local.adminUsers);
}

export async function writeAdminUsers(users: AdminUser[]): Promise<AdminUser[]> {
  const normalized = ensureMasterAdmin(users);
  const local = readLocalDb();
  writeLocalDb({ ...local, adminUsers: normalized });
  await writeRemoteSysConfig({ adminUsers: normalized });
  return normalized;
}
