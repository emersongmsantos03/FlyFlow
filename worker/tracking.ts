// Links curtos dos e-mails, eventos de prospecção e cliques dos sites. O Worker só
// registra: quem aplica os eventos no CRM é o FlyFlow aberto no navegador, porque o
// CRM mora no snapshot do workspace e uma escrita daqui geraria conflito de versão.

export interface TrackingEnv {
  FLYFLOW_DB: D1Database
  GOOGLE_OAUTH: KVNamespace
  IP_HASH_SALT?: string
}

export const HOME_URL = 'https://www.herodrone.com.br/'
export const siteOrigins = new Set([
  'https://herodrone.com.br',
  'https://www.herodrone.com.br',
  'https://loja.herodrone.com.br',
])

export const linkButtons = ['whatsapp', 'portfolio', 'site'] as const
export const emailEventTypes = ['email_sent', 'email_reply', 'email_bounce', 'email_unsubscribe'] as const
type EmailEventType = (typeof emailEventTypes)[number]

const MAX_BATCH = 500
const D1_BATCH_SIZE = 90
const SITE_EVENTS_PER_MINUTE = 60
const CODE_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export class TrackingError extends Error {}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const email = (value: unknown) => text(value, 200).toLowerCase()
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

/** Dia civil em Brasília, que é como o painel agrupa tudo. */
export const saoPauloDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

export const saoPauloDayBounds = (from: string, to: string) => {
  const end = new Date(`${to}T00:00:00-03:00`)
  end.setUTCDate(end.getUTCDate() + 1)
  return { start: new Date(`${from}T00:00:00-03:00`).toISOString(), end: end.toISOString() }
}

// Filtros de e-mail e pré-visualizações abrem links sozinhos antes da pessoa.
const PREVIEW_BOTS = /bot\b|bot\/|crawler|spider|preview|GoogleImageProxy|Google-Safety|Google-Read-Aloud|facebookexternalhit|WhatsApp\/|TelegramBot|Slackbot|Twitterbot|LinkedInBot|Discordbot|SkypeUriPreview|Barracuda|Proofpoint|Mimecast|MessageLabs|SafeLinks|YahooMailProxy|python-requests|curl\/|wget|Go-http-client|HeadlessChrome/i

export const isPreviewBot = (userAgent: string | null) => !userAgent || PREVIEW_BOTS.test(userAgent)

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Sem o sal configurado nada é gravado: o IP nunca vai puro nem com hash reversível. */
export const hashIp = async (ip: string | null, salt?: string) => (ip && salt ? sha256(`${salt}:${ip}`) : null)

const redirectTo = (location: string) => new Response(null, {
  status: 302,
  headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
})

interface LinkRow {
  code: string
  workspace_id: string
  destination_url: string
  campaign: string
  email_step: string
  segment: string
  lead_id: string | null
  lead_email: string
  button: string
}

