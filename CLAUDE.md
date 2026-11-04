# CLAUDE.md

## Histórico entre máquinas

O Conrado alterna entre **desktop e laptop**. O arquivo
[historico.md](historico.md) é a memória compartilhada do projeto.

- **Ao começar** uma sessão, leia o `historico.md` (principalmente
  "Pendências e próximos passos").
- **Sempre que finalizar algo** (uma funcionalidade, uma correção, uma
  decisão), atualize o `historico.md` antes de encerrar: nova entrada datada no
  topo da linha do tempo e pendências revisadas. Inclua o arquivo no commit.
- Escreva em português, sem senhas, chaves ou tokens: o repositório é público.

## Regras do projeto

- Repositório público (`conradosmn/cmlab`): nunca commitar segredos nem
  arquivos de terceiros. A pasta `Conteudos/` é local e fica fora do Git.
- `git push` não faz deploy: a Vercel não está ligada ao GitHub. Deploy é
  `vercel --prod`, e só com autorização do Conrado.
- O `.env.local` aponta para o Supabase de produção. Para testar localmente
  sem gravar lá, siga "Rodar o app localmente" no `historico.md`.
- O Laboratório (`/admin/laboratorio`) é exclusivo do usuário master.
