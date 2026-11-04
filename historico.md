# Histórico do projeto CMLab

Registro do que foi feito e decidido, para continuar o trabalho de qualquer
máquina (desktop ou laptop). Mais recente no topo.

---

## Pendências e próximos passos

- [ ] **Publicar em produção.** O `main` está à frente do que roda em
  cmlab.gabinex.com.br, cujo último deploy é de ~22/10. O projeto na Vercel
  **não está ligado ao GitHub**: `git push` não faz deploy. É preciso rodar
  `vercel --prod` na pasta do projeto (ou ligar o repositório no painel da
  Vercel: Project → Settings → Git).
- [ ] **Antes do deploy, configurar `SUPABASE_SERVICE_ROLE_KEY` na Vercel.**
  `ADMIN_MASTER_PASSWORD_HASH` e `AUTH_SECRET` já existem em Production.
  Sem a service role, o app funciona, mas o banco continua aberto a quem tiver
  a anon key. **Não rodar `supabase/rls-lockdown.sql` antes de configurar a
  chave**, ou as gravações do app passam a falhar.
- [ ] **Senha do master em produção.** A senha antiga foi publicada no
  repositório (público) e deve ser considerada comprometida. A nova senha vem
  de `ADMIN_MASTER_PASSWORD_HASH` (bcrypt), gerada pelo próprio Conrado. O
  master troca a senha no primeiro acesso.
- [ ] **Imprimir o chaveiro articulado de teste** e calibrar a folga das
  dobradiças (padrão 0,4 mm). Travou: aumentar. Ficou frouxo: diminuir.
- [ ] **Conferir as plaquinhas no Bambu Studio** abertas pela interface
  (pela linha de comando já fatiaram certo, com 2 filamentos).
- [ ] **Gerador de catálogo para Instagram** (área Catálogo): selecionar
  produtos, escolher tema, fundos por tema, preço vindo do produto, salvar
  catálogos e exportar em 1080×1350 (feed/carrossel), opcionalmente 1080×1920
  (stories) e PDF. Ficou combinado; esperando o Conrado mandar um exemplo.
- [ ] **Próximas ferramentas do Laboratório:** Conversor SVG (limiar +
  largura em mm, reaproveitando o motor da plaquinha), Gerador de QR Code em
  SVG, Separador de 3MF.
- [ ] Renomear/excluir categorias de produto pela tela (hoje só cria).

---

## 2026-11-03 — Laboratório, plaquinha, chaveiro e menu novo

Commit `f9047fe`.

### Menu do admin reorganizado
- A barra de cima tinha lotado (com barra de rolagem). Virou duas camadas:
  **áreas** (Feira, Catálogo, Laboratório) e, embaixo, as **funções da área
  atual**. Usuários, restaurar demonstração e Sair ficam à direita.
- Feira: Caixa Mobile, Fila de Impressão, Insumos, botão Kiosk iPad.
  Catálogo: Produtos. Laboratório: Ferramentas, Plaquinha, Chaveiro.
- Insumos ficou em Feira (controle de estoque de produção); pode ir para
  Catálogo se preferir. Arquivo: `components/AdminNav.tsx`.

### Laboratório (`/admin/laboratorio`)
- Área pessoal, **só para o usuário master**: o `middleware.ts` redireciona
  qualquer outro para `/admin/caixa`, e `components/lab/MasterOnly.tsx` é a
  segunda tranca.
- Tudo roda no navegador: os arquivos não saem do computador.

### Plaquinha de Colorir (`/admin/laboratorio/plaquinha`)
- Referência: kit "Savana" da MakerWorld (designer Chuhas, licença
  **CC BY-ND**: serve só de referência técnica, não pode ser vendido nem
  redistribuído). Estrutura: base branca 0,8 mm + contorno preto 0,4 mm em
  relevo.
- Entrada: SVG (inclusive feito com traço, que o Gestor 3D não aceita) ou
  PNG/JPG. A ferramenta **recorta as margens** e **detecta** se é desenho
  preto e branco ("Contorno pronto") ou ilustração ("Ilustração colorida").
- Ilustração colorida: simplifica cores (k-means em Lab, peso menor no
  brilho), alisa fronteiras e desenha linha entre áreas. Padrão 12 cores.
- Linha mínima imprimível 0,8 mm (bico 0,4); linhas finas aparecem em
  vermelho. Cada desenho separado vira uma plaquinha; até 6 artes por arquivo.
- Qualidade: **desenho de contorno sai muito bom** (teste: elefante).
  Ilustração colorida sai razoável (teste: girafa no carro, o pescoço fica
  pesado). Melhor fluxo: pedir à IA a versão "para colorir, só contorno".
- Arquivos: `lib/lab/raster.ts`, `lib/lab/coloringPlate.ts`,
  `lib/lab/plateGeometry.ts`.

### Chaveiro de Nome Articulado (`/admin/laboratorio/chaveiro`)
- Inspirado no "Chaveiro de nome articulado" do Gestor 3D (gestor3d.app →
  Personalizados). Construído do zero, sem copiar código.
- Até 12 nomes, 16 caracteres cada (maiúsculas, números, acentos, Ç, espaço).
  12 fontes abertas (OFL/Apache) em `public/fonts/lab/`.
