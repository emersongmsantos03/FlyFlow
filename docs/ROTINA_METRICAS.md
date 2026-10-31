# Rotina de métricas do FlyFlow

A página **Métricas** mostra o que chega pelo endpoint abaixo. Quem coleta os dados
é uma rotina externa (por exemplo, uma rotina agendada do Claude): ela lê cada canal
e envia os números ao FlyFlow. O FlyFlow não precisa conhecer a API de cada rede.

## Antes de ligar

1. Publique o backend (uma vez):

   ```sh
   npx wrangler d1 migrations apply flyflow-db --remote
   npx wrangler deploy
   ```

2. No FlyFlow, abra **Integrações → Tokens de acesso → Gerar token** e copie o valor.
   Ele aparece só uma vez. Guarde na configuração da rotina como `FLYFLOW_TOKEN`.

Cada token tem permissões próprias e nenhuma dá acesso a clientes ou ao financeiro.
Se vazar, revogue em Integrações.

| Permissão | Libera |
|---|---|
| `metrics` | `POST /integrations/ingest`, `GET /integrations/context` |
| `links` | `POST /integrations/links`, `GET /integrations/suppressions` |
| `events` | `POST /integrations/events`, `GET /integrations/suppressions` |

Use dois tokens: **Rotina de envio** (`links` + `events`) e **Rotina da madrugada**
(`metrics` + `events`). Tokens criados antes das permissões seguem só com `metrics`.

O FlyFlow não chama as APIs das redes e não guarda senha nem token delas. Quem coleta
é a rotina, com as conexões configuradas no próprio Claude.

Todas as datas seguem o fuso `America/Sao_Paulo`.

## Enviar dados

`POST https://flyflow.herodronecwb.workers.dev/integrations/ingest`

Cabeçalhos: `Authorization: Bearer <token>` e `Content-Type: application/json`.
Faça uma requisição por canal e conta.

```json
{
  "source": "instagram",
  "account": "@herodrone",
  "metrics": [
    { "metric": "followers", "date": "2026-10-30", "value": 3200 },
    { "metric": "reach", "date": "2026-10-30", "value": 1180 }
  ],
  "posts": [
    {
      "externalId": "17890012345",
      "contentId": "content-abc",
      "title": "Bastidores da gravação",
      "url": "https://www.instagram.com/p/abc/",
      "format": "Reels",
      "publishedAt": "2026-10-28T13:00:00Z",
      "metrics": { "reach": 2100, "likes": 180, "comments": 12, "saves": 40 }
    }
  ],
  "run": { "agent": "rotina-claude", "message": "Coleta diária" }
}
```

- **Datas** em `AAAA-MM-DD`, sempre o dia a que o número se refere.
- **Reenviar é seguro**: mesma combinação de canal, conta, métrica e dia substitui o valor.
  Reenviar o mesmo `externalId` atualiza o post.
- **Limites**: 5.000 métricas e 500 posts por requisição.
- `contentId` é opcional. Sem ele, o post é ligado ao planejamento pelo link publicado.

### Quando a coleta falhar

Avise em vez de ficar em silêncio: o alerta aparece em Métricas e Integrações.

```json
{ "source": "youtube", "run": { "status": "error", "message": "Token do YouTube expirou", "agent": "rotina-claude" } }
```

## Consultar o estado

`GET /integrations/context` com o mesmo token devolve as contas conhecidas, a última
coleta e o último dia com dados por canal. A rotina usa isso para saber de onde retomar.

## Canais e métricas reconhecidos

| `source` | Métricas |
|---|---|
| `instagram` | `followers`, `reach`, `impressions`, `profile_visits`, `engagement` |
| `youtube` | `subscribers`, `views`, `watch_minutes` |
| `tiktok` | `followers`, `views`, `engagement` |
| `facebook` | `followers`, `reach`, `engagement` |
| `linkedin` | `followers`, `impressions`, `engagement` |
| `email` | `subscribers`, `sent`, `clicks`, `clicked_contacts`, `replies`, `bounces`, `unsubscribes`, `open_rate`, `click_rate` |
| `google_business` | `profile_views`, `search_views`, `maps_views`, `website_clicks`, `calls`, `direction_requests` |
| `site` | `users`, `sessions`, `pageviews`, `conversions` (use `account` `herodrone.com.br` ou `loja.herodrone.com.br`) |
| `ads` | `spend`, `clicks`, `leads` |

`followers`, `subscribers` e similares são **totais do dia**: o painel usa o valor mais
recente. As demais são **do dia**: o painel soma o período. `open_rate` e `click_rate`
vão em porcentagem (`31.5`, não `0.315`) e o painel mostra a média.

