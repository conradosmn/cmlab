export type ProductCategory = "decoracao" | "religioso" | "fidgets" | "chaveiros";

export type AccessoryCategory =
  | "chaveiro"
  | "silicone_acabamento"
  | "eletrica"
  | "fixacao"
  | "embalagem"
  | "outros";

export interface Filament {
  id: string;
  code: string;
  brand: string;
  material: "PLA" | "PLA Silk" | "PETG" | "TPU" | string;
  color_name: string;
  hex_code: string;
  purchase_date: string;
  purchase_price: number;
  initial_weight_grams: number;
  remaining_weight_grams: number;
  cost_per_gram: number;
  is_on_order_color: boolean;
  restock_lead_time_days: number;
  active: boolean;
  created_at?: string;
}

export interface Accessory {
  id: string;
  code: string;
  name: string;
  category?: AccessoryCategory;
  unit_label?: string; // ex: 'un.', 'gota', 'kit'
  supplier?: string;
  purchase_date: string;
  pack_price: number;
  pack_quantity: number;
  stock_quantity: number;
  min_stock_alert?: number;
  unit_cost: number;
  active: boolean;
}

export interface ProductAccessoryItem {
  accessory_id: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  makerworld_url?: string;
  images: string[];
  print_time_minutes: number;
  weight_grams: number;
  max_colors: number;
  allowed_filament_ids: string[];
  accessories: ProductAccessoryItem[];
  production_cost: number;
  price: number;
  is_custom_keychain: boolean;
  ready_stock_qty: number;
  active: boolean;
  created_at?: string;
}

export type KeychainFont = "rounded" | "modern" | "script";
export type KeychainCharm =
  | "none"
  | "star"
  | "flower"
  | "heart"
  | "butterfly"
  | "cat"
  | "cross";

export interface CustomKeychainData {
  text: string;
  font: KeychainFont;
  base_filament_id: string;
  base_hex: string;
  base_color_name: string;
  letter_filament_id: string;
  letter_hex: string;
  letter_color_name: string;
  charm: KeychainCharm;
  charm_filament_id?: string;
  charm_hex?: string;
  charm_color_name?: string;
}

export interface SelectedColorChoice {
  slot_label: string;
  filament_id: string;
  color_name: string;
  hex_code: string;
  weight_grams: number;
}

export type PaymentMethod = "pix" | "credit_tap" | "debit_tap";
export type PaymentStatus = "pending" | "awaiting_tap_to_pay" | "paid";
export type QueueStatus =
  | "waiting_payment"
  | "awaiting_material"
  | "queued"
  | "printing"
  | "done"
  | "delivered";

export interface PixSettings {
  pixKey: string;
  keyType: "cpf" | "cnpj" | "phone" | "email" | "random";
  merchantName: string;
  merchantCity: string;
}

export interface PrintQueueOrder {
  id: string;
  order_number: number;
  customer_name: string;
  customer_whatsapp: string;
  delivery_sector: string;
  product_id: string;
  product_title_snapshot: string;
  selected_colors: SelectedColorChoice[];
  custom_keychain_data?: CustomKeychainData;
  total_price: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  mp_payment_id?: string;
  print_time_minutes: number;
  weight_grams: number;
  cooldown_minutes: number;
  material_ready: boolean;
  restock_buffer_days?: number;
  is_night_owl_slot: boolean;
  estimated_start_at?: string;
  estimated_finish_at?: string;
  queue_status: QueueStatus;
  created_at: string;
}
