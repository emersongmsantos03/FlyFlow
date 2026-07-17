# FlyFlow by Hero Drone

CRM, projetos e gestao financeira para uma empresa de servicos com drones.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- React Hook Form + Zod
- Recharts
- Firebase Auth + Cloud Firestore preparados como backend principal opcional
- Firebase Hosting e GitHub Pages preparados para hospedagem estática
- Supabase preparado via migration SQL
- Persistência local com CRUD granular por registro no Firebase ou snapshot no Supabase
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
npm run deploy:firebase # build e publicação no Firebase
```

## Firebase (recomendado para começar)

O Firebase é opcional. Sem credenciais, o FlyFlow continua funcionando localmente. Quando as variáveis do Firebase estão preenchidas, o sistema usa Firebase Authentication e Cloud Firestore; o Supabase passa a ser apenas o segundo fallback.

### 1. Criar e configurar o projeto

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Em `Authentication > Sign-in method`, habilite `E-mail/senha`.
3. Em `Authentication > Users`, crie a conta principal `herodronecwb@gmail.com` com uma senha segura.
4. Em `Firestore Database`, crie o banco em modo de produção, preferencialmente em uma região próxima dos usuários.
5. Em `Project settings > Your apps`, registre um aplicativo Web.
6. Copie `.env.example` para `.env.local` e preencha os valores entregues pelo Firebase:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

As chaves `VITE_*` fazem parte da configuração pública do aplicativo Web. A proteção real está no login e nas regras do Firestore, não em esconder esses valores.

### 2. Publicar regras e site

Autentique o Firebase CLI:

```bash
npm install -g firebase-tools@15.23.0
firebase login
```

O repositório já está associado ao projeto `flyflow-a97ab`. Para publicar:

```bash
npm run deploy:firebase
```

O arquivo `firebase.json` configura E-mail/Senha no Authentication, o Hosting como SPA, cache de arquivos versionados e a publicação das regras e índices do Firestore. As regras em `firestore.rules` isolam cada espaço de trabalho e só permitem acesso a membros autenticados e ativos.

### 3. Continuar usando o GitHub Pages

Também é possível manter o frontend gratuito no GitHub Pages e usar apenas Firebase Auth + Firestore como backend. A configuração pública do aplicativo Web está em `.env.production` e o workflow atual já a inclui no build.

O domínio `emersongmsantos03.github.io` já está autorizado no Firebase Authentication.

Ambientes publicados:

- Firebase Hosting: `https://flyflow-a97ab.web.app`
- GitHub Pages: `https://emersongmsantos03.github.io/FlyFlow/`

### Como os dados são organizados

- Cada empresa possui um `workspace`.
- Cada usuário autenticado possui uma associação ativa ao workspace.
- Contatos, projetos, agenda, propostas, financeiro e demais cadastros são gravados individualmente no Firestore.
- Criações e alterações escrevem somente os registros modificados; exclusões removem o documento correspondente.
- O carregamento continua compatível com o formato antigo por seções e o converte automaticamente para o formato granular.
- Usuários internos criados pelo administrador recebem conta no Firebase Auth e acesso ao mesmo workspace.
- O navegador mantém uma cópia local para tolerar recarregamentos e falhas temporárias de rede.

Comprovantes enviados diretamente do computador usam `data URL` e permanecem apenas no navegador. Links externos de comprovantes são sincronizados. O Cloud Storage for Firebase exige o plano Blaze; por isso o projeto não tenta colocar arquivos pesados dentro do Firestore, que possui limite de 1 MiB por documento.

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
  services/firebase.ts    # Firebase Auth e inicializacao do Firestore
  services/firebaseData.ts # workspaces, CRUD granular e migracao do formato legado
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
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_MAPS_API_KEY=
VITE_LEAD_HUNTER_API_URL=
```

### OpenAI no Lead Hunter

A chave da OpenAI fica somente na Firebase Function. Nunca use `VITE_OPENAI_API_KEY`.

```bash
cd functions
npm install
cd ..
firebase functions:secrets:set OPENAI_API_KEY
```

Informe a chave nova quando solicitado. Depois publique a função e configure no frontend:

```bash
firebase deploy --only functions:leadApi
```

```bash
VITE_LEAD_HUNTER_API_URL=https://southamerica-east1-flyflow-a97ab.cloudfunctions.net/leadApi
```

O OpenStreetMap continua sendo a fonte inicial gratuita. A OpenAI pesquisa contatos
públicos para até dez resultados por lote e mantém campos vazios quando não encontra
evidência confiável.

Para usar busca de endereços e mapas, habilite na mesma chave do Google Cloud:

- Maps JavaScript API
- Places API

Em produção, restrinja a chave aos domínios do sistema e somente a essas APIs.

Sem Firebase ou Supabase o sistema continua funcionando localmente no navegador. Se ambos estiverem configurados, Firebase tem prioridade. Com Firebase, o login usa Firebase Auth e o estado é sincronizado no workspace protegido pelas regras do Firestore. Com apenas Supabase, o comportamento anterior de Auth + `app_state_snapshots` protegido por RLS é mantido.

## Limitacoes atuais

- Com a Edge Function `google-calendar` e os segredos OAuth configurados, eventos sao criados e atualizados pelo mesmo `external_event_id`. Sem essa configuracao, o sistema abre o evento preenchido para confirmacao do usuario.
- Comprovantes em modo local usam data URL e estão sujeitos ao limite do navegador. Para sincronizar arquivos binários entre dispositivos, use Cloud Storage no Blaze, Supabase Storage ou links de um provedor externo.
- No Firebase, cada entidade é persistida em um documento próprio. O fallback Supabase ainda usa `app_state_snapshots`; seu schema relacional completo permanece preparado nas migrations para uma futura adoção integral desse backend.
- A migration `20260714150000_crm_finance_integrity.sql` precisa ser aplicada no ambiente Supabase antes de usar as novas colunas relacionais de soft delete, auditoria, comprovantes e oportunidades.
