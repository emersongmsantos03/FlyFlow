import type {
  AppState,
  Appointment,
  PipelineStage,
  Project,
  ProjectChecklistItem,
  ProjectStatus,
  Quote,
  QuoteStatus,
  NotificationItem,
  StatusHistoryItem,
  TaskItem,
} from '../types'

const DAY_MS = 86_400_000

const legacyPipelineMap: Partial<Record<PipelineStage, PipelineStage>> = {
  'Novo lead': 'Entrada',
  'Primeiro contato': 'Contato realizado',
  'Aguardando resposta': 'Contato realizado',
  'Entendendo necessidade': 'Em negociação',
  'Orçamento solicitado': 'Em negociação',
  'Orçamento enviado': 'Proposta enviada',
  'Negociação': 'Em negociação',
  'Aguardando sinal': 'Aguardando entrada',
  'Serviço agendado': 'Serviço confirmado',
  'Convertido em cliente': 'Serviço confirmado',
  'Contato futuro': 'Retorno futuro',
}

const legacyQuoteMap: Partial<Record<QuoteStatus, QuoteStatus>> = {
  Enviado: 'Enviada',
  Visualizado: 'Visualizada',
  Aprovado: 'Aprovada',
  Recusado: 'Recusada',
  Expirado: 'Expirada',
  Cancelado: 'Cancelada',
}

const legacyProjectMap: Partial<Record<ProjectStatus, ProjectStatus>> = {
  Orçamento: 'Aguardando agendamento',
  'Aguardando aprovação': 'Aguardando agendamento',
  'Aguardando sinal': 'Aguardando agendamento',
  'Seleção de arquivos': 'Em edição',
  'Aguardando revisão': 'Pronto para revisão',
  'Ajustes solicitados': 'Aguardando aprovação do cliente',
  'Pronto para entrega': 'Aguardando pagamento final',
  Finalizado: 'Concluído',
  Reagendado: 'Agendado',
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10)

export const addCalendarDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T12:00:00`)
  parsed.setDate(parsed.getDate() + days)
  return dateOnly(parsed)
}

export const calendarDaysBetween = (startDate: string, endDate: string) => {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T12:00:00`).getTime()
  const end = new Date(`${endDate}T12:00:00`).getTime()
  return Math.round((end - start) / DAY_MS)
}

