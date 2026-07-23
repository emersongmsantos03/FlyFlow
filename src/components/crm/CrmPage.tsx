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
  ExternalLink,
  Eye,
  FileText,
  Globe2,
  LayoutGrid,
  Mail,
  MapPin,
  MessageCircle,
  Paperclip,
  Phone,
  Plus,
  Search,
  Sparkles,
  SlidersHorizontal,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatDate, formatDateTime, phoneLink, whatsappLink } from '../../lib/format'
import { buildGoogleBusinessUrl, buildInstagramUrl, leadOpportunitySummary } from '../../services/leadHunter/LeadOpportunityService'
import { buildCommercialActionQueue, buildCommercialInsights } from '../../services/commercial/CommercialPriorityService'
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
  | 'stalled'

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

const buildPriorityWhatsAppMessage = (lead: Lead) => {
  const data = lead.leadHunterData
  const company = displayName(lead)
  const contactName = data?.contactName?.trim()
  const greeting = contactName && contactName.toLocaleLowerCase('pt-BR') !== company.toLocaleLowerCase('pt-BR')
    ? `Olá, ${contactName.split(/\s+/)[0]}! Tudo bem?`
    : 'Olá! Tudo bem?'

  return [
    greeting,
    'Sou o Emerson, da Hero Drone. Produzimos fotos, vídeos e imagens aéreas para mostrar espaços de uma forma mais marcante e profissional.',
    `Conheci a ${company} e achei que o ambiente de vocês tem muito potencial para um conteúdo visual especial.`,
    'Posso compartilhar a ideia que tive?',
  ].join(' ')
}

const whatsappContexts = [
  'Primeiro contato',
  'Acompanhamento',
  'Sem resposta',
  'Interesse demonstrado',
  'Enviar portfólio',
  'Enviar proposta',
  'Retomada',
] as const
type WhatsAppContext = (typeof whatsappContexts)[number]

