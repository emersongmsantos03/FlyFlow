# FlyFlow by Hero Drone

CRM, projetos e gestao financeira para uma empresa de servicos com drones.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- React Hook Form + Zod
- Recharts
- Supabase preparado via migration SQL
- Persistencia local com sincronizacao transacional em snapshot no Supabase quando configurado
- Tema escuro por padrao, com opcao claro/escuro

## Como executar

```bash
npm install
npm run dev
```

Depois acesse a URL mostrada pelo Vite.

A conta principal tem acesso total, nao pode ser desativada e pode criar contas internas com permissoes diferentes. Por seguranca, a tela de login inicia vazia e nenhuma senha e publicada na documentacao. O banco inicia vazio para voce fazer os primeiros cadastros. As contas locais e a sessao ficam salvas no navegador para o MVP. Para limpar cadastros locais e voltar ao banco vazio, use o botao `Limpar banco` no menu lateral.

## Scripts

```bash
npm run dev      # ambiente local
npm run build    # valida TypeScript e gera build de producao
npm run preview  # pre-visualiza o build
npm run lint     # roda oxlint
```

## Supabase

O app roda em modo local por padrao. Para preparar o banco:

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env.local`.
3. Preencha:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

4. Aplique a migration:

```bash
supabase db push
```

5. Para sincronizacao real com Google Calendar, configure e publique a Edge Function:

```bash
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... GOOGLE_CALENDAR_ID=primary
supabase functions deploy google-calendar
```

As migrations em `supabase/migrations/` criam:

- tabelas principais da especificacao;
- perfis de usuario com `permissions` e `is_primary_owner`;
- validacoes de valores negativos, percentuais e prazos;
- RLS por `owner_user_id`;
- politica para usuarios com `manageUsers` gerenciarem contas;
- gatilhos de `updated_at`;
- recalculo automatico de saldo/status financeiro em pagamentos;
- bloqueio de exclusao de pagamento ja recebido.
- relacionamentos entre contato, proposta, projeto, pagamento e anexos;
- numero unico de proposta e somente um projeto por proposta;
- tarefas, timeline, ajustes e transacoes financeiras;
- sincronizacao idempotente de pagamentos com o financeiro;
- snapshot JSON transacional para o estado integrado usado pela interface;
- expiracao de propostas e validacao da origem dos projetos.

Para envio real de recuperacao de senha por e-mail, conecte o Supabase Auth. No modo local, a solicitacao de reset fica registrada no navegador.

## Funcionalidades do MVP

- Login com conta principal e banco local de contas.
- Dashboard com cards, listas e graficos.
- Tema claro/escuro moderno, minimalista e com cores vibrantes.
- CRM em quadro, lista e Minhas tarefas, com filtros, painel lateral, drag-and-drop validado e rolagem horizontal visível.
- Lead e cliente ficam unificados visualmente como `Contatos`.
- Conversao de contato em projeto quando necessario.
- Projetos com status, financeiro, links, mapa e checklist.
- Agenda com visualizacao mensal/lista e alerta de conflito.
- Orcamentos com itens, validade, total, copia de texto, WhatsApp e impressao/PDF.
- Gerador rapido de propostas atrelado a contatos, com telefone/WhatsApp, local, dados da Hero Drone, pacotes prontos, itens editaveis, sinal, prazo, validade e previa financeira.
- Download direto da proposta em PDF com dados da empresa, destinatario, escopo, itens, valores e condicoes comerciais.
- Financeiro com criação, edição, arquivamento, restauração, exclusão lógica, comprovantes, exportação e fluxo de caixa.
- Pagamentos parciais com regra de sinal e saldo.
- Calculos de faturamento, recebido, pendente, custos, lucro, margem, ticket e conversao.
- Equipamentos e proximas manutencoes.
- Relatorios basicos com exportacao CSV.
- Configuracoes da empresa e simulacao de deslocamento.
- Usuarios internos com perfis, permissoes, ativacao/desativacao e redefinicao de senha.

## Fluxo operacional integrado

1. Cadastre o contato no CRM e registre conversas ou tarefas.
2. Use `Gerar proposta`; se houver propostas anteriores, escolha nova, duplicacao, rascunho ou revisao versionada.
3. Salve o rascunho, gere o PDF e marque a proposta como enviada.
4. Registre a aprovacao. O sistema cria entrada e saldo como valores previstos, sem contabiliza-los como recebidos.
5. Registre a entrada, anexe o comprovante e confirme manualmente `Pagamento recebido e conferido`.
6. O sistema abre a confirmação `Serviço confirmado`: escolha criar um único projeto, deixar para depois ou cancelar a movimentação. Nenhum projeto é criado sem confirmação.
7. No projeto, use `Agendar captacao`. O evento interno e atualizado sem duplicidade e o Google Calendar e aberto por padrao.
8. Confirme a captacao, registre sua realizacao e acompanhe o prazo automatico de sete dias.
9. Envie para revisao, acompanhe ajustes, registre o pagamento final e a entrega.
10. A conclusao e bloqueada enquanto houver saldo ou ajustes pendentes.

As proximas acoes e alertas sao recalculados de forma idempotente no Dashboard. Executar a automacao novamente nao duplica tarefas, pagamentos, projetos ou eventos de captacao.

## Estrutura

```text
src/
  App.tsx                 # telas e fluxo do MVP
  components/ui.tsx       # componentes reutilizaveis
  components/crm/         # CRM, quadro, lista, tarefas e painel lateral
  data/demoData.ts        # dados ficticios iniciais
  lib/financial.ts        # calculos financeiros e series de graficos
  lib/format.ts           # moeda, datas, telefone, WhatsApp e mapas
  lib/permissions.ts      # perfis e permissoes
  lib/operations.ts       # regras operacionais, automacoes e idempotencia
  lib/validation.ts       # schemas Zod dos formularios
  services/auth.ts        # contas locais, senha hash e sessao
  services/storage.ts     # persistencia local dos dados
  services/cloudStorage.ts # sincronizacao do estado com Supabase
  services/supabase.ts    # cliente Supabase opcional
