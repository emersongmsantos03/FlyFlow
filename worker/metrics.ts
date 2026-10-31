import { listDataAudit } from './dataApi'
import { ackEvents, createLinks, emailReport, listSuppressions, parseEventsPayload, parseLinksPayload, pendingEvents, saoPauloDate, storeEvents, TrackingError, type TrackingEnv } from './tracking'

// Métricas de marketing: recebe os dados da rotina (token de integração) e os
// entrega ao FlyFlow (login Firebase). Tudo é genérico por `source` + `metric`,
// então um canal novo não exige mudança aqui.

type MetricsEnv = TrackingEnv

export interface MetricsAccess {
  workspaceId: string
  userId: string
  canManage: boolean
}

export interface IngestPayload {
  source: string
  account: string
  status: 'ok' | 'error'
  message: string
  agent: string
  points: Array<{ metric: string; date: string; value: number }>
  posts: Array<{
    externalId: string
    contentId: string
    title: string
    url: string
    format: string
    thumbnailUrl: string
    publishedAt: string
    metrics: Record<string, number>
  }>
}

export const tokenScopes = ['metrics', 'links', 'events', 'crm:read', 'crm:write', 'content:read', 'content:write'] as const
export type TokenScope = (typeof tokenScopes)[number]

export const parseScopes = (value: unknown): TokenScope[] =>
  tokenScopes.filter((scope) => String(value ?? '').split(',').map((item) => item.trim()).includes(scope))

/** Permissão exigida por rota. Listas de exclusão servem às duas rotinas que escrevem e-mails. */
const routeScopes: Record<string, TokenScope[]> = {
  'GET /integrations/context': ['metrics'],
  'POST /integrations/ingest': ['metrics'],
  'POST /integrations/links': ['links'],
  'POST /integrations/events': ['events'],
  'GET /integrations/suppressions': ['links', 'events'],
}

const MAX_POINTS = 5_000
const MAX_POSTS = 500
const BATCH_SIZE = 90

export class IngestError extends Error {}

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

const metricKey = (value: unknown) => text(value, 60).toLowerCase()
const isMetricKey = (value: string) => /^[a-z0-9][a-z0-9_.-]*$/.test(value)

export const parseIngestPayload = (body: unknown): IngestPayload => {
  if (!body || typeof body !== 'object') throw new IngestError('Envie um objeto JSON.')
  const input = body as Record<string, unknown>
  const source = text(input.source, 40).toLowerCase()
  if (!/^[a-z0-9][a-z0-9_-]+$/.test(source)) throw new IngestError('`source` é obrigatório (ex.: instagram, youtube, email).')
  const account = text(input.account, 120)
  const run = (input.run && typeof input.run === 'object' ? input.run : {}) as Record<string, unknown>
  const status = run.status === 'error' ? 'error' : 'ok'

  const rawPoints = Array.isArray(input.metrics) ? input.metrics : []
  const rawPosts = Array.isArray(input.posts) ? input.posts : []
  if (rawPoints.length > MAX_POINTS) throw new IngestError(`Máximo de ${MAX_POINTS} métricas por envio.`)
  if (rawPosts.length > MAX_POSTS) throw new IngestError(`Máximo de ${MAX_POSTS} posts por envio.`)

  const points = rawPoints.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>
    const metric = metricKey(item.metric)
    const date = text(item.date, 10)
    const value = typeof item.value === 'string' ? Number(item.value) : item.value
    if (!isMetricKey(metric)) throw new IngestError(`metrics[${index}].metric inválida: use letras minúsculas, números, _ ou .`)
    if (!isCalendarDate(date)) throw new IngestError(`metrics[${index}].date inválida: use AAAA-MM-DD.`)
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new IngestError(`metrics[${index}].value precisa ser numérico.`)
    return { metric, date, value }
  })

  const posts = rawPosts.map((raw, index) => {
    const item = (raw ?? {}) as Record<string, unknown>
    const externalId = text(item.externalId, 200)
    if (!externalId) throw new IngestError(`posts[${index}].externalId é obrigatório.`)
    const url = text(item.url, 600)
    if (url && !/^https?:\/\//i.test(url)) throw new IngestError(`posts[${index}].url precisa começar com http.`)
    const thumbnailUrl = text(item.thumbnailUrl, 600)
    const metrics: Record<string, number> = {}
    Object.entries((item.metrics && typeof item.metrics === 'object' ? item.metrics : {}) as Record<string, unknown>).forEach(([key, value]) => {
      const name = metricKey(key)
      const number = typeof value === 'string' ? Number(value) : value
      if (isMetricKey(name) && typeof number === 'number' && Number.isFinite(number)) metrics[name] = number
    })
    return {
      externalId,
      contentId: text(item.contentId, 120),
      title: text(item.title, 300),
      url,
      format: text(item.format, 60),
      thumbnailUrl: /^https?:\/\//i.test(thumbnailUrl) ? thumbnailUrl : '',
      publishedAt: text(item.publishedAt, 40),
      metrics,
    }
  })

  if (status === 'ok' && !points.length && !posts.length) throw new IngestError('Envie `metrics` ou `posts`, ou `run.status: "error"`.')
  return { source, account, status, message: text(run.message, 500), agent: text(run.agent, 120), points, posts }
}

