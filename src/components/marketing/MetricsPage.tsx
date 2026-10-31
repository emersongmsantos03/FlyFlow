import { AlertTriangle, ArrowDownRight, ArrowUpRight, ExternalLink, Minus, Plug, Plus, RefreshCw, Table2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, EmptyState, InputField, Modal, PageToolbar, Panel, Select } from '../ui'
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from '../../lib/format'
import {
  activeMetricKeys,
  buildButtonRanking,
  buildComparisonSeries,
  buildEmailBreakdown,
  buildMetricSeries,
  channelById,
  compareMetric,
  connectionHealth,
  emptyMetricsSnapshot,
  matchPostToContent,
  metricChannels,
  metricFormat,
  metricLabel,
  postScore,
  previousRange,
  sameRangeLastMonth,
  saoPauloDateKey,
  summarizeEmailRows,
  type ChannelDefinition,
  type DateRange,
  type EmailReport,
  type MetricFormat,
  type MetricsSnapshot,
} from '../../lib/marketing'
import { loadEmailReport, loadMetrics, saveManualMetrics } from '../../services/marketingMetrics'
import type { ContentItem } from '../../types'

const periods = [{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }, { value: 'custom', label: 'Personalizado' }]
const comparisonModes = [{ value: 'previous', label: 'Período anterior' }, { value: 'lastMonth', label: 'Mesmo período do mês passado' }, { value: 'custom', label: 'Datas escolhidas' }]
const fixedTabs = ['email', 'instagram', 'facebook', 'youtube', 'google_business', 'site']

const formatMetric = (value: number | undefined, format: MetricFormat) => {
  if (value === undefined) return '—'
  if (format === 'currency') return formatCurrency(value)
  if (format === 'percent') return formatPercent(value)
  return formatNumber(Math.round(value * 100) / 100)
}

const shortDate = (date?: string) => {
  if (!date) return ''
  const [, month, day] = date.split('-')
  return `${day}/${month}`
}

const signed = (value: number | undefined, format: MetricFormat) => value === undefined ? '' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatMetric(Math.abs(value), format)}`

function Delta({ value }: { value?: number }) {
  if (value === undefined) return <span className="delta is-flat">sem base</span>
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return <span className={`delta ${value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-flat'}`}><Icon size={13} />{Math.abs(value).toFixed(1).replace('.', ',')}%</span>
}

function Comparison({ difference, delta, format }: { difference?: number; delta?: number; format: MetricFormat }) {
  if (difference === undefined) return <span className="delta is-flat">sem base</span>
  return <span className="comparison-line"><small>{signed(difference, format)}</small><Delta value={delta} /></span>
}

