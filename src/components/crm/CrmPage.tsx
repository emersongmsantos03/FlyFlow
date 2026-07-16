import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Download,
  Eye,
  FileText,
  LayoutGrid,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatDate, formatDateTime, phoneLink, whatsappLink } from '../../lib/format'
import { downloadUrl, getBrowserSafeFileUrl, getFilePreviewMode, openUrlInNewTab, type FilePreviewMode } from '../../lib/files'
import type { AppState, Lead, Payment, PipelineStage, Project, Quote, TaskItem } from '../../types'
import { Button, StatusBadge } from '../ui'

export type CrmView = 'kanban' | 'table' | 'tasks'

type QuickFilter =
  | 'all'
  | 'action'
  | 'overdue'
  | 'no-activity'
  | 'with-quote'
  | 'waiting-deposit'
  | 'paid'
  | 'no-receipt'
  | 'with-project'
  | 'confirmed-no-project'

type DrawerTab = 'overview' | 'activities' | 'tasks' | 'quotes' | 'projects' | 'finance' | 'files'

const columns: Array<{
  id: string
  title: string
  subtitle: string
  stages: PipelineStage[]
  target: PipelineStage
}> = [
  { id: 'entry', title: 'Entrada', subtitle: 'Novos contatos', stages: ['Entrada', 'Novo lead'], target: 'Entrada' },
  { id: 'contact', title: 'Contato realizado', subtitle: 'Primeira conversa', stages: ['Contato realizado', 'Primeiro contato', 'Aguardando resposta'], target: 'Contato realizado' },
  { id: 'negotiation', title: 'Em negociação', subtitle: 'Necessidade e valores', stages: ['Em negociação', 'Entendendo necessidade', 'Orçamento solicitado', 'Negociação'], target: 'Em negociação' },
  { id: 'sent', title: 'Proposta enviada', subtitle: 'Documento enviado', stages: ['Proposta enviada', 'Orçamento enviado'], target: 'Proposta enviada' },
  { id: 'approval', title: 'Aguardando aprovação', subtitle: 'Retorno do cliente', stages: ['Aguardando aprovação'], target: 'Aguardando aprovação' },
  { id: 'deposit', title: 'Aguardando entrada', subtitle: 'Confirmar recebimento', stages: ['Aguardando entrada', 'Aguardando sinal'], target: 'Aguardando entrada' },
  { id: 'confirmed', title: 'Serviço confirmado', subtitle: 'Pronto para operar', stages: ['Serviço confirmado', 'Serviço agendado', 'Convertido em cliente'], target: 'Serviço confirmado' },
  { id: 'future', title: 'Retorno futuro', subtitle: 'Follow-up agendado', stages: ['Retorno futuro', 'Contato futuro'], target: 'Retorno futuro' },
  { id: 'lost', title: 'Perdido', subtitle: 'Recuperar depois', stages: ['Perdido'], target: 'Perdido' },
]

const displayName = (lead: Lead) => lead.companyName?.trim() || lead.fullName?.trim() || 'Contato sem nome'
const displayDetail = (lead: Lead) => lead.fullName && lead.companyName ? lead.fullName : lead.city || lead.whatsapp || lead.phone || 'Sem detalhes'

