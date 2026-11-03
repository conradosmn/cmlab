# CMLab — Handoff: Deploy Vercel + Plano de Segurança

**Data:** 2026-10-22
**Contexto:** migração do deploy Netlify → Vercel e plano para fechar os furos de segurança antes da Feira TCE.

---

## 1. Estado atual

| Item | Estado |
|---|---|
| Produção | **https://cmlab.gabinex.com.br** — todas as rotas 200 |
| Plataforma | Vercel, projeto `cmlab` (`conrado-machado-s-projects`) |
| Banco | Supabase conectado — `GET /api/state` responde `source: supabase` |
| Netlify | site removido; **a zona DNS do `gabinex.com.br` continua no Netlify DNS** (`dns1-4.p05.nsone.net`) |

Smoke test validado em `/`, `/feira`, `/admin/caixa`, `/admin/catalogo`, `/admin/fila`, `/admin/insumos`, `/admin/usuarios`, `/api/state`.

### Por que o deploy falhava antes

Dois problemas distintos, que vale não confundir:

1. **O subdomínio apontava pro lugar errado.** O registro DNS `cmlab` apontava pro site Netlify que foi pausado quando os créditos do agente acabaram. DNS certo, destino morto. O código nunca esteve errado — o build de CI foi reproduzido do zero (`npm ci` + Next 15.5.28, sem `.env.local`) e passa limpo.

2. **`framework: null` no Vercel.** O projeto foi criado via `vercel project add`, que nasce sem preset. O `next build` rodava, mas sem o preset o Vercel não monta o roteamento nem as funções serverless — servia a saída como estático e devolvia 404 em tudo. Corrigido com [`vercel.json`](vercel.json) declarando `"framework": "nextjs"`.

> **Não confirmado:** o erro de build original no painel do Netlify. O log nunca foi lido. O que se sabe é que o código compila e que o DNS apontava pro site pausado — não o que o Netlify cuspiu no build. O `SECRETS_SCAN_ENABLED = "false"` no [`netlify.toml`](netlify.toml) sugere que o *secrets scanning* já havia barrado um build antes (ele falha ao achar a anon key dentro do bundle — e por ser `NEXT_PUBLIC_`, ela vai pro bundle por definição).

### Pendências de infra

- **Env vars de Preview** não foram setadas — bug da Vercel CLI 54.14.0, que ignora o `--yes` e exige branch interativamente. Production e Development estão OK. Só afeta deploys de branch; dá pra setar no dashboard.
- **`diario.gabinex.com.br`** — DNS já repontado pro Vercel (`76.76.21.21`), certificado em emissão automática. Se depois do cert ainda der 404, é a mesma armadilha de `framework` no projeto `diario-obras`.
- **DNS em split-brain** — a zona vive no Netlify DNS enquanto todos os sites estão no Vercel. Migrar a zona pro Vercel DNS (troca de nameservers no Registro.br) encerraria isso. Afeta `www`, `diario` e `recebimento`, então precisa de cuidado.

---

## 2. Segurança — o que está aberto

O site está público. Hoje, qualquer pessoa com a URL pode:

- **Ler todos os usuários admin com as senhas em texto puro**, via `GET /api/state`.
- **Sobrescrever catálogo, estoque e pedidos** inteiros, via `POST /api/state` anônimo.
- **Ler e escrever direto no Supabase**, ignorando o app por completo.

### As três causas

