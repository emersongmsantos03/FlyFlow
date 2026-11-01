import {
  buildMetricSeries, channelById, summarizeMetric, type ChannelDefinition, type DateRange, type MetricPoint, type MetricPost,
} from './marketing'

/** Redes sociais do relatório, na ordem em que aparecem. */
export const socialChannelIds = ['instagram', 'facebook', 'youtube', 'tiktok', 'linkedin'] as const

/** Métrica que representa cada ideia em cada rede. */
const audienceKey: Record<string, string> = { instagram: 'followers', facebook: 'followers', youtube: 'subscribers', tiktok: 'followers', linkedin: 'followers' }
const reachKeys: Record<string, string[]> = { instagram: ['reach'], facebook: ['reach'], youtube: ['views'], tiktok: ['views'], linkedin: ['impressions'] }
const engagementParts = ['likes', 'comments', 'shares', 'saves']

export const audienceMetric = (source: string) => audienceKey[source] ?? 'followers'

const has = (points: MetricPoint[], source: string, metric: string) => points.some((point) => point.source === source && point.metric === metric)

const reachMetric = (points: MetricPoint[], source: string) => (reachKeys[source] ?? ['reach', 'views', 'impressions']).find((key) => has(points, source, key))

/** Soma `engagement`; sem ela, soma curtidas, comentários, compartilhamentos e salvos. */
const engagementTotal = (points: MetricPoint[], channel: ChannelDefinition, range: DateRange) => {
  if (has(points, channel.id, 'engagement')) return summarizeMetric(points, channel, 'engagement', range.from, range.to)
  const parts = engagementParts.map((key) => summarizeMetric(points, channel, key, range.from, range.to)).filter((value): value is number => value !== undefined)
  return parts.length ? parts.reduce((total, value) => total + value, 0) : undefined
}

/** Último valor conhecido de um estoque (seguidores) até a data, somando as contas. */
export const stockAt = (points: MetricPoint[], source: string, metric: string, date: string) => {
  const latest = new Map<string, MetricPoint>()
  points.forEach((point) => {
    if (point.source !== source || point.metric !== metric || point.date > date) return
    const current = latest.get(point.account)
    if (!current || point.date > current.date) latest.set(point.account, point)
  })
  return latest.size ? [...latest.values()].reduce((total, point) => total + point.value, 0) : undefined
}

/** Seguidores ganhos no período: fim do período menos o último valor antes dele. */
export const audienceGrowth = (points: MetricPoint[], source: string, range: DateRange) => {
  const metric = audienceMetric(source)
  const end = stockAt(points, source, metric, range.to)
  const dayBefore = new Date(`${range.from}T12:00:00`)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const beforeKey = dayBefore.toISOString().slice(0, 10)
  const start = stockAt(points, source, metric, beforeKey)
    ?? points.filter((point) => point.source === source && point.metric === metric && point.date >= range.from && point.date <= range.to).sort((left, right) => left.date.localeCompare(right.date))[0]?.value
  if (end === undefined || start === undefined) return undefined
  return end - start
}

export interface NetworkSummary {
  channel: ChannelDefinition
  audience?: number
  growth?: number
  reach?: number
  engagement?: number
  /** Interações divididas pelo alcance, em %. */
  engagementRate?: number
}

export const summarizeNetwork = (points: MetricPoint[], source: string, range: DateRange): NetworkSummary => {
  const channel = channelById(source)
  const audience = stockAt(points, source, audienceMetric(source), range.to)
  const reachKey = reachMetric(points, source)
  const reach = reachKey ? summarizeMetric(points, channel, reachKey, range.from, range.to) : undefined
  const engagement = engagementTotal(points, channel, range)
  return {
    channel,
    audience,
    growth: audienceGrowth(points, source, range),
    reach,
    engagement,
    engagementRate: reach && engagement !== undefined ? (engagement / reach) * 100 : undefined,
  }
}

const sumDefined = (values: Array<number | undefined>) => {
  const defined = values.filter((value): value is number => value !== undefined)
  return defined.length ? defined.reduce((total, value) => total + value, 0) : undefined
}

