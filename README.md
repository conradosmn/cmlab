# CM Casa Criativa (CMLab) 🌿

Sistema Kiosk de Encomendas para iPad (E-commerce de Feira TCE) + Simulador de Chaveiros 2.5D + ERP de Custos, Gerenciador de Recursos e Agendador Inteligente da **Bambu Lab A1**.

## Como rodar no Laptop / Outra Máquina

1. **Clone o repositório e instale as dependências:**
   ```bash
   git clone <URL_DO_SEU_REPOSITORIO_GITHUB>
   cd CMLab
   npm install
   ```

2. **Crie o arquivo `.env.local` na raiz do projeto com as credenciais do Supabase:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

## Rotas Principais
- `http://localhost:3000` — Hub de Comando do Atelier
- `http://localhost:3000/feira` — Modo Kiosk iPad (Vitrine + Simulador de Chaveiros 2.5D + Checkout PIX/Tap to Pay)
- `http://localhost:3000/admin/caixa` — Caixa Mobile de Bolso (Confirmação Tap to Pay 1 Toque + Configuração Chave PIX Real)
- `http://localhost:3000/admin/catalogo` — Importador MakerWorld A1 / `.3mf` + Calculadora de Engenharia de Custos 3D
- `http://localhost:3000/admin/insumos` — Gerenciador de Recursos (Chaveiros, Gotas de Silicone, Bobinas de Filamento e Lista de Compras)
- `http://localhost:3000/admin/fila` — Agendador Inteligente Bambu Lab A1 (Modo Corujão, Regra >6h + 2h de Folga, Exportador OpenSCAD e WhatsApp TCE)
