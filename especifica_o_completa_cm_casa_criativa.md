# Especificação de Sistema & Arquitetura: CM Casa Criativa (CMLab)
**Objetivo:** Sistema Kiosk de Encomendas para iPad (E-commerce de Feira) + ERP de Custos, Estoque de Filamentos/Acessórios e Agendador Inteligente de Fila de Impressão 3D.
**Evento Alvo:** Feira do Tribunal de Contas (TCE).
**Equipamento de Produção:** 1x Impressora **Bambu Lab A1** (com AMS Lite - até 4 cores simultâneas, mesa $256 \times 256 \times 256\text{ mm}$).

---

## 1. Identidade Visual & Design System (`CM Casa Criativa`)

O visual deve fugir de temas escuros/tech e transmitir a sensação de um **atelier de decoração aconchegante, orgânico e elegante**. As únicas cores vibrantes na tela devem ser as fotos reais das peças e as amostras de filamento.

### Paleta de Cores (Tailwind Config)
*   **`linho` (`#FAF7F2`):** Fundo principal da página (Off-White quente).
*   **`areia` (`#F2ECE1`):** Fundo de cards, modais, barras de navegação e áreas secundárias.
*   **`borda` (`#E2D9C8`):** Linhas divisórias e bordas sutis dos componentes.
*   **`musgo` (`#4A4F3B`):** Cor primária de texto, títulos, preços, cabeçalhos e botões ativos (extraída das letras "CM" e folhas da logo).
*   **`oliva` (`#767A65`):** Textos secundários, legendas e indicadores discretos.
*   **`terracota` (`#A3522B`):** Cor de ação principal (Botões de CTA: *"Fazer Reserva"*, *"Montar Chaveiro"*, badges de destaque). Hover: `#88411F`.
*   **`argila` (`#C89D7C`):** Detalhes visuais suaves e estados de foco.

### Tipografia
*   **Títulos (`font-serif`):** `'Cormorant Garamond'` ou `'Playfair Display'` (elegante, remetendo ao monograma CM).
*   **Corpo, Preços e Botões (`font-sans`):** `'Plus Jakarta Sans'` ou `'Montserrat'`.
*   **Fontes do Simulador de Chaveiro:** `'Fredoka'` (Redonda), `'Montserrat'` (Moderna Forte), `'Pacifico'` (Cursiva).

---

## 2. Regras de Negócio Fundamentais

1.  **Categorias de Foco na Feira:**
    *   Vasos & Luminárias (Decoração)
    *   Artigos Religiosos / Espiritualidade
    *   Fidgets & Mimos
    *   Chaveiros Personalizados com Nome
2.  **Pagamento 100% Antecipado (Zero Risco de Desistência):**
    *   Todos os pedidos sob encomenda são pagos no ato da reserva na feira. Isso garante caixa imediato inclusive para comprar bobinas de filamento que estejam com estoque baixo ou que sejam "cores sob demanda".
    *   **PIX:** Gera QR Code dinâmico direto na tela do iPad (API Mercado Pago). Confirmação via Webhook muda a tela automaticamente.
    *   **Cartão (Crédito/Débito):** Utiliza o **Tap to Pay do Mercado Pago no celular do atendente**. O iPad exibe *"Aproxime seu cartão no celular do atendente"* (`payment_status = 'awaiting_tap_to_pay'`). O celular do atendente recebe um alerta em tempo real (Supabase Realtime) e tem um botão `[✅ Confirmar Recebimento Tap to Pay]`, que libera a tela do iPad instantaneamente.
3.  **Logística Facilitada para o Tribunal de Contas:**
    *   No checkout do iPad, o cliente preenche: **Nome**, **WhatsApp** e **Setor/Sala no TCE (ou opção de Retirada/Combinar via WhatsApp)**, evitando digitação longa de endereço completo na fila do estande.
4.  **Simulador de Chaveiro 2.5D ao Vivo no iPad (Sem gerar STL no cliente):**
    *   Renderização instantânea em **SVG Dinâmico com filtros de extrusão/sombra** (imulando perfeitamente o `offset()` arredondado da base + relevo das letras + furo da argola do OpenSCAD).
    *   **Preço Fixo do Chaveiro com Nome:** **R$ 15,00** (independente do número de letras, limite de ~11-12 caracteres).
    *   **Adereço / Pingente Pendurado (Upsell):** **+ R$ 5,00 fixo** (Estrela, Flor, Coração, Cruz). O adereço aparece pendurado na argola no preview ao vivo e permite escolher a cor do pingente.
    *   O peso em gramas e o tempo de impressão continuam sendo calculados nos bastidores (`peso = 5 + letras * 1.1 + peso_adereco`) para alimentar a fila e o estoque.
