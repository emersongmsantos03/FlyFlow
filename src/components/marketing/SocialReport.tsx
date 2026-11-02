import { ArrowDownRight, ArrowUpRight, ExternalLink, Heart, Lightbulb, Loader2, Minus, PlayCircle, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Panel } from '../ui'
import { formatDate, formatNumber } from '../../lib/format'
import { channelById, connectionHealth, matchPostToContent, type DateRange, type MetricConnection, type MetricPoint, type MetricPost } from '../../lib/marketing'
import {
  buildAudienceSeries, buildFormatBreakdown, buildInsights, buildReachSeries, buildWeekdayPerformance, percentChange, postEngagement,
  postEngagementRate, postReach, postsInRange, socialChannelIds, summarizeSocial, topPosts, type SocialTotals,
} from '../../lib/socialReport'
import type { ContentItem } from '../../types'

/** Cor de cada rede a partir da paleta do tema, para funcionar no claro e no escuro. */
const networkColor: Record<string, string> = {
  instagram: 'var(--series-5)', facebook: 'var(--series-1)', youtube: 'var(--series-2)', tiktok: 'var(--series-3)', linkedin: 'var(--series-4)',
}

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

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }
const axisTick = { fill: 'var(--text-muted)', fontSize: 11 }

function Trend({ value, suffix = '%' }: { value?: number; suffix?: string }) {
  if (value === undefined) return <span className="delta is-flat">sem base</span>
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return <span className={`delta ${value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-flat'}`}><Icon size={13} />{Math.abs(value).toFixed(1).replace('.', ',')}{suffix}</span>
}

