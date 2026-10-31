import { CalendarDays, ChevronLeft, ChevronRight, Columns3, Copy, ExternalLink, Layers, List, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type DragEvent, type FormEvent } from 'react'
import { createId } from '../../services/storage'
import { Button, EmptyState, InputField, Modal, PageToolbar, Panel, Select, StatusBadge } from '../ui'
import { formatDateTime, slugify } from '../../lib/format'
import {
  buildMonthGrid,
  buildPillarBalance,
  contentFormatsByPlatform,
  contentStatusFlow,
  isContentOverdue,
  localDateKey,
  nextContentStatus,
  pad2,
  pillarColors,
  platformBrief,
} from '../../lib/marketing'
import { contentPlatforms, type ContentItem, type ContentPillar, type ContentPlatform, type ContentStatus, type Project, type User } from '../../types'

type PlannerView = 'calendar' | 'board' | 'list'

interface ContentDraft extends Omit<ContentItem, 'id' | 'createdAt' | 'updatedAt' | 'scheduledAt'> {
  id?: string
  createdAt?: string
  scheduledDate: string
  scheduledTime: string
}

const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const emptyDraft = (date = ''): ContentDraft => ({
  title: '', platform: 'Instagram', format: 'Reels', status: date ? 'Roteiro' : 'Ideia', pillarId: '', hook: '', caption: '', script: '',
  callToAction: '', hashtags: '', mediaUrl: '', permalink: '', campaign: '', responsibleUserId: '', projectId: '', notes: '',
  scheduledDate: date, scheduledTime: '10:00',
})

const toDraft = (item: ContentItem): ContentDraft => {
  const scheduled = item.scheduledAt ? new Date(item.scheduledAt) : undefined
  return {
    ...item,
    scheduledDate: scheduled ? localDateKey(scheduled) : '',
    scheduledTime: scheduled ? `${pad2(scheduled.getHours())}:${pad2(scheduled.getMinutes())}` : '10:00',
  }
}