supabase/migrations/      # schema inicial do banco
```

## Teste rapido

1. Entre com a conta principal.
2. Confira o tema escuro com a identidade Hero Drone.
3. No Dashboard, confira cards, graficos, proximas entregas e alertas.
4. Em `Contatos`, cadastre um contato, registre uma conversa e clique em `Gerar proposta`.
5. Salve como rascunho, gere o PDF, marque como enviada e registre a aprovacao.
6. Registre a entrada com comprovante e confirmacao manual.
7. No modal de serviço confirmado, teste `Não abrir agora` e depois `Criar projeto`; confirme que uma segunda tentativa abre o projeto existente sem duplicar.
8. Agende a captacao e confirme que o evento aparece na Agenda; edite-o para testar o reagendamento.
9. Avance por confirmacao, captacao e edicao; confira o prazo de sete dias e as proximas acoes.
10. Registre o pagamento final, a entrega e conclua o projeto.
11. Revise timeline, checklist, arquivos e relatorios relacionados.
12. Rode `npm run build` e `npm run lint` antes de publicar.

## Variaveis de ambiente

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_API_KEY=
```

Para usar busca de endereços e mapas, habilite na mesma chave do Google Cloud:

- Maps JavaScript API
- Places API

Em produção, restrinja a chave aos domínios do sistema e somente a essas APIs.

Sem Supabase o sistema continua funcionando localmente no navegador. Com Supabase configurado, o login usa Supabase Auth e o estado e sincronizado com `app_state_snapshots` protegido por RLS.

## Limitacoes atuais

- Com a Edge Function `google-calendar` e os segredos OAuth configurados, eventos sao criados e atualizados pelo mesmo `external_event_id`. Sem essa configuracao, o sistema abre o evento preenchido para confirmacao do usuario.
- Comprovantes em modo local usam data URL e estao sujeitos ao limite do armazenamento do navegador. Em producao, use Supabase Storage.
- O schema relacional completo esta preparado na migration; a interface sincroniza o agregado transacional em JSON para manter atomicidade durante a transicao do MVP. Uma futura camada de repositorios pode gravar cada entidade tambem nas tabelas normalizadas.
- A migration `20260714150000_crm_finance_integrity.sql` precisa ser aplicada no ambiente Supabase antes de usar as novas colunas relacionais de soft delete, auditoria, comprovantes e oportunidades.