function HeroTile({ label, value, hint, trend, icon }: { label: string; value: string; hint?: ReactNode; trend?: ReactNode; icon: ReactNode }) {
  return (
    <div className="report-hero__tile">
      <span className="report-hero__icon">{icon}</span>
      <span className="report-hero__label">{label}</span>
      <strong>{value}</strong>
      <span className="report-hero__foot">{trend}{hint ? <small>{hint}</small> : null}</span>
    </div>
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

  return (
    <section className="social-report">
      <header className="report-section-head">
        <div><h2>Redes sociais</h2><p>{formatDate(range.from)} a {formatDate(range.to)} · comparado com {formatDate(comparison.from)} a {formatDate(comparison.to)}</p></div>
        <div className="network-chips">
          {connected.map((id) => {
            const health = connectionHealth(connections.find((item) => item.source === id))
            const importing = pending.includes(id)
            return (
              <button key={id} type="button" className="network-chip" onClick={() => onSelect(id)} title={importing ? 'Conectado. Aguardando o histórico.' : health.label}>
                <i style={{ background: networkColor[id] }} />{channelById(id).label}
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
          <HeroTile icon={<Sparkles size={16} />} label="Audiência total" value={compact(current.audience)} trend={current.growth !== undefined ? <span className={`delta ${current.growth > 0 ? 'is-up' : current.growth < 0 ? 'is-down' : 'is-flat'}`}>{current.growth > 0 ? '+' : ''}{formatNumber(current.growth)} no período</span> : undefined} hint="seguidores e inscritos" />
          <HeroTile icon={<TrendingUp size={16} />} label="Novos seguidores" value={current.growth === undefined ? '—' : `${current.growth > 0 ? '+' : ''}${formatNumber(current.growth)}`} trend={<Trend value={percentChange(current.growth, previous.growth)} />} hint="vs. período comparado" />
          <HeroTile icon={<PlayCircle size={16} />} label="Alcance" value={compact(current.reach)} trend={<Trend value={percentChange(current.reach, previous.reach)} />} hint="contas alcançadas e views" />
          <HeroTile icon={<Heart size={16} />} label="Interações" value={compact(current.engagement)} trend={<Trend value={percentChange(current.engagement, previous.engagement)} />} hint="curtidas, comentários, salvos" />
          <HeroTile icon={<Lightbulb size={16} />} label="Engajamento" value={percentText(current.engagementRate)} trend={current.engagementRate !== undefined && previous.engagementRate !== undefined ? <Trend value={current.engagementRate - previous.engagementRate} suffix=" p.p." /> : <Trend />} hint="interações ÷ alcance" />
        </div>

        <div className="report-grid">
          <AudienceChart points={points} sources={withData} range={range} />
          <ReachChart points={points} sources={withData} range={range} />
        </div>

        <NetworkTable current={current} previous={previous} onSelect={onSelect} />

        {insights.length ? (
          <Panel title="O que os números dizem">
            <ul className="report-insights-list">
              {insights.map((item, index) => (
                <li key={index} className={`is-${item.tone}`}>
                  {item.tone === 'positive' ? <TrendingUp size={15} /> : item.tone === 'negative' ? <TrendingDown size={15} /> : <Lightbulb size={15} />}
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

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

function AudienceChart({ points, sources, range }: { points: MetricPoint[]; sources: string[]; range: DateRange }) {
  const data = buildAudienceSeries(points, sources, range)
  const hasData = data.some((row) => sources.some((source) => row[source] !== null))
  return (
    <Panel title="Crescimento da audiência">
      {hasData ? (
        <div className="report-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} axisLine={false} tickLine={false} tick={axisTick} />
              <YAxis width={48} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => compact(Number(value))} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => shortDate(String(label))} formatter={(value, name) => [formatNumber(Number(value)), channelById(String(name)).label]} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{channelById(String(value)).label}</span>} />
              {sources.map((source) => <Line key={source} dataKey={source} type="monotone" connectNulls stroke={networkColor[source] ?? 'var(--series-6)'} strokeWidth={2} dot={false} isAnimationActive={false} />)}
            </LineChart>
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
    <Panel title="Alcance por dia">
      {active.length ? (
        <div className="report-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} axisLine={false} tickLine={false} tick={axisTick} />
              <YAxis width={48} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => compact(Number(value))} />
              <Tooltip cursor={{ fill: 'var(--surface-3)' }} contentStyle={tooltipStyle} labelFormatter={(label) => shortDate(String(label))} formatter={(value, name) => [formatNumber(Number(value)), channelById(String(name)).label]} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{channelById(String(value)).label}</span>} />
              {active.map((source, index) => <Bar key={source} dataKey={source} stackId="reach" fill={networkColor[source] ?? 'var(--series-6)'} radius={index === active.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="muted-note">O alcance diário aparece depois da primeira coleta com histórico.</p>}
    </Panel>
  )
}

function NetworkTable({ current, previous, onSelect }: { current: SocialTotals; previous: SocialTotals; onSelect: (id: string) => void }) {
  return (
    <Panel title="Comparativo por rede">
      <div className="table-scroll">
        <table className="data-table report-network-table">
          <thead><tr><th>Rede</th><th>Seguidores</th><th>Ganho</th><th>Alcance</th><th>Interações</th><th>Engajamento</th><th>Alcance vs. antes</th></tr></thead>
          <tbody>
            {current.networks.map((item) => {
              const before = previous.networks.find((network) => network.channel.id === item.channel.id)
              return (
                <tr key={item.channel.id} onClick={() => onSelect(item.channel.id)} className="is-clickable">
                  <td data-label="Rede"><span className="network-name"><i style={{ background: networkColor[item.channel.id] }} />{item.channel.label}</span></td>
                  <td data-label="Seguidores">{compact(item.audience)}</td>
                  <td data-label="Ganho">{item.growth === undefined ? '—' : <span className={item.growth > 0 ? 'text-positive' : item.growth < 0 ? 'text-negative' : ''}>{item.growth > 0 ? '+' : ''}{formatNumber(item.growth)}</span>}</td>
                  <td data-label="Alcance">{compact(item.reach)}</td>
                  <td data-label="Interações">{compact(item.engagement)}</td>
                  <td data-label="Engajamento">{item.engagementRate === undefined ? '—' : <span className="rate-bar"><span style={{ width: `${Math.min(item.engagementRate * 10, 100)}%`, background: networkColor[item.channel.id] }} /><b>{percentText(item.engagementRate)}</b></span>}</td>
                  <td data-label="Alcance vs. antes"><Trend value={percentChange(item.reach, before?.reach)} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

export function PostGallery({ title, posts, contentItems }: { title: string; posts: MetricPost[]; contentItems: ContentItem[] }) {
  if (!posts.length) return null
  return (
    <Panel title={title}>
      <div className="post-gallery">
        {posts.map((post, index) => {
          const planned = matchPostToContent(post, contentItems)
          const rate = postEngagementRate(post)
          const Wrapper = post.url ? 'a' : 'div'
          return (
            <Wrapper key={`${post.source}-${post.externalId}`} className="post-card" {...(post.url ? { href: post.url, target: '_blank', rel: 'noreferrer' } : {})}>
              <div className="post-card__media" style={{ ['--network' as string]: networkColor[post.source] ?? 'var(--series-6)' }}>
                <span>{post.format || channelById(post.source).label}</span>
                {/* Miniaturas do Instagram expiram; se falhar, fica o fundo com o formato. */}
                {post.thumbnailUrl ? <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}
                <em>#{index + 1}</em>
                <i>{channelById(post.source).label}{post.format ? ` · ${post.format}` : ''}</i>
              </div>
              <div className="post-card__body">
                <strong>{post.title || planned?.title || 'Publicação sem legenda'}</strong>
                <small>{post.publishedAt ? formatDate(post.publishedAt.slice(0, 10)) : 'Sem data'}{planned ? ` · Planejado: ${planned.title}` : ''}</small>
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
          {formats.map((item) => (
            <div key={item.format}>
              <span><strong>{item.format}</strong><small>{item.posts} post(s) · {percentText(item.engagementRate)} engaj.</small></span>
              <div className="meter"><span style={{ width: `${(item.avgEngagement / max) * 100}%`, background: 'var(--series-1)' }} /></div>
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
  return (
    <Panel title="Melhor dia para postar">
      {enough ? (
        <div className="report-chart is-short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
              <YAxis width={40} axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(value) => compact(Number(value))} />
              <Tooltip cursor={{ fill: 'var(--surface-3)' }} contentStyle={tooltipStyle} formatter={(value, _name, item) => [`${formatNumber(Math.round(Number(value)))} interações por post (${(item?.payload as { posts?: number })?.posts ?? 0} post(s))`, 'Média']} />
              <Bar dataKey="avgEngagement" fill="var(--series-3)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="muted-note">Precisa de posts em pelo menos dois dias da semana para comparar.</p>}
    </Panel>
  )
}