/** O destino vem sempre do cadastro, nunca da URL: por isso não há redirecionamento aberto. */
export const handleRedirect = async (code: string, request: Request, env: TrackingEnv) => {
  let link: LinkRow | null = null
  try {
    link = await env.FLYFLOW_DB.prepare('SELECT * FROM tracked_links WHERE code = ?').bind(code).first<LinkRow>()
  } catch {
    return redirectTo(HOME_URL)
  }
  if (!link) return redirectTo(HOME_URL)
  try {
    const now = new Date().toISOString()
    const bot = request.method === 'HEAD' || isPreviewBot(request.headers.get('User-Agent'))
    await env.FLYFLOW_DB.prepare(`
      INSERT INTO tracking_events (id, workspace_id, type, tracked_link_code, lead_id, lead_email, campaign, email_step, segment, is_bot, ip_hash, metadata_json, occurred_at, processed_at)
      VALUES (?, ?, 'link_click', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), link.workspace_id, link.code, link.lead_id, link.lead_email, link.campaign, link.email_step, link.segment,
      bot ? 1 : 0, await hashIp(request.headers.get('CF-Connecting-IP'), env.IP_HASH_SALT),
      JSON.stringify({ button: link.button, bot }), now, bot ? now : null,
    ).run()
  } catch {
    // Quem clicou chega ao destino mesmo que o registro falhe.
  }
  return redirectTo(link.destination_url)
}

export interface LinkInput {
  destinationUrl: string
  campaign: string
  emailStep: string
  segment: string
  leadId: string | null
  leadEmail: string
  button: string
}

export const parseLinksPayload = (body: unknown): LinkInput[] => {
  const raw = (body as { links?: unknown } | null)?.links
  if (!Array.isArray(raw) || !raw.length) throw new TrackingError('Envie `links` com ao menos um item.')
  if (raw.length > MAX_BATCH) throw new TrackingError(`Máximo de ${MAX_BATCH} links por envio.`)
  return raw.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const destinationUrl = text(item.destinationUrl, 1000)
    if (!/^https:\/\/[^\s]+$/i.test(destinationUrl)) throw new TrackingError(`links[${index}].destinationUrl precisa ser https.`)
    const leadEmail = email(item.leadEmail)
    if (!isEmail(leadEmail)) throw new TrackingError(`links[${index}].leadEmail inválido.`)
    const button = text(item.button, 20).toLowerCase()
    if (!(linkButtons as readonly string[]).includes(button)) throw new TrackingError(`links[${index}].button deve ser ${linkButtons.join(', ')}.`)
    return {
      destinationUrl, leadEmail, button,
      campaign: text(item.campaign, 120), emailStep: text(item.emailStep, 60), segment: text(item.segment, 120),
      leadId: text(item.leadId, 120) || null,
    }
  })
}

export const generateCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(9))
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

const runBatches = async (env: TrackingEnv, statements: D1PreparedStatement[]) => {
  const results: D1Result[] = []
  for (let index = 0; index < statements.length; index += D1_BATCH_SIZE) {
    results.push(...await env.FLYFLOW_DB.batch(statements.slice(index, index + D1_BATCH_SIZE)))
  }
  return results
}

export const listSuppressions = async (env: TrackingEnv, workspaceId: string) => {
  const rows = await env.FLYFLOW_DB.prepare(`
    SELECT lead_email AS email, MIN(occurred_at) AS unsubscribedAt FROM tracking_events
    WHERE workspace_id = ? AND type = 'email_unsubscribe' AND lead_email IS NOT NULL
    GROUP BY lead_email ORDER BY unsubscribedAt DESC
  `).bind(workspaceId).all<{ email: string; unsubscribedAt: string }>()
  return rows.results
}

/** Quem se descadastrou não recebe link novo, mesmo que a rotina tente. */
export const createLinks = async (env: TrackingEnv, workspaceId: string, inputs: LinkInput[], baseUrl: string) => {
  const suppressed = new Set((await listSuppressions(env, workspaceId)).map((row) => row.email))
  const now = new Date().toISOString()
  const created: Array<LinkInput & { code: string; url: string }> = []
  const skipped: Array<{ leadEmail: string; reason: string }> = []
  const statements: D1PreparedStatement[] = []
  inputs.forEach((input) => {
    if (suppressed.has(input.leadEmail)) {
      skipped.push({ leadEmail: input.leadEmail, reason: 'descadastrado' })
      return
    }
    const code = generateCode()
    created.push({ ...input, code, url: `${baseUrl}/r/${code}` })
    statements.push(env.FLYFLOW_DB.prepare(`
      INSERT INTO tracked_links (code, workspace_id, destination_url, campaign, email_step, segment, lead_id, lead_email, button, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(code, workspaceId, input.destinationUrl, input.campaign, input.emailStep, input.segment, input.leadId, input.leadEmail, input.button, now))
  })
  await runBatches(env, statements)
  return { links: created, skipped }
}

