import {
  Archive,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  CheckSquare2,
  Columns3,
  GripVertical,
  LayoutList,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Button, InputField, Modal } from '../ui'
import {
  internalProjectCategories,
  internalProjectStatuses,
  type InternalProject,
  type InternalProjectChecklistCategory,
  type InternalProjectStatus,
  type User,
} from '../../types'

type ViewMode = 'board' | 'list'
type Scope = 'active' | 'archived'

const statusStyle: Record<InternalProjectStatus, { dot: string; accent: string; soft: string }> = {
  Ideias: { dot: 'bg-violet-500', accent: 'border-t-violet-500', soft: 'bg-violet-50 text-violet-700' },
  Planejado: { dot: 'bg-sky-500', accent: 'border-t-sky-500', soft: 'bg-sky-50 text-sky-700' },
  'Em andamento': { dot: 'bg-amber-500', accent: 'border-t-amber-500', soft: 'bg-amber-50 text-amber-700' },
  'Em revisão': { dot: 'bg-cyan-500', accent: 'border-t-cyan-500', soft: 'bg-cyan-50 text-cyan-700' },
  Concluído: { dot: 'bg-emerald-500', accent: 'border-t-emerald-500', soft: 'bg-emerald-50 text-emerald-700' },
  Pausado: { dot: 'bg-gray-400', accent: 'border-t-gray-400', soft: 'bg-gray-100 text-gray-600' },
}

const priorityStyle: Record<InternalProject['priority'], string> = {
  Baixa: 'bg-gray-100 text-gray-600',
  Média: 'bg-blue-50 text-blue-700',
  Alta: 'bg-orange-50 text-orange-700',
  Urgente: 'bg-red-50 text-red-700',
}

const newProject = (): InternalProject => {
  const now = new Date().toISOString()
  return {
    id: '',
    name: '',
    description: '',
    status: 'Ideias',
    priority: 'Média',
    category: 'Geral',
    progress: 0,
    tags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

const formatDate = (value?: string) => value
  ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
  : 'Sem prazo'

const daysTo = (value?: string) => {
  if (!value) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(`${value}T12:00:00`).getTime() - today.getTime()) / 86_400_000)
}

const makeInternalId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const checklistStats = (project: InternalProject) => {
  const items = (project.checklist || []).flatMap((category) => category.items || [])
  const completed = items.filter((item) => item.completed).length
  return {
    total: items.length,
    completed,
    progress: items.length ? Math.round((completed / items.length) * 100) : project.progress,
  }
}