const newestQuote = (state: AppState, leadId: string) =>
  state.quotes
    .filter((quote) => quote.leadId === leadId && !quote.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

const currentProject = (state: AppState, leadId: string) =>
  state.projects.find((project) => project.leadId === leadId && !project.deletedAt && !['Cancelado', 'Concluído', 'Finalizado'].includes(project.projectStatus))

const relatedPayments = (state: AppState, leadId: string, project?: Project) =>
  state.payments.filter((payment) => !payment.deletedAt && (payment.leadId === leadId || (project && payment.projectId === project.id)))

const taskBucket = (task: TaskItem) => {
  if (task.status === 'Concluída') return 'Concluídas recentemente'
  if (!task.dueAt) return 'Sem data'
  const due = new Date(task.dueAt)
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const tomorrow = new Date(start.getTime() + 86_400_000)
  const afterTomorrow = new Date(start.getTime() + 172_800_000)
  const nextWeek = new Date(start.getTime() + 8 * 86_400_000)
  if (due < start) return 'Atrasadas'
  if (due < tomorrow) return 'Hoje'
  if (due < afterTomorrow) return 'Amanhã'
  if (due < nextWeek) return 'Próximos sete dias'
  return 'Sem data'
}

export function CrmPage({
  leads,
  state,
  view,
  selectedLead,
  onViewChange,
  onMoveLead,
  onCreateLead,
  onEditLead,
  onOpenLead,
  onCloseLead,
  onDeleteLead,
  onAttachReceipt,
  onGenerateProposal,
  onRegisterInteraction,
  onScheduleReturn,
  onRegisterDeposit,
  onDownloadQuote,
  onApproveQuote,
  onMarkPaymentPaid,
  onCreateProject,
  onCreateTask,
  onCompleteTask,
  onCancelTask,
}: {
  leads: Lead[]
  state: AppState
  view: CrmView
  selectedLead?: Lead
  onViewChange: (view: CrmView) => void
  onMoveLead: (leadId: string, stage: PipelineStage) => void
  onCreateLead: () => void
  onEditLead: (lead: Lead) => void
  onOpenLead: (lead: Lead) => void
  onCloseLead: () => void
  onDeleteLead: (lead: Lead) => void
  onAttachReceipt: (payment: Payment) => void
  onGenerateProposal: (clientId: string, leadId?: string) => void
  onRegisterInteraction: (lead: Lead, type: string) => void
  onScheduleReturn: (lead: Lead) => void
  onRegisterDeposit: (quote: Quote) => void
  onDownloadQuote: (quote: Quote) => void | Promise<void>
  onApproveQuote: (quote: Quote) => void
  onMarkPaymentPaid: (payment: Payment) => void
  onCreateProject: (lead: Lead) => void
  onCreateTask: (lead?: Lead) => void
  onCompleteTask: (task: TaskItem) => void
  onCancelTask: (task: TaskItem) => void
}) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [mobileColumn, setMobileColumn] = useState(columns[0].id)

  const activeLeads = useMemo(() => leads.filter((lead) => !lead.archived && !lead.deletedAt), [leads])
  const filtered = useMemo(() => activeLeads.filter((lead) => {
    const quote = newestQuote(state, lead.id)
    const project = currentProject(state, lead.id)
    const payments = relatedPayments(state, lead.id, project)
    const hasReceipt = payments.some((payment) => payment.receiptUrl) || state.files.some((file) => file.leadId === lead.id && file.paymentId && !file.deletedAt)
    const overdue = Boolean(lead.nextContactAt && new Date(lead.nextContactAt) < new Date())
    const haystack = `${displayName(lead)} ${lead.fullName} ${lead.email} ${lead.phone} ${lead.whatsapp} ${lead.city} ${lead.serviceInterest} ${quote?.quoteNumber ?? ''} ${project?.projectCode ?? ''}`.toLowerCase()
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false
    if (quickFilter === 'action') return overdue || !lead.nextContactAt
    if (quickFilter === 'overdue') return overdue
    if (quickFilter === 'no-activity') return !lead.nextContactAt
    if (quickFilter === 'with-quote') return Boolean(quote)
    if (quickFilter === 'waiting-deposit') return lead.pipelineStage === 'Aguardando entrada' || payments.some((payment) => ['Pendente', 'Prevista'].includes(payment.status))
    if (quickFilter === 'paid') return payments.some((payment) => payment.status === 'Recebida')
    if (quickFilter === 'no-receipt') return payments.some((payment) => payment.status === 'Recebida') && !hasReceipt
    if (quickFilter === 'with-project') return Boolean(project)
    if (quickFilter === 'confirmed-no-project') return lead.pipelineStage === 'Serviço confirmado' && !project
    return true
  }), [activeLeads, quickFilter, search, state])

  const activeQuotes = state.quotes.filter((quote) => !quote.archivedAt && !quote.deletedAt && !['Cancelada', 'Recusada', 'Expirada'].includes(quote.status))
  const potentialValue = activeLeads.reduce((total, lead) => total + lead.estimatedValue, 0)
  const contactsNeedingAction = activeLeads.filter((lead) => !lead.nextContactAt || new Date(lead.nextContactAt) < new Date()).length

  const scrollBoard = (direction: -1 | 1) => boardRef.current?.scrollBy({ left: direction * 620, behavior: 'smooth' })

  return (
    <div className="crm-page space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a7900]">Relacionamento comercial</p>
            <h1 className="mt-1 text-2xl font-black text-gray-950">CRM</h1>
            <p className="mt-1 text-sm text-gray-500">Gerencie contatos, negociações e próximas ações.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" type="button" onClick={() => onCreateTask()}><CheckCircle2 size={16} /> Nova tarefa</Button><Button type="button" onClick={onCreateLead}><Plus size={16} /> Novo contato</Button></div>
        </div>
        <div className="crm-metrics mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['Contatos ativos', activeLeads.length],
            ['Valor potencial', formatCurrency(potentialValue)],
            ['Propostas abertas', activeQuotes.length],
            ['Precisam de ação', contactsNeedingAction],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <p className="text-[0.65rem] font-bold uppercase text-gray-500">{label}</p>
              <p className="mt-1 truncate text-base font-black text-gray-950">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full rounded-lg bg-gray-100 p-1 sm:w-auto">
            {([
              ['kanban', 'Quadro', LayoutGrid],
              ['table', 'Lista', Table2],
              ['tasks', 'Minhas tarefas', CheckCircle2],
            ] as const).map(([value, label, Icon]) => (
              <button key={value} className={`focus-ring inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-bold sm:flex-none ${view === value ? 'bg-white text-gray-950 shadow-sm' : 'text-gray-500'}`} type="button" onClick={() => onViewChange(value)}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row xl:justify-end">
            <label className="relative min-w-0 flex-1 xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-3 text-gray-400" size={17} />
              <input className="field-input field-input-with-leading-icon" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, cidade, proposta ou projeto…" />
            </label>
            <select className="field-input sm:max-w-[15rem]" aria-label="Filtro rápido" value={quickFilter} onChange={(event) => setQuickFilter(event.target.value as QuickFilter)}>
              <option value="all">Todos</option>
              <option value="action">Precisa de ação</option>
              <option value="overdue">Atrasados</option>
              <option value="no-activity">Sem próxima atividade</option>
              <option value="with-quote">Com proposta</option>
              <option value="waiting-deposit">Aguardando entrada</option>
              <option value="paid">Entrada paga</option>
              <option value="no-receipt">Sem comprovante</option>
              <option value="with-project">Com projeto</option>
              <option value="confirmed-no-project">Confirmado sem projeto</option>
            </select>
          </div>
        </div>
      </section>

      {view === 'kanban' ? (
        <section className="crm-board-shell relative">
          <div className="mb-2 flex items-center justify-between gap-3 lg:hidden">
            <select className="field-input" value={mobileColumn} onChange={(event) => setMobileColumn(event.target.value)}>
              {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
            </select>
          </div>
          <button aria-label="Rolar quadro para a esquerda" className="crm-scroll-button left-2" type="button" onClick={() => scrollBoard(-1)}><ArrowLeft size={19} /></button>
          <button aria-label="Rolar quadro para a direita" className="crm-scroll-button right-2" type="button" onClick={() => scrollBoard(1)}><ArrowRight size={19} /></button>
          <div ref={boardRef} className="crm-board" tabIndex={0}>
            {columns.map((column) => {
              const columnLeads = filtered.filter((lead) => column.stages.includes(lead.pipelineStage))
              const value = columnLeads.reduce((total, lead) => total + lead.estimatedValue, 0)
              return (
                <section
                  key={column.id}
                  className={`crm-pipeline-column ${mobileColumn === column.id ? 'is-mobile-active' : ''}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const leadId = event.dataTransfer.getData('lead-id')
                    if (leadId) onMoveLead(leadId, column.target)
                  }}
                >
                  <header className="crm-column-header">
                    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black text-gray-950">{column.title}</h2><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{columnLeads.length}</span></div>
                    <p className="mt-1 text-xs text-gray-500">{formatCurrency(value)}</p>
                  </header>
                  <div className="crm-column-body">
                    {columnLeads.map((lead) => (
                      <OpportunityCard
                        key={lead.id}
                        lead={lead}
                        state={state}
                        onOpen={onOpenLead}
                        onEdit={onEditLead}
                        onDelete={onDeleteLead}
                        onAttachReceipt={onAttachReceipt}
                        onGenerateProposal={onGenerateProposal}
                        onRegisterInteraction={onRegisterInteraction}
                        onScheduleReturn={onScheduleReturn}
                        onRegisterDeposit={onRegisterDeposit}
                        onCreateProject={onCreateProject}
                      />
                    ))}
                    {!columnLeads.length ? <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">Nenhum contato.</div> : null}
                  </div>
                </section>
              )
            })}
          </div>
        </section>
      ) : null}

      {view === 'table' ? (
        <CrmTable
          leads={filtered}
          state={state}
          onOpen={onOpenLead}
          onEdit={onEditLead}
          onDelete={onDeleteLead}
          onAttachReceipt={onAttachReceipt}
          onGenerateProposal={onGenerateProposal}
          onRegisterInteraction={onRegisterInteraction}
          onScheduleReturn={onScheduleReturn}
          onRegisterDeposit={onRegisterDeposit}
          onCreateProject={onCreateProject}
        />
      ) : null}
      {view === 'tasks' ? <TaskView state={state} onOpenLead={onOpenLead} onCreate={onCreateTask} onComplete={onCompleteTask} onCancel={onCancelTask} /> : null}

      {selectedLead ? (
        <ContactDrawer
          lead={selectedLead}
          state={state}
          onClose={onCloseLead}
          onEdit={onEditLead}
          onDelete={onDeleteLead}
          onAttachReceipt={onAttachReceipt}
          onGenerateProposal={onGenerateProposal}
          onRegisterInteraction={onRegisterInteraction}
          onScheduleReturn={onScheduleReturn}
          onRegisterDeposit={onRegisterDeposit}
          onDownloadQuote={onDownloadQuote}
          onApproveQuote={onApproveQuote}
          onMarkPaymentPaid={onMarkPaymentPaid}
          onCreateProject={onCreateProject}
          onCreateTask={onCreateTask}
          onCompleteTask={onCompleteTask}
          onCancelTask={onCancelTask}
        />
      ) : null}
    </div>
  )
}

function OpportunityCard({ lead, state, onOpen, onEdit, onDelete, onAttachReceipt, onGenerateProposal, onRegisterInteraction, onScheduleReturn, onRegisterDeposit, onCreateProject }: {
  lead: Lead
  state: AppState
  onOpen: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onAttachReceipt: (payment: Payment) => void
  onGenerateProposal: (clientId: string, leadId?: string) => void
  onRegisterInteraction: (lead: Lead, type: string) => void
  onScheduleReturn: (lead: Lead) => void
  onRegisterDeposit: (quote: Quote) => void
  onCreateProject: (lead: Lead) => void
}) {
  const quote = newestQuote(state, lead.id)
  const overdue = Boolean(lead.nextContactAt && new Date(lead.nextContactAt) < new Date())
  const nextAction = lead.nextContactAt ? `${overdue ? 'Atrasada' : 'Próxima ação'} · ${formatDateTime(lead.nextContactAt)}` : 'Sem próxima atividade'

  const stop = (event: MouseEvent) => event.stopPropagation()
  return (
    <article className="crm-opportunity-card" draggable onDragStart={(event) => event.dataTransfer.setData('lead-id', lead.id)} onClick={() => onOpen(lead)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="truncate font-black text-gray-950">{displayName(lead)}</h3><p className="truncate text-xs text-gray-500">{displayDetail(lead)}</p></div>
        {overdue || !lead.nextContactAt ? <AlertCircle className={overdue ? 'text-red-600' : 'text-amber-600'} size={17} aria-label="Contato precisa de ação" /> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm text-gray-600">{lead.serviceInterest}</p>{quote ? <p className="mt-1 truncate text-xs text-gray-500"><FileText className="mr-1 inline" size={12} />{quote.status}</p> : null}</div>
        <strong className="shrink-0 text-sm text-gray-950">{formatCurrency(lead.estimatedValue)}</strong>
      </div>
      <div className={`mt-3 flex items-center gap-2 rounded-md px-2.5 py-2 text-xs ${overdue ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>
        <Clock3 className="shrink-0" size={13} /><span className="truncate">{nextAction}</span>
      </div>
      <footer className="mt-2 flex items-start justify-end gap-1 border-t border-gray-100 pt-2">
        <ContactShortcuts
          lead={lead}
          state={state}
          onEdit={onEdit}
          onDelete={onDelete}
          onAttachReceipt={onAttachReceipt}
          onGenerateProposal={onGenerateProposal}
          onRegisterInteraction={onRegisterInteraction}
          onScheduleReturn={onScheduleReturn}
          onRegisterDeposit={onRegisterDeposit}
          onCreateProject={onCreateProject}
        />
        <button className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" type="button" onClick={(event) => { stop(event); onDelete(lead) }}><Trash2 size={13} /> Excluir</button>
      </footer>
    </article>
  )
}

function ContactShortcuts({ lead, state, onEdit, onDelete, onAttachReceipt, onGenerateProposal, onRegisterInteraction, onScheduleReturn, onRegisterDeposit, onCreateProject }: {
  lead: Lead
  state: AppState
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onAttachReceipt: (payment: Payment) => void
  onGenerateProposal: (clientId: string, leadId?: string) => void
  onRegisterInteraction: (lead: Lead, type: string) => void
  onScheduleReturn: (lead: Lead) => void
  onRegisterDeposit: (quote: Quote) => void
  onCreateProject: (lead: Lead) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const quotes = state.quotes.filter((quote) => quote.leadId === lead.id && !quote.deletedAt && !quote.archivedAt)
  const quoteForDeposit = quotes.find((quote) => ['Aprovada', 'Aguardando entrada', 'Entrada recebida'].includes(quote.status))
  const project = currentProject(state, lead.id)
  const payments = relatedPayments(state, lead.id, project)
  const receiptTarget = payments.find((payment) => !payment.receiptUrl) ?? payments[0]
  const run = (action: () => void) => {
    setOpen(false)
    action()
  }
  const shortcutClass = 'flex min-h-9 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-100'

  useEffect(() => {
    if (!open) return

    const positionMenu = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const triggerRect = trigger.getBoundingClientRect()
      const menuWidth = menuRef.current?.offsetWidth ?? 192
      const menuHeight = menuRef.current?.offsetHeight ?? 320
      const left = Math.min(Math.max(8, triggerRect.right - menuWidth), window.innerWidth - menuWidth - 8)
      const spaceBelow = window.innerHeight - triggerRect.bottom - 8
      const top = spaceBelow >= menuHeight
        ? triggerRect.bottom + 4
        : Math.max(8, triggerRect.top - menuHeight - 4)
      setMenuPosition({ left, top })
    }
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    positionMenu()
    const animationFrame = window.requestAnimationFrame(positionMenu)
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [open])

  return (
    <div
      className="relative"
      onClick={(event) => event.stopPropagation()}
    >
      <button ref={triggerRef} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        Atalhos <ChevronDown className={`transition ${open ? 'rotate-180' : ''}`} size={13} />
      </button>
      {open ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] w-48 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl"
          role="menu"
          style={{ left: menuPosition.left, top: menuPosition.top }}
          onClick={(event) => event.stopPropagation()}
        >
          {lead.whatsapp ? <a className={shortcutClass} href={whatsappLink(lead.whatsapp)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><MessageCircle size={15} /> WhatsApp</a> : null}
          {lead.phone ? <a className={shortcutClass} href={phoneLink(lead.phone)} onClick={() => setOpen(false)}><Phone size={15} /> Ligar</a> : null}
          <button className={shortcutClass} type="button" onClick={() => run(() => onRegisterInteraction(lead, 'Contato realizado'))}><MessageCircle size={15} /> Registrar atividade</button>
          <button className={shortcutClass} type="button" onClick={() => run(() => onScheduleReturn(lead))}><CalendarDays size={15} /> Agendar retorno</button>
          <button className={shortcutClass} type="button" onClick={() => run(() => onGenerateProposal('', lead.id))}><FileText size={15} /> Gerar proposta</button>
          {quoteForDeposit ? <button className={shortcutClass} type="button" onClick={() => run(() => onRegisterDeposit(quoteForDeposit))}><CircleDollarSign size={15} /> Registrar entrada</button> : null}
          {receiptTarget ? <button className={shortcutClass} type="button" onClick={() => run(() => onAttachReceipt(receiptTarget))}><Paperclip size={15} /> {receiptTarget.receiptUrl ? 'Ver comprovante' : 'Anexar comprovante'}</button> : null}
          {lead.pipelineStage === 'Serviço confirmado' && !project ? <button className={shortcutClass} type="button" onClick={() => run(() => onCreateProject(lead))}><Briefcase size={15} /> Criar projeto</button> : null}
          <div className="my-1 border-t border-gray-100" />
          <button className={shortcutClass} type="button" onClick={() => run(() => onEdit(lead))}><SlidersHorizontal size={15} /> Editar contato</button>
          <button className={`${shortcutClass} text-red-600 hover:bg-red-50`} type="button" onClick={() => run(() => onDelete(lead))}><Trash2 size={15} /> Excluir contato</button>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

function CrmTable({ leads, state, onOpen, onEdit, onDelete, onAttachReceipt, onGenerateProposal, onRegisterInteraction, onScheduleReturn, onRegisterDeposit, onCreateProject }: {
  leads: Lead[]
  state: AppState
  onOpen: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onAttachReceipt: (payment: Payment) => void
  onGenerateProposal: (clientId: string, leadId?: string) => void
  onRegisterInteraction: (lead: Lead, type: string) => void
  onScheduleReturn: (lead: Lead) => void
  onRegisterDeposit: (quote: Quote) => void
  onCreateProject: (lead: Lead) => void
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead><tr><th>Contato</th><th>Etapa</th><th>Serviço</th><th>Valor</th><th>Próxima ação</th><th>Ações</th></tr></thead>
          <tbody>{leads.map((lead) => {
            return <tr key={lead.id} className="cursor-pointer" onClick={() => onOpen(lead)}>
              <td data-label="Contato"><strong>{displayName(lead)}</strong><p className="text-xs text-gray-500">{lead.phone || lead.email || lead.city}</p></td>
              <td data-label="Etapa"><StatusBadge>{lead.pipelineStage}</StatusBadge></td>
              <td data-label="Serviço">{lead.serviceInterest}</td><td data-label="Valor">{formatCurrency(lead.estimatedValue)}</td>
              <td data-label="Próxima ação">{lead.nextContactAt ? formatDateTime(lead.nextContactAt) : 'Não definida'}</td>
              <td data-label="Ações">
                <div className="flex items-start gap-1" onClick={(event) => event.stopPropagation()}>
                  <ContactShortcuts
                    lead={lead}
                    state={state}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAttachReceipt={onAttachReceipt}
                    onGenerateProposal={onGenerateProposal}
                    onRegisterInteraction={onRegisterInteraction}
                    onScheduleReturn={onScheduleReturn}
                    onRegisterDeposit={onRegisterDeposit}
                    onCreateProject={onCreateProject}
                  />
                  <button className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" onClick={() => onDelete(lead)}><Trash2 size={14} /> Excluir</button>
                </div>
              </td>
            </tr>
          })}</tbody>
        </table>
      </div>
    </section>
  )
}

function TaskView({ state, onOpenLead, onCreate, onComplete, onCancel }: { state: AppState; onOpenLead: (lead: Lead) => void; onCreate: (lead?: Lead) => void; onComplete: (task: TaskItem) => void; onCancel: (task: TaskItem) => void }) {
  const buckets = ['Atrasadas', 'Hoje', 'Amanhã', 'Próximos sete dias', 'Sem data', 'Concluídas recentemente']
  return <div className="space-y-3"><div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"><div><h2 className="font-black text-gray-950">Tarefas dos contatos</h2><p className="text-xs text-gray-500">Próximas ações avulsas e operacionais.</p></div><Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onCreate()}><Plus size={15} /> Nova tarefa</Button></div><div className="grid gap-3 xl:grid-cols-2">{buckets.map((bucket) => {
    const tasks = state.tasks.filter((task) => task.status !== 'Cancelada' && taskBucket(task) === bucket).slice(0, bucket === 'Concluídas recentemente' ? 8 : undefined)
    return <section key={bucket} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-black text-gray-950">{bucket}</h2><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{tasks.length}</span></div><div className="mt-3 space-y-2">{tasks.map((task) => {
      const lead = task.leadId ? state.leads.find((item) => item.id === task.leadId) : undefined
      const client = task.clientId ? state.clients.find((item) => item.id === task.clientId) : undefined
      const responsible = task.responsibleUserId ? state.users.find((item) => item.id === task.responsibleUserId) : undefined
      return <article key={task.id} className="rounded-lg border border-gray-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-gray-950">{task.title}</strong><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-black text-gray-600">{task.taskType || 'Tarefa'}</span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-black text-amber-700">{task.priority}</span></div><p className="mt-1 text-xs text-gray-500">{lead ? displayName(lead) : client ? client.companyName || client.fullName : 'Sem contato'} · {task.dueAt ? formatDateTime(task.dueAt) : 'Sem data'}</p>{task.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-600">{task.description}</p> : null}<p className="mt-1 text-[0.68rem] text-gray-400">{responsible?.name || 'Sem responsável'} · {task.durationMinutes || 30} min</p></div>{task.status === 'Concluída' ? <CheckCircle2 className="shrink-0 text-emerald-600" size={18} /> : <div className="flex shrink-0 gap-1"><button className="focus-ring rounded-lg bg-emerald-50 p-2 text-emerald-700" aria-label="Concluir tarefa" type="button" onClick={() => onComplete(task)}><Check size={17} /></button><button className="focus-ring rounded-lg bg-gray-100 p-2 text-gray-500" aria-label="Cancelar tarefa" type="button" onClick={() => onCancel(task)}><X size={17} /></button></div>}</div><div className="mt-2 flex gap-3">{lead ? <button className="text-xs font-bold text-[#866800]" type="button" onClick={() => onOpenLead(lead)}>Abrir contato</button> : null}{lead?.whatsapp ? <a className="text-xs font-bold text-emerald-700" href={whatsappLink(lead.whatsapp)} target="_blank" rel="noreferrer">WhatsApp</a> : null}</div></article>
    })}{!tasks.length ? <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Nada por aqui.</p> : null}</div></section>
  })}</div></div>
}

function ContactDrawer({ lead, state, onClose, onEdit, onDelete, onAttachReceipt, onGenerateProposal, onRegisterInteraction, onScheduleReturn, onRegisterDeposit, onDownloadQuote, onApproveQuote, onMarkPaymentPaid, onCreateProject, onCreateTask, onCompleteTask, onCancelTask }: {
  lead: Lead
  state: AppState
  onClose: () => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onAttachReceipt: (payment: Payment) => void
  onGenerateProposal: (clientId: string, leadId?: string) => void
  onRegisterInteraction: (lead: Lead, type: string) => void
  onScheduleReturn: (lead: Lead) => void
  onRegisterDeposit: (quote: Quote) => void
  onDownloadQuote: (quote: Quote) => void | Promise<void>
  onApproveQuote: (quote: Quote) => void
  onMarkPaymentPaid: (payment: Payment) => void
  onCreateProject: (lead: Lead) => void
  onCreateTask: (lead?: Lead) => void
  onCompleteTask: (task: TaskItem) => void
  onCancelTask: (task: TaskItem) => void
}) {
  const [tab, setTab] = useState<DrawerTab>('overview')
  const [previewQuoteId, setPreviewQuoteId] = useState('')
  const [previewFile, setPreviewFile] = useState<{ fileName: string; url: string; mode: FilePreviewMode } | null>(null)
  const quotes = state.quotes.filter((quote) => quote.leadId === lead.id && !quote.deletedAt)
  const projects = state.projects.filter((project) => project.leadId === lead.id && !project.deletedAt)
  const payments = state.payments.filter((payment) => !payment.deletedAt && !payment.archivedAt && (payment.leadId === lead.id || projects.some((project) => project.id === payment.projectId)))
  const files = state.files.filter((file) => !file.deletedAt && (file.leadId === lead.id || projects.some((project) => project.id === file.projectId)))
  const tasks = state.tasks.filter((task) => task.leadId === lead.id && task.status !== 'Cancelada').sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const quoteForDeposit = quotes.find((quote) => ['Aprovada', 'Aguardando entrada', 'Entrada recebida'].includes(quote.status))
  const receiptTarget = payments.find((payment) => !payment.receiptUrl && !files.some((file) => file.paymentId === payment.id)) ?? payments[0]
  const timeline = [
    ...state.leadInteractions.filter((item) => item.leadId === lead.id).map((item) => ({ id: item.id, at: item.interactionDate, title: item.interactionType, description: item.description })),
    ...state.statusHistory.filter((item) => (item.entityType === 'Contato' && item.entityId === lead.id) || quotes.some((quote) => item.entityType === 'Proposta' && item.entityId === quote.id) || projects.some((project) => item.entityType === 'Projeto' && item.entityId === project.id)).map((item) => ({ id: item.id, at: item.createdAt, title: item.action, description: item.details })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return <>
    <button className="fixed inset-0 z-40 cursor-default bg-black/20" aria-label="Fechar detalhes" type="button" onClick={onClose} />
    <aside className="crm-contact-drawer">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase text-gray-500">Contato e oportunidade</p><h2 className="mt-1 truncate text-xl font-black text-gray-950">{displayName(lead)}</h2><p className="text-sm text-gray-500">{lead.fullName || lead.city}</p></div><button className="focus-ring rounded-lg p-2 hover:bg-gray-100" aria-label="Fechar" type="button" onClick={onClose}><X size={20} /></button></div>
        <div className="mt-3 flex flex-wrap gap-2"><StatusBadge>{lead.pipelineStage}</StatusBadge><StatusBadge>{lead.temperature}</StatusBadge>{currentProject(state, lead.id) ? <StatusBadge>Com projeto</StatusBadge> : null}</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {lead.whatsapp ? <a className="crm-drawer-action" href={whatsappLink(lead.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={17} /><span>WhatsApp</span></a> : null}
          {lead.phone ? <a className="crm-drawer-action" href={phoneLink(lead.phone)}><Phone size={17} /><span>Ligar</span></a> : null}
          {lead.email ? <a className="crm-drawer-action" href={`mailto:${lead.email}`}><Mail size={17} /><span>E-mail</span></a> : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" type="button" onClick={() => onEdit(lead)}><SlidersHorizontal size={16} /> Editar</Button>
          <Button variant="danger" type="button" onClick={() => onDelete(lead)}><Trash2 size={16} /> Excluir contato</Button>
        </div>
      </header>
      <nav className="flex overflow-x-auto border-b border-gray-200 bg-white px-2">{([
        ['overview', 'Visão geral'], ['activities', 'Atividades'], ['tasks', 'Tarefas'], ['quotes', 'Propostas'], ['projects', 'Projetos'], ['finance', 'Financeiro'], ['files', 'Arquivos'],
      ] as Array<[DrawerTab, string]>).map(([value, label]) => <button key={value} className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-xs font-bold ${tab === value ? 'border-[#d8a500] text-gray-950' : 'border-transparent text-gray-500'}`} type="button" onClick={() => setTab(value)}>{label}</button>)}</nav>
      <div className="space-y-4 p-4">
        {tab === 'overview' ? <>
          <div className="grid grid-cols-2 gap-2">{[['Valor potencial', formatCurrency(lead.estimatedValue)], ['Próxima ação', lead.nextContactAt ? formatDateTime(lead.nextContactAt) : 'Não definida'], ['Serviço', lead.serviceInterest], ['Origem', lead.source]].map(([label, value]) => <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-[0.68rem] font-bold uppercase text-gray-500">{label}</p><p className="mt-1 text-sm font-black text-gray-950">{value}</p></div>)}</div>
          <section><h3 className="text-sm font-black text-gray-950">Ações principais</h3><div className="mt-2 grid gap-2 sm:grid-cols-2"><Button type="button" onClick={() => onRegisterInteraction(lead, 'Contato realizado')}><MessageCircle size={16} /> Registrar atividade</Button><Button variant="secondary" type="button" onClick={() => onCreateTask(lead)}><CheckCircle2 size={16} /> Criar tarefa</Button><Button variant="secondary" type="button" onClick={() => onScheduleReturn(lead)}><CalendarDays size={16} /> Agendar retorno</Button><Button variant="secondary" type="button" onClick={() => onGenerateProposal('', lead.id)}><FileText size={16} /> Gerar proposta</Button>{quoteForDeposit ? <Button variant="secondary" type="button" onClick={() => onRegisterDeposit(quoteForDeposit)}><CircleDollarSign size={16} /> Registrar entrada</Button> : null}{receiptTarget ? <Button variant="secondary" type="button" onClick={() => receiptTarget.receiptUrl ? setPreviewFile({ fileName: `${receiptTarget.paymentType} comprovante`, url: receiptTarget.receiptUrl, mode: getFilePreviewMode(receiptTarget.receiptUrl) }) : onAttachReceipt(receiptTarget)}><Paperclip size={16} /> {receiptTarget.receiptUrl ? 'Ver comprovante' : 'Anexar comprovante'}</Button> : null}{lead.pipelineStage === 'Serviço confirmado' && !currentProject(state, lead.id) ? <Button className="sm:col-span-2" type="button" onClick={() => onCreateProject(lead)}><Briefcase size={16} /> Criar projeto</Button> : null}</div></section>
          <section><h3 className="text-sm font-black text-gray-950">Contato</h3><dl className="mt-2 space-y-2 rounded-lg border border-gray-200 p-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Telefone</dt><dd className="font-bold text-gray-950">{lead.whatsapp || lead.phone || 'Não informado'}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">E-mail</dt><dd className="break-all text-right font-bold text-gray-950">{lead.email || 'Não informado'}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Local</dt><dd className="text-right font-bold text-gray-950">{lead.city || 'Não informado'}</dd></div></dl></section>
        </> : null}
        {tab === 'activities' ? <Timeline items={timeline} /> : null}
        {tab === 'tasks' ? <section className="space-y-2"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-gray-950">Tarefas do contato</h3><p className="text-xs text-gray-500">Ações com prazo e responsável.</p></div><Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onCreateTask(lead)}><Plus size={14} /> Nova</Button></div>{tasks.map((task) => <article key={task.id} className="rounded-lg border border-gray-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-gray-950">{task.title}</strong><StatusBadge>{task.status}</StatusBadge></div><p className="mt-1 text-xs text-gray-500">{task.taskType || 'Tarefa'} · {formatDateTime(task.dueAt)} · {task.priority}</p>{task.description ? <p className="mt-1 text-xs text-gray-600">{task.description}</p> : null}</div>{task.status !== 'Concluída' ? <div className="flex shrink-0 gap-1"><button className="rounded-lg bg-emerald-50 p-2 text-emerald-700" type="button" aria-label="Concluir tarefa" onClick={() => onCompleteTask(task)}><Check size={16} /></button><button className="rounded-lg bg-gray-100 p-2 text-gray-500" type="button" aria-label="Cancelar tarefa" onClick={() => onCancelTask(task)}><X size={16} /></button></div> : <CheckCircle2 className="shrink-0 text-emerald-600" size={18} />}</div></article>)}{!tasks.length ? <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Nenhuma tarefa vinculada.</p> : null}</section> : null}
        {tab === 'quotes' ? <DrawerList empty="Nenhuma proposta vinculada.">{quotes.map((quote) => {
          const quoteItems = state.quoteItems.filter((item) => item.quoteId === quote.id)
          const previewOpen = previewQuoteId === quote.id
          const canApprove = ['Rascunho', 'Gerada', 'Enviada', 'Visualizada', 'Em negociação'].includes(quote.status) && quoteItems.length > 0 && quote.totalValue > 0
          return <article key={quote.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-3"><strong>{quote.quoteNumber}</strong><StatusBadge>{quote.status}</StatusBadge></div>
            <p className="mt-2 text-sm text-gray-500">{formatCurrency(quote.totalValue)} · validade {formatDate(quote.expirationDate)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button className="min-h-9 px-2 py-1 text-xs" variant="secondary" type="button" onClick={() => setPreviewQuoteId(previewOpen ? '' : quote.id)}><Eye size={14} /> {previewOpen ? 'Fechar' : 'Visualizar'}</Button>
              <Button className="min-h-9 px-2 py-1 text-xs" variant="secondary" type="button" onClick={() => onDownloadQuote(quote)}><Download size={14} /> Baixar PDF</Button>
              {canApprove ? <Button className="col-span-2 min-h-9 px-2 py-1 text-xs" type="button" onClick={() => onApproveQuote(quote)}><CheckCircle2 size={14} /> Marcar proposta como aceita</Button> : null}
            </div>
            {previewOpen ? <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3">
              {quote.notes ? <div><p className="text-[0.68rem] font-black uppercase text-gray-500">Proposta</p><p className="mt-1 whitespace-pre-line text-sm font-bold text-gray-900">{quote.notes}</p></div> : null}
              <div><p className="text-[0.68rem] font-black uppercase text-gray-500">Itens</p><div className="mt-1 space-y-1">{quoteItems.map((item) => <div key={item.id} className="flex justify-between gap-3 text-xs"><span>{item.quantity}x {item.description}</span><strong className="whitespace-nowrap">{formatCurrency(item.totalPrice)}</strong></div>)}</div></div>
              <div className="border-t border-gray-200 pt-2 text-xs"><div className="flex justify-between"><span>Sinal</span><strong>{formatCurrency(quote.depositValue)}</strong></div><div className="mt-1 flex justify-between text-sm"><span className="font-black">Total</span><strong>{formatCurrency(quote.totalValue)}</strong></div><p className="mt-2 text-gray-500">Entrega em até 7 dias após a captação.</p></div>
            </div> : null}
          </article>
        })}</DrawerList> : null}
        {tab === 'projects' ? <DrawerList empty="Nenhum projeto vinculado.">{projects.map((project) => <div key={project.id} className="rounded-lg border border-gray-200 p-3"><div className="flex items-center justify-between gap-3"><strong>{project.projectCode}</strong><StatusBadge>{project.projectStatus}</StatusBadge></div><p className="mt-2 text-sm text-gray-500">{project.name} · {formatCurrency(project.totalValue)}</p></div>)}</DrawerList> : null}
        {tab === 'finance' ? <DrawerList empty="Nenhum lançamento vinculado.">{payments.map((payment) => {
          const receiptFile = files.find((file) => file.paymentId === payment.id && !file.deletedAt)
          const receiptUrl = payment.receiptUrl || receiptFile?.fileUrl || receiptFile?.externalLink || ''
          const hasReceipt = Boolean(receiptUrl)
          const receiptMode = getFilePreviewMode(receiptUrl, `${receiptFile?.fileType || ''} ${receiptFile?.fileName || ''}`)
          const paid = payment.status === 'Recebida'
          const paidLabel = payment.paymentType === 'Sinal' ? 'Marcar sinal pago' : payment.paymentType === 'Pagamento final' ? 'Marcar final pago' : 'Marcar como pago'
          return <article key={payment.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-3"><strong>{payment.paymentType} · {formatCurrency(payment.amount)}</strong><StatusBadge>{payment.status}</StatusBadge></div>
            <p className="mt-2 text-sm text-gray-500">{paid && payment.paidAt ? `Recebido em ${formatDate(payment.paidAt)}` : `Vencimento ${formatDate(payment.dueDate)}`} · {hasReceipt ? 'com comprovante' : 'sem comprovante'}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {hasReceipt ? <Button className="min-h-10 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => setPreviewFile({ fileName: receiptFile?.fileName || `${payment.paymentType} comprovante`, url: receiptUrl, mode: receiptMode })}><Eye size={15} /> Abrir comprovante</Button> : null}
              {paid ? <Button className="min-h-10 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onMarkPaymentPaid(payment)}><X size={15} /> Desmarcar como pago</Button> : <Button className="min-h-10 px-3 py-1 text-xs" type="button" onClick={() => onMarkPaymentPaid(payment)}><Check size={15} /> {paidLabel}</Button>}
              <Button className="min-h-10 px-3 py-1 text-xs" variant="secondary" type="button" onClick={() => onAttachReceipt(payment)}><Paperclip size={15} /> {hasReceipt ? 'Anexar novo comprovante' : 'Anexar comprovante'}</Button>
            </div>
          </article>
        })}</DrawerList> : null}
        {tab === 'files' ? <DrawerList empty="Nenhum arquivo vinculado.">{files.map((file) => {
          const fileUrl = file.fileUrl || file.externalLink || ''
          const previewMode = getFilePreviewMode(fileUrl, `${file.fileType} ${file.fileName}`)
          return (
            <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm font-bold text-gray-950">
              <button
                className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-emerald-700"
                type="button"
                onClick={() => {
                  if (!fileUrl) return
                  setPreviewFile({ fileName: file.fileName, url: fileUrl, mode: previewMode })
                }}
              >
                <Paperclip size={16} />
                <span className="truncate">{file.fileName}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {fileUrl ? (
                  <>
                    <button
                      aria-label={`Visualizar ${file.fileName}`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[0.65rem] font-bold text-gray-700 hover:bg-gray-50"
                      type="button"
                      onClick={() => setPreviewFile({ fileName: file.fileName, url: fileUrl, mode: previewMode })}
                    >
                      <Eye size={12} /> Visualizar
                    </button>
                    <button
                      aria-label={`Baixar ${file.fileName}`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[0.65rem] font-bold text-gray-700 hover:bg-gray-50"
                      type="button"
                      onClick={() => downloadUrl(fileUrl, file.fileName)}
                    >
                      <Download size={12} /> Baixar
                    </button>
                  </>
                ) : null}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-black text-gray-500">{file.receiptStatus || file.fileType}</span>
              </div>
            </div>
          )
        })}</DrawerList> : null}
      </div>
    </aside>
    {previewFile ? createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3">
        <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Arquivo</p>
              <p className="truncate text-base font-black text-gray-950">{previewFile.fileName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => openUrlInNewTab(previewFile.url)}><ArrowRight size={15} /> Abrir em nova aba</Button>
              <Button variant="secondary" type="button" onClick={() => downloadUrl(previewFile.url, previewFile.fileName)}><Download size={15} /> Baixar</Button>
              <Button variant="ghost" type="button" onClick={() => setPreviewFile(null)}>Fechar</Button>
            </div>
          </div>
          <div className="bg-gray-100 p-3">
            {previewFile.mode === 'image' ? (
              <img className="max-h-[75vh] w-full object-contain" src={previewFile.url} alt={previewFile.fileName} />
            ) : previewFile.mode === 'pdf' ? (
              <iframe className="h-[75vh] w-full rounded-xl bg-white" src={getBrowserSafeFileUrl(previewFile.url)} title={previewFile.fileName} />
            ) : (
              <div className="flex min-h-[35vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
                <p className="text-sm text-gray-600">Este arquivo será aberto em uma nova aba. Você também pode baixá-lo.</p>
                <Button type="button" onClick={() => openUrlInNewTab(previewFile.url)}><ArrowRight size={15} /> Abrir arquivo</Button>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body,
    ) : null}
  </>
}

function DrawerList({ children, empty }: { children: ReactNode; empty: string }) {
  return <div className="space-y-2">{children || <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">{empty}</p>}</div>
}

function Timeline({ items }: { items: Array<{ id: string; at: string; title: string; description: string }> }) {
  return <div className="space-y-4">{items.map((item) => <div key={item.id} className="relative border-l-2 border-gray-200 pl-4 before:absolute before:-left-[5px] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-[#d8a500]"><strong className="text-sm text-gray-950">{item.title}</strong><p className="mt-0.5 text-xs text-gray-500">{formatDateTime(item.at)}</p><p className="mt-1 text-sm leading-6 text-gray-600">{item.description}</p></div>)}{!items.length ? <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Nenhuma atividade registrada.</p> : null}</div>
}