export function MetricsPage({ contentItems, canManageIntegrations, onOpenIntegrations, onOpenLead }: {
  contentItems: ContentItem[]
  canManageIntegrations: boolean
  onOpenIntegrations: () => void
  onOpenLead: (leadId: string | null | undefined, email: string) => void
}) {
  const today = saoPauloDateKey()
  const [snapshot, setSnapshot] = useState<MetricsSnapshot>(emptyMetricsSnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('30')
  const [customRange, setCustomRange] = useState<DateRange>({ from: today.slice(0, 8) + '01', to: today })
  const [comparisonMode, setComparisonMode] = useState('previous')
  const [customComparison, setCustomComparison] = useState<DateRange>(() => sameRangeLastMonth(today.slice(0, 8) + '01', today))
  const [tab, setTab] = useState('overview')
  const [manualOpen, setManualOpen] = useState(false)

  const range = useMemo<DateRange>(() => {
    if (period === 'custom') return customRange
    return { from: saoPauloDateKey(new Date(Date.now() - (Number(period) - 1) * 86_400_000)), to: today }
  }, [customRange, period, today])
  const comparison = useMemo<DateRange>(() => {
    if (comparisonMode === 'custom') return customComparison
    return comparisonMode === 'lastMonth' ? sameRangeLastMonth(range.from, range.to) : previousRange(range.from, range.to)
  }, [comparisonMode, customComparison, range])

  const queryFrom = range.from < comparison.from ? range.from : comparison.from
  const queryTo = range.to > comparison.to ? range.to : comparison.to

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSnapshot(await loadMetrics(queryFrom, queryTo))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar as métricas.')
    } finally {
      setLoading(false)
    }
  }, [queryFrom, queryTo])

  useEffect(() => { void refresh() }, [refresh])

  const channelsWithData = useMemo(() => {
    const received = [...new Set([...snapshot.points.map((point) => point.source), ...snapshot.posts.map((post) => post.source)])]
    const known = metricChannels.filter((channel) => received.includes(channel.id))
    return [...known, ...received.filter((id) => !metricChannels.some((channel) => channel.id === id)).map(channelById)]
  }, [snapshot])

  const tabs = [...fixedTabs, ...channelsWithData.map((channel) => channel.id).filter((id) => !fixedTabs.includes(id))]
  const validRange = range.from <= range.to && comparison.from <= comparison.to

  return (
    <div className="metrics-page module-page">
      <PageToolbar
        title="Métricas"
        description="Redes sociais, site, Google Meu Negócio e e-mails de prospecção em um só painel."
        action={<>
          <Button variant="secondary" type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw className={loading ? 'animate-spin' : ''} size={15} /> Atualizar</Button>
          <Button variant="secondary" type="button" onClick={() => setManualOpen(true)}><Plus size={15} /> Lançar manualmente</Button>
          {canManageIntegrations ? <Button type="button" onClick={onOpenIntegrations}><Plug size={15} /> Integrações</Button> : null}
        </>}
      />

      {error ? <p className="form-alert">{error}</p> : null}
      <FreshnessStrip snapshot={snapshot} />

      <section className="metrics-controls">
        <div className="segmented" aria-label="Período">
          {periods.map((item) => <button key={item.value} className={period === item.value ? 'is-active' : ''} type="button" onClick={() => setPeriod(item.value)}>{item.label}</button>)}
        </div>
        {period === 'custom' ? <DateRangeFields value={customRange} onChange={setCustomRange} label="Período" /> : null}
        <Select className="metrics-compare-select" ariaLabel="Comparar com" value={comparisonMode} onChange={setComparisonMode} options={comparisonModes} />
        {comparisonMode === 'custom' ? <DateRangeFields value={customComparison} onChange={setCustomComparison} label="Comparar com" /> : null}
        <span className="muted-note">{formatDate(range.from)} a {formatDate(range.to)} × {formatDate(comparison.from)} a {formatDate(comparison.to)}</span>
      </section>
      {!validRange ? <p className="form-alert">A data inicial precisa ser anterior à final.</p> : null}

      <div className="segmented metrics-tabs" aria-label="Canal">
        <button className={tab === 'overview' ? 'is-active' : ''} type="button" onClick={() => setTab('overview')}>Visão geral</button>
        {tabs.map((id) => <button key={id} className={tab === id ? 'is-active' : ''} type="button" onClick={() => setTab(id)}>{id === 'email' ? 'Emails' : channelById(id).label}</button>)}
      </div>

      {validRange && tab === 'overview' ? (channelsWithData.length
        ? <Overview channels={channelsWithData} snapshot={snapshot} range={range} comparison={comparison} onSelect={setTab} />
        : !loading && !error ? <EmptyState
            title="Nenhuma métrica recebida ainda"
            description="Assim que a rotina enviar a primeira coleta, os números de cada canal aparecem aqui. Você também pode lançar um valor manualmente."
            action={canManageIntegrations ? <Button type="button" onClick={onOpenIntegrations}><Plug size={15} /> Configurar integrações</Button> : undefined}
          /> : null) : null}
      {validRange && tab === 'email' ? <EmailTab key={`${range.from}-${range.to}-${comparison.from}-${comparison.to}`} range={range} comparison={comparison} onOpenLead={onOpenLead} /> : null}
      {validRange && tab !== 'overview' && tab !== 'email' ? <ChannelDetail key={tab} channel={channelById(tab)} snapshot={snapshot} range={range} comparison={comparison} contentItems={contentItems} /> : null}

      {manualOpen ? <ManualEntry onClose={() => setManualOpen(false)} onSaved={() => { setManualOpen(false); void refresh() }} /> : null}
    </div>
  )
}