export function InternalProjectsPage({
  projects,
  users,
  onChange,
}: {
  projects: InternalProject[]
  users: User[]
  onChange: (projects: InternalProject[], message: string) => void
}) {
  const [view, setView] = useState<ViewMode>('list')
  const [scope, setScope] = useState<Scope>('active')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<InternalProject | null>(null)
  const [menuId, setMenuId] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'due' | 'priority'>('updated')
  const [expandedChecklistId, setExpandedChecklistId] = useState<string | null>(null)

  const toggleChecklistItem = (project: InternalProject, categoryId: string, itemId: string) => {
    const updatedChecklist = (project.checklist || []).map((category) => {
      if (category.id !== categoryId) return category
      return {
        ...category,
        items: category.items.map((item) => {
          if (item.id !== itemId) return item
          const completed = !item.completed
          return {
            ...item,
            completed,
            completedAt: completed ? new Date().toISOString() : undefined,
          }
        }),
      }
    })
    const allItems = updatedChecklist.flatMap((cat) => cat.items)
    const progress = allItems.length
      ? Math.round((allItems.filter((item) => item.completed).length / allItems.length) * 100)
      : project.progress
    const updatedStatus = progress === 100 ? 'Concluído' : (project.status === 'Concluído' ? 'Em andamento' : project.status)
    patch(project.id, { checklist: updatedChecklist, progress, status: updatedStatus }, 'Checklist atualizado.')
  }

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    const priorityOrder = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 }
    return projects
      .filter((project) => scope === 'archived' ? Boolean(project.archivedAt) : !project.archivedAt)
      .filter((project) => !term || `${project.name} ${project.description} ${project.category} ${project.tags.join(' ')} ${(project.checklist || []).map((category) => `${category.name} ${category.description} ${category.items.map((item) => `${item.title} ${item.details}`).join(' ')}`).join(' ')}`.toLocaleLowerCase('pt-BR').includes(term))
      .sort((a, b) => {
        if (sortBy === 'due') return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
        if (sortBy === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority]
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [projects, scope, search, sortBy])

  const active = projects.filter((project) => !project.archivedAt)
  const groupedProjects = useMemo(() => {
    const groups = new Map<string, InternalProject[]>()
    visible.forEach((project) => {
      const category = project.category.trim() || 'Geral'
      groups.set(category, [...(groups.get(category) || []), project])
    })
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
  }, [visible])
  const inProgress = active.filter((project) => project.status === 'Em andamento').length
  const overdue = active.filter((project) => {
    const days = daysTo(project.dueDate)
    return days !== null && days < 0 && project.status !== 'Concluído'
  }).length
  const averageProgress = active.length ? Math.round(active.reduce((sum, project) => sum + checklistStats(project).progress, 0) / active.length) : 0

  const save = (project: InternalProject) => {
    const now = new Date().toISOString()
    const checklist = (project.checklist || [])
      .map((category) => ({
        ...category,
        name: category.name.trim(),
        description: category.description.trim(),
        items: (category.items || [])
          .map((item) => ({ ...item, title: item.title.trim(), details: item.details.trim() }))
          .filter((item) => item.title),
      }))
      .filter((category) => category.name)
    const checklistItems = checklist.flatMap((category) => category.items)
    const progress = checklistItems.length
      ? Math.round((checklistItems.filter((item) => item.completed).length / checklistItems.length) * 100)
      : Math.max(0, Math.min(100, Number(project.progress)))
    const normalized = { ...project, name: project.name.trim(), category: project.category.trim() || 'Geral', checklist, progress, updatedAt: now }
    if (!normalized.name) return
    if (project.id) {
      onChange(projects.map((item) => item.id === project.id ? normalized : item), 'Projeto interno atualizado.')
    } else {
      onChange([{ ...normalized, id: `internal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now }, ...projects], 'Projeto interno criado.')
    }
    setEditing(null)
  }

  const patch = (id: string, values: Partial<InternalProject>, message = 'Projeto atualizado.') =>
    onChange(projects.map((item) => item.id === id ? { ...item, ...values, updatedAt: new Date().toISOString() } : item), message)

  const remove = (id: string) => {
    if (!window.confirm('Excluir este projeto interno permanentemente?')) return
    onChange(projects.filter((item) => item.id !== id), 'Projeto interno excluído.')
    setMenuId('')
  }

  const renderCard = (project: InternalProject) => {
    const owner = users.find((user) => user.id === project.responsibleUserId)
    const due = daysTo(project.dueDate)
    const late = due !== null && due < 0 && project.status !== 'Concluído'
    const checklist = checklistStats(project)
    const isExpanded = expandedChecklistId === project.id
    return (
      <article
        key={project.id}
        className="group relative rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <button className="min-w-0 flex-1 text-left" type="button" onClick={() => setEditing({ ...project })}>
            <span className={`inline-flex rounded-md px-2 py-1 text-[0.65rem] font-bold ${priorityStyle[project.priority]}`}>{project.priority}</span>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-gray-950">{project.name}</h3>
          </button>
          <div className="relative">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" type="button" onClick={() => setMenuId(menuId === project.id ? '' : project.id)} aria-label="Ações do projeto"><MoreHorizontal size={17} /></button>
            {menuId === project.id ? (
              <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-gray-200 bg-white p-1.5 text-xs font-semibold shadow-xl">
                <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-gray-50" type="button" onClick={() => { setEditing({ ...project }); setMenuId('') }}><Pencil size={14} /> Editar</button>
                <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-gray-50" type="button" onClick={() => { patch(project.id, { archivedAt: project.archivedAt ? undefined : new Date().toISOString() }, project.archivedAt ? 'Projeto restaurado.' : 'Projeto arquivado.'); setMenuId('') }}><Archive size={14} /> {project.archivedAt ? 'Restaurar' : 'Arquivar'}</button>
                <button className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-red-600 hover:bg-red-50" type="button" onClick={() => remove(project.id)}><Trash2 size={14} /> Excluir</button>
              </div>
            ) : null}
          </div>
        </div>
        {project.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{project.description}</p> : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-gray-100 px-2 py-1 text-[0.65rem] font-semibold text-gray-600">{project.category}</span>
          {project.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-md bg-amber-50 px-2 py-1 text-[0.65rem] font-semibold text-amber-700">#{tag}</span>)}
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="mb-1.5 flex w-full items-center justify-between text-[0.68rem] font-semibold text-gray-500 hover:text-gray-900"
            onClick={() => setExpandedChecklistId(isExpanded ? null : project.id)}
          >
            <span className="flex items-center gap-1.5"><ListChecks size={13} /> {checklist.total ? `${checklist.completed}/${checklist.total} tarefas` : 'Adicionar checklist'}</span>
            <span>{checklist.progress}%</span>
          </button>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#c9a227] transition-all" style={{ width: `${checklist.progress}%` }} /></div>
        </div>
        {isExpanded && (project.checklist || []).length > 0 ? (
          <div className="mt-3 space-y-2 rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 text-xs">
            {(project.checklist || []).map((cat) => (
              <div key={cat.id} className="space-y-1">
                <p className="text-[0.68rem] font-bold text-gray-700">{cat.name}</p>
                {cat.items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleChecklistItem(project, cat.id, item.id)}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-[#c9a227]"
                    />
                    <span className={`text-[0.72rem] ${item.completed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.title}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-[0.68rem] font-semibold">
          <span className={`inline-flex items-center gap-1.5 ${late ? 'text-red-600' : 'text-gray-500'}`}><CalendarDays size={13} /> {late ? `${Math.abs(due!)}d atrasado` : formatDate(project.dueDate)}</span>
          <span className="flex items-center gap-1.5 text-gray-500" title={owner?.name}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-900 text-[0.6rem] font-bold text-white">
              {owner?.avatarUrl ? <img src={owner.avatarUrl} alt={owner.name} className="h-full w-full object-cover" /> : owner ? owner.name.split(' ').slice(0, 2).map((part) => part[0]).join('') : <UserRound size={12} />}
            </span>
          </span>
        </div>
      </article>
    )
  }

  return (
    <div className="internal-projects-page module-page space-y-4">
      <header className="page-toolbar flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-gray-950 sm:text-2xl">Projetos internos</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">Organize as iniciativas da empresa por área, responsável, status e cronograma.</p>
        </div>
        <div className="page-toolbar-actions flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setEditing(newProject())}><Plus size={16} /> Novo projeto</Button>
        </div>
      </header>

      <section className="internal-project-controls list-control-bar">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button className={`rounded-md px-3 py-1.5 text-xs font-semibold ${scope === 'active' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => setScope('active')}>Ativos <span className="ml-1 text-gray-400">{active.length}</span></button>
              <button className={`rounded-md px-3 py-1.5 text-xs font-semibold ${scope === 'archived' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => setScope('archived')}>Arquivados</button>
            </div>
            <div className="flex rounded-lg border border-gray-200 p-1">
              <button className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500'}`} type="button" onClick={() => setView('list')}><LayoutList size={14} /> Quadro principal</button>
              <button className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${view === 'board' ? 'bg-gray-900 text-white' : 'text-gray-500'}`} type="button" onClick={() => setView('board')}><Columns3 size={14} /> Kanban</button>
            </div>
          </div>
          <div className="flex flex-1 gap-2 lg:max-w-xl">
            <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} /><input className="field-input w-full pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projetos, categorias ou tags..." /></label>
            <label className="relative"><ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><select className="field-input pl-8 pr-7 text-xs" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="updated">Recentes</option><option value="due">Prazo</option><option value="priority">Prioridade</option></select></label>
          </div>
        </div>
        <div className="internal-project-summary mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-gray-500">
          <span>{inProgress} em andamento</span>
          <span>{averageProgress}% de progresso médio</span>
          {overdue ? <span className="text-red-600">{overdue} precisando de atenção</span> : null}
        </div>
      </section>

      {!visible.length ? (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <Sparkles className="mx-auto text-[#c9a227]" size={32} />
          <h2 className="mt-3 text-base font-semibold text-gray-950">{search ? 'Nenhum projeto encontrado' : scope === 'archived' ? 'Nenhum projeto arquivado' : 'Sua próxima ideia começa aqui'}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{search ? 'Tente outro termo ou limpe a busca.' : 'Crie um projeto interno para organizar melhorias, campanhas, produtos e experimentos.'}</p>
          {!search && scope === 'active' ? <Button className="mt-5" type="button" onClick={() => setEditing(newProject())}><Plus size={15} /> Criar primeiro projeto</Button> : null}
        </section>
      ) : view === 'board' ? (
        <div className="flex snap-x gap-3 overflow-x-auto pb-3">
          {internalProjectStatuses.map((status) => {
            const items = visible.filter((project) => project.status === status)
            return (
              <section key={status} className={`min-w-[17rem] flex-1 snap-start rounded-xl border border-t-4 border-gray-200 bg-gray-50/80 p-2.5 ${statusStyle[status].accent}`}>
                <div className="mb-2.5 flex items-center justify-between px-1"><h2 className="flex items-center gap-2 text-xs font-bold text-gray-800"><span className={`h-2 w-2 rounded-full ${statusStyle[status].dot}`} />{status}</h2><span className="rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-bold text-gray-500 shadow-sm">{items.length}</span></div>
                <div className="space-y-2.5">{items.map(renderCard)}</div>
                <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 py-2 text-xs font-semibold text-gray-500 hover:border-gray-400 hover:bg-white" type="button" onClick={() => setEditing({ ...newProject(), status })}><Plus size={14} /> Adicionar</button>
              </section>
            )
          })}
        </div>
      ) : (
        <section className="space-y-4">
          {groupedProjects.map(([category, categoryProjects], groupIndex) => {
            const groupColors = ['#579bfc', '#a25ddc', '#00c875', '#fdab3d', '#e2445c', '#66ccff']
            const color = groupColors[groupIndex % groupColors.length]
            return (
              <div key={category} className="internal-project-table customer-project-board monday-board-group">
                <div className="customer-project-group-title monday-group-heading">
                  <span style={{ backgroundColor: color }} />
                  <div><h2 style={{ color }}>{category}</h2><small>{categoryProjects.length} item(ns)</small></div>
                </div>
                <div className="customer-project-scroll overflow-x-auto">
                  <div className="internal-project-table-content">
                    <div className="internal-project-grid customer-project-header monday-board-header grid">
                      <span>Projeto</span><span>Responsável</span><span>Status</span><span>Prioridade</span><span>Cronograma</span><span>Progresso</span><span>Ações</span>
                    </div>
                    {categoryProjects.map((project) => {
                      const late = (daysTo(project.dueDate) ?? 0) < 0 && project.status !== 'Concluído'
                      const checklist = checklistStats(project)
                      return (
                        <div key={project.id} className={`internal-project-grid customer-project-row monday-board-row group grid ${late ? 'is-late' : ''}`}>
                          <button className="customer-project-name min-w-0 text-left" type="button" onClick={() => setEditing({ ...project })}>
                            <span className="customer-project-color" style={{ backgroundColor: color }} />
                            <span className="min-w-0"><strong className="block truncate text-sm font-semibold text-gray-950">{project.name}</strong><small className="mt-0.5 block truncate text-[0.68rem] text-gray-500">{project.description || 'Sem descrição'}</small></span>
                          </button>
                          <label className="customer-project-cell owner-cell">
                            <select aria-label={`Responsável por ${project.name}`} className="internal-project-board-select w-full cursor-pointer bg-transparent py-2 text-center font-semibold text-gray-700 outline-none" value={project.responsibleUserId || ''} onChange={(event) => patch(project.id, { responsibleUserId: event.target.value || undefined })}>
                              <option value="">Não atribuído</option>{users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                            </select>
                          </label>
                          <label className="customer-project-cell internal-project-status-cell">
                            <select aria-label={`Status de ${project.name}`} className={`internal-project-board-select w-full cursor-pointer rounded-md border-0 text-center font-bold outline-none ${statusStyle[project.status].soft}`} value={project.status} onChange={(event) => patch(project.id, { status: event.target.value as InternalProjectStatus, progress: event.target.value === 'Concluído' ? 100 : project.progress })}>
                              {internalProjectStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </label>
                          <label className="customer-project-cell internal-project-status-cell">
                            <select aria-label={`Prioridade de ${project.name}`} className={`internal-project-board-select w-full cursor-pointer rounded-md border-0 text-center font-bold outline-none ${priorityStyle[project.priority]}`} value={project.priority} onChange={(event) => patch(project.id, { priority: event.target.value as InternalProject['priority'] })}>
                              <option>Baixa</option><option>Média</option><option>Alta</option><option>Urgente</option>
                            </select>
                          </label>
                          <button className={`customer-project-cell timeline-cell ${late ? 'text-red-600' : 'text-gray-600'}`} type="button" onClick={() => setEditing({ ...project })}>
                            <CalendarDays size={14} /><span>{project.startDate ? formatDate(project.startDate) : 'Início'} — {formatDate(project.dueDate)}</span>
                          </button>
                          <div className="customer-project-cell progress-cell">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${checklist.progress}%`, backgroundColor: color }} /></div>
                            <small>{checklist.completed}/{checklist.total} · {checklist.progress}%</small>
                          </div>
                          <div className="customer-project-cell customer-project-actions"><button type="button" onClick={() => setEditing({ ...project })}>Abrir</button><button className="internal-project-edit-action focus-ring" type="button" onClick={() => setEditing({ ...project })} aria-label={`Editar ${project.name}`}><Pencil size={15} /></button></div>
                        </div>
                      )
                    })}
                    <button className="customer-project-add" type="button" onClick={() => setEditing({ ...newProject(), category })}><Plus size={14} /> Adicionar projeto</button>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {editing ? <ProjectEditor project={editing} users={users} onClose={() => setEditing(null)} onSave={save} /> : null}
    </div>
  )
}

