import {
  ArrowDownRight, ArrowUpRight, Bookmark, Clapperboard, ExternalLink, Eye, Heart, Image as ImageIcon, Images, Lightbulb, Loader2, MessageCircle, Minus,
  Share2, Sparkles, TrendingDown, TrendingUp, Trophy, Users, Video,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '../ui'
import { formatDate, formatNumber } from '../../lib/format'
import { channelById, connectionHealth, matchPostToContent, type DateRange, type MetricConnection, type MetricPoint, type MetricPost } from '../../lib/marketing'
import {
  buildAudienceSeries, buildEngagementSeries, buildFormatBreakdown, buildInsights, buildInteractionBreakdown, buildNetworkAudienceSeries, buildReachSeries,
  buildTotalSeries, buildWeekdayPerformance, percentChange, postEngagement, postEngagementRate, postReach, postsInRange, socialChannelIds, summarizeSocial,
  topPosts, type NetworkSummary, type SocialTotals,
} from '../../lib/socialReport'
import type { ContentItem } from '../../types'

/** Cor de cada rede (definidas em report.css, com versão para o tema escuro). */
const networkColor: Record<string, string> = {
  instagram: 'var(--net-instagram)', facebook: 'var(--net-facebook)', youtube: 'var(--net-youtube)', tiktok: 'var(--net-tiktok)', linkedin: 'var(--net-linkedin)',
}
const colorOf = (source: string) => networkColor[source] ?? 'var(--series-6)'
const networkMark: Record<string, string> = { instagram: 'IG', facebook: 'f', youtube: '▶', tiktok: '♪', linkedin: 'in' }

const interactionColor: Record<string, string> = { likes: 'var(--series-5)', comments: 'var(--series-1)', saves: 'var(--series-3)', shares: 'var(--series-2)' }
const interactionIcon: Record<string, ReactNode> = { likes: <Heart size={13} />, comments: <MessageCircle size={13} />, saves: <Bookmark size={13} />, shares: <Share2 size={13} /> }
const formatColors = ['var(--series-5)', 'var(--series-1)', 'var(--series-3)', 'var(--series-2)', 'var(--series-4)', 'var(--series-6)']

const compact = (value?: number) => {
  if (value === undefined) return '—'
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(Math.abs(value) >= 100_000 ? 0 : 1).replace('.', ',')} mil`
  return formatNumber(Math.round(value))
}
const percentText = (value?: number) => (value === undefined ? '—' : `${value.toFixed(1).replace('.', ',')}%`)
const shortDate = (date?: string | number | null) => {
  if (!date || typeof date !== 'string') return ''
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow-sm)' }
const axisTick = { fill: 'var(--text-muted)', fontSize: 11 }

function Trend({ value, suffix = '%' }: { value?: number; suffix?: string }) {
  if (value === undefined) return <span className="delta is-flat">sem base</span>
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return <span className={`delta ${value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-flat'}`}><Icon size={13} />{Math.abs(value).toFixed(1).replace('.', ',')}{suffix}</span>
}

/** Mini gráfico de área, sem eixos. */
function Spark({ data, color, id, bars = false }: { data: Array<{ date: string; value: number | null }>; color: string; id: string; bars?: boolean }) {
  if (data.filter((point) => point.value !== null).length < 2) return <div className="spark is-empty" />
  if (bars) {
    return (
      <div className="spark is-bars" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 12, bottom: 6, left: 12 }} barCategoryGap="18%">
            <YAxis hide domain={[0, 'dataMax']} />
            <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }
  return (
    <div className="spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area dataKey="value" type="monotone" connectNulls stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function HeroTile({ label, value, hint, trend, icon, tone, spark }: { label: string; value: string; hint?: ReactNode; trend?: ReactNode; icon: ReactNode; tone: string; spark?: ReactNode }) {
  return (
    <div className="report-hero__tile" style={{ ['--tone' as string]: tone } as CSSProperties}>
      <div className="report-hero__top">
        <span className="report-hero__icon">{icon}</span>
        <span className="report-hero__label">{label}</span>
      </div>
      <strong>{value}</strong>
      <span className="report-hero__foot">{trend}{hint ? <small>{hint}</small> : null}</span>
      {spark}
    </div>
  )
}

/** Anel de progresso para a taxa de engajamento (0 a 10%+ preenche o anel). */
function Ring({ value, color, size = 64 }: { value?: number; color: string; size?: number }) {
  const stroke = 7
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  const share = value === undefined ? 0 : Math.min(value / 10, 1)
  return (
    <svg className="gauge" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
      {share > 0 ? <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${share * length} ${length}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="gauge__text">{percentText(value)}</text>
    </svg>
  )
}

export function SocialReport({ points, posts, connections, range, comparison, contentItems, onSelect }: {
  points: MetricPoint[]
  posts: MetricPost[]
  connections: MetricConnection[]
  range: DateRange
  comparison: DateRange
  contentItems: ContentItem[]
  onSelect: (id: string) => void
}) {
  const connected = socialChannelIds.filter((id) => connections.some((item) => item.source === id) || points.some((point) => point.source === id) || posts.some((post) => post.source === id))
  if (!connected.length) return null
  const withData = connected.filter((id) => points.some((point) => point.source === id) || posts.some((post) => post.source === id))
  const pending = connected.filter((id) => !withData.includes(id))

  const current = summarizeSocial(points, withData, range)
  const previous = summarizeSocial(points, withData, comparison)
  const periodPosts = postsInRange(posts, range, withData)
  const insights = buildInsights(current, previous, periodPosts)

  const audienceSeries = buildTotalSeries(buildAudienceSeries(points, withData, range), withData)
  const reachSeries = buildTotalSeries(buildReachSeries(points, withData, range), withData)
  const engagementSeries = buildEngagementSeries(points, withData, range)
  const growthSeries = audienceSeries.map((point, index) => ({ date: point.date, value: index && point.value !== null && audienceSeries[index - 1].value !== null ? point.value - (audienceSeries[index - 1].value as number) : null }))

  return (
    <section className="social-report">
      <header className="report-banner">
        <div className="report-banner__text">
          <span className="report-banner__eyebrow"><Sparkles size={13} /> Relatório de redes sociais</span>
          <h2>{current.growth !== undefined && current.growth > 0 ? `+${formatNumber(current.growth)} seguidores no período` : 'Como suas redes foram no período'}</h2>
          <p>{formatDate(range.from)} a {formatDate(range.to)} · comparado com {formatDate(comparison.from)} a {formatDate(comparison.to)}</p>
        </div>
        <div className="network-chips">
          {connected.map((id) => {
            const health = connectionHealth(connections.find((item) => item.source === id))
            const importing = pending.includes(id)
            return (
              <button key={id} type="button" className="network-chip" onClick={() => onSelect(id)} title={importing ? 'Conectado. Aguardando o histórico.' : health.label}>
                <i className={`net-mark is-${id}`}>{networkMark[id] ?? id[0]}</i>{channelById(id).label}
                {importing ? <Loader2 size={12} className="animate-spin" /> : <span className={`health-dot is-${health.tone}`} />}
              </button>
            )
          })}
        </div>
      </header>

      {pending.length ? (
        <div className="report-pending">
          <Loader2 size={16} className="animate-spin" />
          <div>
            <strong>{pending.map((id) => channelById(id).label).join(', ')} {pending.length > 1 ? 'estão conectados' : 'está conectado'}, importando o histórico.</strong>
            <span>O Metricool leva até 48 horas para trazer os dados das redes recém-conectadas. A coleta da madrugada preenche os últimos 90 dias assim que eles chegarem, e os gráficos aparecem aqui sozinhos.</span>
          </div>
        </div>
      ) : null}

      {withData.length ? <>
        <div className="report-hero">
          <HeroTile tone="var(--series-1)" icon={<Users size={15} />} label="Audiência total" value={compact(current.audience)}
            trend={current.growth !== undefined ? <span className={`delta ${current.growth > 0 ? 'is-up' : current.growth < 0 ? 'is-down' : 'is-flat'}`}>{current.growth > 0 ? '+' : ''}{formatNumber(current.growth)} no período</span> : undefined}
            hint="seguidores e inscritos" spark={<Spark id="spark-audience" data={audienceSeries} color="var(--series-1)" />} />
          <HeroTile tone="var(--series-3)" icon={<TrendingUp size={15} />} label="Novos seguidores" value={current.growth === undefined ? '—' : `${current.growth > 0 ? '+' : ''}${formatNumber(current.growth)}`}
            trend={<Trend value={percentChange(current.growth, previous.growth)} />} hint="vs. antes" spark={<Spark id="spark-growth" data={growthSeries} color="var(--series-3)" bars />} />
          <HeroTile tone="var(--series-4)" icon={<Eye size={15} />} label="Alcance" value={compact(current.reach)}
            trend={<Trend value={percentChange(current.reach, previous.reach)} />} hint="vs. antes" spark={<Spark id="spark-reach" data={reachSeries} color="var(--series-4)" />} />
          <HeroTile tone="var(--series-5)" icon={<Heart size={15} />} label="Interações" value={compact(current.engagement)}
            trend={<Trend value={percentChange(current.engagement, previous.engagement)} />} hint="vs. antes" spark={<Spark id="spark-engagement" data={engagementSeries} color="var(--series-5)" bars />} />
          <div className="report-hero__tile is-ring" style={{ ['--tone' as string]: 'var(--series-2)' } as CSSProperties}>
            <div className="report-hero__top"><span className="report-hero__icon"><Lightbulb size={15} /></span><span className="report-hero__label">Engajamento</span></div>
            <div className="report-hero__ring">
              <Ring value={current.engagementRate} color="var(--series-2)" size={76} />
              <span className="report-hero__foot">{current.engagementRate !== undefined && previous.engagementRate !== undefined ? <Trend value={current.engagementRate - previous.engagementRate} suffix=" p.p." /> : <Trend />}<small>interações ÷ alcance</small></span>
            </div>
          </div>
        </div>

        <div className="network-cards">
          {current.networks.map((item) => (
            <NetworkCard key={item.channel.id} item={item} before={previous.networks.find((network) => network.channel.id === item.channel.id)} points={points} range={range} onSelect={onSelect} />
          ))}
        </div>

        <div className="report-grid">
          <AudienceChart points={points} sources={withData} range={range} />
          <ReachChart points={points} sources={withData} range={range} />
        </div>

        <div className="report-grid is-wide-left">
          {insights.length ? (
            <Panel title="O que os números dizem">
              <ul className="report-insights-list">
                {insights.map((item, index) => (
                  <li key={index} className={`is-${item.tone}`}>
                    <span className="insight-icon">{item.tone === 'positive' ? <TrendingUp size={15} /> : item.tone === 'negative' ? <TrendingDown size={15} /> : <Lightbulb size={15} />}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : <div />}
          <InteractionPanel points={points} sources={withData} range={range} posts={periodPosts} />
        </div>

        {periodPosts.length ? <>
          <PostGallery title="Melhores publicações do período" posts={topPosts(periodPosts, 6)} contentItems={contentItems} />
          <div className="report-grid">
            <FormatPanel posts={periodPosts} />
            <WeekdayPanel posts={periodPosts} />
          </div>
        </> : null}
      </> : null}
    </section>
  )
}

function NetworkCard({ item, before, points, range, onSelect }: { item: NetworkSummary; before?: NetworkSummary; points: MetricPoint[]; range: DateRange; onSelect: (id: string) => void }) {
  const id = item.channel.id
  const color = colorOf(id)
  const series = buildNetworkAudienceSeries(points, id, range)
  const audienceLabel = id === 'youtube' ? 'inscritos' : 'seguidores'
  return (
    <button type="button" className={`network-card is-${id}`} style={{ ['--network' as string]: color } as CSSProperties} onClick={() => onSelect(id)}>
      <header>
        <i className={`net-mark is-${id}`}>{networkMark[id] ?? id[0]}</i>
        <strong>{item.channel.label}</strong>
        {item.growth !== undefined ? <span className={`growth-chip ${item.growth > 0 ? 'is-up' : item.growth < 0 ? 'is-down' : ''}`}>{item.growth > 0 ? '+' : ''}{formatNumber(item.growth)}</span> : null}
      </header>
      <div className="network-card__audience">
        <b>{compact(item.audience)}</b><small>{audienceLabel}</small>
      </div>
      <Spark id={`spark-net-${id}`} data={series} color={color} />
      <div className="network-card__stats">
        <span><small>Alcance</small><b>{compact(item.reach)}</b><Trend value={percentChange(item.reach, before?.reach)} /></span>
        <span><small>Interações</small><b>{compact(item.engagement)}</b><Trend value={percentChange(item.engagement, before?.engagement)} /></span>
        <Ring value={item.engagementRate} color={color} size={58} />
      </div>
    </button>
  )
}

function ChartLegend({ sources }: { sources: string[] }) {
  return <div className="chart-legend">{sources.map((source) => <span key={source}><i style={{ background: colorOf(source) }} />{channelById(source).label}</span>)}</div>
}

function AudienceChart({ points, sources, range }: { points: MetricPoint[]; sources: string[]; range: DateRange }) {
  const data = buildAudienceSeries(points, sources, range)
  const active = sources.filter((source) => data.some((row) => row[source] !== null))
  return (
    <Panel title="Crescimento da audiência" action={<ChartLegend sources={active} />}>
      {active.length ? (
        <div className="report-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                {active.map((source) => (
                  <linearGradient key={source} id={`aud-${source}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorOf(source)} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={colorOf(source)} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 4" />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} axisLine={false} tickLine={false} tick={axisTick} />
              <YAxis width={44} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => compact(Number(value))} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => shortDate(String(label))} formatter={(value, name) => [formatNumber(Number(value)), channelById(String(name)).label]} />
              {active.map((source) => <Area key={source} dataKey={source} type="monotone" connectNulls stroke={colorOf(source)} strokeWidth={2.5} fill={`url(#aud-${source})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="muted-note">Os seguidores aparecem depois da primeira coleta com histórico.</p>}
    </Panel>
  )
}

function ReachChart({ points, sources, range }: { points: MetricPoint[]; sources: string[]; range: DateRange }) {
  const data = buildReachSeries(points, sources, range)
  const active = sources.filter((source) => data.some((row) => row[source] !== null))
  return (
    <Panel title="Alcance por dia" action={<ChartLegend sources={active} />}>
      {active.length ? (
        <div className="report-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 4" />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} axisLine={false} tickLine={false} tick={axisTick} />
              <YAxis width={44} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => compact(Number(value))} />
              <Tooltip cursor={{ fill: 'var(--surface-3)', radius: 4 }} contentStyle={tooltipStyle} labelFormatter={(label) => shortDate(String(label))} formatter={(value, name) => [formatNumber(Number(value)), channelById(String(name)).label]} />
              {active.map((source, index) => <Bar key={source} dataKey={source} stackId="reach" fill={colorOf(source)} radius={index === active.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="muted-note">O alcance diário aparece depois da primeira coleta com histórico.</p>}
    </Panel>
  )
}

function InteractionPanel({ points, sources, range, posts }: { points: MetricPoint[]; sources: string[]; range: DateRange; posts: MetricPost[] }) {
  const slices = buildInteractionBreakdown(points, sources, range, posts)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  return (
    <Panel title="De onde vêm as interações">
      {slices.length ? (
        <div className="interaction-donut">
          <div className="interaction-donut__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={slices} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {slices.map((slice) => <Cell key={slice.key} fill={interactionColor[slice.key]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [formatNumber(Number(value)), String(name)]} />
              </PieChart>
            </ResponsiveContainer>
            <span className="interaction-donut__center"><b>{compact(total)}</b><small>interações</small></span>
          </div>
          <ul>
            {slices.map((slice) => (
              <li key={slice.key} style={{ ['--tone' as string]: interactionColor[slice.key] } as CSSProperties}>
                <span className="interaction-icon">{interactionIcon[slice.key]}</span>
                <span>{slice.label}</span>
                <b>{formatNumber(slice.value)}</b>
                <small>{percentText((slice.value / total) * 100)}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="muted-note">As curtidas, comentários e salvos aparecem quando houver publicações no período.</p>}
    </Panel>
  )
}

const formatIcon = (format: string) => {
  const value = format.toLowerCase()
  if (value.includes('reel') || value.includes('vídeo') || value.includes('video') || value.includes('short')) return <Clapperboard size={26} />
  if (value.includes('carros')) return <Images size={26} />
  if (value.includes('story')) return <Video size={26} />
  return <ImageIcon size={26} />
}

export function PostGallery({ title, posts, contentItems }: { title: string; posts: MetricPost[]; contentItems: ContentItem[] }) {
  if (!posts.length) return null
  const best = Math.max(...posts.map(postEngagement), 1)
  return (
    <Panel title={title}>
      <div className="post-gallery">
        {posts.map((post, index) => {
          const planned = matchPostToContent(post, contentItems)
          const rate = postEngagementRate(post)
          const Wrapper = post.url ? 'a' : 'div'
          return (
            <Wrapper key={`${post.source}-${post.externalId}`} className={`post-card ${index === 0 ? 'is-top' : ''}`} {...(post.url ? { href: post.url, target: '_blank', rel: 'noreferrer' } : {})}>
              <div className="post-card__media" style={{ ['--network' as string]: colorOf(post.source) } as CSSProperties}>
                <span className="post-card__placeholder">{formatIcon(post.format || '')}<small>{post.format || channelById(post.source).label}</small></span>
                {/* Miniaturas do Instagram expiram; se falhar, fica o fundo com o formato. */}
                {post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}
                <em className={index < 3 ? `is-rank-${index + 1}` : ''}>{index === 0 ? <Trophy size={11} /> : null}#{index + 1}</em>
                <i><span className={`net-mark is-${post.source}`}>{networkMark[post.source] ?? post.source[0]}</span>{channelById(post.source).label}</i>
              </div>
              <div className="post-card__body">
                <strong>{post.title || planned?.title || 'Publicação sem legenda'}</strong>
                <small>{post.publishedAt ? formatDate(post.publishedAt.slice(0, 10)) : 'Sem data'}{planned ? ` · Planejado: ${planned.title}` : ''}</small>
                <div className="post-card__meter"><span style={{ width: `${(postEngagement(post) / best) * 100}%` }} /></div>
                <div className="post-card__stats">
                  <span><b>{compact(postReach(post))}</b>alcance</span>
                  <span><b>{compact(postEngagement(post))}</b>interações</span>
                  <span><b>{percentText(rate)}</b>engaj.</span>
                </div>
              </div>
              {post.url ? <ExternalLink size={13} className="post-card__link" /> : null}
            </Wrapper>
          )
        })}
      </div>
    </Panel>
  )
}

export function FormatPanel({ posts }: { posts: MetricPost[] }) {
  const formats = buildFormatBreakdown(posts)
  const max = Math.max(...formats.map((item) => item.avgEngagement), 1)
  return (
    <Panel title="Qual formato rende mais">
      {formats.length ? (
        <div className="format-bars">
          {formats.map((item, index) => (
            <div key={item.format} style={{ ['--tone' as string]: formatColors[index % formatColors.length] } as CSSProperties}>
              <span className="format-bars__name">
                <span className="format-bars__icon">{formatIcon(item.format)}</span>
                <span><strong>{item.format}{index === 0 && formats.length > 1 ? <em>melhor</em> : null}</strong><small>{item.posts} post(s) · {percentText(item.engagementRate)} engaj.</small></span>
              </span>
              <div className="meter"><span style={{ width: `${(item.avgEngagement / max) * 100}%` }} /></div>
              <b>{compact(item.avgEngagement)}<small>/post</small></b>
            </div>
          ))}
        </div>
      ) : <p className="muted-note">Sem publicações no período.</p>}
    </Panel>
  )
}

export function WeekdayPanel({ posts }: { posts: MetricPost[] }) {
  const data = buildWeekdayPerformance(posts)
  const enough = data.filter((item) => item.posts).length >= 2
  const best = data.reduce((top, item) => (item.avgEngagement > top.avgEngagement ? item : top), data[0])
  return (
    <Panel title="Melhor dia para postar" action={enough && best?.posts ? <span className="best-day-chip"><Trophy size={12} /> {best.label}</span> : undefined}>
      {enough ? (
        <div className="report-chart is-short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" strokeDasharray="3 4" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
              <YAxis width={36} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => compact(Number(value))} />
              <Tooltip cursor={{ fill: 'var(--surface-3)', radius: 4 }} contentStyle={tooltipStyle} formatter={(value, _name, item) => [`${formatNumber(Math.round(Number(value)))} interações por post (${(item?.payload as { posts?: number })?.posts ?? 0} post(s))`, 'Média']} />
              <Bar dataKey="avgEngagement" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {data.map((item) => <Cell key={item.label} fill={item.label === best?.label ? 'var(--series-3)' : 'color-mix(in srgb, var(--series-3) 30%, var(--surface-3))'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="muted-note">Precisa de posts em pelo menos dois dias da semana para comparar.</p>}
    </Panel>
  )
}

/** Exportado para outras telas que listam a métrica de uma rede. */
export type { SocialTotals }