function DateRangeFields({ value, onChange, label }: { value: DateRange; onChange: (value: DateRange) => void; label: string }) {
  return (
    <span className="date-range-fields">
      <input aria-label={`${label}: início`} className="field-input" type="date" value={value.from} onChange={(event) => onChange({ ...value, from: event.target.value })} />
      <span>a</span>
      <input aria-label={`${label}: fim`} className="field-input" type="date" value={value.to} onChange={(event) => onChange({ ...value, to: event.target.value })} />
    </span>
  )
}

function FreshnessStrip({ snapshot }: { snapshot: MetricsSnapshot }) {
  const rows = snapshot.connections.map((connection) => ({ connection, health: connectionHealth(connection) }))
  if (!rows.length) return null
  const problems = rows.filter(({ health }) => health.tone === 'danger' || health.tone === 'warning')
  return <>
    {problems.map(({ connection, health }) => (
      <p key={`${connection.source}-${connection.account}`} className={`inline-alert ${health.tone === 'danger' ? 'is-danger' : ''}`}>
        <AlertTriangle size={15} />
        <span><strong>{channelById(connection.source).label}{connection.account ? ` · ${connection.account}` : ''}:</strong> {health.tone === 'danger' ? connection.lastError || 'a última coleta falhou.' : 'mais de 36 horas sem dados novos.'}</span>
      </p>
    ))}
    <div className="freshness-strip">
      {rows.map(({ connection, health }) => (
        <span key={`${connection.source}-${connection.account}`} className={`health-pill is-${health.tone}`}>
          <strong>{channelById(connection.source).label}{connection.account ? ` ${connection.account}` : ''}</strong>
          {connection.lastSyncAt ? formatDateTime(connection.lastSyncAt) : 'sem coleta'}
        </span>
      ))}
    </div>
  </>
}