5.  **As Cores Nascem do Catálogo (Fluxo Guiado pelo Produto):**
    *   As cores disponíveis e necessárias para compra partem dos itens cadastrados no catálogo.
    *   Se uma cor estiver com **Estoque Baixo** ou for **Sob Encomenda (0g em casa)**, o sistema **não bloqueia a venda** no iPad: ele vende normalmente (recebendo antecipado), adiciona um buffer de dias no prazo daquele cliente (`restock_lead_time_days`) e joga a cor na **"Lista de Compras Automática"** do painel Admin.
6.  **Regras da Fila de Impressão da Bambu Lab A1:**
    *   **Regra das 6h + 2h de Folga:** Toda vez que uma impressão tiver tempo superior a **6 horas ($360\text{ min}$)**, o sistema insere obrigatoriamente **2 horas ($120\text{ min}$) de descanso/folga** para a impressora antes da próxima peça. Para peças menores ($\le 6\text{h}$), aplica-se um buffer padrão de $15\text{ min}$ para limpeza de mesa PEI.
    *   **Janela de Operação Humana:** Nenhuma impressão nova pode ser agendada para *iniciar* de madrugada (entre $23\text{h}00$ e $07\text{h}30$), pois o operador estará dormindo.
    *   **Modo Corujão (Otimização Dia/Noite):** Durante o dia ($07\text{h}30$ às $20\text{h}00$), a fila prioriza peças curtas e médias. Na janela noturna ($20\text{h}00$ às $23\text{h}00$), o algoritmo busca na fila peças longas ($\ge 5\text{h}$, como vasos e luminárias) para rodarem durante a madrugada. Assim, a máquina trabalha à noite e as 2h de folga já ocorrem enquanto o operador dorme.
    *   **Pulo de Peça Sem Material:** Se um pedido depender de compra de filamento (`material_ready = false`), ele fica aguardando reposição sem travar os pedidos seguintes que já têm bobina em casa.

---

## 3. Modelagem Completa do Banco de Dados (Supabase PostgreSQL)