export const hashToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const generateToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return `ffk_${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

const runBatches = async (env: MetricsEnv, statements: D1PreparedStatement[]) => {
  for (let index = 0; index < statements.length; index += BATCH_SIZE) {
    await env.FLYFLOW_DB.batch(statements.slice(index, index + BATCH_SIZE))
  }
}

export const storeIngest = async (env: MetricsEnv, workspaceId: string, payload: IngestPayload) => {
  const now = new Date().toISOString()
  const statements: D1PreparedStatement[] = []
  payload.points.forEach((point) => {
    statements.push(env.FLYFLOW_DB.prepare(`
      INSERT INTO metric_points (workspace_id, source, account, metric, date, value, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, source, account, metric, date) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).bind(workspaceId, payload.source, payload.account, point.metric, point.date, point.value, now))
  })
  payload.posts.forEach((post) => {
    statements.push(env.FLYFLOW_DB.prepare(`
      INSERT INTO metric_posts (workspace_id, source, account, external_id, content_id, title, url, format, thumbnail_url, published_at, metrics_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id, source, account, external_id) DO UPDATE SET
        content_id = COALESCE(NULLIF(excluded.content_id, ''), metric_posts.content_id),
        title = excluded.title, url = excluded.url, format = excluded.format, thumbnail_url = excluded.thumbnail_url,
        published_at = excluded.published_at, metrics_json = excluded.metrics_json, updated_at = excluded.updated_at
    `).bind(workspaceId, payload.source, payload.account, post.externalId, post.contentId, post.title, post.url, post.format, post.thumbnailUrl, post.publishedAt || null, JSON.stringify(post.metrics), now))
  })
  statements.push(env.FLYFLOW_DB.prepare(`
    INSERT INTO integration_connections (workspace_id, source, account, status, last_sync_at, last_error)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(workspace_id, source, account) DO UPDATE SET
      status = excluded.status,
      last_sync_at = CASE WHEN excluded.status = 'ok' THEN excluded.last_sync_at ELSE integration_connections.last_sync_at END,
      last_error = excluded.last_error
  `).bind(workspaceId, payload.source, payload.account, payload.status, payload.status === 'ok' ? now : null, payload.status === 'error' ? payload.message : null))
  statements.push(env.FLYFLOW_DB.prepare(`
    INSERT INTO integration_runs (id, workspace_id, source, account, status, points_count, posts_count, message, agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), workspaceId, payload.source, payload.account, payload.status, payload.points.length, payload.posts.length, payload.message, payload.agent, now))
  await runBatches(env, statements)
  return { points: payload.points.length, posts: payload.posts.length, syncedAt: now }
}

const corsFor = (origin: string | null) => ({
  ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
})

const reply = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: corsFor(origin) })

const describeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : ''
  if (/no such (table|column)/i.test(message)) return 'Banco de métricas ainda não criado. Rode: npx wrangler d1 migrations apply flyflow-db --remote'
  return message || 'Falha ao processar as métricas.'
}

const dateParam = (value: string | null, fallback: string) => (value && isCalendarDate(value) ? value : fallback)

/** Rotas chamadas pela rotina, autenticadas pelo token `ffk_…`. */
export const handleIntegrationRequest = async (request: Request, url: URL, env: MetricsEnv, token: string, origin: string | null) => {
  if (!token.startsWith('ffk_')) return reply({ error: 'Token de integração ausente ou inválido.' }, 401, origin)
  const required = routeScopes[`${request.method} ${url.pathname}`]
  if (!required) return reply({ error: 'Rota não encontrada.' }, 404, origin)
  try {
    const stored = await env.FLYFLOW_DB.prepare(
      'SELECT id, workspace_id, scopes FROM integration_tokens WHERE token_hash = ? AND revoked_at IS NULL',
    ).bind(await hashToken(token)).first<{ id: string; workspace_id: string; scopes: string }>()
    if (!stored) return reply({ error: 'Token de integração ausente ou inválido.' }, 401, origin)
    const granted = parseScopes(stored.scopes)
    if (!required.some((scope) => granted.includes(scope))) return reply({ error: `Este token não tem a permissão ${required.join(' ou ')}.` }, 403, origin)
    await env.FLYFLOW_DB.prepare('UPDATE integration_tokens SET last_used_at = ? WHERE id = ?').bind(new Date().toISOString(), stored.id).run()

    if (request.method === 'GET' && url.pathname === '/integrations/context') {
      const connections = await env.FLYFLOW_DB.prepare(
        'SELECT source, account, status, last_sync_at AS lastSyncAt, last_error AS lastError FROM integration_connections WHERE workspace_id = ? ORDER BY source',
      ).bind(stored.workspace_id).all()
      const latest = await env.FLYFLOW_DB.prepare(
        'SELECT source, account, MAX(date) AS latestDate FROM metric_points WHERE workspace_id = ? GROUP BY source, account',
      ).bind(stored.workspace_id).all()
      const yesterday = new Date(Date.now() - 86_400_000)
      return reply({ connections: connections.results, latestData: latest.results, today: saoPauloDate(), yesterday: saoPauloDate(yesterday), timeZone: 'America/Sao_Paulo' }, 200, origin)
    }
    if (request.method === 'POST' && url.pathname === '/integrations/ingest') {
      const payload = parseIngestPayload(await request.json().catch(() => null))
      return reply({ saved: true, ...(await storeIngest(env, stored.workspace_id, payload)) }, 200, origin)
    }
    if (url.pathname === '/integrations/links') {
      const inputs = parseLinksPayload(await request.json().catch(() => null))
      return reply(await createLinks(env, stored.workspace_id, inputs, url.origin), 201, origin)
    }
    if (url.pathname === '/integrations/events') {
      const events = parseEventsPayload(await request.json().catch(() => null))
      return reply(await storeEvents(env, stored.workspace_id, events), 200, origin)
    }
    return reply({ suppressions: await listSuppressions(env, stored.workspace_id) }, 200, origin)
  } catch (error) {
    if (error instanceof IngestError || error instanceof TrackingError) return reply({ error: error.message }, 400, origin)
    return reply({ error: describeError(error) }, 500, origin)
  }
}

/** Rotas chamadas pelo próprio FlyFlow, autenticadas pelo login Firebase. */
export const handleMetricsRequest = async (request: Request, url: URL, env: MetricsEnv, access: MetricsAccess, origin: string | null) => {
  const { workspaceId } = access
  try {
    if (request.method === 'GET' && url.pathname === '/metrics') {
      const today = saoPauloDate()
      const defaultFrom = saoPauloDate(new Date(Date.now() - 180 * 86_400_000))
      const from = dateParam(url.searchParams.get('from'), defaultFrom)
      const to = dateParam(url.searchParams.get('to'), today)
      const [points, posts, connections, runs] = await Promise.all([
        env.FLYFLOW_DB.prepare(
          'SELECT source, account, metric, date, value FROM metric_points WHERE workspace_id = ? AND date BETWEEN ? AND ? ORDER BY date',
        ).bind(workspaceId, from, to).all(),
        env.FLYFLOW_DB.prepare(`
          SELECT source, account, external_id AS externalId, content_id AS contentId, title, url, format,
            thumbnail_url AS thumbnailUrl, published_at AS publishedAt, metrics_json AS metricsJson
          FROM metric_posts WHERE workspace_id = ? ORDER BY published_at DESC LIMIT 200
        `).bind(workspaceId).all<Record<string, unknown> & { metricsJson: string }>(),
        env.FLYFLOW_DB.prepare(
          'SELECT source, account, status, last_sync_at AS lastSyncAt, last_error AS lastError FROM integration_connections WHERE workspace_id = ? ORDER BY source',
        ).bind(workspaceId).all(),
        env.FLYFLOW_DB.prepare(`
          SELECT id, source, account, status, points_count AS pointsCount, posts_count AS postsCount, message, agent, created_at AS createdAt
          FROM integration_runs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 30
        `).bind(workspaceId).all(),
      ])
      return reply({
        points: points.results,
        posts: posts.results.map(({ metricsJson, ...post }) => ({ ...post, metrics: JSON.parse(metricsJson || '{}') })),
        connections: connections.results,
        runs: runs.results,
      }, 200, origin)
    }
    if (request.method === 'GET' && url.pathname === '/metrics/email') {
      const today = saoPauloDate()
      const from = dateParam(url.searchParams.get('from'), saoPauloDate(new Date(Date.now() - 29 * 86_400_000)))
      return reply(await emailReport(env, workspaceId, from, dateParam(url.searchParams.get('to'), today)), 200, origin)
    }
    if (request.method === 'GET' && url.pathname === '/metrics/data-audit') {
      return reply({ entries: await listDataAudit(env, workspaceId) }, 200, origin)
    }
    if (request.method === 'GET' && url.pathname === '/crm/events/pending') {
      return reply({ events: await pendingEvents(env, workspaceId) }, 200, origin)
    }
    if (request.method === 'POST' && url.pathname === '/crm/events/ack') {
      const body = await request.json().catch(() => null) as { ids?: unknown } | null
      await ackEvents(env, workspaceId, Array.isArray(body?.ids) ? body.ids.map(String) : [])
      return reply({ acknowledged: true }, 200, origin)
    }
    if (request.method === 'POST' && url.pathname === '/metrics/manual') {
      const payload = parseIngestPayload(await request.json().catch(() => null))
      return reply({ saved: true, ...(await storeIngest(env, workspaceId, { ...payload, agent: `manual:${access.userId}` })) }, 200, origin)
    }

    if (!url.pathname.startsWith('/integrations/tokens')) return reply({ error: 'Rota não encontrada.' }, 404, origin)
    if (!access.canManage) return reply({ error: 'Seu usuário não pode gerenciar integrações.' }, 403, origin)

    if (request.method === 'GET' && url.pathname === '/integrations/tokens') {
      const tokens = await env.FLYFLOW_DB.prepare(`
        SELECT id, label, prefix, scopes, created_at AS createdAt, last_used_at AS lastUsedAt
        FROM integration_tokens WHERE workspace_id = ? AND revoked_at IS NULL ORDER BY created_at DESC
      `).bind(workspaceId).all()
      return reply({ tokens: tokens.results }, 200, origin)
    }
    if (request.method === 'POST' && url.pathname === '/integrations/tokens') {
      const body = await request.json().catch(() => null) as { label?: string; scopes?: unknown } | null
      const label = text(body?.label, 80) || 'Rotina Claude'
      const scopes = parseScopes(Array.isArray(body?.scopes) ? body.scopes.join(',') : body?.scopes)
      if (!scopes.length) return reply({ error: 'Escolha ao menos uma permissão.' }, 400, origin)
      const token = generateToken()
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      await env.FLYFLOW_DB.prepare(`
        INSERT INTO integration_tokens (id, workspace_id, label, prefix, token_hash, created_by, created_at, scopes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, workspaceId, label, token.slice(0, 10), await hashToken(token), access.userId, createdAt, scopes.join(',')).run()
      // O valor completo só existe nesta resposta: no banco fica apenas o hash.
      return reply({ id, label, prefix: token.slice(0, 10), scopes: scopes.join(','), createdAt, token }, 201, origin)
    }
    const tokenMatch = url.pathname.match(/^\/integrations\/tokens\/([0-9a-f-]{36})$/)
    if (request.method === 'DELETE' && tokenMatch) {
      await env.FLYFLOW_DB.prepare('UPDATE integration_tokens SET revoked_at = ? WHERE id = ? AND workspace_id = ?')
        .bind(new Date().toISOString(), tokenMatch[1], workspaceId).run()
      return reply({ revoked: true }, 200, origin)
    }
    return reply({ error: 'Rota não encontrada.' }, 404, origin)
  } catch (error) {
    if (error instanceof IngestError) return reply({ error: error.message }, 400, origin)
    return reply({ error: describeError(error) }, 500, origin)
  }
}
