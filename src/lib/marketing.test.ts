import { describe, expect, it } from 'vitest'
import { activeMetricKeys, buildButtonRanking, buildComparisonSeries, buildEmailBreakdown, sameRangeLastMonth, saoPauloDateKey, summarizeEmailRows, buildMetricSeries, buildMonthGrid, buildPillarBalance, channelById, compareMetric, connectionHealth, createDefaultContentPillars, isContentOverdue, matchPostToContent, nextContentStatus, previousRange, summarizeMetric, type MetricPoint, type MetricPost } from './marketing'
import type { ContentItem } from '../types'

const point = (metric: string, date: string, value: number, account = ''): MetricPoint => ({ source: 'instagram', account, metric, date, value })
const instagram = channelById('instagram')

const content = (overrides: Partial<ContentItem>): ContentItem => ({
  id: 'c1', title: 'Post', platform: 'Instagram', format: 'Reels', status: 'Ideia', hook: '', caption: '', script: '', callToAction: '',
  hashtags: '', mediaUrl: '', permalink: '', campaign: '', notes: '', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', ...overrides,
})

describe('agregação de métricas', () => {
  it('estoque usa o último dia; fluxo soma os dias', () => {
    const points = [point('followers', '2026-10-01', 100), point('followers', '2026-10-10', 130), point('reach', '2026-10-01', 50), point('reach', '2026-10-10', 70)]
    expect(summarizeMetric(points, instagram, 'followers', '2026-10-01', '2026-10-31')).toBe(130)
    expect(summarizeMetric(points, instagram, 'reach', '2026-10-01', '2026-10-31')).toBe(120)
  })

  it('soma o último valor de cada conta do mesmo canal', () => {
    const points = [point('followers', '2026-10-05', 100, '@a'), point('followers', '2026-10-09', 40, '@b'), point('followers', '2026-10-02', 90, '@a')]
    expect(summarizeMetric(points, instagram, 'followers', '2026-10-01', '2026-10-31')).toBe(140)
  })

  it('sem dado devolve undefined, nunca zero inventado', () => {
    expect(summarizeMetric([], instagram, 'reach', '2026-10-01', '2026-10-31')).toBeUndefined()
    expect(compareMetric([point('reach', '2026-10-05', 10)], instagram, 'reach', '2026-10-01', '2026-10-31').delta).toBeUndefined()
  })

  it('compara com o período imediatamente anterior de mesmo tamanho', () => {
    expect(previousRange('2026-10-08', '2026-10-14')).toEqual({ from: '2026-10-01', to: '2026-10-07' })
    const points = [point('reach', '2026-10-02', 100), point('reach', '2026-10-09', 150)]
    expect(compareMetric(points, instagram, 'reach', '2026-10-08', '2026-10-14').delta).toBe(50)
  })

  it('série mantém os dias vazios como null', () => {
    expect(buildMetricSeries([point('reach', '2026-10-02', 9)], 'instagram', 'reach', '2026-10-01', '2026-10-03')).toEqual([
      { date: '2026-10-01', value: null }, { date: '2026-10-02', value: 9 }, { date: '2026-10-03', value: null },
    ])
  })
})

describe('saúde da conexão', () => {
  const now = new Date('2026-10-30T12:00:00Z')
  it('distingue aguardando, atualizado, atrasado e falha', () => {
    expect(connectionHealth(undefined, now).tone).toBe('idle')
    expect(connectionHealth({ source: 'x', account: '', status: 'ok', lastSyncAt: '2026-10-30T02:00:00Z' }, now).tone).toBe('ok')
    expect(connectionHealth({ source: 'x', account: '', status: 'ok', lastSyncAt: '2026-10-20T02:00:00Z' }, now).tone).toBe('warning')
    expect(connectionHealth({ source: 'x', account: '', status: 'error', lastError: 'x' }, now).tone).toBe('danger')
  })
})

