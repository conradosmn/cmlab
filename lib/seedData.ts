import {
  Accessory,
  AdminUser,
  Filament,
  Printer3D,
  PrintQueueOrder,
  Product,
} from "./types";

/**
 * Contas semente SEM material de senha. O hash do usuário master é injetado no
 * servidor a partir de ADMIN_MASTER_PASSWORD_HASH (ver app/api/state/route.ts);
 * os demais começam sem hash e só entram depois que um admin gera uma senha
 * temporária em /admin/usuarios.
 *
 * Nunca volte a colocar senha literal aqui: este arquivo vai para o repositório.
 */
export const INITIAL_ADMIN_USERS: AdminUser[] = [
  {
    id: "admin-master-conrado",
    username: "conradosmn",
    email: "eng.conradosmn@gmail.com",
    full_name: "Conrado de Sampaio Machado Neto",
    phone: "(86) 99999-9999",
    role: "admin",
    is_master: true,
    // A senha inicial vem de ADMIN_MASTER_PASSWORD_HASH, gerada fora do fluxo
    // normal de cadastro — por isso o master também troca no primeiro acesso.
    must_change_password: true,
    created_at: "2026-10-20T00:00:00.000Z",
  },
  {
    id: "usr-lorena-eulalio",
    username: "lorenaeulalio",
    email: "lorenaeulalio@gmail.com",
    full_name: "Lorena Eulálio Nunes",
    phone: "(86) 98146-5710",
    role: "gerente",
    is_master: false,
    must_change_password: true,
    created_at: "2026-10-21T21:45:00.000Z",
  },
];

export const INITIAL_PRINTERS: Printer3D[] = [
  {
    id: "printer-a1-01",
    code: "IMP-A1-01",
    name: "Bambu Lab A1 Combo #01 (Principal)",
    brand: "Bambu Lab",
    model: "A1 Combo (AMS Lite)",
    purchase_date: "2026-09-15",
    purchase_price: 4500.0,
    lifespan_hours: 8000,
    maintenance_reserve_percent: 0,
    average_power_watts: 150,
    hourly_depreciation_cost: 0.56, // R$ 4.500 / 8.000h = R$ 0,5625/h
    active: true,
  },
];

export const INITIAL_FILAMENTS: Filament[] = [];

export const INITIAL_ACCESSORIES: Accessory[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_ORDERS: PrintQueueOrder[] = [];