const buildContextualWhatsAppMessage = (lead: Lead, context: WhatsAppContext) => {
  const firstMessage = buildPriorityWhatsAppMessage(lead)
  const company = displayName(lead)
  const contactName = lead.leadHunterData?.contactName?.trim()
  const greeting = contactName && contactName.toLocaleLowerCase('pt-BR') !== company.toLocaleLowerCase('pt-BR')
    ? `Olá, ${contactName.split(/\s+/)[0]}!`
    : 'Olá! Tudo bem?'
  const service = (lead.leadHunterData?.recommendedService || lead.serviceInterest || 'produção de imagens com drone').toLocaleLowerCase('pt-BR')
  const messages: Record<WhatsAppContext, string> = {
    'Primeiro contato': firstMessage,
    'Acompanhamento': `${greeting} Aqui é o Emerson, da Hero Drone. Passando para saber se você conseguiu ver minha mensagem sobre uma ideia de ${service} para a ${company}. Se fizer sentido, te explico de forma bem rápida por aqui.`,
    'Sem resposta': `${greeting} Prometo ser breve: se melhorar a apresentação visual da ${company} estiver nos planos, posso te enviar uma sugestão objetiva de ${service}. Caso não seja o momento, sem problema algum.`,
    'Interesse demonstrado': `${greeting} Que bom que a ideia fez sentido! Para eu preparar uma sugestão realmente útil para a ${company}, posso te fazer duas perguntas rápidas sobre o espaço e o objetivo do material?`,
    'Enviar portfólio': `${greeting} Separei algumas referências para você visualizar como um trabalho de ${service} pode valorizar a ${company}. Posso te enviar o portfólio e, se gostar da linha, preparo uma ideia específica para vocês.`,
    'Enviar proposta': `${greeting} Preparei uma proposta para a ${company} considerando o trabalho de ${service} que conversamos. Posso te enviar por aqui? Se quiser, também explico rapidamente cada etapa.`,
    'Retomada': `${greeting} Aqui é o Emerson, da Hero Drone. Retomando nosso contato sobre a ${company}: surgiu uma ideia de ${service} que pode funcionar muito bem para vocês. Ainda faz sentido conversarmos sobre isso?`,
  }
  return messages[context]
}
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
  onSendWhatsAppApproach,
  onSendEmail,
  onEmailQuote,
  onScheduleReturn,
  onRegisterDeposit,
  onDownloadQuote,
  onApproveQuote,
  onMarkPaymentPaid,
  onCreateProject,
  onCreateTask,
  onEditTask,
  onCompleteTask,
  onReopenTask,
  onCancelTask,
  onDeleteTask,
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
  onSendWhatsAppApproach: (lead: Lead, message: string, context: string) => void
  onSendEmail: (lead: Lead) => void
  onEmailQuote: (quote: Quote) => void | Promise<void>
  onScheduleReturn: (lead: Lead) => void
  onRegisterDeposit: (quote: Quote) => void
  onDownloadQuote: (quote: Quote) => void | Promise<void>
  onApproveQuote: (quote: Quote) => void
  onMarkPaymentPaid: (payment: Payment) => void
  onCreateProject: (lead: Lead) => void
  onCreateTask: (lead?: Lead) => void
  onEditTask: (task: TaskItem) => void
  onCompleteTask: (task: TaskItem) => void
  onReopenTask: (task: TaskItem) => void
  onCancelTask: (task: TaskItem) => void
  onDeleteTask: (task: TaskItem) => void
}) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')
  const [mobileColumn, setMobileColumn] = useState(columns[0].id)
  const [priorityLead, setPriorityLead] = useState<Lead>()
  const [whatsAppContext, setWhatsAppContext] = useState<WhatsAppContext>('Primeiro contato')
  const [whatsAppMessage, setWhatsAppMessage] = useState('')

  const activeLeads = useMemo(() => leads.filter((lead) => !lead.archived && !lead.deletedAt), [leads])
  const commercialInsights = useMemo(() => buildCommercialInsights(activeLeads, state), [activeLeads, state])
  const stalledIds = useMemo(() => new Set(commercialInsights.stalled.map((lead) => lead.id)), [commercialInsights.stalled])
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
    if (quickFilter === 'stalled') return stalledIds.has(lead.id)
    if (quickFilter === 'confirmed-no-project') return lead.pipelineStage === 'Serviço confirmado' && !project
    return true
  }), [activeLeads, quickFilter, search, stalledIds, state])

  const activeQuotes = state.quotes.filter((quote) => !quote.archivedAt && !quote.deletedAt && !['Cancelada', 'Recusada', 'Expirada'].includes(quote.status))
  const potentialValue = activeLeads.reduce((total, lead) => total + lead.estimatedValue, 0)
  const contactsNeedingAction = activeLeads.filter((lead) => !lead.nextContactAt || new Date(lead.nextContactAt) < new Date()).length
  const actionQueue = useMemo(() => buildCommercialActionQueue(activeLeads, state).slice(0, 5), [activeLeads, state])
  const selectedPriority = priorityLead ? actionQueue.find(({ lead }) => lead.id === priorityLead.id)?.priority : undefined

  const scrollBoard = (direction: -1 | 1) => boardRef.current?.scrollBy({ left: direction * 620, behavior: 'smooth' })

  return (
    <div className="crm-page space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">CRM e vendas</p>
            <h1 className="mt-1 text-2xl font-black text-gray-950">Comercial</h1>
            <p className="mt-1 text-sm text-gray-500">Gerencie oportunidades, negociações e próximas ações.</p>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" type="button" onClick={() => onCreateTask()}><CheckCircle2 size={16} /> Nova tarefa</Button><Button type="button" onClick={onCreateLead}><Plus size={16} /> Nova oportunidade</Button></div>
        </div>
        <div className="crm-metrics mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ['Oportunidades ativas', activeLeads.length],
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

      {actionQueue.length ? (
        <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-black text-gray-950">Prioridades de hoje</h2>
              <p className="mt-0.5 text-xs text-gray-500">Ordem sugerida por urgência, potencial e facilidade de contato.</p>
            </div>
            <button className="text-xs font-bold text-blue-600" type="button" onClick={() => { setQuickFilter('action'); onViewChange('table') }}>Ver todas</button>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-5">
            {actionQueue.map(({ lead, priority }, index) => (
              <article key={lead.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[0.65rem] font-black uppercase tracking-wide text-gray-400">#{index + 1}</span>
                  <strong className="text-xs text-blue-600">{priority.score} pts</strong>
                </div>
                <button className="mt-1 block w-full truncate text-left text-sm font-black text-gray-950 hover:underline" type="button" onClick={() => onOpenLead(lead)}>{displayName(lead)}</button>
                <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-gray-500">{priority.reason}</p>
                <div className="mt-2 flex gap-2">
                  {lead.whatsapp ? <button className="inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-50 px-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100" type="button" title="Revisar mensagem personalizada" onClick={() => { setPriorityLead(lead); setWhatsAppContext('Primeiro contato'); setWhatsAppMessage(buildContextualWhatsAppMessage(lead, 'Primeiro contato')) }}><MessageCircle size={13} /> Mensagem</button> : null}
                  <button className="inline-flex min-h-8 flex-1 items-center justify-center rounded-md border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 hover:bg-gray-100" type="button" onClick={() => onOpenLead(lead)}>Abrir</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"><p className="text-[0.65rem] font-bold uppercase text-gray-500">Taxa de contato</p><strong className="mt-1 block text-xl text-gray-950">{commercialInsights.contactRate}%</strong><p className="text-xs text-gray-500">Oportunidades com atividade registrada</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"><p className="text-[0.65rem] font-bold uppercase text-gray-500">Conversão geral</p><strong className="mt-1 block text-xl text-gray-950">{commercialInsights.conversionRate}%</strong><p className="text-xs text-gray-500">{commercialInsights.sourceConversion[0] ? `Melhor origem: ${commercialInsights.sourceConversion[0].source} (${commercialInsights.sourceConversion[0].rate}%)` : 'Ainda sem conversões registradas'}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"><p className="text-[0.65rem] font-bold uppercase text-gray-500">Abordagens no WhatsApp</p><strong className="mt-1 block text-xl text-gray-950">{commercialInsights.outreach.attempts}</strong><p className="text-xs text-gray-500">{commercialInsights.outreach.responseRate}% avançaram após a abordagem</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"><p className="text-[0.65rem] font-bold uppercase text-gray-500">Saúde do CRM</p><strong className={`mt-1 block text-xl ${commercialInsights.hygieneIssueCount ? 'text-amber-700' : 'text-emerald-700'}`}>{commercialInsights.hygieneIssueCount}</strong><p className="text-xs text-gray-500">{commercialInsights.hygieneIssueCount ? commercialInsights.hygieneIssues[0]?.label : 'Nenhuma inconsistência detectada'}</p></div>
      </section>

      {commercialInsights.hygieneIssues.length ? (
        <details className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-black text-gray-900">Diagnóstico automático <span className="ml-2 text-xs font-medium text-gray-500">Veja o que precisa de correção</span></summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {commercialInsights.hygieneIssues.map((issue) => <div key={issue.id} className="rounded-lg bg-gray-50 px-3 py-2"><strong className="text-base text-gray-950">{issue.count}</strong><p className="text-xs text-gray-500">{issue.label}</p></div>)}
          </div>
        </details>
      ) : null}

      {commercialInsights.outreach.attempts ? (
        <details className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-black text-gray-900">Desempenho das abordagens <span className="ml-2 text-xs font-medium text-gray-500">WhatsApp por contexto, categoria, cidade e serviço</span></summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Contexto mais usado', commercialInsights.outreach.bestContexts[0]?.context, commercialInsights.outreach.bestContexts[0]?.count ? `${commercialInsights.outreach.bestContexts[0].count} envio(s)` : 'Sem dados'],
              ['Melhor categoria', commercialInsights.outreach.categoryPerformance[0]?.label, commercialInsights.outreach.categoryPerformance[0] ? `${commercialInsights.outreach.categoryPerformance[0].rate}% avançaram` : 'Sem dados'],
              ['Melhor cidade', commercialInsights.outreach.cityPerformance[0]?.label, commercialInsights.outreach.cityPerformance[0] ? `${commercialInsights.outreach.cityPerformance[0].rate}% avançaram` : 'Sem dados'],
              ['Melhor serviço', commercialInsights.outreach.servicePerformance[0]?.label, commercialInsights.outreach.servicePerformance[0] ? `${commercialInsights.outreach.servicePerformance[0].rate}% avançaram` : 'Sem dados'],
            ].map(([label, value, detail]) => <div key={label} className="rounded-lg bg-gray-50 px-3 py-2"><p className="text-[0.65rem] font-bold uppercase text-gray-400">{label}</p><strong className="mt-1 block truncate text-sm text-gray-950">{value || 'Ainda sem dados'}</strong><p className="text-xs text-gray-500">{detail}</p></div>)}
          </div>
        </details>
      ) : null}

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
              <option value="stalled">Oportunidades paradas</option>
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
      {view === 'tasks' ? <TaskWorkspace state={state} onOpenLead={onOpenLead} onCreate={onCreateTask} onEdit={onEditTask} onComplete={onCompleteTask} onReopen={onReopenTask} onCancel={onCancelTask} onDelete={onDeleteTask} /> : null}

      {priorityLead ? createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Fechar mensagem" onClick={() => setPriorityLead(undefined)} />
          <section className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.15em] text-[#8a6c00]">Próxima abordagem</p>
                <h2 className="mt-1 truncate text-xl font-black text-gray-950">{displayName(priorityLead)}</h2>
                <p className="mt-1 text-xs text-gray-500">{priorityLead.leadHunterData?.categoryName || priorityLead.serviceInterest} · {selectedPriority?.score || 0} pontos</p>
              </div>
              <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" type="button" aria-label="Fechar" onClick={() => setPriorityLead(undefined)}><X size={19} /></button>
            </header>
            <div className="space-y-4 p-5">
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-[0.65rem] font-bold uppercase text-gray-400">Por que agora</p><p className="mt-1 text-xs font-bold text-gray-800">{selectedPriority?.reason || 'Acompanhamento comercial recomendado'}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-[0.65rem] font-bold uppercase text-gray-400">Serviço indicado</p><p className="mt-1 text-xs font-bold text-gray-800">{priorityLead.leadHunterData?.recommendedService || priorityLead.serviceInterest}</p></div>
                <div className="rounded-xl bg-gray-50 p-3"><p className="text-[0.65rem] font-bold uppercase text-gray-400">Inteligência</p><p className="mt-1 line-clamp-3 text-xs font-bold text-gray-800">{priorityLead.leadHunterData?.aiSummary || priorityLead.leadHunterData?.aiContactHook || 'Contato acessível e com ação comercial pendente.'}</p></div>
              </div>
              <label className="block text-xs font-bold text-gray-700">Momento da conversa
                <select className="field-input mt-1" value={whatsAppContext} onChange={(event) => { const context = event.target.value as WhatsAppContext; setWhatsAppContext(context); setWhatsAppMessage(buildContextualWhatsAppMessage(priorityLead, context)) }}>
                  {whatsappContexts.map((context) => <option key={context}>{context}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-gray-700">Mensagem personalizada
                <textarea className="field-input mt-1 min-h-36 resize-y leading-6" value={whatsAppMessage} onChange={(event) => setWhatsAppMessage(event.target.value)} />
              </label>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800">
                Ao abrir o WhatsApp, o FlyFlow registrará a mensagem, moverá o contato no funil quando necessário e criará o próximo acompanhamento da cadência.
              </div>
            </div>
            <footer className="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
              <Button variant="secondary" type="button" onClick={() => setPriorityLead(undefined)}>Cancelar</Button>
              <Button type="button" disabled={!whatsAppMessage.trim()} onClick={() => { onSendWhatsAppApproach(priorityLead, whatsAppMessage.trim(), whatsAppContext); setPriorityLead(undefined) }}><MessageCircle size={16} /> Abrir WhatsApp e registrar</Button>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}

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
          onSendWhatsAppApproach={onSendWhatsAppApproach}
          onSendEmail={onSendEmail}
          onEmailQuote={onEmailQuote}
          onScheduleReturn={onScheduleReturn}
          onRegisterDeposit={onRegisterDeposit}
          onDownloadQuote={onDownloadQuote}
          onApproveQuote={onApproveQuote}
          onMarkPaymentPaid={onMarkPaymentPaid}
          onCreateProject={onCreateProject}
          onCreateTask={onCreateTask}
          onEditTask={onEditTask}
          onCompleteTask={onCompleteTask}
          onReopenTask={onReopenTask}
          onDeleteTask={onDeleteTask}
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

function TaskWorkspace({ state, onOpenLead, onCreate, onEdit, onComplete, onReopen, onCancel, onDelete }: { state: AppState; onOpenLead: (lead: Lead) => void; onCreate: (lead?: Lead) => void; onEdit: (task: TaskItem) => void; onComplete: (task: TaskItem) => void; onReopen: (task: TaskItem) => void; onCancel: (task: TaskItem) => void; onDelete: (task: TaskItem) => void }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'Ativas' | 'Todas' | TaskItem['status']>('Ativas')
  const [typeFilter, setTypeFilter] = useState('')
  const taskTypes = [...new Set(state.tasks.map((task) => task.taskType || 'Tarefa'))]
  const filteredTasks = state.tasks.filter((task) => {
    const lead = task.leadId ? state.leads.find((item) => item.id === task.leadId) : undefined
    const client = task.clientId ? state.clients.find((item) => item.id === task.clientId) : undefined
    const contact = lead ? displayName(lead) : client?.companyName || client?.fullName || ''
    const haystack = `${task.title} ${task.description} ${task.taskType} ${contact}`.toLocaleLowerCase('pt-BR')
    if (query.trim() && !haystack.includes(query.trim().toLocaleLowerCase('pt-BR'))) return false
    if (statusFilter === 'Ativas' && ['Concluída', 'Cancelada'].includes(task.status)) return false
    if (statusFilter !== 'Ativas' && statusFilter !== 'Todas' && task.status !== statusFilter) return false
    if (typeFilter && (task.taskType || 'Tarefa') !== typeFilter) return false
    return true
  })
  const buckets = statusFilter === 'Ativas'
    ? ['Atrasadas', 'Hoje', 'Amanhã', 'Próximos sete dias', 'Sem data']
    : ['Atrasadas', 'Hoje', 'Amanhã', 'Próximos sete dias', 'Sem data', 'Concluídas recentemente']

  return <div className="space-y-3">
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1"><h2 className="font-black text-gray-950">Tarefas</h2><p className="text-xs text-gray-500">Organize retornos, ligações e atividades comerciais.</p></div>
        <label className="relative min-w-0 flex-1 lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-3 text-gray-400" size={16} /><input className="field-input field-input-with-leading-icon" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Buscar tarefa ou contato" /></label>
        <select className="field-input lg:max-w-44" value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value as typeof statusFilter)}><option>Ativas</option><option>Todas</option><option>Pendente</option><option>Em andamento</option><option>Concluída</option><option>Cancelada</option></select>
        <select className="field-input lg:max-w-40" value={typeFilter} onChange={(event) => setTypeFilter(event.currentTarget.value)}><option value="">Todos os tipos</option>{taskTypes.map((type) => <option key={type}>{type}</option>)}</select>
        <Button type="button" onClick={() => onCreate()}><Plus size={15} /> Nova tarefa</Button>
      </div>
    </section>
    <div className="grid gap-3 xl:grid-cols-2">
      {buckets.map((bucket) => {
        const tasks = filteredTasks.filter((task) => taskBucket(task) === bucket)
        if (!tasks.length && query) return null
        return <section key={bucket} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="font-black text-gray-950">{bucket}</h3><span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">{tasks.length}</span></div>
          <div className="mt-3 space-y-2">{tasks.map((task) => {
            const lead = task.leadId ? state.leads.find((item) => item.id === task.leadId) : undefined
            const client = task.clientId ? state.clients.find((item) => item.id === task.clientId) : undefined
            const responsible = task.responsibleUserId ? state.users.find((item) => item.id === task.responsibleUserId) : undefined
            return <article key={task.id} className="rounded-lg border border-gray-200 p-3 transition hover:border-amber-300">
              <button className="block w-full text-left" type="button" onClick={() => onEdit(task)}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-gray-950">{task.title}</strong><StatusBadge>{task.status}</StatusBadge></div><p className="mt-1 text-xs text-gray-500">{task.taskType || 'Tarefa'} · {task.dueAt ? formatDateTime(task.dueAt) : 'Sem data'} · {task.priority}</p>{task.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-600">{task.description}</p> : null}<p className="mt-1 text-[0.68rem] text-gray-400">{lead ? displayName(lead) : client?.companyName || client?.fullName || 'Sem contato'} · {responsible?.name || 'Sem responsável'} · {task.durationMinutes || 30} min</p></div><SlidersHorizontal className="shrink-0 text-gray-400" size={16} /></div>
              </button>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
                {task.status !== 'Concluída' ? <button className="text-xs font-bold text-emerald-700" type="button" onClick={() => onComplete(task)}><Check size={14} className="mr-1 inline" />Concluir</button> : <button className="text-xs font-bold text-blue-700" type="button" onClick={() => onReopen(task)}><Clock3 size={14} className="mr-1 inline" />Voltar para pendente</button>}
                {task.status !== 'Cancelada' && task.status !== 'Concluída' ? <button className="text-xs font-bold text-gray-500" type="button" onClick={() => onCancel(task)}>Cancelar</button> : null}
                <button className="text-xs font-bold text-red-600" type="button" onClick={() => onDelete(task)}><Trash2 size={13} className="mr-1 inline" />Excluir</button>
                {lead ? <button className="ml-auto text-xs font-bold text-[#866800]" type="button" onClick={() => onOpenLead(lead)}>Abrir contato</button> : null}
              </div>
            </article>
          })}{!tasks.length ? <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Nenhuma tarefa.</p> : null}</div>
        </section>
      })}
    </div>
  </div>
}

export function TaskView({ state, onOpenLead, onCreate, onEdit: _onEdit, onComplete, onReopen: _onReopen, onCancel, onDelete: _onDelete }: { state: AppState; onOpenLead: (lead: Lead) => void; onCreate: (lead?: Lead) => void; onEdit: (task: TaskItem) => void; onComplete: (task: TaskItem) => void; onReopen: (task: TaskItem) => void; onCancel: (task: TaskItem) => void; onDelete: (task: TaskItem) => void }) {
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

function ContactDrawer({ lead, state, onClose, onEdit, onDelete, onAttachReceipt, onGenerateProposal, onRegisterInteraction, onSendWhatsAppApproach, onSendEmail, onEmailQuote, onScheduleReturn, onRegisterDeposit, onDownloadQuote, onApproveQuote, onMarkPaymentPaid, onCreateProject, onCreateTask, onEditTask, onCompleteTask, onReopenTask, onDeleteTask }: {
  lead: Lead
  state: AppState
  onClose: () => void
  onEdit: (lead: Lead) => void
  onDelete: (lead: Lead) => void
  onAttachReceipt: (payment: Payment) => void
  onGenerateProposal: (clientId: string, leadId?: string) => void
  onRegisterInteraction: (lead: Lead, type: string) => void
  onSendWhatsAppApproach: (lead: Lead, message: string, context: string) => void
  onSendEmail: (lead: Lead) => void
  onEmailQuote: (quote: Quote) => void | Promise<void>
  onScheduleReturn: (lead: Lead) => void
  onRegisterDeposit: (quote: Quote) => void
  onDownloadQuote: (quote: Quote) => void | Promise<void>
  onApproveQuote: (quote: Quote) => void
  onMarkPaymentPaid: (payment: Payment) => void
  onCreateProject: (lead: Lead) => void
  onCreateTask: (lead?: Lead) => void
  onEditTask: (task: TaskItem) => void
  onCompleteTask: (task: TaskItem) => void
  onReopenTask: (task: TaskItem) => void
  onDeleteTask: (task: TaskItem) => void
}) {
  const [tab, setTab] = useState<DrawerTab>('overview')
  const [previewQuoteId, setPreviewQuoteId] = useState('')
  const [previewFile, setPreviewFile] = useState<{ fileName: string; url: string; mode: FilePreviewMode } | null>(null)
  const quotes = state.quotes.filter((quote) => quote.leadId === lead.id && !quote.deletedAt)
  const projects = state.projects.filter((project) => project.leadId === lead.id && !project.deletedAt)
  const payments = state.payments.filter((payment) => !payment.deletedAt && !payment.archivedAt && (payment.leadId === lead.id || projects.some((project) => project.id === payment.projectId)))
  const files = state.files.filter((file) => !file.deletedAt && (file.leadId === lead.id || projects.some((project) => project.id === file.projectId)))
  const tasks = state.tasks.filter((task) => (task.leadId === lead.id || task.leadIds?.includes(lead.id)) && task.status !== 'Cancelada').sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const quoteForDeposit = quotes.find((quote) => ['Aprovada', 'Aguardando entrada', 'Entrada recebida'].includes(quote.status))
  const quoteToSend = [...quotes]
    .filter((quote) => !quote.archivedAt && !['Aprovada', 'Convertida em projeto', 'Cancelada', 'Recusada', 'Expirada'].includes(quote.status))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  const receiptTarget = payments.find((payment) => !payment.receiptUrl && !files.some((file) => file.paymentId === payment.id)) ?? payments[0]
  const storedLeadHunterData = lead.leadHunterData || state.leadHunterProspects?.find((prospect) => prospect.leadId === lead.id)
  const leadHunterData = storedLeadHunterData ? {
    ...storedLeadHunterData,
    name: storedLeadHunterData.name || lead.companyName || lead.fullName,
    contactName: storedLeadHunterData.contactName || lead.fullName,
    phone: storedLeadHunterData.phone || lead.phone,
    whatsapp: storedLeadHunterData.whatsapp || lead.whatsapp,
    email: storedLeadHunterData.email || lead.email,
    instagram: storedLeadHunterData.instagram || lead.instagram,
    city: storedLeadHunterData.city || lead.city,
    neighborhood: storedLeadHunterData.neighborhood || lead.neighborhood,
    address: storedLeadHunterData.address || lead.address,
    googleMapsUrl: storedLeadHunterData.googleMapsUrl || buildGoogleBusinessUrl({
      name: storedLeadHunterData.name || lead.companyName || lead.fullName,
      address: storedLeadHunterData.address || lead.address,
      city: storedLeadHunterData.city || lead.city,
    }),
  } : undefined
  const timeline = [
    ...state.leadInteractions.filter((item) => item.leadId === lead.id).map((item) => ({ id: item.id, at: item.interactionDate, title: item.interactionType, description: item.description })),
    ...state.statusHistory.filter((item) => (item.entityType === 'Contato' && item.entityId === lead.id) || quotes.some((quote) => item.entityType === 'Proposta' && item.entityId === quote.id) || projects.some((project) => item.entityType === 'Projeto' && item.entityId === project.id)).map((item) => ({ id: item.id, at: item.createdAt, title: item.action, description: item.details })),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return <>
    <button className="fixed inset-0 z-40 cursor-default bg-black/20" aria-label="Fechar detalhes" type="button" onClick={onClose} />
    <aside className="crm-contact-drawer">
      <header className="border-b border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase text-gray-500">Contato e oportunidade</p><h2 className="mt-1 truncate text-xl font-black text-gray-950">{displayName(lead)}</h2><p className="text-sm text-gray-500">{lead.fullName || lead.city}</p></div><button className="focus-ring rounded-lg p-2 hover:bg-gray-100" aria-label="Fechar" type="button" onClick={onClose}><X size={20} /></button></div>
        <div className="mt-3 flex flex-wrap gap-2"><StatusBadge>{lead.pipelineStage}</StatusBadge><StatusBadge>{lead.temperature}</StatusBadge>{currentProject(state, lead.id) ? <StatusBadge>Com projeto</StatusBadge> : null}</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button className="min-h-9 py-1 text-xs" variant="secondary" type="button" onClick={() => onEdit(lead)}><SlidersHorizontal size={14} /> Editar</Button>
          <Button className="min-h-9 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" variant="secondary" type="button" onClick={() => onDelete(lead)}><Trash2 size={14} /> Excluir</Button>
        </div>
      </header>
      <nav className="crm-drawer-tabs sticky top-0 z-10 flex overflow-x-auto border-b border-gray-200 bg-white px-2">{([
        ['overview', 'Visão geral'], ['activities', 'Atividades'], ['tasks', 'Tarefas'], ['quotes', 'Propostas'], ['projects', 'Projetos'], ['finance', 'Financeiro'], ['files', 'Arquivos'],
      ] as Array<[DrawerTab, string]>).map(([value, label]) => <button key={value} className={`min-h-11 whitespace-nowrap border-b-2 px-3 text-xs font-bold ${tab === value ? 'border-[#d8a500] text-[#866800]' : 'border-transparent text-gray-500 hover:text-gray-800'}`} type="button" onClick={() => setTab(value)}>{label}</button>)}</nav>
      <div className="space-y-4 p-4">
        {tab === 'overview' ? <>
          <div className="grid grid-cols-2 gap-2">{[['Valor potencial', formatCurrency(lead.estimatedValue)], ['Próxima ação', lead.nextContactAt ? formatDateTime(lead.nextContactAt) : 'Não definida'], ['Serviço', lead.serviceInterest], ['Origem', lead.source]].map(([label, value]) => <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-[0.68rem] font-bold uppercase text-gray-500">{label}</p><p className="mt-1 text-sm font-black text-gray-950">{value}</p></div>)}</div>
          {lead.whatsapp || lead.phone ? <section><div className="mb-2 flex items-center gap-2"><MessageCircle className="text-gray-500" size={15} /><h3 className="text-xs font-black uppercase tracking-wide text-gray-500">WhatsApp</h3></div><div className="grid grid-cols-3 gap-2"><a className="crm-lead-link" href={whatsappLink(lead.whatsapp || lead.phone)} target="_blank" rel="noreferrer">Abrir vazio</a><button className="crm-lead-link" type="button" onClick={() => onSendWhatsAppApproach(lead, buildContextualWhatsAppMessage(lead, 'Primeiro contato'), 'Primeiro contato')}>Apresentar</button><button className="crm-lead-link" type="button" onClick={() => onSendWhatsAppApproach(lead, buildContextualWhatsAppMessage(lead, 'Enviar proposta'), 'Enviar proposta')}>Proposta</button></div>{lead.email ? <button className="mt-2 text-xs font-bold text-gray-500 hover:text-gray-900" type="button" onClick={() => onSendEmail(lead)}><Mail className="mr-1 inline" size={13} /> Enviar e-mail</button> : null}</section> : null}
          {leadHunterData ? <LeadHunterDossier data={leadHunterData} notes={lead.notes} hideWhatsApp /> : null}
          <section><h3 className="text-sm font-black text-gray-950">Ações principais</h3><div className="mt-2 grid gap-2 sm:grid-cols-2"><Button type="button" onClick={() => onRegisterInteraction(lead, 'Contato realizado')}><MessageCircle size={16} /> Registrar atividade</Button><Button variant="secondary" type="button" onClick={() => onCreateTask(lead)}><CheckCircle2 size={16} /> Criar tarefa</Button><Button variant="secondary" type="button" onClick={() => onScheduleReturn(lead)}><CalendarDays size={16} /> Agendar retorno</Button>{quoteToSend ? <Button variant="secondary" type="button" onClick={() => void onEmailQuote(quoteToSend)}><Mail size={16} /> Enviar proposta</Button> : <Button variant="secondary" type="button" onClick={() => onGenerateProposal('', lead.id)}><FileText size={16} /> Gerar proposta</Button>}{quoteForDeposit ? <Button variant="secondary" type="button" onClick={() => onRegisterDeposit(quoteForDeposit)}><CircleDollarSign size={16} /> Registrar entrada</Button> : null}{receiptTarget ? <Button variant="secondary" type="button" onClick={() => receiptTarget.receiptUrl ? setPreviewFile({ fileName: `${receiptTarget.paymentType} comprovante`, url: receiptTarget.receiptUrl, mode: getFilePreviewMode(receiptTarget.receiptUrl) }) : onAttachReceipt(receiptTarget)}><Paperclip size={16} /> {receiptTarget.receiptUrl ? 'Ver comprovante' : 'Anexar comprovante'}</Button> : null}{lead.pipelineStage === 'Serviço confirmado' && !currentProject(state, lead.id) ? <Button className="sm:col-span-2" type="button" onClick={() => onCreateProject(lead)}><Briefcase size={16} /> Criar projeto</Button> : null}</div>{quoteToSend ? <p className="mt-2 text-xs text-gray-500">Envia o PDF e o link de aceite. Após a confirmação, a oportunidade avança para “Proposta enviada”.</p> : null}</section>
          <section><h3 className="text-sm font-black text-gray-950">Contato</h3><dl className="mt-2 space-y-2 rounded-lg border border-gray-200 p-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-gray-500">Telefone</dt><dd className="font-bold text-gray-950">{lead.whatsapp || lead.phone || 'Não informado'}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">E-mail</dt><dd className="break-all text-right font-bold text-gray-950">{lead.email || 'Não informado'}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500">Local</dt><dd className="text-right font-bold text-gray-950">{lead.city || 'Não informado'}</dd></div></dl></section>
        </> : null}
        {tab === 'activities' ? <Timeline items={timeline} /> : null}
        {tab === 'tasks' ? (
          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-gray-950">Tarefas</h3>
                <p className="text-xs text-gray-500">{tasks.length ? `${tasks.length} vinculada${tasks.length === 1 ? '' : 's'} a este contato` : 'Acompanhe os próximos passos deste contato.'}</p>
              </div>
              <Button className="min-h-9 px-3 py-1 text-xs" type="button" onClick={() => onCreateTask(lead)}><Plus size={14} /> Nova tarefa</Button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {tasks.map((task, index) => {
                const completed = task.status === 'Concluída'
                return (
                  <article key={task.id} className={`${index ? 'border-t border-gray-200' : ''} group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-gray-50`}>
                    <button
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${completed ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 text-transparent hover:border-emerald-600 hover:text-emerald-600'}`}
                      type="button"
                      title={completed ? 'Voltar para pendente' : 'Marcar como concluída'}
                      aria-label={completed ? 'Voltar tarefa para pendente' : 'Concluir tarefa'}
                      onClick={() => completed ? onReopenTask(task) : onCompleteTask(task)}
                    >
                      {completed ? <Check size={15} /> : <Check size={14} />}
                    </button>
                    <button className="min-w-0 flex-1 text-left" type="button" onClick={() => onEditTask(task)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className={`text-sm ${completed ? 'text-gray-500 line-through' : 'text-gray-950'}`}>{task.title}</strong>
                        <StatusBadge>{task.status}</StatusBadge>
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-500">{task.taskType || 'Tarefa'} · {formatDateTime(task.dueAt)} · {task.priority}</p>
                      {task.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-600">{task.description}</p> : null}
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button className="rounded-lg p-2 text-gray-500 hover:bg-white hover:text-gray-950 hover:shadow-sm" title="Editar tarefa" type="button" onClick={() => onEditTask(task)}><SlidersHorizontal size={15} /></button>
                      <button className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Excluir tarefa" type="button" onClick={() => onDeleteTask(task)}><Trash2 size={15} /></button>
                    </div>
                  </article>
                )
              })}
              {!tasks.length ? <div className="px-4 py-8 text-center"><CheckCircle2 className="mx-auto text-gray-300" size={24} /><p className="mt-2 text-sm font-bold text-gray-700">Nenhuma tarefa</p><p className="mt-1 text-xs text-gray-500">Crie uma tarefa para definir o próximo passo.</p></div> : null}
            </div>
          </section>
        ) : null}
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

function LeadHunterDossier({ data, notes, hideWhatsApp = false }: { data: NonNullable<Lead['leadHunterData']>; notes: string; hideWhatsApp?: boolean }) {
  const location = [data.address, data.neighborhood, data.city].filter(Boolean).join(' · ')
  const googleBusinessUrl = data.googleMapsUrl || buildGoogleBusinessUrl(data)
  const rating = data.googleRating ? `${data.googleRating} ★ · ${data.googleReviewCount || 0} avaliações` : ''
  const savedAiComment = notes.split(/\r?\n/).find((line) => line.trim().toLocaleLowerCase('pt-BR').startsWith('análise da ia:'))
    ?.replace(/^análise da ia:\s*/i, '').trim()
  const aiComment = data.aiSummary || savedAiComment || data.aiApproach || data.aiContactHook || ''
  const opportunityComment = aiComment || leadOpportunitySummary(data)
  const approachComment = data.aiApproach || data.aiContactHook || `Apresente ${data.recommendedService || 'o serviço indicado'} e cite um ponto específico do negócio para demonstrar que a abordagem foi personalizada.`
  return <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500"><Sparkles size={15} /> Lead Hunter</p>
          <h3 className="mt-1 text-base font-black text-gray-950">{data.categoryName}</h3>
          <p className="mt-1 text-xs text-gray-500">{data.recommendedService || 'Serviço a definir'}{typeof data.distanceKm === 'number' ? ` · ${data.distanceKm} km` : ''}</p>
        </div>
        <div className="shrink-0 text-right"><strong className="text-xl text-gray-950">{data.score}</strong><p className="text-[0.62rem] font-bold uppercase text-gray-400">potencial</p></div>
      </div>
      {location ? <div className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-700"><MapPin className="mt-0.5 shrink-0 text-gray-400" size={15} /><span>{location}</span></div> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {data.whatsapp && !hideWhatsApp ? <a className="crm-lead-link" href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp vazio</a> : null}
        {data.instagram ? <a className="crm-lead-link" href={buildInstagramUrl(data.instagram)} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Instagram</a> : null}
        {data.website ? <a className="crm-lead-link" href={data.website} target="_blank" rel="noreferrer"><Globe2 size={15} /> Site</a> : null}
        <a className="crm-lead-link" href={googleBusinessUrl} target="_blank" rel="noreferrer"><MapPin size={15} /> Google Business</a>
      </div>
      <details className="group mt-3 rounded-lg border border-gray-200">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-xs font-bold text-gray-700"><span className="flex items-center gap-1.5"><Sparkles size={14} /> Análise e abordagem</span><ChevronDown className="transition group-open:rotate-180" size={15} /></summary>
        <div className="space-y-3 border-t border-gray-200 p-3">
          <div><p className="text-[0.65rem] font-black uppercase tracking-wide text-gray-500">Leitura da oportunidade</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{opportunityComment}</p></div>
          <div><p className="text-[0.65rem] font-black uppercase tracking-wide text-gray-500">Como iniciar o contato</p><p className="mt-1 text-sm leading-relaxed text-gray-700">{approachComment}</p></div>
        </div>
      </details>
    </div>
    <details className="group border-t border-gray-200">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50">
        Ver dossiê completo
        <ChevronDown className="transition group-open:rotate-180" size={16} />
      </summary>
      <div className="space-y-4 border-t border-gray-200 p-3 text-sm">
        {data.aiApproach || data.aiSocialInsight || data.aiContactHook || data.aiFirstMessage ? <div className="space-y-3">
          {data.aiApproach ? <InsightBlock title="Abordagem sugerida" text={data.aiApproach} /> : null}
          {data.aiSocialInsight ? <InsightBlock title="Leitura das redes" text={data.aiSocialInsight} /> : null}
          {data.aiContactHook ? <InsightBlock title="Gancho personalizado" text={data.aiContactHook} /> : null}
          {data.aiFirstMessage ? <div className="rounded-lg bg-gray-50 p-3"><p className="text-[0.65rem] font-black uppercase text-gray-500">Mensagem pronta</p><p className="mt-1 leading-relaxed text-gray-700">{data.aiFirstMessage}</p><button className="mt-2 text-xs font-bold text-gray-700 hover:underline" type="button" onClick={() => void navigator.clipboard.writeText(data.aiFirstMessage || '')}>Copiar mensagem</button></div> : null}
        </div> : null}
        <dl className="space-y-2 rounded-lg border border-gray-200 p-3">
          {[['Responsável', data.contactName], ['Telefone', data.phone], ['WhatsApp', data.whatsapp], ['E-mail', data.email], ['Instagram', data.instagram], ['Endereço', location], ['Avaliação', rating], ['Encontrado em', data.firstDiscoveredAt ? new Date(data.firstDiscoveredAt).toLocaleDateString('pt-BR') : '']].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="break-all text-right font-bold text-gray-900">{value || 'Não informado'}</dd></div>)}
        </dl>
        {data.scoreReasons?.length ? <div><h4 className="text-xs font-black uppercase text-gray-500">Por que é uma oportunidade</h4><div className="mt-2 space-y-1.5">{data.scoreReasons.map((reason) => <div key={reason.id} className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 p-2"><div><span>{reason.label}</span>{reason.evidence ? <p className="mt-0.5 text-xs text-gray-500">{reason.evidence}</p> : null}</div><strong className="text-gray-700">{reason.points > 0 ? '+' : ''}{reason.points}</strong></div>)}</div></div> : null}
        <div><h4 className="text-xs font-black uppercase text-gray-500">Fontes verificáveis</h4><div className="mt-2 space-y-1.5">{data.sourceUrls?.length ? data.sourceUrls.map((url, index) => <a key={`${url}-${index}`} className="flex items-center gap-2 break-all rounded-lg border border-gray-200 p-2 text-xs font-bold text-gray-700 hover:bg-gray-50" href={url} target="_blank" rel="noreferrer"><ExternalLink className="shrink-0" size={14} /> {url}</a>) : <p className="text-xs text-gray-500">{data.sources?.join(', ') || 'Nenhuma fonte registrada.'}</p>}</div></div>
      </div>
    </details>
  </section>
}

function InsightBlock({ title, text }: { title: string; text: string }) {
  return <div><p className="text-[0.65rem] font-black uppercase text-gray-500">{title}</p><p className="mt-1 leading-relaxed text-gray-700">{text}</p></div>
}

export function LeadHunterIntelligence({ data }: { data: NonNullable<Lead['leadHunterData']> }) {
  return <details className="group overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
      <span className="flex items-center gap-2 text-sm font-black text-amber-950"><Sparkles size={17} /> Inteligência do Lead Hunter</span>
      <span className="text-xs font-bold text-amber-800">Score {data.score} · clique para abrir</span>
    </summary>
    <div className="space-y-4 border-t border-amber-200 bg-white p-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-gray-50 p-3"><p className="text-[0.68rem] font-bold uppercase text-gray-500">Categoria</p><strong className="mt-1 block">{data.categoryName}</strong></div>
        <div className="rounded-lg bg-gray-50 p-3"><p className="text-[0.68rem] font-bold uppercase text-gray-500">Serviço indicado</p><strong className="mt-1 block">{data.recommendedService || 'Não definido'}</strong></div>
      </div>
      {data.aiSummary || data.aiApproach ? <div className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3">
        {data.aiSummary ? <div><p className="text-[0.68rem] font-black uppercase text-amber-800">Análise da IA</p><p className="mt-1 leading-relaxed text-gray-700">{data.aiSummary}</p></div> : null}
        {data.aiApproach ? <div><p className="text-[0.68rem] font-black uppercase text-amber-800">Abordagem sugerida</p><p className="mt-1 leading-relaxed text-gray-700">{data.aiApproach}</p></div> : null}
        {data.aiSocialInsight ? <div><p className="text-[0.68rem] font-black uppercase text-amber-800">Leitura das redes</p><p className="mt-1 leading-relaxed text-gray-700">{data.aiSocialInsight}</p></div> : null}
        {data.aiContactHook ? <div><p className="text-[0.68rem] font-black uppercase text-amber-800">Gancho personalizado</p><p className="mt-1 leading-relaxed text-gray-700">{data.aiContactHook}</p></div> : null}
        {data.aiFirstMessage ? <div className="rounded-lg border border-amber-200 bg-white p-2"><p className="text-[0.68rem] font-black uppercase text-amber-800">Mensagem pronta</p><p className="mt-1 leading-relaxed text-gray-700">{data.aiFirstMessage}</p><button className="mt-2 text-xs font-bold text-amber-800 hover:underline" type="button" onClick={() => void navigator.clipboard.writeText(data.aiFirstMessage || '')}>Copiar mensagem</button></div> : null}
      </div> : null}
      <div className="flex flex-wrap gap-2">
        {data.whatsapp ? <a className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white" href={whatsappLink(data.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a> : null}
        {data.instagram ? <a className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-fuchsia-200 px-3 text-xs font-bold text-fuchsia-700" href={buildInstagramUrl(data.instagram)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Instagram</a> : null}
        {data.website ? <a className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700" href={data.website} target="_blank" rel="noreferrer"><Globe2 size={14} /> Site</a> : null}
        {data.googleMapsUrl ? <a className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-700" href={data.googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={14} /> Google Maps</a> : null}
      </div>
      <dl className="space-y-2 rounded-lg border border-gray-200 p-3">
        {[['Responsável', data.contactName], ['Telefone', data.phone], ['WhatsApp', data.whatsapp], ['E-mail', data.email], ['Instagram', data.instagram], ['Endereço', data.address], ['Avaliação', data.googleRating ? `${data.googleRating} (${data.googleReviewCount || 0} avaliações)` : 'Não encontrada'], ['Encontrado em', new Date(data.firstDiscoveredAt).toLocaleDateString('pt-BR')]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="break-all text-right font-bold text-gray-900">{value || 'Não informado'}</dd></div>)}
      </dl>
      {data.scoreReasons.length ? <div><h4 className="text-xs font-black uppercase text-gray-500">Motivos do score</h4><div className="mt-2 space-y-2">{data.scoreReasons.map((reason) => <div key={reason.id} className="rounded-lg bg-gray-50 p-2"><div className="flex justify-between gap-3"><span>{reason.label}</span><strong className={reason.points >= 0 ? 'text-emerald-700' : 'text-red-700'}>{reason.points > 0 ? '+' : ''}{reason.points}</strong></div>{reason.evidence ? <p className="mt-1 text-xs text-gray-500">{reason.evidence}</p> : null}</div>)}</div></div> : null}
      <div><h4 className="text-xs font-black uppercase text-gray-500">Fontes verificáveis</h4><div className="mt-2 space-y-2">{data.sourceUrls.length ? data.sourceUrls.map((url, index) => <a key={`${url}-${index}`} className="flex items-center gap-2 break-all rounded-lg border border-gray-200 p-2 text-xs font-bold text-blue-700 hover:bg-blue-50" href={url} target="_blank" rel="noreferrer"><ExternalLink className="shrink-0" size={14} /> {url}</a>) : <p className="text-xs text-gray-500">{data.sources.join(', ') || 'Nenhuma fonte registrada.'}</p>}</div></div>
    </div>
  </details>
}

function DrawerList({ children, empty }: { children: ReactNode; empty: string }) {
  return <div className="space-y-2">{children || <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">{empty}</p>}</div>
}

function Timeline({ items }: { items: Array<{ id: string; at: string; title: string; description: string }> }) {
  return <div className="space-y-4">{items.map((item) => <div key={item.id} className="relative border-l-2 border-gray-200 pl-4 before:absolute before:-left-[5px] before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-[#d8a500]"><strong className="text-sm text-gray-950">{item.title}</strong><p className="mt-0.5 text-xs text-gray-500">{formatDateTime(item.at)}</p><p className="mt-1 text-sm leading-6 text-gray-600">{item.description}</p></div>)}{!items.length ? <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">Nenhuma atividade registrada.</p> : null}</div>
}
