import type { ContentItem, ContentPillar, ContentPlatform, ContentStatus } from '../types'

export const contentFormatsByPlatform: Record<ContentPlatform, string[]> = {
  Instagram: ['Reels', 'Carrossel', 'Post', 'Stories', 'Live'],
  YouTube: ['Vídeo longo', 'Shorts', 'Live'],
  TikTok: ['Vídeo', 'Live'],
  LinkedIn: ['Post', 'Artigo', 'Carrossel', 'Vídeo'],
  Facebook: ['Post', 'Reels', 'Stories'],
  Blog: ['Artigo'],
  'E-mail': ['Newsletter', 'Campanha', 'Automação'],
  WhatsApp: ['Lista de transmissão', 'Status'],
  Outro: ['Outro'],
}

/** Cada plataforma pede algo diferente do roteiro; a ajuda aparece no formulário. */
export const platformBrief: Record<ContentPlatform, string> = {
  Instagram: 'Os 3 primeiros segundos decidem o alcance. Legenda curta e CTA para salvar ou compartilhar.',
  YouTube: 'Título e miniatura vêm antes do roteiro. Abra prometendo o que o vídeo entrega.',
  TikTok: 'Comece pelo gancho, sem introdução. Vertical, direto e com legenda na tela.',
  LinkedIn: 'A primeira linha precisa funcionar sozinha. Foque em aprendizado e bastidores do negócio.',
  Facebook: 'Reaproveite o melhor do Instagram e adapte a legenda para o público local.',
  Blog: 'Pense na busca: uma pergunta real do cliente respondida do início ao fim.',
  'E-mail': 'Um assunto, uma ideia, um CTA. Teste o assunto antes de enviar.',
  WhatsApp: 'Mensagem curta e pessoal. Use com moderação para não virar spam.',
  Outro: 'Descreva o objetivo e onde este conteúdo será publicado.',
}

export const contentStatusFlow: ContentStatus[] = ['Ideia', 'Roteiro', 'Produção', 'Revisão', 'Agendado', 'Publicado']

export const nextContentStatus = (status: ContentStatus): ContentStatus | undefined => {
  const index = contentStatusFlow.indexOf(status)
  return index >= 0 && index < contentStatusFlow.length - 1 ? contentStatusFlow[index + 1] : undefined
}

export const pillarColors = ['#2f6f5e', '#3b6ea5', '#8a5a9c', '#b56b2d', '#b4465a', '#5c6b73']

export const createDefaultContentPillars = (createdAt: string): ContentPillar[] => ([
  ['pillar-educar', 'Educar', '#2f6f5e', 'Ensina algo útil e mostra domínio do assunto.', 40],
  ['pillar-bastidores', 'Bastidores', '#3b6ea5', 'Mostra como o trabalho acontece e aproxima a marca.', 25],
  ['pillar-prova', 'Prova social', '#8a5a9c', 'Resultados, antes e depois e depoimentos de clientes.', 20],
  ['pillar-oferta', 'Oferta', '#b56b2d', 'Convida para comprar: serviços, pacotes e chamadas diretas.', 15],
] as const).map(([id, name, color, description, targetShare]) => ({ id, name, color, description, targetShare, createdAt, updatedAt: createdAt }))

export const pad2 = (value: number) => String(value).padStart(2, '0')

const saoPauloFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })

/** Dia civil em Brasília, independente do fuso de quem abre o painel. */
export const saoPauloDateKey = (date = new Date()) => saoPauloFormatter.format(date)

export const localDateKey = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const startOfWeek = (date: Date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7))
  return next
}

/** Grade de 6 semanas do mês, começando na segunda-feira. */
export const buildMonthGrid = (month: Date) => {
  const first = startOfWeek(new Date(month.getFullYear(), month.getMonth(), 1))
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first)
    day.setDate(first.getDate() + index)
    return day
  })
}

export const isContentOverdue = (item: ContentItem, now = new Date()) =>
  Boolean(item.scheduledAt && item.status !== 'Publicado' && !item.archivedAt && new Date(item.scheduledAt) < now)