export const getNextQuoteNumber = (quotes: Quote[], now = new Date()) => {
  const year = now.getFullYear()
  const expression = new RegExp(`^HD-${year}-(\\d{4})(?:-V\\d+)?$`)
  const highest = quotes.reduce((max, quote) => {
    const match = quote.quoteNumber.match(expression)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `HD-${year}-${String(highest + 1).padStart(4, '0')}`
}

export const getNextQuoteVersionNumber = (quotes: Quote[], original: Quote) => {
  const rootNumber = original.quoteNumber.replace(/-V\d+$/, '')
  const highest = quotes.reduce((max, quote) => {
    if (quote.quoteNumber === rootNumber) return Math.max(max, quote.version ?? 0)
    const match = quote.quoteNumber.match(new RegExp(`^${rootNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-V(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, original.version ?? 0)
  return { version: highest + 1, quoteNumber: `${rootNumber}-V${highest + 1}` }
}

export const createStatusHistory = (
  entityType: StatusHistoryItem['entityType'],
  entityId: string,
  action: string,
  details: string,
  userId?: string,
  fromStatus?: string,
  toStatus?: string,
  now = new Date().toISOString(),
): StatusHistoryItem => ({
  id: `history-${entityType.toLowerCase()}-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  entityType,
  entityId,
  action,
  fromStatus,
  toStatus,
  details,
  userId,
  createdAt: now,
})

const generatedTask = (
  sourceKey: string,
  title: string,
  dueAt: string,
  priority: TaskItem['priority'],
  links: Pick<TaskItem, 'leadId' | 'quoteId' | 'projectId' | 'appointmentId'>,
  now: string,
  description = '',
): TaskItem => ({
  id: `task-${sourceKey.replace(/[^a-z0-9-]/gi, '-')}`,
  sourceKey,
  title,
  description,
  dueAt,
  priority,
  status: 'Pendente',
  ...links,
  createdAt: now,
  updatedAt: now,
})

export const buildOperationalTasks = (state: AppState, nowDate = new Date()): TaskItem[] => {
  const now = nowDate.toISOString()
  const today = dateOnly(nowDate)
  const generated: TaskItem[] = []

  state.quotes.forEach((quote) => {
    if (quote.archivedAt || quote.deletedAt) return
    if (quote.status === 'Rascunho' || quote.status === 'Gerada') {
      generated.push(generatedTask(`quote-send:${quote.id}`, `Enviar proposta ${quote.quoteNumber}`, now, 'Alta', { leadId: quote.leadId, quoteId: quote.id }, now))
    }
    if (['Enviada', 'Visualizada', 'Em negociação'].includes(quote.status)) {
      generated.push(generatedTask(`quote-followup:${quote.id}`, `Acompanhar aprovação de ${quote.quoteNumber}`, `${quote.expirationDate}T10:00:00`, 'Alta', { leadId: quote.leadId, quoteId: quote.id }, now))
    }
    if (quote.status === 'Enviada' || quote.status === 'Visualizada') {
      const cadenceBase = quote.viewedAt || quote.sentAt || quote.createdAt
      const cadenceDays = quote.viewedAt ? 1 : 2
      generated.push(generatedTask(`quote-nudge:${quote.id}`, `Fazer follow-up de ${quote.quoteNumber}`, new Date(new Date(cadenceBase).getTime() + cadenceDays * DAY_MS).toISOString(), 'Alta', { leadId: quote.leadId, quoteId: quote.id }, now, quote.viewedAt ? 'Cliente visualizou a proposta. Retomar em 1 dia.' : 'Proposta enviada. Retomar em 2 dias.'))
    }
    if (quote.status === 'Aprovada' || quote.status === 'Aguardando entrada') {
      generated.push(generatedTask(`quote-deposit:${quote.id}`, `Confirmar entrada de ${quote.quoteNumber}`, now, 'Urgente', { leadId: quote.leadId, quoteId: quote.id }, now))
    }
    if (quote.status === 'Expirada') {
      generated.push(generatedTask(`quote-renew:${quote.id}`, `Renovar ou revisar ${quote.quoteNumber}`, now, 'Alta', { leadId: quote.leadId, quoteId: quote.id }, now))
    }
  })

  state.projects.forEach((project) => {
    if (project.archivedAt || project.deletedAt) return
    const capture = state.appointments.find((item) => item.projectId === project.id && item.appointmentType === 'Captação' && item.status !== 'Cancelado')
    if (!capture && ['Aguardando agendamento', 'Confirmado'].includes(project.projectStatus)) {
      generated.push(generatedTask(`project-schedule:${project.id}`, `Agendar captação de ${project.name}`, now, 'Urgente', { leadId: project.leadId, projectId: project.id }, now))
    }
    if (capture) {
      const confirmationDue = new Date(new Date(capture.startAt).getTime() - DAY_MS).toISOString()
      if (new Date(capture.startAt) >= nowDate && capture.confirmationStatus !== 'Confirmado') {
        generated.push(generatedTask(`capture-confirm:${capture.id}`, `Confirmar captação com o cliente`, confirmationDue, 'Urgente', { leadId: project.leadId, projectId: project.id, appointmentId: capture.id }, now, project.name))
      }
    }
    if (['Em edição', 'Pronto para revisão', 'Aguardando aprovação do cliente'].includes(project.projectStatus)) {
      const days = Math.ceil((new Date(`${project.deliveryDeadline}T23:59:59`).getTime() - nowDate.getTime()) / DAY_MS)
      generated.push(generatedTask(`project-delivery:${project.id}`, `Entrega de ${project.name}`, `${project.deliveryDeadline}T18:00:00`, days <= 1 ? 'Urgente' : days <= 3 ? 'Alta' : 'Média', { leadId: project.leadId, projectId: project.id }, now))
    }
    if (project.projectStatus === 'Aguardando pagamento final') {
      generated.push(generatedTask(`project-final-payment:${project.id}`, `Solicitar pagamento final de ${project.name}`, now, 'Urgente', { leadId: project.leadId, projectId: project.id }, now))
    }
    if (project.projectStatus === 'Entregue') {
      generated.push(generatedTask(`project-complete:${project.id}`, `Concluir projeto ${project.name}`, now, 'Alta', { leadId: project.leadId, projectId: project.id }, now))
    }
    if (project.projectStatus === 'Concluído' && project.completedAt) {
      generated.push(generatedTask(`project-post-sale:${project.id}`, `Pós-venda e avaliação de ${project.name}`, new Date(new Date(project.completedAt).getTime() + 30 * DAY_MS).toISOString(), 'Média', { leadId: project.leadId, projectId: project.id }, now, 'Solicitar avaliação e oferecer um novo serviço.'))
    }
  })

  state.leads.forEach((lead) => {
    if (!lead.archived && !lead.deletedAt && lead.pipelineStage !== 'Perdido' && lead.nextContactAt && lead.nextContactAt.slice(0, 10) <= today) {
      generated.push(generatedTask(`lead-followup:${lead.id}`, `Realizar retorno de ${lead.fullName}`, lead.nextContactAt, 'Alta', { leadId: lead.id }, now))
    }
  })

  const generatedKeys = new Set(generated.map((task) => task.sourceKey))
  const retained = (state.tasks ?? []).filter((task) => !task.sourceKey || (!generatedKeys.has(task.sourceKey) && task.status === 'Concluída'))
  const previousByKey = new Map((state.tasks ?? []).filter((task) => task.sourceKey).map((task) => [task.sourceKey, task]))
  return [
    ...generated.map((task) => {
      const previous = previousByKey.get(task.sourceKey)
      return previous ? { ...task, id: previous.id, createdAt: previous.createdAt, status: ['Concluída', 'Cancelada'].includes(previous.status) ? previous.status : task.status } : task
    }),
    ...retained,
  ]
}

const buildOperationalNotifications = (state: AppState, nowDate: Date): NotificationItem[] => {
  const today = dateOnly(nowDate)
  const now = nowDate.toISOString()
  const generated: NotificationItem[] = []
  state.quotes.forEach((quote) => {
    if (quote.archivedAt || quote.deletedAt) return
    const days = Math.ceil((new Date(`${quote.expirationDate}T23:59:59`).getTime() - nowDate.getTime()) / DAY_MS)
    if (quote.status === 'Expirada') generated.push({ id: `notification-quote-expired-${quote.id}`, userId: quote.responsibleUserId ?? '', title: 'Proposta expirada', message: `${quote.quoteNumber} precisa ser renovada, revisada ou duplicada.`, notificationType: 'Proposta', entityType: 'Proposta', entityId: quote.id, read: false, createdAt: now })
    else if (days >= 0 && days <= 2 && !['Aprovada', 'Aguardando entrada', 'Entrada recebida', 'Convertida em projeto', 'Cancelada', 'Recusada'].includes(quote.status)) generated.push({ id: `notification-quote-expiring-${quote.id}`, userId: quote.responsibleUserId ?? '', title: 'Proposta próxima do vencimento', message: `${quote.quoteNumber} vence em ${days} dia(s).`, notificationType: 'Proposta', entityType: 'Proposta', entityId: quote.id, read: false, createdAt: now })
  })
  state.payments.filter((payment) => payment.status === 'Vencida' && !payment.archivedAt && !payment.deletedAt).forEach((payment) => generated.push({ id: `notification-payment-overdue-${payment.id}`, userId: '', title: 'Pagamento atrasado', message: `${payment.paymentType} vencido em ${payment.dueDate}.`, notificationType: 'Financeiro', entityType: 'Pagamento', entityId: payment.id, read: false, createdAt: now }))
  state.projects.forEach((project) => {
    if (project.archivedAt || project.deletedAt) return
    if (!project.deliveryDeadline || ['Entregue', 'Concluído', 'Cancelado'].includes(project.projectStatus)) return
    const days = Math.ceil((new Date(`${project.deliveryDeadline}T23:59:59`).getTime() - nowDate.getTime()) / DAY_MS)
    if (days <= 3) generated.push({ id: `notification-delivery-${project.id}-${today}`, userId: project.responsibleUserId, title: days < 0 ? 'Projeto atrasado' : 'Entrega próxima', message: `${project.name}: ${days < 0 ? `${Math.abs(days)} dia(s) de atraso` : `vence em ${days} dia(s)`}.`, notificationType: 'Projeto', entityType: 'Projeto', entityId: project.id, read: false, createdAt: now })
  })
  const previous = new Map((state.notifications ?? []).map((notification) => [notification.id, notification]))
  return [...generated.map((item) => previous.has(item.id) ? { ...item, read: previous.get(item.id)!.read, createdAt: previous.get(item.id)!.createdAt } : item), ...(state.notifications ?? []).filter((item) => !item.id.startsWith('notification-'))]
}

export const synchronizeOperationalState = (state: AppState, nowDate = new Date()): AppState => {
  const today = dateOnly(nowDate)
  const now = nowDate.toISOString()
  const quotes = (state.quotes ?? []).map((quote) => {
    const normalizedStatus = legacyQuoteMap[quote.status] ?? quote.status
    const expirable = ['Rascunho', 'Gerada', 'Enviada', 'Visualizada', 'Em negociação'].includes(normalizedStatus)
    return {
      ...quote,
      version: quote.version ?? 0,
      status: expirable && quote.expirationDate < today ? 'Expirada' as const : normalizedStatus,
    }
  })
  const leads = (state.leads ?? []).map((lead) => ({ ...lead, pipelineStage: legacyPipelineMap[lead.pipelineStage] ?? lead.pipelineStage }))
  const defaultDeliveryDays = Math.max(Number(state.companySettings?.defaultDeliveryDays) || 7, 1)
  const projects = (state.projects ?? []).map((project) => {
    const automaticDeadline = project.captureDate ? addCalendarDays(project.captureDate, defaultDeliveryDays) : ''
    const deliveryDaysAfterCapture = project.deliveryDaysAfterCapture ?? (
      project.captureDate && project.deliveryDeadline
        ? Math.max(calendarDaysBetween(project.captureDate, project.deliveryDeadline), 0)
        : defaultDeliveryDays
    )
    const deliveryDeadlineNegotiated = project.deliveryDeadlineNegotiated ?? Boolean(
      project.captureDate && project.deliveryDeadline && deliveryDaysAfterCapture !== defaultDeliveryDays,
    )
    return {
      ...project,
      projectStatus: legacyProjectMap[project.projectStatus] ?? project.projectStatus,
      originalDeliveryDeadline: project.originalDeliveryDeadline ?? (automaticDeadline || project.deliveryDeadline),
      deliveryDeadlineNegotiated,
      deliveryDaysAfterCapture,
    }
  })
  const payments = (state.payments ?? []).map((payment) => ({
    ...payment,
    status: !payment.archivedAt && !payment.deletedAt && payment.status === 'Pendente' && payment.dueDate < today ? 'Vencida' as const : payment.status,
  }))
  const normalized: AppState = {
    ...state,
    leads,
    quotes,
    projects,
    payments,
    projectChecklistItems: (state.projectChecklistItems ?? []).filter((item) => item.category !== 'Comercial'),
    tasks: state.tasks ?? [],
    statusHistory: state.statusHistory ?? [],
    projectAdjustments: state.projectAdjustments ?? [],
    updatedAt: now,
  }
  return { ...normalized, tasks: buildOperationalTasks(normalized, nowDate), notifications: buildOperationalNotifications(normalized, nowDate) }
}

export const buildGoogleCalendarUrl = (appointment: Appointment, project?: Project) => {
  const compactDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const details = [
    project ? `Projeto: ${project.projectCode}` : '',
    project ? `Cliente: ${project.contactName}` : '',
    project ? `Telefone: ${project.contactPhone}` : '',
    project ? `Serviço: ${project.serviceName}` : '',
    project ? `Valor restante: ${project.remainingValue}` : '',
    appointment.notes ? `Observações: ${appointment.notes}` : '',
  ].filter(Boolean).join('\n')
  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: project ? `Hero Drone — Captação — ${project.contactName || project.name}` : appointment.title,
    dates: `${compactDate(appointment.startAt)}/${compactDate(appointment.endAt)}`,
    details,
    location: appointment.address,
  })
  return `https://calendar.google.com/calendar/render?${query.toString()}`
}

export const createOperationalChecklist = (projectId: string, now: string): ProjectChecklistItem[] => {
  const groups: Array<{ category: ProjectChecklistItem['category']; items: string[] }> = [
    { category: 'Pré-produção', items: ['Preparação concluída'] },
    { category: 'Captação', items: ['Captação concluída'] },
    { category: 'Pós-produção', items: ['Edição e revisão concluídas'] },
    { category: 'Financeiro e entrega', items: ['Pagamento e entrega concluídos'] },
  ]
  let index = 0
  return groups.flatMap((group) => group.items.map((title) => ({
    id: `check-${projectId}-${index}`,
    projectId,
    title,
    category: group.category,
    completed: false,
    orderIndex: index++,
    createdAt: now,
  })))
}
