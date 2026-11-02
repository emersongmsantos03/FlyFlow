import { describe, expect, it } from 'vitest'
import type { MetricPoint, MetricPost } from './marketing'
import {
  audienceGrowth, buildAudienceSeries, buildFormatBreakdown, buildInsights, buildWeekdayPerformance, postEngagement, postEngagementRate,
  summarizeNetwork, summarizeSocial,
} from './socialReport'

const p = (source: string, metric: string, date: string, value: number, account = ''): MetricPoint => ({ source, account, metric, date, value })
const post = (overrides: Partial<MetricPost>): MetricPost => ({
  source: 'instagram', account: '', externalId: Math.random().toString(36), title: '', url: '', format: 'Reels', thumbnailUrl: '', publishedAt: '2026-10-05T15:00:00Z', metrics: {}, ...overrides,
})
const range = { from: '2026-10-01', to: '2026-10-07' }

describe('relatório de redes sociais', () => {
  it('ganho de seguidores usa o último valor antes do período', () => {
    const points = [p('instagram', 'followers', '2026-09-30', 100), p('instagram', 'followers', '2026-10-03', 104), p('instagram', 'followers', '2026-10-07', 110)]
    expect(audienceGrowth(points, 'instagram', range)).toBe(10)
  })

  it('sem histórico anterior, compara com o primeiro dia do período', () => {
    const points = [p('youtube', 'subscribers', '2026-10-02', 50), p('youtube', 'subscribers', '2026-10-06', 53)]
    expect(audienceGrowth(points, 'youtube', range)).toBe(3)
    expect(audienceGrowth([], 'youtube', range)).toBeUndefined()
  })

  it('engajamento soma curtidas e comentários quando não há "engagement"', () => {
    const points = [p('facebook', 'reach', '2026-10-02', 200), p('facebook', 'likes', '2026-10-02', 8), p('facebook', 'comments', '2026-10-03', 2)]
    const summary = summarizeNetwork(points, 'facebook', range)
    expect(summary.engagement).toBe(10)
    expect(summary.engagementRate).toBe(5)
  })

  it('YouTube usa visualizações como alcance e soma redes sem dados vazios', () => {
    const points = [p('youtube', 'views', '2026-10-02', 300), p('instagram', 'reach', '2026-10-02', 100), p('instagram', 'engagement', '2026-10-02', 6)]
    const totals = summarizeSocial(points, ['instagram', 'youtube'], range)
    expect(totals.reach).toBe(400)
    expect(totals.engagement).toBe(6)
    expect(totals.audience).toBeUndefined()
  })

  it('série de audiência repete o último valor conhecido', () => {
    const points = [p('instagram', 'followers', '2026-10-02', 10), p('instagram', 'followers', '2026-10-04', 12)]
    const series = buildAudienceSeries(points, ['instagram'], range)
    expect(series.map((row) => row.instagram)).toEqual([null, 10, 10, 12, 12, 12, 12])
  })

  it('posts: taxa de engajamento, formatos e dia da semana', () => {
    const posts = [
      post({ format: 'Reels', publishedAt: '2026-10-05T15:00:00Z', metrics: { reach: 1000, likes: 40, comments: 10 } }),
      post({ format: 'Reels', publishedAt: '2026-10-05T18:00:00Z', metrics: { reach: 500, likes: 20 } }),
      post({ format: 'Carrossel', publishedAt: '2026-10-07T12:00:00Z', metrics: { reach: 300, engagement: 9 } }),
    ]
    expect(postEngagement(posts[0])).toBe(50)
    expect(postEngagementRate(posts[0])).toBe(5)
    const formats = buildFormatBreakdown(posts)
    expect(formats[0]).toMatchObject({ format: 'Reels', posts: 2, avgEngagement: 35 })
    const weekdays = buildWeekdayPerformance(posts)
    expect(weekdays[1]).toMatchObject({ label: 'Seg', posts: 2 })
    expect(weekdays[3]).toMatchObject({ label: 'Qua', posts: 1 })
  })

  it('insights só falam do que tem dado', () => {
    const empty = summarizeSocial([], ['instagram'], range)
    expect(buildInsights(empty, empty, [])).toEqual([])
    const points = [p('instagram', 'followers', '2026-09-30', 100), p('instagram', 'followers', '2026-10-07', 120), p('instagram', 'reach', '2026-10-02', 1000), p('instagram', 'engagement', '2026-10-02', 50)]
    const current = summarizeSocial(points, ['instagram'], range)
    const texts = buildInsights(current, empty, []).map((item) => item.text)
    expect(texts[0]).toContain('+20 seguidores')
    expect(texts.some((text) => text.includes('5,0%'))).toBe(true)
  })
})