export interface EventInput {
  externalId: string
  type: EmailEventType
  leadEmail: string
  leadId: string | null
  campaign: string
  emailStep: string
  segment: string
  occurredAt: string
  metadata: Record<string, unknown>
}

export const parseEventsPayload = (body: unknown): EventInput[] => {
  const raw = (body as { events?: unknown } | null)?.events
  if (!Array.isArray(raw) || !raw.length) throw new TrackingError('Envie `events` com ao menos um item.')
  if (raw.length > MAX_BATCH) throw new TrackingError(`Máximo de ${MAX_BATCH} eventos por envio.`)
  return raw.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const externalId = text(item.externalId, 200)
    if (!externalId) throw new TrackingError(`events[${index}].externalId é obrigatório.`)
    const type = text(item.type, 30) as EmailEventType
    if (!emailEventTypes.includes(type)) throw new TrackingError(`events[${index}].type deve ser ${emailEventTypes.join(', ')}.`)
    const leadEmail = email(item.email)
    if (!isEmail(leadEmail)) throw new TrackingError(`events[${index}].email inválido.`)
    const occurred = new Date(text(item.occurredAt, 40))
    if (Number.isNaN(occurred.getTime())) throw new TrackingError(`events[${index}].occurredAt inválido.`)
    return {
      externalId, type, leadEmail,
      leadId: text(item.leadId, 120) || null,
      campaign: text(item.campaign, 120), emailStep: text(item.emailStep, 60), segment: text(item.segment, 120),
      occurredAt: occurred.toISOString(),
      metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : {},
    }
  })
}

export const storeEvents = async (env: TrackingEnv, workspaceId: string, events: EventInput[]) => {
  const results = await runBatches(env, events.map((event) => env.FLYFLOW_DB.prepare(`
    INSERT INTO tracking_events (id, workspace_id, type, external_id, lead_id, lead_email, campaign, email_step, segment, metadata_json, occurred_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `).bind(crypto.randomUUID(), workspaceId, event.type, event.externalId, event.leadId, event.leadEmail, event.campaign, event.emailStep, event.segment, JSON.stringify(event.metadata).slice(0, 4000), event.occurredAt)))
  const inserted = results.reduce((total, result) => total + (result.meta?.changes ?? 0), 0)
  return { received: events.length, inserted, duplicates: events.length - inserted }
}

export const pendingEvents = async (env: TrackingEnv, workspaceId: string) => {
  const rows = await env.FLYFLOW_DB.prepare(`
    SELECT id, type, tracked_link_code AS trackedLinkCode, lead_id AS leadId, lead_email AS leadEmail, campaign, email_step AS emailStep,
      segment, metadata_json AS metadataJson, occurred_at AS occurredAt
    FROM tracking_events
    WHERE workspace_id = ? AND processed_at IS NULL AND is_bot = 0 AND type <> 'site_button_click' AND lead_email IS NOT NULL
    ORDER BY occurred_at LIMIT 500
  `).bind(workspaceId).all<Record<string, unknown> & { metadataJson: string }>()
  return rows.results.map(({ metadataJson, ...event }) => ({ ...event, metadata: JSON.parse(metadataJson || '{}') }))
}

export const ackEvents = async (env: TrackingEnv, workspaceId: string, ids: string[]) => {
  const now = new Date().toISOString()
  await runBatches(env, ids.slice(0, MAX_BATCH).map((id) =>
    env.FLYFLOW_DB.prepare('UPDATE tracking_events SET processed_at = ? WHERE workspace_id = ? AND id = ? AND processed_at IS NULL').bind(now, workspaceId, id)))
}

