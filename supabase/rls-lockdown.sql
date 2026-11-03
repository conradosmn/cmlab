-- ============================================================================
-- CMLab — Fechamento da RLS
--
-- PRÉ-REQUISITO: a variável SUPABASE_SERVICE_ROLE_KEY precisa estar configurada
-- no Vercel ANTES de rodar este script. Sem ela o servidor escreve com a chave
-- anônima, e ao aplicar estas políticas todas as gravações passam a falhar.
--
-- Por que isto é necessário: a anon key é embutida no bundle que qualquer
-- visitante baixa — ela é pública por construção. Enquanto as políticas forem
-- USING (true), qualquer pessoa lê e escreve o banco inteiro direto pela API
-- REST do Supabase, sem passar pela aplicação. O service_role ignora RLS e só
-- existe no servidor.
--
-- Cole no SQL Editor do Supabase e clique em Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Remove as políticas abertas
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Acesso Total Feira Filaments"    ON filaments;
DROP POLICY IF EXISTS "Acesso Total Feira Accessories"  ON accessories;
DROP POLICY IF EXISTS "Acesso Total Feira Products"     ON products;
DROP POLICY IF EXISTS "Acesso Total Feira Orders"       ON print_queue_orders;
DROP POLICY IF EXISTS "Acesso Total Feira AdminUsers"   ON admin_users;

ALTER TABLE filaments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_queue_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users        ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. Catálogo: leitura pública (a vitrine precisa), escrita nenhuma
-- ----------------------------------------------------------------------------
CREATE POLICY "catalogo_leitura_publica_products" ON products
  FOR SELECT TO anon, authenticated USING (active IS NOT FALSE);

CREATE POLICY "catalogo_leitura_publica_filaments" ON filaments
  FOR SELECT TO anon, authenticated USING (true);

-- A linha de configuração do sistema mora dentro de `accessories` e carrega os
-- usuários administrativos. Ela fica de fora da leitura pública.
-- (A correção definitiva é movê-la para uma tabela própria — ver item 5.)
CREATE POLICY "catalogo_leitura_publica_accessories" ON accessories
  FOR SELECT TO anon, authenticated
  USING (id <> '__cmlab_system_config__');

-- ----------------------------------------------------------------------------
-- 3. Pedidos: nada para o público
--    Criação e leitura passam pelas rotas do servidor, que usam service_role.
--    Dados de cliente (nome, WhatsApp, setor) nunca mais saem pela API REST.
-- ----------------------------------------------------------------------------
-- (sem policy = sem acesso para anon; o service_role ignora RLS)

-- ----------------------------------------------------------------------------
-- 4. admin_users: nenhum acesso anônimo, em hipótese alguma
-- ----------------------------------------------------------------------------
-- (sem policy)

-- ----------------------------------------------------------------------------
-- 5. Verificação — rode depois e confira o resultado
-- ----------------------------------------------------------------------------
-- Deve listar apenas as 3 políticas de SELECT criadas acima:
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Deve retornar true para todas as tabelas:
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('filaments','accessories','products','print_queue_orders','admin_users');
