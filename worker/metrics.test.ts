import { describe, expect, it } from 'vitest'
import { generateToken, hashToken, IngestError, parseIngestPayload } from './metrics'

describe('parseIngestPayload', () => {
  it('normaliza um envio completo', () => {
    const payload = parseIngestPayload({
      source: 'Instagram',
      account: '@herodrone',
      metrics: [{ metric: 'Followers', date: '2026-10-30', value: '1234' }],
      posts: [{ externalId: 'abc', url: 'https://instagram.com/p/abc', metrics: { reach: 900, 'inválida!': 1, likes: 'x' } }],
      run: { agent: 'rotina-claude' },
    })
    expect(payload.source).toBe('instagram')
    expect(payload.points).toEqual([{ metric: 'followers', date: '2026-10-30', value: 1234 }])
    expect(payload.posts[0].metrics).toEqual({ reach: 900 })
    expect(payload.status).toBe('ok')
  })

  it('recusa data impossível, valor não numérico e URL que não é http', () => {
    expect(() => parseIngestPayload({ source: 'x1', metrics: [{ metric: 'a1', date: '2026-02-31', value: 1 }] })).toThrow(IngestError)
    expect(() => parseIngestPayload({ source: 'x1', metrics: [{ metric: 'a1', date: '2026-02-01', value: 'abc' }] })).toThrow(IngestError)
    expect(() => parseIngestPayload({ source: 'x1', posts: [{ externalId: '1', url: 'javascript:alert(1)' }] })).toThrow(IngestError)
  })

  it('exige dados, exceto quando a rotina reporta falha', () => {
    expect(() => parseIngestPayload({ source: 'youtube' })).toThrow(IngestError)
    const failed = parseIngestPayload({ source: 'youtube', run: { status: 'error', message: 'Token expirado' } })
    expect(failed.status).toBe('error')
    expect(failed.message).toBe('Token expirado')
    const pending = parseIngestPayload({ source: 'instagram', account: '@hero', run: { status: 'pending', message: 'Metricool ainda sem histórico' } })
    expect(pending.status).toBe('pending')
    expect(pending.message).toBe('Metricool ainda sem histórico')
  })
})

describe('tokens', () => {
  it('gera tokens únicos e guarda só o hash', async () => {
    const token = generateToken()
    expect(token).toMatch(/^ffk_[0-9a-f]{64}$/)
    expect(generateToken()).not.toBe(token)
    expect(await hashToken(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashToken(token)).not.toContain(token)
  })
})