`opens` só deve ser enviado se vier de fonte confiável. Se não vier, deixe vazio: nunca
estime. Não envie `site/button_clicks` pela rotina: esse número vem do script dos sites.
A aba Emails é calculada pelos eventos abaixo, então não é preciso enviar `email` por ingest.

Canal ou métrica fora da tabela também é aceito e aparece no painel com o nome enviado.
Para dar rótulo e formato próprios, adicione em `metricChannels` (`src/lib/marketing.ts`).

## Links rastreados

Todo link de e-mail passa pelo FlyFlow, porque o Gmail reescreve links.

`POST /integrations/links` (permissão `links`), até 500 por envio:

```json
{
  "links": [
    {
      "destinationUrl": "https://wa.me/5541999999999",
      "button": "whatsapp",
      "leadEmail": "contato@empresa.com.br",
      "leadId": "lead-123",
      "campaign": "pousadas-novembro",
      "segment": "hospedagem",
      "emailStep": "1"
    }
  ]
}
```

`button` é `whatsapp`, `portfolio` ou `site`. `destinationUrl` precisa ser `https`. A resposta
traz `links[].url` para colocar no e-mail e `skipped` com quem se descadastrou: esses
não têm link e não devem receber o e-mail.

## Eventos de e-mail

`POST /integrations/events` (permissão `events`), até 500 por envio:

```json
{
  "events": [
    {
      "externalId": "gmail-18c3f2a",
      "type": "email_reply",
      "email": "contato@empresa.com.br",
      "leadId": "lead-123",
      "campaign": "pousadas-novembro",
      "segment": "hospedagem",
      "emailStep": "1",
      "occurredAt": "2026-10-30T14:22:00Z",
      "metadata": { "snippet": "Tenho interesse, pode me ligar?" }
    }
  ]
}
```

`type`: `email_sent`, `email_reply`, `email_bounce` ou `email_unsubscribe`. Use o id da
mensagem no Gmail em `externalId`: reenviar o mesmo evento não duplica nada. A resposta
informa `inserted` e `duplicates`.

## Lista de descadastro

`GET /integrations/suppressions` (permissão `links` ou `events`) devolve
`{ "suppressions": [{ "email": "...", "unsubscribedAt": "..." }] }`.
Quem está nessa lista nunca mais recebe e-mail.

## Rotina de envio, 9h (horário de Brasília)

Token: `links` + `events`.

```text
Todos os dias às 9h (America/Sao_Paulo), envie os e-mails de prospecção do dia.

1. Consulte GET /integrations/suppressions e remova esses e-mails da lista de hoje.
2. Para cada destinatário, gere os links em POST /integrations/links, com campaign,
   segment, emailStep, leadEmail, leadId (se houver) e button. Se um e-mail voltar em
   "skipped", não envie para ele.
3. Envie pelo Gmail usando somente os links curtos devolvidos. Não inclua pixel de
   abertura.
4. Para cada envio confirmado, registre em POST /integrations/events um evento
   email_sent, com o id da mensagem do Gmail em externalId e occurredAt real do envio.
5. Se um envio falhar, não registre email_sent para ele e continue nos demais.
6. Ao final, resuma quantos foram enviados, ignorados e com falha.
```

## Rotina da madrugada, 3h (horário de Brasília)

Token: `metrics` + `events`.

```text
Todos os dias às 3h (America/Sao_Paulo), atualize os resultados da Hero Drone no FlyFlow.

1. E-mails: busque no Gmail as respostas e os bounces das últimas 48 horas e envie em
   POST /integrations/events como email_reply e email_bounce, com o id da mensagem em
   externalId. Quem pedir para sair vira email_unsubscribe. Em caso de dúvida sobre
   o pedido de saída, trate como descadastro.
2. Consulte GET /integrations/context. Para cada canal e conta, os dias faltando vão do
   dia seguinte a latestData.latestDate até "yesterday". Canal sem histórico começa em
   "yesterday".
3. Colete até ontem Instagram, Facebook, YouTube, Google Meu Negócio e o site (uma conta
   para herodrone.com.br e outra para loja.herodrone.com.br).
4. Envie um POST /integrations/ingest por canal e conta, incluindo no Instagram, Facebook
   e YouTube os posts publicados nos últimos 30 dias.
5. Use só números que a fonte retornou. Nunca estime, arredonde nem preencha dia sem
   dado. Se abertura de e-mail não vier de fonte confiável, deixe vazio.
6. Se um canal falhar, envie run.status "error" com o motivo e continue nos demais.
7. Ao final, resuma o que foi enviado e o que falhou.
```

## Cliques nos botões dos sites

Os sites `herodrone.com.br`, `www.herodrone.com.br` e `loja.herodrone.com.br` enviam
cliques para `POST /t/event` pelo script `public/flyflow-track.js`. Só esses domínios são
aceitos, com limite de 60 cliques por minuto por IP. O ranking aparece na aba Site.