export function ContentPlannerPage({ items, pillars, users, projects, onSaveItem, onDeleteItem, onSavePillars }: {
  items: ContentItem[]
  pillars: ContentPillar[]
  users: User[]
  projects: Project[]
  onSaveItem: (item: ContentItem, message: string) => void
  onDeleteItem: (item: ContentItem) => void
  onSavePillars: (pillars: ContentPillar[]) => void
}) {
  const [view, setView] = useState<PlannerView>(() => (window.localStorage.getItem('flyflow:content-view') as PlannerView) || 'calendar')
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [platform, setPlatform] = useState('')
  const [pillarId, setPillarId] = useState('')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<ContentDraft | null>(null)
  const [pillarsOpen, setPillarsOpen] = useState(false)
  const [dragId, setDragId] = useState('')

  const changeView = (next: PlannerView) => {
    setView(next)
    window.localStorage.setItem('flyflow:content-view', next)
  }

  const active = useMemo(() => items.filter((item) => !item.archivedAt), [items])
  const visible = useMemo(() => active.filter((item) => {
    if (platform && item.platform !== platform) return false
    if (pillarId && item.pillarId !== pillarId) return false
    return !search.trim() || slugify(`${item.title} ${item.campaign} ${item.caption} ${item.format}`).includes(slugify(search))
  }), [active, pillarId, platform, search])

  const pillarOf = (item: ContentItem) => pillars.find((pillar) => pillar.id === item.pillarId)
  const grid = buildMonthGrid(month)
  const monthName = month.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1)
  const today = localDateKey(new Date())
  const byDay = useMemo(() => {
    const map = new Map<string, ContentItem[]>()
    visible.filter((item) => item.scheduledAt).forEach((item) => {
      const key = localDateKey(new Date(item.scheduledAt as string))
      map.set(key, [...(map.get(key) ?? []), item])
    })
    map.forEach((list) => list.sort((left, right) => (left.scheduledAt as string).localeCompare(right.scheduledAt as string)))
    return map
  }, [visible])
  const unscheduled = visible.filter((item) => !item.scheduledAt && item.status !== 'Publicado')
  const overdue = active.filter((item) => isContentOverdue(item)).length
  const weekEnd = new Date()
  weekEnd.setDate(weekEnd.getDate() + 7)
  const nextSeven = active.filter((item) => item.scheduledAt && item.status !== 'Publicado' && new Date(item.scheduledAt) >= new Date() && new Date(item.scheduledAt) <= weekEnd).length
  const publishedThisMonth = active.filter((item) => item.publishedAt && item.publishedAt.slice(0, 7) === today.slice(0, 7)).length
  const balance = buildPillarBalance(active, pillars)

  const reschedule = (item: ContentItem, dateKey: string) => {
    const previous = item.scheduledAt ? new Date(item.scheduledAt) : undefined
    const time = previous ? `${pad2(previous.getHours())}:${pad2(previous.getMinutes())}` : '10:00'
    onSaveItem({ ...item, scheduledAt: new Date(`${dateKey}T${time}`).toISOString(), updatedAt: new Date().toISOString() }, 'Conteúdo reagendado.')
  }

  const setStatus = (item: ContentItem, status: ContentStatus) => {
    if (status === item.status) return
    const now = new Date().toISOString()
    onSaveItem({ ...item, status, publishedAt: status === 'Publicado' ? item.publishedAt ?? now : undefined, updatedAt: now }, `Conteúdo movido para ${status}.`)
  }

  const allowDrop = (event: DragEvent) => event.preventDefault()
  const dragged = () => active.find((item) => item.id === dragId)

  const card = (item: ContentItem, compact = false) => {
    const pillar = pillarOf(item)
    return (
      <button
        key={item.id}
        className={`content-card ${compact ? 'is-compact' : ''} ${isContentOverdue(item) ? 'is-late' : ''}`}
        draggable
        type="button"
        onDragStart={() => setDragId(item.id)}
        onDragEnd={() => setDragId('')}
        onClick={() => setDraft(toDraft(item))}
      >
        <span className="content-card__bar" style={{ background: pillar?.color ?? 'var(--border-strong)' }} />
        <span className="content-card__body">
          <strong>{item.title}</strong>
          <small>{compact && item.scheduledAt ? `${new Date(item.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ` : ''}{item.platform} · {item.format}</small>
          {!compact && item.scheduledAt ? <small>{formatDateTime(item.scheduledAt)}</small> : null}
        </span>
      </button>
    )
  }

  return (
    <div className="content-page module-page">
      <PageToolbar
        title="Mídias sociais"
        description="Planeje, produza e acompanhe o conteúdo de todos os canais em um só calendário."
        action={<>
          <Button variant="secondary" type="button" onClick={() => setPillarsOpen(true)}><Layers size={15} /> Pilares</Button>
          <Button type="button" onClick={() => setDraft(emptyDraft())}><Plus size={15} /> Novo conteúdo</Button>
        </>}
      />

      <section className="stat-strip">
        <div><span>Próximos 7 dias</span><strong>{nextSeven}</strong></div>
        <div><span>Publicados no mês</span><strong>{publishedThisMonth}</strong></div>
        <div><span>Banco de ideias</span><strong>{active.filter((item) => item.status === 'Ideia').length}</strong></div>
        <div className={overdue ? 'is-danger' : ''}><span>Atrasados</span><strong>{overdue}</strong></div>
      </section>

      <section className="toolbar-row">
        <div className="segmented" role="tablist" aria-label="Visualização">
          <button className={view === 'calendar' ? 'is-active' : ''} type="button" onClick={() => changeView('calendar')}><CalendarDays size={15} /> Calendário</button>
          <button className={view === 'board' ? 'is-active' : ''} type="button" onClick={() => changeView('board')}><Columns3 size={15} /> Produção</button>
          <button className={view === 'list' ? 'is-active' : ''} type="button" onClick={() => changeView('list')}><List size={15} /> Lista</button>
        </div>
        <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conteúdo ou campanha…" /></label>
        <Select className="toolbar-select" placeholder="Todos os canais" clearable value={platform} onChange={setPlatform} options={contentPlatforms.map((value) => ({ value, label: value }))} />
        <Select className="toolbar-select" placeholder="Todos os pilares" clearable value={pillarId} onChange={setPillarId} options={pillars.map((pillar) => ({ value: pillar.id, label: pillar.name }))} />
      </section>

      {view === 'calendar' ? (
        <div className="content-calendar-layout">
          <section className="content-calendar">
            <header>
              <div className="content-calendar__nav">
                <button aria-label="Mês anterior" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
                <button aria-label="Próximo mês" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
                <h2>{monthLabel}</h2>
              </div>
              <Button variant="ghost" type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</Button>
            </header>
            <div className="content-calendar__week">{weekdayLabels.map((label) => <span key={label}>{label}</span>)}</div>
            <div className="content-calendar__grid">
              {grid.map((day) => {
                const key = localDateKey(day)
                const dayItems = byDay.get(key) ?? []
                return (
                  <div
                    key={key}
                    className={`content-day ${day.getMonth() !== month.getMonth() ? 'is-outside' : ''} ${key === today ? 'is-today' : ''}`}
                    onDragOver={allowDrop}
                    onDrop={() => { const item = dragged(); if (item) reschedule(item, key) }}
                  >
                    <button className="content-day__add" aria-label={`Novo conteúdo em ${key}`} type="button" onClick={() => setDraft(emptyDraft(key))}><span>{day.getDate()}</span><Plus size={13} /></button>
                    <div className="content-day__items">{dayItems.slice(0, 3).map((item) => card(item, true))}{dayItems.length > 3 ? <button className="content-day__more" type="button" onClick={() => { setSearch(''); changeView('list') }}>+{dayItems.length - 3} no dia</button> : null}</div>
                  </div>
                )
              })}
            </div>
          </section>
          <aside className="content-side">
            <Panel title="Sem data" action={<span className="count-pill">{unscheduled.length}</span>}>
              <p className="muted-note">Arraste para um dia do calendário.</p>
              <div className="content-side__list">
                {unscheduled.slice(0, 12).map((item) => card(item))}
                {!unscheduled.length ? <p className="muted-note">Nenhuma ideia solta.</p> : null}
              </div>
            </Panel>
            <Panel title="Equilíbrio dos pilares">
              <div className="pillar-balance">
                {balance.map(({ pillar, share, count }) => (
                  <div key={pillar.id}>
                    <div><span><i style={{ background: pillar.color }} />{pillar.name}</span><small>{count} · {share.toFixed(0)}% de {pillar.targetShare}%</small></div>
                    <div className="meter" role="img" aria-label={`${pillar.name}: ${share.toFixed(0)}% do calendário, meta de ${pillar.targetShare}%`}><span style={{ width: `${Math.min(share, 100)}%`, background: pillar.color }} /><i style={{ left: `${pillar.targetShare}%` }} /></div>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      ) : null}

      {view === 'board' ? (
        <section className="content-board">
          {contentStatusFlow.map((status) => {
            const columnItems = visible.filter((item) => item.status === status)
            return (
              <div key={status} className="content-column" onDragOver={allowDrop} onDrop={() => { const item = dragged(); if (item) setStatus(item, status) }}>
                <header><strong>{status}</strong><span className="count-pill">{columnItems.length}</span></header>
                <div>{columnItems.map((item) => card(item))}</div>
              </div>
            )
          })}
        </section>
      ) : null}

      {view === 'list' ? (
        visible.length ? (
          <Panel title={`Conteúdos (${visible.length})`}>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Conteúdo</th><th>Canal</th><th>Pilar</th><th>Data</th><th>Etapa</th><th /></tr></thead>
                <tbody>
                  {[...visible].sort((left, right) => (right.scheduledAt || '').localeCompare(left.scheduledAt || '')).map((item) => {
                    const next = nextContentStatus(item.status)
                    return (
                      <tr key={item.id}>
                        <td data-label="Conteúdo"><button className="link-cell" type="button" onClick={() => setDraft(toDraft(item))}>{item.title}</button></td>
                        <td data-label="Canal">{item.platform} · {item.format}</td>
                        <td data-label="Pilar">{pillarOf(item)?.name || '-'}</td>
                        <td data-label="Data">{item.scheduledAt ? formatDateTime(item.scheduledAt) : 'Sem data'}</td>
                        <td data-label="Etapa"><StatusBadge>{isContentOverdue(item) ? 'Atrasado' : item.status}</StatusBadge></td>
                        <td data-label="Ações">{next ? <Button variant="ghost" type="button" onClick={() => setStatus(item, next)}>Avançar para {next}</Button> : item.permalink ? <a className="link-cell" href={item.permalink} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir</a> : null}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : <EmptyState title="Nenhum conteúdo encontrado" description="Ajuste os filtros ou crie o primeiro conteúdo do calendário." action={<Button type="button" onClick={() => setDraft(emptyDraft())}><Plus size={15} /> Novo conteúdo</Button>} />
      ) : null}

      {draft ? (
        <ContentForm
          draft={draft}
          pillars={pillars}
          users={users}
          projects={projects}
          onClose={() => setDraft(null)}
          onDelete={draft.id ? () => { const item = items.find((entry) => entry.id === draft.id); if (item) { onDeleteItem(item); setDraft(null) } } : undefined}
          onDuplicate={draft.id ? (target) => {
            setDraft({ ...draft, id: undefined, createdAt: undefined, platform: target, format: contentFormatsByPlatform[target][0], status: 'Roteiro', permalink: '', publishedAt: undefined, title: `${draft.title} (${target})` })
          } : undefined}
          onSubmit={(value) => {
            const now = new Date().toISOString()
            const { scheduledDate, scheduledTime, ...rest } = value
            onSaveItem({
              ...rest,
              id: value.id || createId('content'),
              pillarId: value.pillarId || undefined,
              responsibleUserId: value.responsibleUserId || undefined,
              projectId: value.projectId || undefined,
              scheduledAt: scheduledDate ? new Date(`${scheduledDate}T${scheduledTime || '10:00'}`).toISOString() : undefined,
              publishedAt: value.status === 'Publicado' ? value.publishedAt ?? now : undefined,
              createdAt: value.createdAt ?? now,
              updatedAt: now,
            }, value.id ? 'Conteúdo atualizado.' : 'Conteúdo adicionado ao planejamento.')
            setDraft(null)
          }}
        />
      ) : null}

      {pillarsOpen ? <PillarsEditor pillars={pillars} onClose={() => setPillarsOpen(false)} onSave={(next) => { onSavePillars(next); setPillarsOpen(false) }} /> : null}
    </div>
  )
}

function ContentForm({ draft, pillars, users, projects, onSubmit, onClose, onDelete, onDuplicate }: {
  draft: ContentDraft
  pillars: ContentPillar[]
  users: User[]
  projects: Project[]
  onSubmit: (value: ContentDraft) => void
  onClose: () => void
  onDelete?: () => void
  onDuplicate?: (platform: ContentPlatform) => void
}) {
  const [value, setValue] = useState(draft)
  const [error, setError] = useState('')
  const patch = (next: Partial<ContentDraft>) => setValue((current) => ({ ...current, ...next }))
  const formats = contentFormatsByPlatform[value.platform]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value.title.trim()) return setError('Dê um título ao conteúdo.')
    if (value.status === 'Agendado' && !value.scheduledDate) return setError('Informe a data para agendar este conteúdo.')
    onSubmit({ ...value, title: value.title.trim() })
  }

  return (
    <Modal title={draft.id ? 'Editar conteúdo' : 'Novo conteúdo'} size="lg" onClose={onClose}>
      <form className="content-form" key={draft.id ?? draft.title} onSubmit={submit}>
        <div className="content-form__main">
          <InputField label="Título"><input autoFocus className="field-input" value={value.title} onChange={(event) => patch({ title: event.target.value })} placeholder="Sobre o que é este conteúdo?" /></InputField>
          <div className="form-grid">
            <InputField label="Canal"><Select value={value.platform} onChange={(next) => { const platform = next as ContentPlatform; patch({ platform, format: contentFormatsByPlatform[platform][0] }) }} options={contentPlatforms.map((item) => ({ value: item, label: item }))} /></InputField>
            <InputField label="Formato"><Select value={value.format} onChange={(format) => patch({ format })} options={formats.map((item) => ({ value: item, label: item }))} /></InputField>
          </div>
          <p className="platform-brief">{platformBrief[value.platform]}</p>
          <InputField label="Gancho"><input className="field-input" value={value.hook} onChange={(event) => patch({ hook: event.target.value })} placeholder="A frase que segura a atenção nos primeiros segundos" /></InputField>
          <InputField label="Roteiro"><textarea className="field-input" rows={5} value={value.script} onChange={(event) => patch({ script: event.target.value })} placeholder="Cenas, falas e pontos principais" /></InputField>
          <InputField label="Legenda ou descrição"><textarea className="field-input" rows={4} value={value.caption} onChange={(event) => patch({ caption: event.target.value })} /></InputField>
          <div className="form-grid">
            <InputField label="Chamada para ação"><input className="field-input" value={value.callToAction} onChange={(event) => patch({ callToAction: event.target.value })} placeholder="Ex.: Peça um orçamento no link da bio" /></InputField>
            <InputField label="Hashtags"><input className="field-input" value={value.hashtags} onChange={(event) => patch({ hashtags: event.target.value })} /></InputField>
          </div>
        </div>
        <aside className="content-form__side">
          <InputField label="Etapa"><Select value={value.status} onChange={(status) => patch({ status: status as ContentStatus })} options={contentStatusFlow.map((item) => ({ value: item, label: item }))} /></InputField>
          <div className="form-grid">
            <InputField label="Data"><input className="field-input" type="date" value={value.scheduledDate} onChange={(event) => patch({ scheduledDate: event.target.value })} /></InputField>
            <InputField label="Hora"><input className="field-input" type="time" value={value.scheduledTime} onChange={(event) => patch({ scheduledTime: event.target.value })} /></InputField>
          </div>
          <InputField label="Pilar"><Select placeholder="Sem pilar" clearable value={value.pillarId ?? ''} onChange={(pillarId) => patch({ pillarId })} options={pillars.map((pillar) => ({ value: pillar.id, label: pillar.name }))} /></InputField>
          <InputField label="Responsável"><Select placeholder="Sem responsável" clearable value={value.responsibleUserId ?? ''} onChange={(responsibleUserId) => patch({ responsibleUserId })} options={users.filter((user) => user.active).map((user) => ({ value: user.id, label: user.name }))} /></InputField>
          <InputField label="Campanha"><input className="field-input" value={value.campaign} onChange={(event) => patch({ campaign: event.target.value })} /></InputField>
          <InputField label="Projeto de origem"><Select placeholder="Nenhum" clearable searchable value={value.projectId ?? ''} onChange={(projectId) => patch({ projectId })} options={projects.filter((project) => !project.deletedAt && !project.archivedAt).map((project) => ({ value: project.id, label: `${project.projectCode} · ${project.name}` }))} /></InputField>
          <InputField label="Arquivos (link)"><input className="field-input" type="url" value={value.mediaUrl} onChange={(event) => patch({ mediaUrl: event.target.value })} placeholder="https://drive.google.com/…" /></InputField>
          <InputField label="Link publicado"><input className="field-input" type="url" value={value.permalink} onChange={(event) => patch({ permalink: event.target.value })} placeholder="https://instagram.com/p/…" /></InputField>
          <InputField label="Observações"><textarea className="field-input" rows={2} value={value.notes} onChange={(event) => patch({ notes: event.target.value })} /></InputField>
        </aside>
        {error ? <p className="form-alert">{error}</p> : null}
        <footer className="content-form__actions">
          {onDelete ? <Button variant="ghost" type="button" onClick={onDelete}><Trash2 size={15} /> Excluir</Button> : null}
          {onDuplicate ? <Select className="toolbar-select" placeholder="Adaptar para outro canal" value="" leadingIcon={<Copy size={14} />} onChange={(next) => onDuplicate(next as ContentPlatform)} options={contentPlatforms.filter((item) => item !== value.platform).map((item) => ({ value: item, label: item }))} /> : null}
          <span />
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar conteúdo</Button>
        </footer>
      </form>
    </Modal>
  )
}

function PillarsEditor({ pillars, onSave, onClose }: { pillars: ContentPillar[]; onSave: (pillars: ContentPillar[]) => void; onClose: () => void }) {
  const [rows, setRows] = useState(pillars)
  const total = rows.reduce((sum, row) => sum + (Number(row.targetShare) || 0), 0)
  const patch = (id: string, next: Partial<ContentPillar>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...next } : row))
  return (
    <Modal title="Pilares de conteúdo" size="md" onClose={onClose}>
      <div className="pillar-editor">
        <p className="muted-note">Pilares são os temas que sustentam sua presença. A meta define quanto do calendário cada um deve ocupar.</p>
        {rows.map((row) => (
          <div key={row.id} className="pillar-editor__row">
            <label className="pillar-color" style={{ background: row.color }}><span className="sr-only">Cor de {row.name}</span><input type="color" value={row.color} onChange={(event) => patch(row.id, { color: event.target.value })} /></label>
            <input aria-label="Nome do pilar" className="field-input" value={row.name} onChange={(event) => patch(row.id, { name: event.target.value })} />
            <input aria-label="Descrição" className="field-input" value={row.description} onChange={(event) => patch(row.id, { description: event.target.value })} placeholder="Descrição" />
            <label className="pillar-share"><input aria-label="Meta em porcentagem" className="field-input" type="number" min="0" max="100" value={row.targetShare} onChange={(event) => patch(row.id, { targetShare: Number(event.target.value) })} /><span>%</span></label>
            <button aria-label={`Remover ${row.name}`} className="icon-button" type="button" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="pillar-editor__footer">
          <Button variant="secondary" type="button" onClick={() => {
            const now = new Date().toISOString()
            setRows((current) => [...current, { id: createId('pillar'), name: 'Novo pilar', color: pillarColors[current.length % pillarColors.length], description: '', targetShare: 0, createdAt: now, updatedAt: now }])
          }}><Plus size={15} /> Adicionar pilar</Button>
          <span className={total === 100 ? 'muted-note' : 'text-warning'}>Soma das metas: {total}%</span>
        </div>
        <div className="form-actions">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => onSave(rows.filter((row) => row.name.trim()).map((row) => ({ ...row, updatedAt: new Date().toISOString() })))}>Salvar pilares</Button>
        </div>
      </div>
    </Modal>
  )
}