/** Distribuição real do que está no calendário comparada à meta de cada pilar. */
export const buildPillarBalance = (items: ContentItem[], pillars: ContentPillar[]) => {
  const planned = items.filter((item) => !item.archivedAt && item.scheduledAt)
  const total = planned.length
  return pillars.map((pillar) => {
    const count = planned.filter((item) => item.pillarId === pillar.id).length
    const share = total ? (count / total) * 100 : 0
    return { pillar, count, share, gap: share - pillar.targetShare }
  })
}

// ---------------------------------------------------------------- métricas

export type MetricFormat = 'number' | 'percent' | 'currency'

export interface MetricDefinition {
  key: string
  label: string
  format?: MetricFormat
  /** `total` é um estoque (seguidores): vale o último dia. `sum` soma os dias do período. */
  kind?: 'total' | 'sum' | 'average'
}

export interface ChannelDefinition {
  id: string
  label: string
  description: string
  color: string
  metrics: MetricDefinition[]
}

export const metricChannels: ChannelDefinition[] = [
  { id: 'instagram', label: 'Instagram', description: 'Seguidores, alcance e engajamento do perfil.', color: '#b4465a', metrics: [
    { key: 'followers', label: 'Seguidores', kind: 'total' },
    { key: 'reach', label: 'Alcance' },
    { key: 'impressions', label: 'Impressões' },
    { key: 'profile_visits', label: 'Visitas ao perfil' },
    { key: 'engagement', label: 'Interações' },
    { key: 'likes', label: 'Curtidas' },
    { key: 'comments', label: 'Comentários' },
    { key: 'shares', label: 'Compartilhamentos' },
    { key: 'saves', label: 'Salvos' },
    { key: 'video_views', label: 'Visualizações de vídeo' },
    { key: 'website_clicks', label: 'Cliques no link da bio' },
    { key: 'posts', label: 'Publicações' },
  ] },
  { id: 'youtube', label: 'YouTube', description: 'Inscritos, visualizações e tempo assistido.', color: '#c0392b', metrics: [
    { key: 'subscribers', label: 'Inscritos', kind: 'total' },
    { key: 'views', label: 'Visualizações' },
    { key: 'watch_minutes', label: 'Minutos assistidos' },
    { key: 'likes', label: 'Curtidas' },
    { key: 'comments', label: 'Comentários' },
    { key: 'shares', label: 'Compartilhamentos' },
    { key: 'subscribers_gained', label: 'Inscritos ganhos' },
    { key: 'subscribers_lost', label: 'Inscritos perdidos' },
  ] },
  { id: 'tiktok', label: 'TikTok', description: 'Seguidores e visualizações.', color: '#22262b', metrics: [
    { key: 'followers', label: 'Seguidores', kind: 'total' },
    { key: 'views', label: 'Visualizações' },
    { key: 'engagement', label: 'Interações' },
  ] },
  { id: 'facebook', label: 'Facebook', description: 'Seguidores e alcance da página.', color: '#3b6ea5', metrics: [
    { key: 'followers', label: 'Seguidores', kind: 'total' },
    { key: 'reach', label: 'Alcance' },
    { key: 'impressions', label: 'Impressões' },
    { key: 'engagement', label: 'Interações' },
    { key: 'page_views', label: 'Visitas à página' },
    { key: 'likes', label: 'Reações' },
    { key: 'comments', label: 'Comentários' },
    { key: 'shares', label: 'Compartilhamentos' },
    { key: 'video_views', label: 'Visualizações de vídeo' },
  ] },
  { id: 'linkedin', label: 'LinkedIn', description: 'Seguidores e impressões da página.', color: '#2d6f9e', metrics: [
    { key: 'followers', label: 'Seguidores', kind: 'total' },
    { key: 'impressions', label: 'Impressões' },
    { key: 'engagement', label: 'Interações' },
  ] },
  { id: 'email', label: 'E-mail', description: 'Envios, aberturas e cliques das campanhas.', color: '#2f6f5e', metrics: [
    { key: 'subscribers', label: 'Assinantes', kind: 'total' },
    { key: 'sent', label: 'Enviados' },
    { key: 'clicks', label: 'Cliques' },
    { key: 'clicked_contacts', label: 'Pessoas que clicaram' },
    { key: 'replies', label: 'Respostas' },
    { key: 'bounces', label: 'Bounces' },
    { key: 'unsubscribes', label: 'Descadastros' },
    { key: 'opens', label: 'Aberturas' },
    { key: 'open_rate', label: 'Taxa de abertura', format: 'percent', kind: 'average' },
    { key: 'click_rate', label: 'Taxa de clique', format: 'percent', kind: 'average' },
  ] },
  { id: 'google_business', label: 'Google Meu Negócio', description: 'Visualizações do perfil e ações de quem encontrou a empresa.', color: '#2d6f9e', metrics: [
    { key: 'profile_views', label: 'Visualizações do perfil' },
    { key: 'search_views', label: 'Vistas na Busca' },
    { key: 'maps_views', label: 'Vistas no Maps' },
    { key: 'website_clicks', label: 'Cliques no site' },
    { key: 'calls', label: 'Ligações' },
    { key: 'direction_requests', label: 'Pedidos de rota' },
  ] },
  { id: 'site', label: 'Site', description: 'Visitantes, páginas e botões de herodrone.com.br e da loja.', color: '#5c6b73', metrics: [
    { key: 'users', label: 'Visitantes' },
    { key: 'sessions', label: 'Sessões' },
    { key: 'pageviews', label: 'Páginas vistas' },
    { key: 'button_clicks', label: 'Cliques em botões' },
    { key: 'conversions', label: 'Conversões' },
  ] },
  { id: 'ads', label: 'Anúncios', description: 'Investimento e resultado das campanhas pagas.', color: '#b56b2d', metrics: [
    { key: 'spend', label: 'Investimento', format: 'currency' },
    { key: 'clicks', label: 'Cliques' },
    { key: 'leads', label: 'Leads' },
  ] },
]