- Mecanismo: espinha segmentada embaixo (uma parte por letra) + dobradiça de
  eixo vertical com **pino em losango** (cones de 45°) dentro de furo igual,
  com folga. Imprime sem suporte e o pino não solta. Base do furo alargada na
  1ª camada contra "pé de elefante".
- A tela confere se cada letra saiu como peça solta ("N partes articuladas").
- Teste: "SEU NOME" = 99 × 15 × 8 mm. Três chaveiros juntos fatiam em ~70
  min no Bambu, 14,2 g corpo + 4,1 g letras, 1 troca de cor.
- Bibliotecas: `manifold-3d` (sólidos, roda em WebAssembly; o `.wasm` fica em
  `public/lab/`) e `opentype.js` (fontes). O `next.config.mjs` desliga módulos
  de Node (`fs`, `module`…) no navegador por causa do manifold.
- Arquivos: `lib/lab/nameKeychain.ts`, `lib/lab/keychainLayout.ts`,
  `lib/lab/keychainFonts.ts`, `lib/lab/labRuntime.ts`.

### Exportação 3MF e perfil de impressão
- `lib/lab/threeMfExport.ts` gera 3MF no formato de projeto do Bambu Studio:
  um objeto por peça, com 2 partes (filamento 1 e filamento 2).
- Perfil embutido `lib/lab/bambu-a1-plate-settings.json`: copiado da Savana
  e reduzido a **2 filamentos**. Bambu Lab A1, bico 0,4, 0,28 mm Extra Draft
  com **camada de 0,2 mm por objeto**, 2 paredes, 15% de preenchimento,
  PEI texturizada, sem torre de purga.
- Material: **Generic PLA @BBL A1** nos dois filamentos (o Conrado define o
  material real na hora de imprimir). Filamento 1 = base/corpo, 2 =
  linhas/letras.
- Por que isso importa: um arquivo sem perfil abriu no Bambu só com o
  filamento que estava selecionado (PETG), e as duas partes caíram no
  filamento 1.
- Trocar o material: `python scripts/bambu-filament-profile.py "Bambu PLA
  Lite @BBL A1"` (resolve a herança dos perfis oficiais instalados no Bambu).

### Como testar sem abrir o Bambu
- O Bambu Studio tem modo de linha de comando. Ele fatia e grava um
  `result.json` com os gramas por filamento:
  ```
  "C:\Program Files\Bambu Studio\bambu-studio.exe" --slice 1 --outputdir <pasta> --export-3mf saida.3mf entrada.3mf
  ```
  No Windows ele não escreve na tela; leia o `result.json` da pasta de saída.
  Não rodar enquanto o Bambu estiver atualizando.

### Pasta `Conteudos/`
- Material de trabalho local, **fora do Git** (`.gitignore`): kit da Savana
  (licença de terceiro), imagens de teste (girafa, elefante) e os arquivos
  `TESTE-*.3mf`. **Não vai para o laptop pelo Git**; copiar à mão se
  precisar.

### Rodar o app localmente sem tocar na produção
- O `.env.local` aponta para o Supabase de produção. Para testar sem gravar
  lá, sobrescrever as variáveis na linha de comando (modo local, dados em
  `.data/`, que está no `.gitignore`):
  ```
  AUTH_SECRET=<segredo de teste com 32+ caracteres> NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test npx next dev -p 3100
  ```
- Para entrar sem senha nesse servidor local, gerar um cookie de sessão
  `cmlab_session` assinado com o mesmo `AUTH_SECRET` de teste (JWT HS256 via
  `jose`, `sub=admin-master-conrado`, `is_master=true`) e colocá-lo no
  navegador em `localhost`. Nunca usar o segredo de produção para isso.
- Se o servidor de dev ficar preso na porta 3100, encerrar o processo `node`
  que escuta nela antes de subir outro. Antes de `npm run build`, parar o
  dev e apagar `.next` (senão dá "no direct app page entry found for
  /_not-found").

---

## 2026-11-02 — Segurança, categorias e reorganização

- Commit `391179a`: login no servidor (bcrypt + cookie de sessão httpOnly com
  JWT), senhas fora do código, `middleware.ts` protegendo `/api/state`,
  escrita no Supabase pela service role e script `supabase/rls-lockdown.sql`.
  Detalhes e plano de segurança em `HANDOFF.md`.
- Commit `3d01b83`: **categorias de produto cadastráveis** (ex.: "Organizadores
  de Escritório"). Campo "escolha ou digite nova" no cadastro; a categoria
  nova é salva na hora, junto da configuração do sistema. A vitrine mostra só
  abas de categorias com peça ativa. Lógica em `lib/categories.ts`.
- Os dois commits foram enviados ao GitHub (`git push`), mas **não**
  publicados na Vercel (o deploy é manual, ver pendências).
- Ideias discutidas e aprovadas: gerador de catálogo para Instagram (ver
  pendências).

---

## Contexto geral

- Negócio: CM Casa Criativa, impressão 3D (Bambu Lab A1 com AMS), vendas na
  Feira TCE e catálogo/vitrine.
- Stack: Next.js 15 (app router), Supabase, deploy na Vercel. Repositório
  **público**: `conradosmn/cmlab`. Nunca commitar senhas, chaves ou arquivos
  de terceiros.
- Gestor 3D (gestor3d.app) é a referência de ferramentas que o Conrado usa;
  ideias de lá: Conversor SVG, Separador 3MF, Gerador de QR Code, Plaquinha de
  colorir, Chaveiro de nome articulado.