```sql
-- 1. Bobinas de Filamento e Paleta de Cores (Nascidas do Catálogo / Estoque)
CREATE TABLE filaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- Ex: 'PLA-VOO-01', 'SILK-3DL-02'
  brand TEXT DEFAULT 'A Definir', -- Ex: 'Voolt3D', '3DLab', 'Bambu Lab', 'eSUN'
  material TEXT NOT NULL DEFAULT 'PLA', -- 'PLA', 'PLA Silk', 'PETG', 'TPU'
  color_name TEXT NOT NULL, -- Ex: 'Terracota Matte', 'Branco Mármore', 'Dourado Silk'
  hex_code TEXT NOT NULL, -- Ex: '#A3522B'
  
  purchase_date DATE DEFAULT CURRENT_DATE,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 110.00, -- Valor pago no rolo
  initial_weight_grams INT NOT NULL DEFAULT 1000,
  remaining_weight_grams INT NOT NULL DEFAULT 1000, -- Pode ficar negativo se vender sob demanda
  
  cost_per_gram DECIMAL(10,4) GENERATED ALWAYS AS (purchase_price / NULLIF(initial_weight_grams, 0)) STORED,
  
  is_on_order_color BOOLEAN DEFAULT false, -- True se ainda vai comprar a bobina com o dinheiro da feira
  restock_lead_time_days INT DEFAULT 3, -- Dias extras no prazo caso precise comprar o rolo
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Acessórios e Insumos de Acabamento (Corrente, Ilha, Ímã, Gota de Silicone, Kit LED)
CREATE TABLE accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- Ex: 'ACC-COR-01', 'ACC-SIL-01'
  name TEXT NOT NULL, -- 'Corrente + Argola', 'Ilha de Chaveiro', 'Ímã Neodímio', 'Gota de Silicone Base', 'Kit Elétrico Luminária'
  purchase_date DATE DEFAULT CURRENT_DATE,
  pack_price DECIMAL(10,2) NOT NULL,
  pack_quantity INT NOT NULL,
  stock_quantity INT NOT NULL,
  unit_cost DECIMAL(10,4) GENERATED ALWAYS AS (pack_price / NULLIF(pack_quantity, 0)) STORED,
  active BOOLEAN DEFAULT true
);

-- 3. Catálogo de Produtos (Perfil Bambu Lab A1)
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- 'decoracao', 'religioso', 'fidgets', 'chaveiros'
  description TEXT,
  makerworld_url TEXT,
  images TEXT[] DEFAULT '{}',
  
  -- Dados Técnicos do Perfil A1
  print_time_minutes INT NOT NULL,
  weight_grams INT NOT NULL,
  max_colors INT DEFAULT 1,
  allowed_filament_ids UUID[] DEFAULT '{}', -- Cores que o cliente pode escolher para este item
  
  -- Custos e Preço
  production_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  
  is_custom_keychain BOOLEAN DEFAULT false,
  ready_stock_qty INT DEFAULT 0, -- Caso tenha unidades a pronta-entrega na mesa
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ficha Técnica: Relação Produto <-> Acessórios
CREATE TABLE product_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  accessory_id UUID REFERENCES accessories(id),
  quantity INT NOT NULL DEFAULT 1 -- Ex: 4 gotas de silicone por vaso
);

-- 5. Pedidos e Fila de Impressão Unificados
CREATE TABLE print_queue_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  delivery_sector TEXT NOT NULL, -- Ex: 'DFINFRA / Sala 202' ou 'Retirada via WhatsApp'
  
  product_id UUID REFERENCES products(id),
  product_title_snapshot TEXT NOT NULL,
  selected_colors JSONB NOT NULL, -- Cores escolhidas (Base, Letra, Pingente ou Cor da Peça)
  custom_keychain_data JSONB, -- {"text": "Maria", "font": "rounded", "charm": "star", "charm_color": "#D4AF37"}
  
  total_price DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'pix', 'credit_tap', 'debit_tap'
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'awaiting_tap_to_pay', 'paid'
  mp_payment_id TEXT,
  
  -- Controle da Fila da Bambu Lab A1
  print_time_minutes INT NOT NULL,
  weight_grams INT NOT NULL,
  cooldown_minutes INT NOT NULL DEFAULT 15, -- 120 min (2h) se print_time_minutes > 360 (6h)
  material_ready BOOLEAN DEFAULT true, -- False se a cor escolhida precisar de compra de bobina
  is_night_owl_slot BOOLEAN DEFAULT false, -- True se alocado para o turno da noite (20h-23h)
  estimated_start_at TIMESTAMPTZ,
  estimated_finish_at TIMESTAMPTZ,
  queue_status TEXT DEFAULT 'waiting_payment', -- 'waiting_payment', 'awaiting_material', 'queued', 'printing', 'done', 'delivered'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Módulos de Back-End e Algoritmos Principais

### 4.1. Importador de Catálogo via MakerWorld (Filtro Exclusivo **Bambu Lab A1**)
Rota de API (`app/api/import-makerworld/route.ts`) para extrair fotos, peso em gramas, tempo em minutos e cores diretamente da URL do modelo no MakerWorld, selecionando sempre o perfil da **A1** (e ignorando perfis exclusivos de *A1 mini*):

```typescript
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    const html = await response.text();
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
    );

    if (!match || !match[1]) {
      return NextResponse.json(
        { error: "Não foi possível ler o JSON diretamente (Cloudflare). Use o upload do arquivo .3mf fatiado." },
        { status: 422 }
      );
    }

    const nextData = JSON.parse(match[1]);
    const design = nextData?.props?.pageProps?.design;
    if (!design) {
      return NextResponse.json({ error: "Modelo não encontrado." }, { status: 404 });
    }

    const instances = design.instances || [];

    // FILTRO EXCLUSIVO PARA BAMBU LAB A1 (Ignora perfis exclusivos 'A1 mini')
    const a1Instance =
      instances.find((inst: any) => {
        const title = (inst.title || "").toLowerCase();
        const compat = JSON.stringify(inst.extention?.modelInfo?.compatibility || "").toLowerCase();
        const mentionsA1 = /\ba1\b/.test(title) || compat.includes('"a1"') || compat.includes("bambu lab a1");
        const isOnlyMini = title.includes("a1 mini") && !title.replace("a1 mini", "").includes("a1");
        return mentionsA1 && !isOnlyMini;
      }) ||
      instances.find((inst: any) => !(inst.title || "").toLowerCase().includes("mini")) ||
      instances[0] ||
      {};

    const ext = a1Instance.extention?.modelInfo || {};
    const images = (design.designExtension?.design_pictures || [])
      .map((pic: any) => pic.url)
      .slice(0, 5);

    const weightGrams = Math.ceil(a1Instance.weight || ext.weight || 0);
    const predictionSeconds = a1Instance.prediction || ext.prediction || 0;
    const printTimeMinutes = Math.ceil(predictionSeconds / 60);

    // Extrai as cores e materiais exigidos pelo perfil A1 para alimentar a tabela 'filaments'
    const filamentsMap = new Map();
    for (const plate of ext.plates || []) {
      for (const fil of plate.filaments || []) {
        const key = `${fil.type}-${fil.color}`;
        const prevGrams = filamentsMap.get(key)?.usedGrams || 0;
        filamentsMap.set(key, {
          material: fil.type || "PLA",
          hexColor: fil.color || "#FFFFFF",
          usedGrams: Math.ceil(prevGrams + parseFloat(fil.usedG || "0")),
        });
      }
    }

    return NextResponse.json({
      title: design.title,
      profile_name: a1Instance.title || "Perfil Padrão A1",
      makerworld_url: url,
      images,
      weight_grams: weightGrams,
      print_time_minutes: printTimeMinutes,
      required_filaments: Array.from(filamentsMap.values()),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### 4.2. Algoritmo Agendador da Fila (Regra $>6\text{h} + 2\text{h}$ Folga + Modo Corujão)
Função central (`lib/queueScheduler.ts`) que organiza os pedidos pagos na fila da **Bambu Lab A1**:

```typescript
export interface QueueOrderInput {
  id: string;
  product_name: string;
  print_time_minutes: number;
  material_ready: boolean;
  created_at: Date;
}

export interface ScheduledOrderOutput extends QueueOrderInput {
  estimated_start_at: Date;
  estimated_finish_at: Date;
  cooldown_after_minutes: number;
  is_night_owl_slot: boolean;
}

export function buildSmartScheduleA1(
  paidOrders: QueueOrderInput[],
  startFrom: Date = new Date()
): ScheduledOrderOutput[] {
  // Filtra apenas pedidos com material disponível em casa (os sem material vão para aba de reposição)
  const readyPool = paidOrders
    .filter((o) => o.material_ready)
    .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

  const schedule: ScheduledOrderOutput[] = [];
  let cursor = normalizeToAwakeHours(new Date(startFrom));

  while (readyPool.length > 0) {
    const currentHour = cursor.getHours();
    let selectedIndex = 0;
    let isNightOwl = false;

    // 1. Janela Noturna (20h às 23h): Prioriza peças longas (>= 5h / 300m) para rodar de madrugada
    if (currentHour >= 20 && currentHour < 23) {
      const longPrintIdx = readyPool.findIndex((item) => item.print_time_minutes >= 300);
      if (longPrintIdx !== -1) {
        selectedIndex = longPrintIdx;
        isNightOwl = true;
      }
    } else {
      // 2. Turno Diurno (07h30 às 19h59): Se a 1ª da fila for longa (>6h), tenta adiantar peças curtas que caibam antes das 20h
      const firstItem = readyPool[0];
      const hoursUntilNight = 20 - currentHour;
      if (firstItem.print_time_minutes > 360 && hoursUntilNight > 2) {
        const shortIdx = readyPool.findIndex(
          (item) => item.print_time_minutes <= hoursUntilNight * 60
        );
        if (shortIdx !== -1) selectedIndex = shortIdx;
      }
    }

    const [job] = readyPool.splice(selectedIndex, 1);
    const startAt = new Date(cursor);
    const finishAt = new Date(startAt.getTime() + job.print_time_minutes * 60000);

    // REGRA OFICIAL: Impressão > 6h (360 min) exige 2h (120 min) de folga para a A1. Caso contrário, 15 min.
    const cooldownMinutes = job.print_time_minutes > 360 ? 120 : 15;

    schedule.push({
      ...job,
      estimated_start_at: startAt,
      estimated_finish_at: finishAt,
      cooldown_after_minutes: cooldownMinutes,
      is_night_owl_slot: isNightOwl,
    });

    const nextAvailable = new Date(finishAt.getTime() + cooldownMinutes * 60000);
    cursor = normalizeToAwakeHours(nextAvailable);
  }

  return schedule;
}

// Impede que uma nova peça seja agendada para começar enquanto você está dormindo (23h00 às 07h30)
function normalizeToAwakeHours(date: Date): Date {
  const d = new Date(date);
  const hour = d.getHours();
  const minutes = d.getMinutes();

  if (hour >= 23) {
    d.setDate(d.getDate() + 1);
    d.setHours(7, 30, 0, 0);
  } else if (hour < 7 || (hour === 7 && minutes < 30)) {
    d.setHours(7, 30, 0, 0);
  }
  return d;
}
```

---

### 4.3. Fórmula da Calculadora de Custos 3D (Admin)
Cálculo de engenharia de custos para precificação dos itens do catálogo:

$$\text{Custo Filamento} = \sum (\text{Peso em g} \times \text{Custo/g da Bobina})$$
$$\text{Custo Energia} = \left(\frac{\text{Potência Média A1 (120W)}}{1000}\right) \times \text{Horas} \times \text{Tarifa kWh (ex: R\$ 0,95)}$$
$$\text{Depreciação/Manutenção} = \text{Horas} \times \text{Custo Hora-Máquina (ex: R\$ 1,50/h)}$$
$$\text{Custo Acessórios} = \sum (\text{Qtd Corrente} \times \text{Custo}) + (\text{Qtd Ilha} \times \text{Custo}) + (\text{Qtd Ímã} \times \text{Custo}) + (\text{Qtd Gota Silicone} \times \text{Custo}) + (\text{Kit LED})$$
$$\text{Custo Total Produção} = (\text{Filamento} + \text{Energia} + \text{Máquina} + \text{Acessórios}) \times (1 + \% \text{Margem de Falha})$$
$$\text{Lucro Líquido} = \text{Preço de Venda Feira} - \text{Custo Total Produção} - (\text{Preço de Venda} \times \% \text{Taxa Tap to Pay Mercado Pago})$$

---

## 5. Estrutura de Rotas e Telas para Construir no Projeto (Next.js App Router)

1.  **`/feira` (Modo Kiosk iPad - Visão do Cliente):**
    *   Header aconchegante com logo **CM Casa Criativa** e badge ao vivo da próxima janela de entrega da fila.
    *   Banner de destaque para abrir o **Simulador de Chaveiro com Nome (R$ 15,00 + Adereço R$ 5,00)**.
    *   Abas de filtro rápido: *Coleção Completa*, *Vasos & Luminárias*, *Artigos Religiosos*, *Fidgets & Mimos*.
    *   Modal de Reserva + Dados (Nome, WhatsApp, Setor no TCE) + Checkout Integrado (PIX QR Code na tela ou aviso de Tap to Pay sincronizado via Supabase Realtime).
2.  **`/admin/caixa` (Tela Mobile de Bolso para o seu Celular na Feira):**
    *   Escuta pedidos com status `awaiting_tap_to_pay`.
    *   Mostra o valor para você passar o cartão do cliente no seu celular via **Tap to Pay do Mercado Pago** e um botão grande `[✅ Confirmar Pagamento Tap to Pay]` que destrava o iPad na hora.
3.  **`/admin/catalogo` (Importador MakerWorld A1 + Calculadora de Custos):**
    *   Campo para colar link do MakerWorld (ou subir `.3mf`), puxando perfil da **Bambu Lab A1**.
    *   Cria/vincula automaticamente as cores necessárias do produto.
    *   Calculadora interativa marcando quantas gotas de silicone, correntes, ilhas de chaveiro ou ímãs entram na peça.
4.  **`/admin/insumos` (Gestão de Bobinas, Acessórios e Lista de Compras):**
    *   Cadastro de filamentos (código, marca, cor, data da compra, valor pago, gramas restantes).
    *   Cadastro de pacotes de acessórios (corrente, ilha, ímã, gota de silicone).
    *   **Alerta de Compras:** Soma os gramas de cada cor comprometidos nos pedidos já pagos na feira e destaca o que precisa ser comprado com o dinheiro antecipado.
5.  **`/admin/fila` (Timeline de Produção da A1 + Exportador OpenSCAD):**
    *   Lista cronológica mostrando turnos do dia, destaque para peças no **Turno Corujão (madrugada)** e blocos visuais das **2h de folga após peças $>6\text{h}$**.
    *   Botão de 1 clique no WhatsApp para avisar o servidor do TCE que a peça ficou pronta.