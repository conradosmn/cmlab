-- ============================================================================
-- CM Casa Criativa (CMLab) - Schema Completo PostgreSQL / Supabase
-- Cole este script no SQL Editor do Supabase e clique em "Run"
-- ============================================================================

-- 1. Bobinas de Filamento e Paleta de Cores (Nascidas do Catálogo / Estoque)
CREATE TABLE IF NOT EXISTS filaments (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  brand TEXT DEFAULT 'A Definir',
  material TEXT NOT NULL DEFAULT 'PLA',
  color_name TEXT NOT NULL,
  hex_code TEXT NOT NULL,
  
  purchase_date DATE DEFAULT CURRENT_DATE,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 110.00,
  initial_weight_grams INT NOT NULL DEFAULT 1000,
  remaining_weight_grams INT NOT NULL DEFAULT 1000,
  
  cost_per_gram DECIMAL(10,4) GENERATED ALWAYS AS (purchase_price / NULLIF(initial_weight_grams, 0)) STORED,
  
  is_on_order_color BOOLEAN DEFAULT false,
  restock_lead_time_days INT DEFAULT 3,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Gerenciador de Recursos / Acessórios (Chaveiro, Ilha, Ímã, Gota de Silicone, Kit LED)
CREATE TABLE IF NOT EXISTS accessories (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'chaveiro',
  unit_label TEXT DEFAULT 'un.',
  supplier TEXT DEFAULT 'Fornecedor Padrão',
  purchase_date DATE DEFAULT CURRENT_DATE,
  pack_price DECIMAL(10,2) NOT NULL,
  pack_quantity INT NOT NULL,
  stock_quantity INT NOT NULL,
  min_stock_alert INT DEFAULT 20,
  unit_cost DECIMAL(10,4) GENERATED ALWAYS AS (pack_price / NULLIF(pack_quantity, 0)) STORED,
  active BOOLEAN DEFAULT true
);

-- 3. Catálogo de Produtos (Perfil Bambu Lab A1)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'decoracao', 'religioso', 'fidgets', 'chaveiros'
  description TEXT,
  makerworld_url TEXT,
  images TEXT[] DEFAULT '{}',
  
  -- Dados Técnicos do Perfil A1
  print_time_minutes INT NOT NULL,
  weight_grams INT NOT NULL,
  max_colors INT DEFAULT 1,
  allowed_filament_ids TEXT[] DEFAULT '{}',
  accessories JSONB DEFAULT '[]', -- Ex: [{"accessory_id": "acc-silicone", "quantity": 4}]
  
  -- Custos e Preço
  production_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  
  is_custom_keychain BOOLEAN DEFAULT false,
  ready_stock_qty INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ficha Técnica Relacional (Opcional para relatórios SQL)
CREATE TABLE IF NOT EXISTS product_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  accessory_id TEXT REFERENCES accessories(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1
);

-- 5. Pedidos e Fila de Impressão Unificados
CREATE TABLE IF NOT EXISTS print_queue_orders (
  id TEXT PRIMARY KEY,
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  delivery_sector TEXT NOT NULL,
  
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  product_title_snapshot TEXT NOT NULL,
  selected_colors JSONB NOT NULL,
  custom_keychain_data JSONB,
  
  total_price DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'pix', 'credit_tap', 'debit_tap'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'awaiting_tap_to_pay', 'paid'
  mp_payment_id TEXT,
  
  -- Controle da Fila da Bambu Lab A1
  print_time_minutes INT NOT NULL,
  weight_grams INT NOT NULL,
  cooldown_minutes INT NOT NULL DEFAULT 15,
  material_ready BOOLEAN DEFAULT true,
  restock_buffer_days INT DEFAULT 0,
  is_night_owl_slot BOOLEAN DEFAULT false,
  estimated_start_at TIMESTAMPTZ,
  estimated_finish_at TIMESTAMPTZ,
  queue_status TEXT DEFAULT 'waiting_payment',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Usuários Administrativos do Painel (/admin)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_master BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissões e Políticas de Acesso (Row Level Security aberta para operação da Feira)
ALTER TABLE filaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_queue_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso Total Feira AdminUsers" ON admin_users;
CREATE POLICY "Acesso Total Feira AdminUsers" ON admin_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Feira Filaments" ON filaments;
CREATE POLICY "Acesso Total Feira Filaments" ON filaments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Feira Accessories" ON accessories;
CREATE POLICY "Acesso Total Feira Accessories" ON accessories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Feira Products" ON products;
CREATE POLICY "Acesso Total Feira Products" ON products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso Total Feira Orders" ON print_queue_orders;
CREATE POLICY "Acesso Total Feira Orders" ON print_queue_orders FOR ALL USING (true) WITH CHECK (true);

-- Habilita Realtime para sincronização instantânea entre iPad (/feira) e Celular (/admin/caixa)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE print_queue_orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE filaments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE accessories;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE products;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