export interface SocialTotals {
  audience?: number
  growth?: number
  reach?: number
  engagement?: number
  engagementRate?: number
  networks: NetworkSummary[]
}

export const summarizeSocial = (points: MetricPoint[], sources: string[], range: DateRange): SocialTotals => {
  const networks = sources.map((source) => summarizeNetwork(points, source, range))
  const reach = sumDefined(networks.map((item) => item.reach))
  const engagement = sumDefined(networks.map((item) => item.engagement))
  return {
    audience: sumDefined(networks.map((item) => item.audience)),
    growth: sumDefined(networks.map((item) => item.growth)),
    reach,
    engagement,
    engagementRate: reach && engagement !== undefined ? (engagement / reach) * 100 : undefined,
    networks,
  }
}

export const percentChange = (current?: number, previous?: number) =>
  current === undefined || previous === undefined || !previous ? undefined : ((current - previous) / Math.abs(previous)) * 100

/** Uma linha por dia com o total de seguidores de cada rede (o último valor conhecido segue adiante). */
export const buildAudienceSeries = (points: MetricPoint[], sources: string[], range: DateRange) => {
  const days = buildMetricSeries([], '', '', range.from, range.to).map((point) => point.date)
  return days.map((date) => {
    const row: Record<string, number | string | null> = { date }
    sources.forEach((source) => {
      const metric = audienceMetric(source)
      const known = points.some((point) => point.source === source && point.metric === metric && point.date <= date)
      row[source] = known ? stockAt(points, source, metric, date) ?? null : null
    })
    return row
  })
}

/** Alcance diário empilhado por rede. */
export const buildReachSeries = (points: MetricPoint[], sources: string[], range: DateRange) => {
  const series = sources.map((source) => {
    const key = reachMetric(points, source)
    return { source, values: key ? buildMetricSeries(points, source, key, range.from, range.to) : [] }
  })
  const days = buildMetricSeries([], '', '', range.from, range.to).map((point) => point.date)
  return days.map((date, index) => {
    const row: Record<string, number | string | null> = { date }
    series.forEach(({ source, values }) => { row[source] = values[index]?.value ?? null })
    return row
  })
}

// ---------------------------------------------------------------- posts

export const postReach = (post: MetricPost) => post.metrics.reach ?? post.metrics.views ?? post.metrics.video_views ?? post.metrics.impressions ?? 0

export const postEngagement = (post: MetricPost) =>
  post.metrics.engagement ?? engagementParts.reduce((total, key) => total + (post.metrics[key] ?? 0), 0)

export const postEngagementRate = (post: MetricPost) => {
  const reach = postReach(post)
  return reach ? (postEngagement(post) / reach) * 100 : undefined
}

const inRange = (post: MetricPost, range: DateRange) => {
  const day = post.publishedAt?.slice(0, 10)
  return !day || (day >= range.from && day <= range.to)
}

export const postsInRange = (posts: MetricPost[], range: DateRange, sources?: string[]) =>
  posts.filter((post) => (!sources || sources.includes(post.source)) && inRange(post, range))

export const topPosts = (posts: MetricPost[], limit = 6) =>
  [...posts].sort((left, right) => postEngagement(right) * 10 + postReach(right) - (postEngagement(left) * 10 + postReach(left))).slice(0, limit)

export interface FormatSummary { format: string; posts: number; avgReach: number; avgEngagement: number; engagementRate?: number }

export const buildFormatBreakdown = (posts: MetricPost[]): FormatSummary[] => {
  const groups = new Map<string, MetricPost[]>()
  posts.forEach((post) => {
    const key = post.format || 'Sem formato'
    groups.set(key, [...(groups.get(key) ?? []), post])
  })
  return [...groups].map(([format, items]) => {
    const reach = items.reduce((total, post) => total + postReach(post), 0)
    const engagement = items.reduce((total, post) => total + postEngagement(post), 0)
    return { format, posts: items.length, avgReach: reach / items.length, avgEngagement: engagement / items.length, engagementRate: reach ? (engagement / reach) * 100 : undefined }
  }).sort((left, right) => right.avgEngagement - left.avgEngagement || right.avgReach - left.avgReach)
}