describe('planejamento de conteúdo', () => {
  it('monta 6 semanas começando na segunda', () => {
    const grid = buildMonthGrid(new Date(2026, 9, 15))
    expect(grid).toHaveLength(42)
    expect(grid[0].getDay()).toBe(1)
    expect(grid.some((day) => day.getMonth() === 9 && day.getDate() === 31)).toBe(true)
  })

  it('avança o fluxo e para em Publicado', () => {
    expect(nextContentStatus('Ideia')).toBe('Roteiro')
    expect(nextContentStatus('Publicado')).toBeUndefined()
  })

  it('só atrasa o que não foi publicado', () => {
    const now = new Date('2026-10-30T12:00:00Z')
    expect(isContentOverdue(content({ scheduledAt: '2026-10-29T12:00:00Z', status: 'Revisão' }), now)).toBe(true)
    expect(isContentOverdue(content({ scheduledAt: '2026-10-29T12:00:00Z', status: 'Publicado' }), now)).toBe(false)
    expect(isContentOverdue(content({ status: 'Ideia' }), now)).toBe(false)
  })

  it('calcula o equilíbrio dos pilares só com o que tem data', () => {
    const pillars = createDefaultContentPillars('2026-10-01T00:00:00Z')
    const balance = buildPillarBalance([
      content({ id: 'a', pillarId: pillars[0].id, scheduledAt: '2026-10-10T12:00:00Z' }),
      content({ id: 'b', pillarId: pillars[1].id, scheduledAt: '2026-10-11T12:00:00Z' }),
      content({ id: 'c', pillarId: pillars[0].id }),
    ], pillars)
    expect(balance[0]).toMatchObject({ count: 1, share: 50, gap: 10 })
  })

  it('casa post com conteúdo por id ou link, ignorando barra final', () => {
    const post: MetricPost = { source: 'instagram', account: '', externalId: '1', title: '', url: 'https://instagram.com/p/x/', format: '', thumbnailUrl: '', metrics: {} }
    expect(matchPostToContent(post, [content({ id: 'z', permalink: 'https://instagram.com/p/x' })])?.id).toBe('z')
    expect(matchPostToContent({ ...post, url: '', contentId: 'z' }, [content({ id: 'z' })])?.id).toBe('z')
  })
})

describe('comparação de períodos', () => {
  it('compara com datas livres e devolve diferença absoluta e porcentagem', () => {
    const points = [point('reach', '2026-09-05', 200), point('reach', '2026-10-05', 300)]
    expect(compareMetric(points, instagram, 'reach', '2026-10-01', '2026-10-31', { from: '2026-09-01', to: '2026-09-30' })).toEqual({ value: 300, previous: 200, difference: 100, delta: 50 })
  })

  it('base zero mostra diferença, sem porcentagem inventada', () => {
    const comparison = compareMetric([point('reach', '2026-10-05', 30), point('reach', '2026-09-05', 0)], instagram, 'reach', '2026-10-01', '2026-10-31', { from: '2026-09-01', to: '2026-09-30' })
    expect(comparison.difference).toBe(30)
    expect(comparison.delta).toBeUndefined()
  })

  it('mesmo período do mês passado ajusta o fim de mês', () => {
    expect(sameRangeLastMonth('2026-10-01', '2026-10-30')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(sameRangeLastMonth('2026-03-31', '2026-03-31')).toEqual({ from: '2026-02-28', to: '2026-02-28' })
    expect(sameRangeLastMonth('2026-01-15', '2026-01-20')).toEqual({ from: '2025-12-15', to: '2025-12-20' })
  })

  it('sobrepõe períodos por posição, mesmo com tamanhos diferentes', () => {
    const series = buildComparisonSeries([point('reach', '2026-10-01', 5), point('reach', '2026-09-01', 7)], 'instagram', 'reach', { from: '2026-10-01', to: '2026-10-02' }, { from: '2026-09-01', to: '2026-09-03' })
    expect(series).toHaveLength(3)
    expect(series[0]).toMatchObject({ atual: 5, comparado: 7 })
    expect(series[2].atual).toBeNull()
  })

  it('usa o dia de Brasília perto da meia-noite', () => {
    expect(saoPauloDateKey(new Date('2026-10-31T02:30:00Z'))).toBe('2026-10-30')
  })
})

describe('e-mails e botões', () => {
  const row = (type: string, total: number, people: number, campaign = 'A') => ({ type, campaign, segment: '', emailStep: '1', total, people })

  it('calcula taxas por pessoa e não inventa taxa sem envio', () => {
    expect(summarizeEmailRows([row('email_sent', 100, 100), row('link_click', 30, 10), row('email_reply', 5, 5)])).toMatchObject({ sent: 100, clicks: 30, clickedContacts: 10, clickRate: 10, replyRate: 5 })
    expect(summarizeEmailRows([row('link_click', 3, 1)]).clickRate).toBeUndefined()
  })

  it('agrupa por campanha e nomeia o que veio sem campanha', () => {
    const breakdown = buildEmailBreakdown([row('email_sent', 10, 10), row('email_sent', 40, 40, 'B'), row('email_sent', 1, 1, '')], 'campaign')
    expect(breakdown.map((item) => item.label)).toEqual(['B', 'A', 'Sem identificação'])
  })

  it('ranking de botões soma contas e some das métricas do canal', () => {
    const site = (metric: string, account: string, value: number): MetricPoint => ({ source: 'site', account, metric, date: '2026-10-05', value })
    const points = [site('button_clicks.whatsapp', 'herodrone.com.br', 3), site('button_clicks.whatsapp', 'loja.herodrone.com.br', 2), site('button_clicks.portfolio', 'herodrone.com.br', 9), site('button_clicks', 'herodrone.com.br', 14)]
    expect(buildButtonRanking(points, '2026-10-01', '2026-10-31')).toEqual([{ name: 'portfolio', total: 9 }, { name: 'whatsapp', total: 5 }])
    expect(activeMetricKeys(points, channelById('site'))).toEqual(['button_clicks'])
  })
})