export const emailReport = async (env: TrackingEnv, workspaceId: string, from: string, to: string) => {
  const { start, end } = saoPauloDayBounds(from, to)
  const [rows, people] = await Promise.all([
    env.FLYFLOW_DB.prepare(`
      SELECT type, campaign, segment, email_step AS emailStep, COUNT(*) AS total, COUNT(DISTINCT lead_email) AS people
      FROM tracking_events
      WHERE workspace_id = ? AND is_bot = 0 AND type <> 'site_button_click' AND occurred_at >= ? AND occurred_at < ?
      GROUP BY type, campaign, segment, email_step
    `).bind(workspaceId, start, end).all(),
    env.FLYFLOW_DB.prepare(`
      SELECT type, lead_id AS leadId, lead_email AS leadEmail, campaign, MAX(occurred_at) AS occurredAt
      FROM tracking_events
      WHERE workspace_id = ? AND is_bot = 0 AND type IN ('link_click', 'email_reply') AND occurred_at >= ? AND occurred_at < ?
      GROUP BY type, lead_email ORDER BY occurredAt DESC LIMIT 100
    `).bind(workspaceId, start, end).all(),
  ])
  return { rows: rows.results, people: people.results }
}

const siteCors = (origin: string | null): Record<string, string> => (origin && siteOrigins.has(origin)
  ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' }
  : { Vary: 'Origin' })

const withinRateLimit = async (env: TrackingEnv, ip: string) => {
  const key = `ratelimit:track:${await sha256(ip)}:${Math.floor(Date.now() / 60_000)}`
  const count = Number(await env.GOOGLE_OAUTH.get(key)) || 0
  if (count >= SITE_EVENTS_PER_MINUTE) return false
  await env.GOOGLE_OAUTH.put(key, String(count + 1), { expirationTtl: 120 })
  return true
}

/** Cada clique soma no total do dia e na linha do botão, usada no ranking. */
export const handleSiteEvent = async (request: Request, env: TrackingEnv) => {
  const origin = request.headers.get('Origin')
  const headers = siteCors(origin)
  if (!origin || !siteOrigins.has(origin)) return new Response(null, { status: 403, headers })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return new Response(null, { status: 405, headers })
  try {
    const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido'
    if (!await withinRateLimit(env, ip)) return new Response(null, { status: 429, headers })
    const body = JSON.parse((await request.text()).slice(0, 2000) || '{}') as { name?: unknown; path?: unknown }
    const name = text(body.name, 60).toLowerCase()
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(name)) return new Response(null, { status: 400, headers })
    // O FlyFlow tem um único workspace; a rota pública não recebe token para escolhê-lo.
    const workspace = await env.FLYFLOW_DB.prepare('SELECT workspace_id FROM workspaces ORDER BY rowid LIMIT 1').first<{ workspace_id: string }>()
    if (!workspace) return new Response(null, { status: 503, headers })
    const account = new URL(origin).hostname.replace(/^www\./, '')
    const date = saoPauloDate()
    const now = new Date().toISOString()
    const bump = (metric: string) => env.FLYFLOW_DB.prepare(`
      INSERT INTO metric_points (workspace_id, source, account, metric, date, value, updated_at)
      VALUES (?, 'site', ?, ?, ?, 1, ?)
      ON CONFLICT(workspace_id, source, account, metric, date) DO UPDATE SET value = metric_points.value + 1, updated_at = excluded.updated_at
    `).bind(workspace.workspace_id, account, metric, date, now)
    await env.FLYFLOW_DB.batch([
      bump('button_clicks'),
      bump(`button_clicks.${name}`),
      env.FLYFLOW_DB.prepare(`
        INSERT INTO tracking_events (id, workspace_id, type, metadata_json, ip_hash, occurred_at, processed_at)
        VALUES (?, ?, 'site_button_click', ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), workspace.workspace_id, JSON.stringify({ name, account, path: text(body.path, 200) }), await hashIp(ip, env.IP_HASH_SALT), now, now),
    ])
    return new Response(null, { status: 204, headers })
  } catch {
    return new Response(null, { status: 400, headers })
  }
}