export const weekdayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Média de interações por post em cada dia da semana (horário de Brasília). */
export const buildWeekdayPerformance = (posts: MetricPost[]) => {
  const buckets = weekdayLabels.map((label) => ({ label, posts: 0, engagement: 0, reach: 0 }))
  posts.forEach((post) => {
    if (!post.publishedAt) return
    const weekday = new Date(new Date(post.publishedAt).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()
    const bucket = buckets[weekday]
    if (!bucket) return
    bucket.posts += 1
    bucket.engagement += postEngagement(post)
    bucket.reach += postReach(post)
  })
  return buckets.map((bucket) => ({ ...bucket, avgEngagement: bucket.posts ? bucket.engagement / bucket.posts : 0, avgReach: bucket.posts ? bucket.reach / bucket.posts : 0 }))
}

// ---------------------------------------------------------------- leitura automática

const integer = (value: number) => Math.round(value).toLocaleString('pt-BR')
const percent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`

/** Frases curtas que respondem "o que mudou e o que fazer". Só fala do que tem dado. */
export const buildInsights = (current: SocialTotals, previous: SocialTotals, posts: MetricPost[]) => {
  const insights: Array<{ tone: 'positive' | 'negative' | 'neutral'; text: string }> = []
  const growing = current.networks.filter((item) => item.growth !== undefined).sort((left, right) => (right.growth ?? 0) - (left.growth ?? 0))
  if (growing[0]?.growth) {
    const best = growing[0]
    insights.push({ tone: best.growth! > 0 ? 'positive' : 'negative', text: best.growth! > 0
      ? `${best.channel.label} foi a rede que mais cresceu: +${integer(best.growth!)} seguidores no período.`
      : `${best.channel.label} perdeu ${integer(Math.abs(best.growth!))} seguidores no período.` })
  }
  const reachDelta = percentChange(current.reach, previous.reach)
  if (reachDelta !== undefined && Math.abs(reachDelta) >= 5) {
    insights.push({ tone: reachDelta > 0 ? 'positive' : 'negative', text: `O alcance somado ${reachDelta > 0 ? 'subiu' : 'caiu'} ${percent(Math.abs(reachDelta))} em relação ao período comparado.` })
  }
  if (current.engagementRate !== undefined) {
    const tone = current.engagementRate >= 3 ? 'positive' : current.engagementRate < 1 ? 'negative' : 'neutral'
    insights.push({ tone, text: `Taxa de engajamento de ${percent(current.engagementRate)}${tone === 'positive' ? ': acima de 3%, um bom sinal para perfis locais.' : tone === 'negative' ? ': abaixo de 1%. Ganchos mais fortes nos 3 primeiros segundos costumam ajudar.' : '.'}` })
  }
  const formats = buildFormatBreakdown(posts).filter((item) => item.posts >= 2)
  if (formats.length >= 2) insights.push({ tone: 'neutral', text: `${formats[0].format} rende em média ${integer(formats[0].avgEngagement)} interações por post, o melhor formato do período.` })
  const weekdays = buildWeekdayPerformance(posts).filter((item) => item.posts)
  if (weekdays.length >= 3) {
    const best = [...weekdays].sort((left, right) => right.avgEngagement - left.avgEngagement)[0]
    insights.push({ tone: 'neutral', text: `Posts publicados ${best.label === 'Sáb' || best.label === 'Dom' ? 'no' : 'na'} ${best.label.toLowerCase()} tiveram mais interações em média.` })
  }
  const champion = topPosts(posts, 1)[0]
  if (champion && postEngagement(champion)) {
    insights.push({ tone: 'positive', text: `Post campeão: “${(champion.title || champion.format || 'publicação').slice(0, 60)}” em ${channelById(champion.source).label}, com ${integer(postEngagement(champion))} interações.` })
  }
  return insights
}
