import type { AppState, Client, Lead, LeadInteraction, NotificationItem, TaskItem } from '../types'

export type TrackingEventType = 'link_click' | 'email_sent' | 'email_reply' | 'email_bounce' | 'email_unsubscribe'

export interface TrackingEvent {
  id: string
  type: TrackingEventType
  leadId?: string | null
  leadEmail: string
  campaign?: string
  emailStep?: string
  segment?: string
  metadata?: Record<string, unknown>
  occurredAt: string
}

const eventLabels: Record<TrackingEventType, string> = {
  link_click: 'Clique no e-mail',
  email_sent: 'E-mail de prospecção enviado',
  email_reply: 'Resposta ao e-mail',
  email_bounce: 'E-mail devolvido',
  email_unsubscribe: 'Descadastro',
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')

const describe = (event: TrackingEvent) => [
  event.campaign ? `Campanha: ${event.campaign}` : '',
  event.emailStep ? `Etapa: ${event.emailStep}` : '',
  typeof event.metadata?.button === 'string' ? `Botão: ${event.metadata.button}` : '',
  typeof event.metadata?.snippet === 'string' ? String(event.metadata.snippet) : '',
].filter(Boolean).join('\n') || eventLabels[event.type]

export interface AppliedTrackingEvents {
  state: AppState
  changed: { leads: Lead[]; clients: Client[]; leadInteractions: LeadInteraction[]; tasks: TaskItem[]; notifications: NotificationItem[] }
  processedIds: string[]
}

/**
 * Aplica os eventos ao CRM. Todos os ids derivam do evento ou do e-mail, então
 * reprocessar o mesmo lote (duas abas abertas, ou falha antes de confirmar) não duplica.
 */
export const applyTrackingEvents = (state: AppState, events: TrackingEvent[], now = new Date().toISOString()): AppliedTrackingEvents => {
  const leads = new Map(state.leads.map((lead) => [lead.id, lead]))
  const clients = new Map(state.clients.map((client) => [client.id, client]))
  const interactionIds = new Set(state.leadInteractions.map((item) => item.id))
  const changedLeads = new Set<string>()
  const changedClients = new Set<string>()
  const interactions: LeadInteraction[] = []
  const tasks: TaskItem[] = []
  const notifications: NotificationItem[] = []
  const knownTaskIds = new Set(state.tasks.map((task) => task.id))

  const findLead = (event: TrackingEvent) => {
    const email = event.leadEmail.trim().toLowerCase()
    const all = [...leads.values()]
    const byId = event.leadId ? leads.get(event.leadId) : undefined
    if (byId) return byId
    const sameEmail = all.filter((lead) => lead.email.trim().toLowerCase() === email)
    // Lead excluído continua recebendo o histórico: criar outro desfaria a exclusão.
    return sameEmail.find((lead) => !lead.deletedAt) ?? sameEmail[0]
  }

  const createFrom = (event: TrackingEvent): Lead => {
    const email = event.leadEmail.trim().toLowerCase()
    const existingClient = [...clients.values()].find((client) => client.email.trim().toLowerCase() === email)
    const client: Client = existingClient ?? {
      id: `client-email-${slug(email)}`, fullName: email, companyName: '', document: '', phone: '', whatsapp: '', email, instagram: '',
      address: '', city: '', source: 'Prospecção por email', notes: '', tags: [], archived: false, createdAt: now, updatedAt: now,
    }
    if (!existingClient) { clients.set(client.id, client); changedClients.add(client.id) }
    const lead: Lead = {
      id: `lead-email-${slug(email)}`, contactId: client.id, fullName: client.fullName, companyName: client.companyName, phone: client.phone,
      whatsapp: client.whatsapp, email, instagram: client.instagram, city: client.city, neighborhood: '', address: client.address,
      source: 'Prospecção por email', serviceInterest: 'Outro', pipelineStage: 'Entrada', temperature: 'Frio', estimatedValue: 0, probability: 10,
      entryDate: now.slice(0, 10), notes: '', responsibleUserId: state.users[0]?.id ?? '', archived: false, tags: [], createdAt: now, updatedAt: now,
    }
    leads.set(lead.id, lead)
    changedLeads.add(lead.id)
    return lead
  }

  const processedIds: string[] = []
  ;[...events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)).forEach((event) => {
    processedIds.push(event.id)
    const interactionId = `int-event-${event.id}`
    if (interactionIds.has(interactionId)) return
    const found = findLead(event) ?? createFrom(event)
    interactionIds.add(interactionId)
    interactions.push({ id: interactionId, leadId: found.id, interactionType: eventLabels[event.type], description: describe(event), interactionDate: event.occurredAt, userId: '', createdAt: now })

    const update: Partial<Lead> = {}
    if (event.type === 'link_click' && found.emailEngagement !== 'Respondeu') update.emailEngagement = 'Clicou'
    if (event.type === 'email_reply') {
      update.emailEngagement = 'Respondeu'
      update.lastEmailReplyAt = event.occurredAt
    }
    if (event.type === 'email_sent' || event.type === 'email_reply') update.lastContactAt = event.occurredAt
    if (event.type === 'email_unsubscribe') {
      update.doNotContact = true
      update.doNotContactAt = event.occurredAt
      if (found.contactId && clients.has(found.contactId)) {
        const client = clients.get(found.contactId) as Client
        clients.set(client.id, { ...client, doNotContact: true, updatedAt: now })
        changedClients.add(client.id)
      }
    }
    if (Object.keys(update).length) {
      leads.set(found.id, { ...found, ...update, updatedAt: now })
      changedLeads.add(found.id)
    }
    if (event.type === 'email_reply' && !found.deletedAt) {
      const name = found.companyName || found.fullName || event.leadEmail
      const taskId = `task-email-reply-${event.id}`
      if (!knownTaskIds.has(taskId)) {
        tasks.push({ id: taskId, title: `Responder ${name}`, description: describe(event), taskType: 'E-mail', dueAt: now, durationMinutes: 15, priority: 'Urgente', status: 'Pendente', leadId: found.id, responsibleUserId: found.responsibleUserId, createdAt: now, updatedAt: now })
        notifications.push({ id: `email-reply-${event.id}`, userId: found.responsibleUserId, title: 'Resposta de prospecção', message: `${name} respondeu ao e-mail.`, notificationType: 'Comercial', entityType: 'Contato', entityId: found.id, read: false, createdAt: now })
      }
    }
  })

  const changed = {
    leads: [...changedLeads].map((id) => leads.get(id) as Lead),
    clients: [...changedClients].map((id) => clients.get(id) as Client),
    leadInteractions: interactions,
    tasks,
    notifications,
  }
  return {
    state: {
      ...state,
      leads: [...leads.values()],
      clients: [...clients.values()],
      leadInteractions: [...interactions, ...state.leadInteractions],
      tasks: [...tasks, ...state.tasks],
      notifications: [...notifications, ...state.notifications],
    },
    changed,
    processedIds,
  }
}