export const channelById = (id: string): ChannelDefinition =>
  metricChannels.find((channel) => channel.id === id) ?? {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' '),
    description: 'Canal enviado pela integração.',
    color: '#5c6b73',
    metrics: [],
  }

export const metricLabel = (channel: ChannelDefinition, key: string) =>
  channel.metrics.find((metric) => metric.key === key)?.label ?? key.replace(/[_.-]/g, ' ').replace(/^./, (letter) => letter.toUpperCase())

export interface MetricPoint {
  source: string
  account: string
  metric: string
  date: string
  value: number
}

export interface MetricPost {
  source: string
  account: string
  externalId: string
  contentId?: string | null
  title: string
  url: string
  format: string
  thumbnailUrl: string
  publishedAt?: string | null
  metrics: Record<string, number>
}

export interface MetricConnection {
  source: string
  account: string
  status: 'ok' | 'error' | 'pending'
  lastSyncAt?: string | null
  lastError?: string | null
}

export interface MetricRun {
  id: string
  source: string
  account: string
  status: 'ok' | 'error' | 'pending'
  pointsCount: number
  postsCount: number
  message: string
  agent: string
  createdAt: string
}

export interface MetricsSnapshot {
  points: MetricPoint[]
  posts: MetricPost[]
  connections: MetricConnection[]
  runs: MetricRun[]
}

export const emptyMetricsSnapshot: MetricsSnapshot = { points: [], posts: [], connections: [], runs: [] }

const metricKind = (channel: ChannelDefinition, key: string) =>
  channel.metrics.find((metric) => metric.key === key)?.kind ?? 'sum'

export const metricFormat = (channel: ChannelDefinition, key: string): MetricFormat =>
  channel.metrics.find((metric) => metric.key === key)?.format ?? 'number'

const inRange = (date: string, from: string, to: string) => date >= from && date <= to