function Overview({ channels, snapshot, range, comparison, onSelect }: { channels: ChannelDefinition[]; snapshot: MetricsSnapshot; range: DateRange; comparison: DateRange; onSelect: (id: string) => void }) {
  return (
    <div className="channel-grid">
      {channels.map((channel) => {
        const keys = activeMetricKeys(snapshot.points, channel).slice(0, 3)
        const connections = snapshot.connections.filter((item) => item.source === channel.id)
        const health = connectionHealth(connections.find((item) => item.status === 'error') ?? connections[0])
        const headline = keys[0]
        const series = headline ? buildMetricSeries(snapshot.points, channel.id, headline, range.from, range.to) : []
        return (
          <button key={channel.id} className="channel-card" type="button" onClick={() => onSelect(channel.id)}>
            <header>
              <strong>{channel.label}</strong>
              <span className={`health-pill is-${health.tone}`}>{health.label}</span>
            </header>
            <div className="channel-card__stats">
              {keys.map((key) => {
                const result = compareMetric(snapshot.points, channel, key, range.from, range.to, comparison)
                return <div key={key}><span>{metricLabel(channel, key)}</span><strong>{formatMetric(result.value, metricFormat(channel, key))}</strong><Delta value={result.delta} /></div>
              })}
              {!keys.length ? <p className="muted-note">Só posts recebidos até agora.</p> : null}
            </div>
            {series.some((point) => point.value !== null) ? (
              <div className="channel-card__spark" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Area dataKey="value" type="monotone" connectNulls stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.1} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function ChannelDetail({ channel, snapshot, range, comparison, contentItems }: { channel: ChannelDefinition; snapshot: MetricsSnapshot; range: DateRange; comparison: DateRange; contentItems: ContentItem[] }) {
  const keys = activeMetricKeys(snapshot.points, channel)
  const [selected, setSelected] = useState('')
  const [showTable, setShowTable] = useState(false)
  const metric = keys.includes(selected) ? selected : keys[0] ?? ''
  const series = metric ? buildComparisonSeries(snapshot.points, channel.id, metric, range, comparison) : []
  const format = metricFormat(channel, metric)
  const buttons = channel.id === 'site' ? buildButtonRanking(snapshot.points, range.from, range.to) : []
  const maxButton = Math.max(...buttons.map((item) => item.total), 1)
  const accounts = snapshot.connections.filter((item) => item.source === channel.id)
  const posts = snapshot.posts
    .filter((post) => post.source === channel.id)
    .sort((left, right) => postScore(right) - postScore(left))
    .slice(0, 12)
  const postKeys = [...new Set(posts.flatMap((post) => Object.keys(post.metrics)))].slice(0, 5)

  if (!keys.length && !posts.length) return <EmptyState title={`Sem dados de ${channel.label}`} description={`${channel.description} Os números aparecem aqui depois da primeira coleta.`} />

  return <>
    {keys.length ? (
      <section className="kpi-row">
        {keys.slice(0, 8).map((key) => {
          const result = compareMetric(snapshot.points, channel, key, range.from, range.to, comparison)
          return (
            <button key={key} className={`kpi-tile ${metric === key ? 'is-active' : ''}`} type="button" onClick={() => setSelected(key)}>
              <span>{metricLabel(channel, key)}</span>
              <strong>{formatMetric(result.value, metricFormat(channel, key))}</strong>
              <Comparison difference={result.difference} delta={result.delta} format={metricFormat(channel, key)} />
            </button>
          )
        })}
      </section>
    ) : null}

    {metric ? (
      <Panel
        title={`${metricLabel(channel, metric)} · ${channel.label}`}
        action={<Button variant="ghost" type="button" onClick={() => setShowTable((value) => !value)}><Table2 size={15} /> {showTable ? 'Ver gráfico' : 'Ver tabela'}</Button>}
      >
        {showTable ? (
          <div className="table-scroll metrics-table-scroll">
            <table className="data-table"><thead><tr><th>Dia</th><th>Atual</th><th>Comparado</th></tr></thead><tbody>
              {series.filter((point) => point.atual !== null || point.comparado !== null).reverse().map((point, index) => <tr key={index}><td data-label="Dia">{shortDate(point.date)} × {shortDate(point.compareDate)}</td><td data-label="Atual">{formatMetric(point.atual ?? undefined, format)}</td><td data-label="Comparado">{formatMetric(point.comparado ?? undefined, format)}</td></tr>)}
            </tbody></table>
          </div>
        ) : (
          <div className="metrics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={36} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <YAxis width={56} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(value) => formatMetric(Number(value), format)} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} labelFormatter={(_, payload) => { const row = payload?.[0]?.payload as { date?: string; compareDate?: string } | undefined; return `${shortDate(row?.date)} × ${shortDate(row?.compareDate)}` }} formatter={(value, name) => [formatMetric(Number(value), format), name]} />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>} />
                <Line dataKey="atual" name="Período atual" type="monotone" connectNulls stroke="var(--series-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="comparado" name="Período comparado" type="monotone" connectNulls stroke="var(--series-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
    ) : null}

    {channel.id === 'site' ? (
      <Panel title="Cliques por botão">
        {buttons.length ? <div className="button-ranking">{buttons.map((item) => (
          <div key={item.name}><span>{item.name}</span><div className="meter"><span style={{ width: `${(item.total / maxButton) * 100}%`, background: 'var(--series-1)' }} /></div><strong>{formatNumber(item.total)}</strong></div>
        ))}</div> : <p className="muted-note">Nenhum clique registrado no período. Instale o script nos sites para começar.</p>}
      </Panel>
    ) : null}

    {posts.length ? (
      <Panel title="Melhores publicações">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Publicação</th><th>Data</th>{postKeys.map((key) => <th key={key}>{metricLabel(channel, key)}</th>)}<th /></tr></thead>
            <tbody>
              {posts.map((post) => {
                const planned = matchPostToContent(post, contentItems)
                return (
                  <tr key={post.externalId}>
                    <td data-label="Publicação"><strong className="cell-title">{post.title || post.format || post.externalId}</strong>{planned ? <small className="cell-sub">Planejado: {planned.title}</small> : post.format ? <small className="cell-sub">{post.format}</small> : null}</td>
                    <td data-label="Data">{post.publishedAt ? formatDate(post.publishedAt.slice(0, 10)) : '-'}</td>
                    {postKeys.map((key) => <td key={key} data-label={metricLabel(channel, key)}>{post.metrics[key] !== undefined ? formatNumber(post.metrics[key]) : '-'}</td>)}
                    <td data-label="Abrir">{post.url ? <a className="link-cell" href={post.url} target="_blank" rel="noreferrer" aria-label="Abrir publicação"><ExternalLink size={14} /></a> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    ) : null}

    {accounts.length ? <p className="muted-note">Contas: {accounts.map((item) => `${item.account || 'principal'} (${item.lastSyncAt ? formatDateTime(item.lastSyncAt) : 'sem coleta'})`).join(' · ')}</p> : null}
  </>
}

const emailDimensions = [{ value: 'campaign', label: 'Campanha' }, { value: 'segment', label: 'Segmento' }, { value: 'emailStep', label: 'Email da sequência' }] as const

function EmailTab({ range, comparison, onOpenLead }: { range: DateRange; comparison: DateRange; onOpenLead: (leadId: string | null | undefined, email: string) => void }) {
  const [current, setCurrent] = useState<EmailReport>({ rows: [], people: [] })
  const [compared, setCompared] = useState<EmailReport>({ rows: [], people: [] })
  const [dimension, setDimension] = useState<'campaign' | 'segment' | 'emailStep'>('campaign')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void Promise.all([loadEmailReport(range.from, range.to), loadEmailReport(comparison.from, comparison.to)])
      .then(([first, second]) => { if (active) { setCurrent(first); setCompared(second) } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os e-mails.') })
    return () => { active = false }
  }, [comparison, range])

  const summary = summarizeEmailRows(current.rows)
  const before = summarizeEmailRows(compared.rows)
  const tiles: Array<[string, number, number]> = [
    ['Enviados', summary.sent, before.sent], ['Cliques', summary.clicks, before.clicks], ['Pessoas que clicaram', summary.clickedContacts, before.clickedContacts],
    ['Respostas', summary.replies, before.replies], ['Bounces', summary.bounces, before.bounces], ['Descadastros', summary.unsubscribes, before.unsubscribes],
  ]
  const breakdown = buildEmailBreakdown(current.rows, dimension)
  const percent = (value?: number) => (value === undefined ? '—' : formatPercent(value))

  if (error) return <p className="form-alert">{error}</p>
  if (!current.rows.length && !compared.rows.length) return <EmptyState title="Nenhum e-mail registrado no período" description="Os números aparecem quando a rotina de envio registrar os e-mails. Aberturas não são mostradas: Gmail e Apple Mail distorcem esse dado." />

  return <>
    <section className="kpi-row">
      {tiles.map(([label, value, previous]) => (
        <div key={label} className="kpi-tile">
          <span>{label}</span>
          <strong>{formatNumber(value)}</strong>
          <Comparison difference={value - previous} delta={previous ? ((value - previous) / previous) * 100 : undefined} format="number" />
        </div>
      ))}
    </section>
    <Panel
      title="Resultado por grupo"
      action={<div className="segmented">{emailDimensions.map((item) => <button key={item.value} className={dimension === item.value ? 'is-active' : ''} type="button" onClick={() => setDimension(item.value)}>{item.label}</button>)}</div>}
    >
      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>{emailDimensions.find((item) => item.value === dimension)?.label}</th><th>Enviados</th><th>Cliques</th><th>Pessoas</th><th>Respostas</th><th>Bounces</th><th>Descad.</th><th>Clique</th><th>Resposta</th><th>Bounce</th></tr></thead>
          <tbody>{breakdown.map((row) => (
            <tr key={row.label}>
              <td data-label="Grupo"><strong className="cell-title">{row.label}</strong></td>
              <td data-label="Enviados">{formatNumber(row.sent)}</td><td data-label="Cliques">{formatNumber(row.clicks)}</td><td data-label="Pessoas">{formatNumber(row.clickedContacts)}</td>
              <td data-label="Respostas">{formatNumber(row.replies)}</td><td data-label="Bounces">{formatNumber(row.bounces)}</td><td data-label="Descadastros">{formatNumber(row.unsubscribes)}</td>
              <td data-label="Taxa de clique">{percent(row.clickRate)}</td><td data-label="Taxa de resposta">{percent(row.replyRate)}</td><td data-label="Taxa de bounce">{percent(row.bounceRate)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </Panel>
    <Panel title="Quem clicou ou respondeu">
      {current.people.length ? <div className="stack-tight">{current.people.map((person) => (
        <button key={`${person.type}-${person.leadEmail}`} className="detail-row" type="button" onClick={() => onOpenLead(person.leadId, person.leadEmail)}>
          <span>{person.leadEmail}<small>{person.campaign || 'Sem campanha'} · {formatDateTime(person.occurredAt)}</small></span>
          <span className={`status-badge ${person.type === 'email_reply' ? 'is-positive' : 'is-warning'}`}>{person.type === 'email_reply' ? 'Respondeu' : 'Clicou'}</span>
        </button>
      ))}</div> : <p className="muted-note">Ninguém clicou ou respondeu neste período.</p>}
    </Panel>
  </>
}

function ManualEntry({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [source, setSource] = useState('instagram')
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(saoPauloDateKey())
  const [rows, setRows] = useState<Array<{ metric: string; value: string }>>([{ metric: 'followers', value: '' }])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const channel = channelById(source)
  const options = channel.metrics.map((metric) => ({ value: metric.key, label: metric.label }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const metrics = rows.filter((row) => row.metric && row.value !== '').map((row) => ({ metric: row.metric, date, value: Number(row.value.replace(',', '.')) }))
    if (!metrics.length) return setError('Informe ao menos um valor.')
    if (metrics.some((row) => !Number.isFinite(row.value))) return setError('Use apenas números nos valores.')
    setSaving(true)
    setError('')
    try {
      await saveManualMetrics({ source, account: account.trim(), metrics })
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Lançar métricas" size="sm" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <InputField label="Canal"><Select value={source} onChange={(next) => { setSource(next); setRows([{ metric: channelById(next).metrics[0]?.key ?? '', value: '' }]) }} options={metricChannels.map((item) => ({ value: item.id, label: item.label }))} /></InputField>
          <InputField label="Data"><input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></InputField>
        </div>
        <InputField label="Conta (opcional)"><input className="field-input" value={account} onChange={(event) => setAccount(event.target.value)} placeholder="@perfil" /></InputField>
        {rows.map((row, index) => (
          <div key={index} className="manual-row">
            <Select ariaLabel="Métrica" value={row.metric} onChange={(metric) => setRows((current) => current.map((item, position) => position === index ? { ...item, metric } : item))} options={options} />
            <input aria-label="Valor" className="field-input" inputMode="decimal" value={row.value} onChange={(event) => setRows((current) => current.map((item, position) => position === index ? { ...item, value: event.target.value } : item))} placeholder="Valor" />
            {rows.length > 1 ? <button aria-label="Remover linha" className="icon-button" type="button" onClick={() => setRows((current) => current.filter((_, position) => position !== index))}><Trash2 size={15} /></button> : null}
          </div>
        ))}
        <div><Button variant="ghost" type="button" onClick={() => setRows((current) => [...current, { metric: options[0]?.value ?? '', value: '' }])}><Plus size={15} /> Outra métrica</Button></div>
        {error ? <p className="form-alert">{error}</p> : null}
        <div className="form-actions">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} type="submit">{saving ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