**a) `/api/state` não tem autenticação nenhuma.**
[`app/api/state/route.ts`](app/api/state/route.ts) — `GET` e `POST` abertos. O login existe só no cliente ([`app/admin/layout.tsx:101`](app/admin/layout.tsx#L101)), ou seja, é UI, não controle de acesso.

**b) Os usuários moram numa tabela que a vitrine precisa ler.**
[`app/api/state/route.ts:17`](app/api/state/route.ts#L17) guarda `adminUsers`, `printers` e `pixSettings` como JSON dentro do campo `supplier` de uma linha da tabela `accessories` (id `__cmlab_system_config__`). É por isso que as senhas saem no `GET`: elas estão numa tabela pública. O schema até tem uma tabela `admin_users` ([`supabase/schema.sql:103`](supabase/schema.sql#L103)), mas ela não é usada — e nem tem as colunas `role` e `must_change_password` que o código espera.

**c) A anon key é pública e a RLS está escancarada. ← a mais importante**
A anon key está embutida no bundle do cliente (confirmado em `chunks/893-*.js`), e as policies do [`supabase/schema.sql:120`](supabase/schema.sql#L120) são `USING (true) WITH CHECK (true)`. Verificado na prática: os 4 endpoints REST do Supabase respondem **HTTP 200** com essa key.

Consequência: **blindar só o `/api/state` é teatro.** Dá pra bater direto no Supabase REST e ler/escrever tudo, sem passar pelo app. `NEXT_PUBLIC_` significa público — não existe esconder essa key.

### Contenção imediata (independente de código)

O repositório `conradosmn/cmlab` é **público**. As senhas em [`lib/seedData.ts`](lib/seedData.ts) são legíveis por qualquer um no GitHub e estão no histórico do git.

- Considerar as duas senhas **queimadas permanentemente**. Reescrever o histórico não resolve — qualquer um pode ter clonado.
- Trocá-las de verdade, e **se a senha master for reaproveitada em e-mail ou banco, trocar lá também.**
- Trocar no `seedData.ts` só colocaria uma senha nova num repo público: elas precisam **sair do código**.
- Avaliar tornar o repositório privado.

---

## 3. O plano

Três camadas, e nenhuma funciona sozinha:

1. **RLS de verdade** — anon só *lê* o catálogo (o que a vitrine precisa); zero acesso à linha/tabela de usuários.
2. **Escritas pelo servidor** — `SUPABASE_SERVICE_ROLE_KEY` como env var *server-only* (nunca `NEXT_PUBLIC_`).
3. **Auth real** — senha com hash (bcrypt), sessão em cookie `httpOnly`, e `middleware.ts` barrando `/admin/*` no servidor em vez de no React.

### Bloco 1 — antes da feira (~30 min)

Fecha o vazamento de senha e a escrita anônima. Não é bonito, mas resolve o sangramento.

- [ ] Remover `adminUsers` do payload do `GET /api/state`.
- [ ] Mover a config de sistema para fora da tabela `accessories` (que a vitrine lê).
- [ ] Exigir um segredo (env var server-only) no `POST /api/state`.
- [ ] Trocar as duas senhas queimadas e tirá-las do `seedData.ts`.

### Bloco 2 — uma noite

- [ ] Usuários em tabela própria, **sem** acesso anon na RLS.
- [ ] `bcrypt` nas senhas + migração das existentes.
- [ ] `POST /api/login` server-side emitindo cookie `httpOnly`; `middleware.ts` guardando `/admin/*`.
- [ ] Escritas via service role key numa rota server-side.
- [ ] RLS: anon read-only nas tabelas de catálogo (`products`, `filaments`) para a vitrine.
- [ ] `/feira` segue pública; criação de pedido passa a ir por rota server-side.

Senhas novas são **decisão do dono** — não devem ser inventadas nem deixadas em arquivo. O fluxo previsto: a senha master vem de env var no Vercel, e a da Lorena entra como temporária com `must_change_password`, que o sistema [já suporta](app/admin/layout.tsx#L196).

### Alternativa: Supabase Auth

Trocar o user table caseiro por Supabase Auth (hash, sessão e refresh de graça, RLS amarrada no `auth`). É o mais robusto, mas mexe bastante na `/admin/usuarios`. Recomendado **depois** da feira — o Bloco 2 já elimina o essencial.

---

## 4. Retomando no laptop

```bash
git pull
npm install          # o lockfile pede Next 15.5.28
npm run dev          # http://localhost:3000
```

O `.env.local` **não** está no repo (corretamente). Para rodar local, recrie com as duas vars — os valores estão no painel do Vercel em *Settings → Environment Variables*, ou via CLI:

```bash
vercel link --project cmlab
vercel env pull .env.local
```

### Observações de arquitetura (não urgentes)

- **O `.data/` não persiste no Vercel** — filesystem serverless é read-only. O código engole o erro no `catch` de [`writeLocalDb`](app/api/state/route.ts#L80), então não dá 500, mas na prática **só o Supabase guarda estado**.
- **Bug de custo:** `recalculateProductsCost` tem `currentPrinters = INITIAL_PRINTERS` como default ([`lib/store.tsx:104`](lib/store.tsx#L104)), e sete chamadas omitem o 4º argumento. Resultado: ao editar qualquer filamento, os custos são recalculados com a depreciação da A1 semente (R$ 0,56/h, 150 W) em vez da impressora real cadastrada.
- **Sync redundante:** o `setInterval` de 3s em [`lib/store.tsx:425`](lib/store.tsx#L425) duplica o que o Supabase Realtime já faz — é uma invocação serverless a cada 3 s por cliente conectado. E `applySmartScheduleToOrders` roda duas vezes por mutação (nos setters e no `useMemo`).
- **Arquivos grandes:** [`app/admin/insumos/page.tsx`](app/admin/insumos/page.tsx) (2.234 linhas) e [`app/admin/catalogo/page.tsx`](app/admin/catalogo/page.tsx) (1.852 linhas) são candidatos a quebrar em componentes.
- `tsc --noEmit` passa limpo.

### `vercel.json` é obrigatório

Não remova o [`vercel.json`](vercel.json). Sem ele o `framework` volta a `null` e o deploy devolve 404 em todas as rotas.