/** Junta o valor do período conforme a natureza da métrica; contas somam entre si. */
export const summarizeMetric = (points: MetricPoint[], channel: ChannelDefinition, key: string, from: string, to: string) => {
  const rows = points.filter((point) => point.source === channel.id && point.metric === key && inRange(point.date, from, to))
  if (!rows.length) return undefined
  const kind = metricKind(channel, key)
  if (kind === 'total') {
    const latestByAccount = new Map<string, MetricPoint>()
    rows.forEach((point) => {
      const current = latestByAccount.get(point.account)
      if (!current || point.date > current.date) latestByAccount.set(point.account, point)
    })
    return [...latestByAccount.values()].reduce((total, point) => total + point.value, 0)
  }
  const sum = rows.reduce((total, point) => total + point.value, 0)
  return kind === 'average' ? sum / rows.length : sum
}

export interface PeriodComparison {
  value?: number
  previous?: number
  /** Diferença absoluta entre os períodos. */
  difference?: number
  /** Variação percentual; `undefined` quando não há base para comparar. */
  delta?: number
}

const shiftDate = (date: string, days: number) => {
  const parsed = new Date(`${date}T12:00:00`)
  parsed.setDate(parsed.getDate() + days)
  return localDateKey(parsed)
}

export const previousRange = (from: string, to: string) => {
  const span = Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1
  return { from: shiftDate(from, -span), to: shiftDate(from, -1) }
}

/** Mesmas datas no mês anterior; dia 31 cai no último dia quando o mês é mais curto. */
export const sameRangeLastMonth = (from: string, to: string) => {
  const shift = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    const lastDay = new Date(year, month - 1, 0).getDate()
    return localDateKey(new Date(year, month - 2, Math.min(day, lastDay), 12))
  }
  return { from: shift(from), to: shift(to) }
}

export interface DateRange { from: string; to: string }

export const compareMetric = (points: MetricPoint[], channel: ChannelDefinition, key: string, from: string, to: string, comparison: DateRange = previousRange(from, to)): PeriodComparison => {
  const value = summarizeMetric(points, channel, key, from, to)
  const previous = summarizeMetric(points, channel, key, comparison.from, comparison.to)
  const difference = value !== undefined && previous !== undefined ? value - previous : undefined
  const delta = difference !== undefined && previous ? (difference / Math.abs(previous)) * 100 : undefined
  return { value, previous, difference, delta }
}

/** Alinha os dois períodos por posição (1º dia com 1º dia) para sobrepor as linhas. */
export const buildComparisonSeries = (points: MetricPoint[], source: string, key: string, range: DateRange, comparison: DateRange) => {
  const current = buildMetricSeries(points, source, key, range.from, range.to)
  const compared = buildMetricSeries(points, source, key, comparison.from, comparison.to)
  return Array.from({ length: Math.max(current.length, compared.length) }, (_, index) => ({
    date: current[index]?.date,
    compareDate: compared[index]?.date,
    atual: current[index]?.value ?? null,
    comparado: compared[index]?.value ?? null,
  }))
}

/** Ranking dos botões do site, a partir das linhas `button_clicks.<nome>`. */
export const buildButtonRanking = (points: MetricPoint[], from: string, to: string) => {
  const totals = new Map<string, number>()
  points
    .filter((point) => point.source === 'site' && point.metric.startsWith('button_clicks.') && inRange(point.date, from, to))
    .forEach((point) => {
      const name = point.metric.slice('button_clicks.'.length)
      totals.set(name, (totals.get(name) ?? 0) + point.value)
    })
  return [...totals].map(([name, total]) => ({ name, total })).sort((left, right) => right.total - left.total)
}

export interface EmailReportRow {
  type: string
  campaign: string
  segment: string
  emailStep: string
  total: number
  people: number
}

export interface EmailReportPerson {
  type: 'link_click' | 'email_reply'
  leadId?: string | null
  leadEmail: string
  campaign: string
  occurredAt: string
}

export interface EmailReport {
  rows: EmailReportRow[]
  people: EmailReportPerson[]
}

