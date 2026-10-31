import { describe, expect, it } from 'vitest'
import { handleIntegrationRequest, hashToken, parseScopes } from './metrics'
import { emailReport, handleRedirect, handleSiteEvent, hashIp, HOME_URL, isPreviewBot, parseEventsPayload, parseLinksPayload, saoPauloDate, saoPauloDayBounds, storeEvents, createLinks, TrackingError, type TrackingEnv } from './tracking'

type Row = Record<string, unknown>

/** D1 em memória com só o que estas rotas usam; os SQL reais rodam em `wrangler dev --local`. */
const fakeEnv = (seed: { links?: Row[]; tokens?: Row[]; failInsert?: boolean } = {}) => {
  const events: Row[] = []
  const links = [...(seed.links ?? [])]
  const points = new Map<string, number>()
  const kv = new Map<string, string>()
  const exec = (sql: string, args: unknown[]) => {
    if (/INSERT INTO tracking_events/.test(sql)) {
      if (seed.failInsert) throw new Error('D1 fora do ar')
      const type = /'link_click'/.test(sql) ? 'link_click' : /'site_button_click'/.test(sql) ? 'site_button_click' : args[2]
      const externalId = /external_id/.test(sql) ? args[3] : null
      if (externalId && events.some((event) => event.externalId === externalId)) return 0
      events.push({ type, externalId, leadEmail: type === 'link_click' ? args[4] : args[5], isBot: type === 'link_click' ? args[8] : 0, ipHash: type === 'link_click' ? args[9] : null })
      return 1
    }
    if (/INSERT INTO tracked_links/.test(sql)) { links.push({ code: args[0], destination_url: args[2], lead_email: args[7] }); return 1 }
    if (/INSERT INTO metric_points/.test(sql)) { const key = String(args[2]); points.set(key, (points.get(key) ?? 0) + 1); return 1 }
    return 0
  }
  const prepare = (sql: string) => {
    let args: unknown[] = []
    const statement = {
      bind: (...values: unknown[]) => { args = values; return statement },
      first: async () => {
        if (/FROM tracked_links/.test(sql)) return links.find((link) => link.code === args[0]) ?? null
        if (/FROM integration_tokens/.test(sql)) return (seed.tokens ?? []).find((token) => token.token_hash === args[0]) ?? null
        if (/FROM workspaces/.test(sql)) return { workspace_id: 'w1' }
        return null
      },
      all: async () => {
        if (/email_unsubscribe/.test(sql) && !/IN \(/.test(sql)) return { results: events.filter((event) => event.type === 'email_unsubscribe').map((event) => ({ email: event.leadEmail })) }
        return { results: [] }
      },
      run: async () => ({ meta: { changes: exec(sql, args) } }),
      exec: () => exec(sql, args),
    }
    return statement
  }
  const env = {
    FLYFLOW_DB: { prepare, batch: async (statements: Array<{ exec: () => number }>) => statements.map((statement) => ({ meta: { changes: statement.exec() } })) },
    GOOGLE_OAUTH: { get: async (key: string) => kv.get(key) ?? null, put: async (key: string, value: string) => { kv.set(key, value) } },
    IP_HASH_SALT: 'sal-de-teste',
  } as unknown as TrackingEnv
  return { env, events, links, points }
}

const link = { code: 'abc123', workspace_id: 'w1', destination_url: 'https://wa.me/5541999', campaign: 'c', email_step: '1', segment: 's', lead_id: 'l1', lead_email: 'ana@x.com', button: 'whatsapp' }
const human = { 'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537 Chrome/130 Safari/537', 'CF-Connecting-IP': '200.1.2.3' }
const open = (headers: Record<string, string> = human, method = 'GET') => new Request('https://w.dev/r/abc123', { headers, method })

describe('redirecionamento', () => {
  it('registra o clique e leva ao destino cadastrado', async () => {
    const { env, events } = fakeEnv({ links: [link] })
    const response = await handleRedirect('abc123', open(), env)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(link.destination_url)
    expect(events).toHaveLength(1)
    expect(events[0].isBot).toBe(0)
  })

  it('código desconhecido vai para o site, sem seguir nada da URL', async () => {
    const { env, events } = fakeEnv()
    const response = await handleRedirect('naoexiste', new Request('https://w.dev/r/naoexiste?url=https://malicioso.com', { headers: human }), env)
    expect(response.headers.get('Location')).toBe(HOME_URL)
    expect(events).toHaveLength(0)
  })

  it('redireciona mesmo se o registro falhar', async () => {
    const { env } = fakeEnv({ links: [link], failInsert: true })
    const response = await handleRedirect('abc123', open(), env)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(link.destination_url)
  })

  it('marca robô de pré-visualização e HEAD como bot', async () => {
    const { env, events } = fakeEnv({ links: [link] })
    await handleRedirect('abc123', open({ 'User-Agent': 'Mozilla/5.0 (via ggpht.com GoogleImageProxy)' }), env)
    await handleRedirect('abc123', open(human, 'HEAD'), env)
    expect(events.map((event) => event.isBot)).toEqual([1, 1])
    expect(isPreviewBot(null)).toBe(true)
    expect(isPreviewBot(human['User-Agent'])).toBe(false)
  })

  it('nunca grava o IP puro', async () => {
    const { env, events } = fakeEnv({ links: [link] })
    await handleRedirect('abc123', open(), env)
    expect(events[0].ipHash).not.toContain('200.1.2.3')
    expect(await hashIp('200.1.2.3', undefined)).toBeNull()
  })
})

describe('links', () => {
  const valid = { destinationUrl: 'https://wa.me/55', leadEmail: 'Ana@X.com', button: 'whatsapp' }

  it('só aceita https e botões conhecidos', () => {
    expect(() => parseLinksPayload({ links: [{ ...valid, destinationUrl: 'javascript:alert(1)' }] })).toThrow(TrackingError)
    expect(() => parseLinksPayload({ links: [{ ...valid, destinationUrl: 'http://x.com' }] })).toThrow(TrackingError)
    expect(() => parseLinksPayload({ links: [{ ...valid, button: 'outro' }] })).toThrow(TrackingError)
    expect(parseLinksPayload({ links: [valid] })[0].leadEmail).toBe('ana@x.com')
  })

  it('não cria link para quem se descadastrou', async () => {
    const { env, links } = fakeEnv()
    await storeEvents(env, 'w1', parseEventsPayload({ events: [{ externalId: 'u1', type: 'email_unsubscribe', email: 'ana@x.com', occurredAt: '2026-10-30T12:00:00Z' }] }))
    const result = await createLinks(env, 'w1', parseLinksPayload({ links: [valid, { ...valid, leadEmail: 'bia@x.com' }] }), 'https://w.dev')
    expect(result.skipped).toEqual([{ leadEmail: 'ana@x.com', reason: 'descadastrado' }])
    expect(result.links[0].url).toMatch(/^https:\/\/w\.dev\/r\/[A-Za-z0-9]{9}$/)
    expect(links).toHaveLength(1)
  })
})

describe('eventos', () => {
  const event = { externalId: 'gmail-1', type: 'email_reply', email: 'ana@x.com', occurredAt: '2026-10-30T12:00:00Z' }

  it('é idempotente por externalId', async () => {
    const { env, events } = fakeEnv()
    expect(await storeEvents(env, 'w1', parseEventsPayload({ events: [event] }))).toEqual({ received: 1, inserted: 1, duplicates: 0 })
    expect(await storeEvents(env, 'w1', parseEventsPayload({ events: [event, { ...event, externalId: 'gmail-2' }] }))).toEqual({ received: 2, inserted: 1, duplicates: 1 })
    expect(events).toHaveLength(2)
  })

  it('valida tipo, e-mail e data', () => {
    expect(() => parseEventsPayload({ events: [{ ...event, type: 'link_click' }] })).toThrow(TrackingError)
    expect(() => parseEventsPayload({ events: [{ ...event, email: 'x' }] })).toThrow(TrackingError)
    expect(() => parseEventsPayload({ events: [{ ...event, occurredAt: 'ontem' }] })).toThrow(TrackingError)
    expect(() => parseEventsPayload({ events: [{ ...event, externalId: '' }] })).toThrow(TrackingError)
  })

  it('o relatório filtra pelo dia de Brasília', async () => {
    expect(saoPauloDayBounds('2026-10-30', '2026-10-30')).toEqual({ start: '2026-10-30T03:00:00.000Z', end: '2026-10-31T03:00:00.000Z' })
    expect(saoPauloDate(new Date('2026-10-31T01:00:00Z'))).toBe('2026-10-30')
    await expect(emailReport(fakeEnv().env, 'w1', '2026-10-01', '2026-10-30')).resolves.toEqual({ rows: [], people: [] })
  })
})

describe('permissões do token', () => {
  const call = async (scopes: string, method: string, path: string, body?: unknown) => {
    const token = 'ffk_teste'
    const { env } = fakeEnv({ tokens: [{ id: 't', workspace_id: 'w1', scopes, token_hash: await hashToken(token) }] })
    const url = new URL(`https://w.dev${path}`)
    return handleIntegrationRequest(new Request(url, { method, body: body ? JSON.stringify(body) : undefined }), url, env, token, null)
  }
  const validEvent = { events: [{ externalId: '1', type: 'email_sent', email: 'a@x.com', occurredAt: '2026-10-30T12:00:00Z' }] }

  it('token só de métricas continua enviando métricas e não acessa o resto', async () => {
    const ingest = await call('metrics', 'POST', '/integrations/ingest', { source: 'site', metrics: [{ metric: 'users', date: '2026-10-30', value: 1 }] })
    expect(ingest.status).toBe(200)
    expect((await call('metrics', 'POST', '/integrations/links', { links: [] })).status).toBe(403)
    expect((await call('metrics', 'POST', '/integrations/events', validEvent)).status).toBe(403)
    expect((await call('metrics', 'GET', '/integrations/suppressions')).status).toBe(403)
  })

  it('cada permissão abre só as próprias rotas', async () => {
    expect((await call('events', 'POST', '/integrations/events', validEvent)).status).toBe(200)
    expect((await call('events', 'GET', '/integrations/suppressions')).status).toBe(200)
    expect((await call('links', 'GET', '/integrations/suppressions')).status).toBe(200)
    expect((await call('links', 'POST', '/integrations/events', validEvent)).status).toBe(403)
    expect((await call('events', 'GET', '/integrations/context')).status).toBe(403)
  })

  it('escopo desconhecido é ignorado e rota inexistente dá 404', async () => {
    expect(parseScopes('metrics, admin')).toEqual(['metrics'])
    expect((await call('metrics', 'GET', '/integrations/qualquer')).status).toBe(404)
  })
})

describe('cliques do site', () => {
  const post = (origin: string | null, body: unknown = { name: 'Orcamento-WhatsApp' }, ip = '1.1.1.1') => new Request('https://w.dev/t/event', {
    method: 'POST', body: JSON.stringify(body), headers: { ...(origin ? { Origin: origin } : {}), 'CF-Connecting-IP': ip },
  })

  it('soma o total e o botão, com CORS só para os domínios da Hero Drone', async () => {
    const { env, points } = fakeEnv()
    const response = await handleSiteEvent(post('https://loja.herodrone.com.br'), env)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://loja.herodrone.com.br')
    expect(points.get('button_clicks')).toBe(1)
    expect(points.get('button_clicks.orcamento-whatsapp')).toBe(1)
  })

  it('recusa outro domínio, sem Origin e nome inválido', async () => {
    const { env, points } = fakeEnv()
    const denied = await handleSiteEvent(post('https://malicioso.com'), env)
    expect(denied.status).toBe(403)
    expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect((await handleSiteEvent(post(null), env)).status).toBe(403)
    expect((await handleSiteEvent(post('https://herodrone.com.br', { name: '<script>' }), env)).status).toBe(400)
    expect(points.size).toBe(0)
  })

  it('limita por IP', async () => {
    const { env } = fakeEnv()
    const statuses = []
    for (let index = 0; index < 62; index += 1) statuses.push((await handleSiteEvent(post('https://herodrone.com.br'), env)).status)
    expect(statuses.at(0)).toBe(204)
    expect(statuses.at(-1)).toBe(429)
    expect((await handleSiteEvent(post('https://herodrone.com.br', undefined, '9.9.9.9'), env)).status).toBe(204)
  })
})