function ProjectEditor({ project, users, onClose, onSave }: { project: InternalProject; users: User[]; onClose: () => void; onSave: (project: InternalProject) => void }) {
  const [draft, setDraft] = useState<InternalProject>({ ...project, checklist: project.checklist || [] })
  const [editorTab, setEditorTab] = useState<'details' | 'checklist'>('details')
  const [newCategoryName, setNewCategoryName] = useState('')
  const categoryOptions = internalProjectCategories.includes(project.category as (typeof internalProjectCategories)[number])
    ? internalProjectCategories
    : [...internalProjectCategories, project.category]
  const set = <K extends keyof InternalProject>(key: K, value: InternalProject[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(draft) }
  const categories = draft.checklist || []
  const stats = checklistStats(draft)
  const updateCategory = (categoryId: string, update: (category: InternalProjectChecklistCategory) => InternalProjectChecklistCategory) =>
    set('checklist', categories.map((category) => category.id === categoryId ? update(category) : category))
  const addCategory = () => {
    const name = newCategoryName.trim()
    if (!name) return
    set('checklist', [...categories, { id: makeInternalId('check-category'), name, description: '', items: [], createdAt: new Date().toISOString() }])
    setNewCategoryName('')
  }
  const addItem = (categoryId: string) => updateCategory(categoryId, (category) => ({
    ...category,
    items: [...category.items, { id: makeInternalId('check-item'), title: '', details: '', completed: false, createdAt: new Date().toISOString() }],
  }))
  return (
    <Modal title={project.id ? 'Editar projeto interno' : 'Novo projeto interno'} onClose={onClose} size="lg">
      <form onSubmit={submit}>
        <div className="mb-5 grid grid-cols-2 rounded-xl bg-gray-100 p-1">
          <button className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${editorTab === 'details' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => setEditorTab('details')}><Pencil size={15} /> Detalhes</button>
          <button className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-bold transition ${editorTab === 'checklist' ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => setEditorTab('checklist')}><ListChecks size={16} /> Checklist {stats.total ? `${stats.completed}/${stats.total}` : ''}</button>
        </div>
        {editorTab === 'details' ? <div className="space-y-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs leading-5 text-amber-900"><strong>Uma boa iniciativa tem um resultado claro.</strong> Descreva o que estará diferente quando este projeto for concluído.</div>
          <InputField label="Nome do projeto"><input autoFocus className="field-input" required value={draft.name} onChange={(event) => set('name', event.target.value)} placeholder="Ex.: Novo site da Hero Drone" /></InputField>
          <InputField label="Objetivo / descrição"><textarea className="field-input min-h-24 resize-y" value={draft.description} onChange={(event) => set('description', event.target.value)} placeholder="Qual problema vamos resolver e qual resultado esperamos?" /></InputField>
          <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Status"><select className="field-input" value={draft.status} onChange={(event) => set('status', event.target.value as InternalProjectStatus)}>{internalProjectStatuses.map((status) => <option key={status}>{status}</option>)}</select></InputField>
          <InputField label="Prioridade"><select className="field-input" value={draft.priority} onChange={(event) => set('priority', event.target.value as InternalProject['priority'])}><option>Baixa</option><option>Média</option><option>Alta</option><option>Urgente</option></select></InputField>
          <InputField label="Categoria">
            <select className="field-input" value={draft.category} onChange={(event) => set('category', event.target.value)}>
              {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </InputField>
          <InputField label="Responsável"><select className="field-input" value={draft.responsibleUserId || ''} onChange={(event) => set('responsibleUserId', event.target.value || undefined)}><option value="">Não atribuído</option>{users.filter((user) => user.active).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></InputField>
          <InputField label="Data de início"><input className="field-input" type="date" value={draft.startDate || ''} onChange={(event) => set('startDate', event.target.value || undefined)} /></InputField>
          <InputField label="Prazo"><input className="field-input" type="date" value={draft.dueDate || ''} onChange={(event) => set('dueDate', event.target.value || undefined)} /></InputField>
          </div>
          {stats.total ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900"><span>Progresso calculado pelo checklist</span><span>{stats.progress}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${stats.progress}%` }} /></div>
            </div>
          ) : <InputField label={`Progresso — ${draft.progress}%`}><input className="w-full accent-[#c9a227]" type="range" min="0" max="100" step="5" value={draft.progress} onChange={(event) => set('progress', Number(event.target.value))} /></InputField>}
          <InputField label="Tags (separadas por vírgula)"><input className="field-input" value={draft.tags.join(', ')} onChange={(event) => set('tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean))} placeholder="site, crescimento, automação" /></InputField>
          <InputField label="Notas gerais"><textarea className="field-input min-h-20 resize-y" value={draft.notes} onChange={(event) => set('notes', event.target.value)} placeholder="Links, decisões, próximos passos..." /></InputField>
        </div> : (
          <div className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold text-blue-950">Plano de execução</p><p className="mt-0.5 text-xs text-blue-700">Separe as tarefas por categoria e acrescente instruções em cada item.</p></div><strong className="shrink-0 text-lg text-blue-950">{stats.progress}%</strong></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${stats.progress}%` }} /></div>
            </div>
            <div className="flex gap-2">
              <input className="field-input min-w-0 flex-1" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCategory() } }} placeholder="Nova categoria, ex.: Planejamento" />
              <Button type="button" onClick={addCategory}><Plus size={15} /> Categoria</Button>
            </div>
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {categories.map((category, categoryIndex) => {
                const completed = category.items.filter((item) => item.completed).length
                return (
                  <section key={category.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-start gap-2 border-b border-gray-100 bg-gray-50/80 p-3">
                      <GripVertical className="mt-2 shrink-0 text-gray-300" size={16} />
                      <div className="min-w-0 flex-1 space-y-2">
                        <input aria-label={`Nome da categoria ${categoryIndex + 1}`} className="w-full bg-transparent text-sm font-bold text-gray-950 outline-none placeholder:text-gray-400" value={category.name} onChange={(event) => updateCategory(category.id, (current) => ({ ...current, name: event.target.value }))} placeholder="Nome da categoria" />
                        <textarea aria-label={`Descrição da categoria ${category.name}`} className="w-full resize-none bg-transparent text-xs leading-5 text-gray-600 outline-none placeholder:text-gray-400" rows={2} value={category.description} onChange={(event) => updateCategory(category.id, (current) => ({ ...current, description: event.target.value }))} placeholder="Contexto, objetivo ou orientações desta categoria..." />
                      </div>
                      <span className="mt-1 shrink-0 rounded-full bg-white px-2 py-1 text-[0.65rem] font-bold text-gray-500">{completed}/{category.items.length}</span>
                      <button className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600" type="button" onClick={() => set('checklist', categories.filter((item) => item.id !== category.id))} aria-label={`Excluir categoria ${category.name}`}><Trash2 size={14} /></button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {category.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 p-3">
                          <button className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${item.completed ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 bg-white text-transparent hover:border-emerald-400'}`} type="button" onClick={() => updateCategory(category.id, (current) => ({ ...current, items: current.items.map((currentItem) => currentItem.id === item.id ? { ...currentItem, completed: !currentItem.completed, completedAt: !currentItem.completed ? new Date().toISOString() : undefined } : currentItem) }))} aria-label={item.completed ? `Reabrir ${item.title}` : `Concluir ${item.title}`}><CheckCircle2 size={14} /></button>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <input className={`w-full bg-transparent text-sm font-semibold outline-none placeholder:text-gray-400 ${item.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`} value={item.title} onChange={(event) => updateCategory(category.id, (current) => ({ ...current, items: current.items.map((currentItem) => currentItem.id === item.id ? { ...currentItem, title: event.target.value } : currentItem) }))} placeholder="Digite a tarefa..." />
                            <textarea className="w-full resize-y rounded-lg border border-transparent bg-gray-50 px-2.5 py-2 text-xs leading-5 text-gray-600 outline-none transition placeholder:text-gray-400 focus:border-gray-200 focus:bg-white" rows={2} value={item.details} onChange={(event) => updateCategory(category.id, (current) => ({ ...current, items: current.items.map((currentItem) => currentItem.id === item.id ? { ...currentItem, details: event.target.value } : currentItem) }))} placeholder="Adicione texto, instruções, links ou observações (opcional)..." />
                          </div>
                          <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-600" type="button" onClick={() => updateCategory(category.id, (current) => ({ ...current, items: current.items.filter((currentItem) => currentItem.id !== item.id) }))} aria-label={`Excluir ${item.title}`}><X size={15} /></button>
                        </div>
                      ))}
                      <button className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold text-blue-700 hover:bg-blue-50" type="button" onClick={() => addItem(category.id)}><Plus size={14} /> Adicionar item</button>
                    </div>
                  </section>
                )
              })}
              {!categories.length ? <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center"><CheckSquare2 className="mx-auto text-gray-300" size={30} /><p className="mt-2 text-sm font-bold text-gray-800">Crie a primeira categoria</p><p className="mt-1 text-xs text-gray-500">Ex.: Planejamento, Conteúdo, Desenvolvimento ou Lançamento.</p></div> : null}
            </div>
          </div>
        )}
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-200 pt-4">
          <button className="text-xs font-bold text-gray-500 hover:text-gray-900" type="button" onClick={() => setEditorTab(editorTab === 'details' ? 'checklist' : 'details')}>{editorTab === 'details' ? 'Montar checklist →' : '← Voltar aos detalhes'}</button>
          <div className="flex gap-2"><Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button><Button type="submit"><CheckCircle2 size={15} /> {project.id ? 'Salvar alterações' : 'Criar projeto'}</Button></div>
        </div>
      </form>
    </Modal>
  )
}