const sumType = (rows: EmailReportRow[], type: string, field: 'total' | 'people' = 'total') =>
  rows.filter((row) => row.type === type).reduce((sum, row) => sum + row[field], 0)

const rate = (part: number, total: number) => (total ? (part / total) * 100 : undefined)

/** Totais e taxas de um conjunto de linhas; taxa sem envio fica vazia, nunca zero. */
export const summarizeEmailRows = (rows: EmailReportRow[]) => {
  const sent = sumType(rows, 'email_sent')
  const clicks = sumType(rows, 'link_click')
  const clickedContacts = sumType(rows, 'link_click', 'people')
  const replies = sumType(rows, 'email_reply')
  const bounces = sumType(rows, 'email_bounce')
  const unsubscribes = sumType(rows, 'email_unsubscribe')
  return { sent, clicks, clickedContacts, replies, bounces, unsubscribes, clickRate: rate(clickedContacts, sent), replyRate: rate(replies, sent), bounceRate: rate(bounces, sent), unsubscribeRate: rate(unsubscribes, sent) }
}

export const buildEmailBreakdown = (rows: EmailReportRow[], dimension: 'campaign' | 'segment' | 'emailStep') => {
  const groups = new Map<string, EmailReportRow[]>()
  rows.forEach((row) => {
    const key = row[dimension] || 'Sem identificação'
    groups.set(key, [...(groups.get(key) ?? []), row])
  })
  return [...groups].map(([label, items]) => ({ label, ...summarizeEmailRows(items) })).sort((left, right) => right.sent - left.sent || right.clicks - left.clicks)
}

/** Série diária para gráfico; preenche os dias sem dado para a linha não mentir o espaçamento. */
export const buildMetricSeries = (points: MetricPoint[], source: string, key: string, from: string, to: string) => {
  const byDate = new Map<string, number>()
  points
    .filter((point) => point.source === source && point.metric === key && inRange(point.date, from, to))
    .forEach((point) => byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.value))
  const series: Array<{ date: string; value: number | null }> = []
  for (let date = from; date <= to; date = shiftDate(date, 1)) series.push({ date, value: byDate.get(date) ?? null })
  return series
}

export const activeMetricKeys = (points: MetricPoint[], channel: ChannelDefinition) => {
  const received = new Set(points.filter((point) => point.source === channel.id && !point.metric.startsWith('button_clicks.')).map((point) => point.metric))
  const known = channel.metrics.map((metric) => metric.key).filter((key) => received.has(key))
  return [...known, ...[...received].filter((key) => !known.includes(key)).sort()]
}

/** A rotina é diária: mais de 36 horas sem coleta significa que uma execução falhou. */
export const connectionHealth = (connection: MetricConnection | undefined, now = new Date()) => {
  if (!connection) return { tone: 'idle' as const, label: 'Aguardando conexão' }
  if (connection.status === 'error') return { tone: 'danger' as const, label: 'Falha na última coleta' }
  if (connection.status === 'pending' && !connection.lastSyncAt) return { tone: 'ok' as const, label: 'Conectado' }
  if (!connection.lastSyncAt) return { tone: 'idle' as const, label: 'Sem coleta ainda' }
  const hours = (now.getTime() - new Date(connection.lastSyncAt).getTime()) / 3_600_000
  return hours > 36 ? { tone: 'warning' as const, label: 'Coleta atrasada' } : { tone: 'ok' as const, label: 'Atualizado' }
}

const engagementKeys = ['engagement', 'likes', 'comments', 'shares', 'saves']

export const postScore = (post: MetricPost) => {
  const engagement = engagementKeys.reduce((total, key) => total + (post.metrics[key] ?? 0), 0)
  return (post.metrics.reach ?? post.metrics.views ?? post.metrics.impressions ?? 0) + engagement * 10
}

export const matchPostToContent = (post: MetricPost, items: ContentItem[]) =>
  items.find((item) => item.id === post.contentId) ??
  (post.url ? items.find((item) => item.permalink && item.permalink.replace(/\/+$/, '') === post.url.replace(/\/+$/, '')) : undefined)
