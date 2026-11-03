# Migração Netlify → Vercel — runbook

**Atualizado:** 2026-10-22 (noite)
**Objetivo:** tirar tudo do Netlify e deletar a conta, sem derrubar e-mail nem o diário.

---

## Estado em 22/10

| Domínio | Status | Servido por |
|---|---|---|
| `cmlab.gabinex.com.br` | ✅ 200 | Vercel `cmlab` |
| `diario.gabinex.com.br` | ✅ 200 | Vercel `diario-obras` |
| `www.gabinex.com.br` | ✅ 200 | Vercel `gabinex` |
| `recebimento.gabinex.com.br` | ✅ 307 | Vercel `recebimento-anexo3` |
| `gabinex.com.br` (apex) | ✅ 307 | Vercel `gabinex` |

Todos os sites já saíram do Netlify. **O que ainda prende a conta é a zona DNS.**

### O diário

Três gerações do mesmo app:

| Versão | Bundle | Onde vive | Conecta no banco? |
|---|---|---|---|
| 17/06 | 574 KB | era o que o Vercel servia | ❌ chave legada |
| 31/07 | 1,05 MB | GitHub `main` + Netlify `delicate-cheesecake` | ✅ **no ar agora** |
| 29/09 | 1,99 MB | Netlify `tiny-madeleine` + **laptop do trabalho** | ✅ (nunca commitado) |

**Causa raiz do problema:** o Supabase desativou as *legacy API keys* do projeto `gbkqvfcdrwfwilhhlgdm` em **28/07**. Os builds de 17/06 e 31/07-com-chave-antiga morreram junto. Não era o Netlify que fazia o diário funcionar — era a chave nova, presente só nos builds feitos depois dessa data.

A `VITE_SUPABASE_ANON_KEY` no Vercel já está com a *publishable key* nova, então **qualquer deploy futuro pega ela sozinho**.

---

## Amanhã, no laptop do trabalho

### 1. Subir o código de 29/09 — faça isto primeiro

É a única cópia fora do Netlify, e a conta do Netlify está com uso estourado (`usage_exceeded`). Enquanto esse push não acontecer, um problema no laptop custa dois meses de trabalho.

```bash
cd <pasta do diario no laptop>
git status                 # ver o que nunca foi commitado
git add -A
git commit -m "feat: orçamento, medições e aditivos (produção desde 29/09)"
git push
```

### 2. Publicar essa versão no Vercel

```bash
vercel link --yes --project diario-obras
vercel deploy --prod --yes
```

Conferir se o código lê a chave de `VITE_SUPABASE_ANON_KEY` ou se ela foi chumbada no fonte. Se estiver chumbada, mover para env var — senão o problema se repete na próxima rotação.

### 3. Migrar a zona DNS para o Cloudflare

Arquivo BIND pronto, com os **14 registros autoritativos** (exportados via API do Netlify, zone_id `69bbed4e4accc702bb90c136`):

`scratchpad/gabinex.com.br.zone` — se o scratchpad tiver expirado, os registros estão na tabela abaixo.

Três registros de e-mail **não** aparecem em consulta DNS comum e são fáceis de perder:
`MX send`, `TXT send` (SPF) e `TXT resend._domainkey` (DKIM). Sem eles, e-mail transacional vai pro spam em silêncio.

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `216.198.79.1` |
| CNAME | `www` | `44b011d7246c745f.vercel-dns-017.com` |
| A | `cmlab` | `76.76.21.21` |
| A | `diario` | `76.76.21.21` |
| A | `recebimento` | `76.76.21.21` |
| MX 1 | `@` | `mx1.larksuite.com` |
| MX 5 | `@` | `mx2.larksuite.com` |
| MX 10 | `@` | `mx3.larksuite.com` |
| TXT | `@` | `v=spf1 +include:spf.onlarksuite.com -all` |
| TXT | `@` | `verification-code-site-App_lark=W71ooNGwyQKEV7a04qXY` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |
| MX 10 | `send` | `feedback-smtp.sa-east-1.amazonses.com` |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC2da1qmCRY0tdbpEfh9dFr2Ac8MMXGO7snenc3md0/wqVYl8JvgfDHfA3hxz6dyAX1m4bZHYAlTaa1JyzKim5+RW/U/aHMUc3mZJIJOgMylQlrAYERAw1YPTdbB0F2QrNKIibRs/Kg8DAZQa4/QlaTyR5/78JjSm1TOs3axJLfhQIDAQAB` |

### 4. Trocar os nameservers no Registro.br

`.com.br` se gerencia no **registro.br**, não no Netlify. O Registro.br valida que os novos NS já respondem pela zona antes de aceitar — por isso o passo 3 vem antes.

### 5. Verificar antes de deletar qualquer coisa

- [ ] Mandar **e** receber um e-mail de teste no domínio
- [ ] Os 5 domínios da tabela de estado respondendo
- [ ] SPF/DKIM/DMARC passando (mail-tester.com ou cabeçalho de um e-mail recebido)

### 6. Só então deletar a conta do Netlify

⚠️ Entre o passo 4 e o 5 a conta do Netlify **precisa continuar viva**. Se ela morrer antes dos nameservers novos estarem valendo, você fica sem e-mail e sem sites até propagar.

---

## Inventário do Netlify (para conferir que nada fica para trás)

Time **Gabinex**, 4 sites:

| Site | Repo | O que é |
|---|---|---|
| `cmlab3d` | `conradosmn/cmlab` | CMLab — já migrado |
| `gabinex` | `conradosmn/Gabinex` | apex — já migrado |
| `delicate-cheesecake-1426f5` | — | diário build 31/07 — já no Vercel |
| `tiny-madeleine-4fb42a` | — | diário build 29/09 — **fonte só no laptop** |

Nenhum app órfão. O único conteúdo insubstituível é o código de 29/09.

---

## Pendências do CMLab

- `vercel.json` e `HANDOFF.md` ainda **sem commit**. Sem o `vercel.json` no repo, um deploy futuro do CMLab via Git volta a dar 404 (`framework: null`).
- Segurança do `/api/state` — ver [HANDOFF.md](HANDOFF.md).

> Nota: este repositório é **público**. Nada aqui é segredo (chaves publicáveis e registros DNS são públicos por natureza), mas é um runbook operacional — vale considerar tornar o repo privado.
