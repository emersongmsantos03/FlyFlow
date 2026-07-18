import type { AppState, Lead } from '../../types'

const DAY_MS = 86_400_000

export interface CommercialPriority {
  score: number
  reason: string
  overdueDays: number
  hasDirectContact: boolean
}

export const calculateCommercialPriority = (lead: Lead, state: Pick<AppState, 'quotes' | 'leadInteractions'>, now = new Date()): CommercialPriority => {
  const reasons: Array<{ label: string; points: number }> = []
  const nextContact = lead.nextContactAt ? new Date(lead.nextContactAt) : undefined
  const overdueDays = nextContact && nextContact < now ? Math.max(1, Math.ceil((now.getTime() - nextContact.getTime()) / DAY_MS)) : 0
  const hasDirectContact = Boolean(lead.whatsapp || lead.phone || lead.email || lead.instagram)
  const latestQuote = state.quotes
    .filter((quote) => quote.leadId === lead.id && !quote.deletedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const interactions = state.leadInteractions.filter((interaction) => interaction.leadId === lead.id)

  if (overdueDays) reasons.push({ label: `Retorno atrasado há ${overdueDays} dia(s)`, points: Math.min(35, 18 + overdueDays * 2) })
  else if (!nextContact) reasons.push({ label: 'Sem próxima ação definida', points: 20 })
  else if (nextContact.getTime() - now.getTime() <= DAY_MS) reasons.push({ label: 'Ação prevista para hoje', points: 14 })
  if (lead.whatsapp) reasons.push({ label: 'WhatsApp disponível', points: 12 })
  else if (hasDirectContact) reasons.push({ label: 'Canal de contato disponível', points: 7 })
  if (lead.temperature === 'Quente') reasons.push({ label: 'Oportunidade quente', points: 14 })
  if (lead.leadHunterData?.score) reasons.push({ label: 'Bom potencial no Lead Hunter', points: Math.round(lead.leadHunterData.score / 10) })
  if (latestQuote && ['Enviada', 'Visualizada', 'Em negociação'].includes(latestQuote.status)) reasons.push({ label: 'Proposta aguardando avanço', points: 18 })
  if (!interactions.length) reasons.push({ label: 'Ainda sem contato registrado', points: 10 })
  if (!hasDirectContact) reasons.push({ label: 'Sem canal direto confirmado', points: -15 })

  const score = Math.max(0, Math.min(100, reasons.reduce((total, item) => total + item.points, Math.round(lead.probability / 5))))
  const strongest = [...reasons].sort((a, b) => b.points - a.points)[0]
  return { score, reason: strongest?.label || 'Acompanhamento comercial', overdueDays, hasDirectContact }
}

export const buildCommercialActionQueue = (leads: Lead[], state: Pick<AppState, 'quotes' | 'leadInteractions'>, now = new Date()) =>
  leads
    .filter((lead) => !lead.archived && !lead.deletedAt && lead.pipelineStage !== 'Perdido')
    .map((lead) => ({ lead, priority: calculateCommercialPriority(lead, state, now) }))
    .filter(({ lead, priority }) => priority.overdueDays > 0 || !lead.nextContactAt || (lead.nextContactAt && new Date(lead.nextContactAt).getTime() - now.getTime() <= DAY_MS))
    .sort((a, b) => b.priority.score - a.priority.score || (a.lead.nextContactAt || '').localeCompare(b.lead.nextContactAt || ''))

export const buildCommercialInsights = (
  leads: Lead[],
  state: Pick<AppState, 'leadInteractions'> & Partial<Pick<AppState, 'quotes' | 'projects' | 'payments'>>,
  now = new Date(),
) => {
  const visible = leads.filter((lead) => !lead.archived && !lead.deletedAt)
  const wonStages = new Set(['Serviço confirmado', 'Serviço agendado', 'Convertido em cliente'])
  const won = visible.filter((lead) => wonStages.has(lead.pipelineStage))
  const contactedIds = new Set(state.leadInteractions.map((interaction) => interaction.leadId))
  const stalled = visible.filter((lead) => {
    if (lead.pipelineStage === 'Perdido' || wonStages.has(lead.pipelineStage)) return false
    const lastMovement = new Date(lead.lastContactAt || lead.updatedAt || lead.createdAt)
    return now.getTime() - lastMovement.getTime() >= 7 * DAY_MS
  })
  const sourceMap = new Map<string, { total: number; won: number }>()
  for (const lead of visible) {
    const current = sourceMap.get(lead.source) || { total: 0, won: 0 }
    current.total += 1
    if (wonStages.has(lead.pipelineStage)) current.won += 1
    sourceMap.set(lead.source, current)
  }
  const sourceConversion = [...sourceMap].map(([source, values]) => ({
    source,
    ...values,
    rate: Math.round(values.won / Math.max(1, values.total) * 100),
  })).sort((a, b) => b.rate - a.rate || b.total - a.total)
  const whatsAppInteractions = state.leadInteractions.filter((interaction) => interaction.interactionType.startsWith('WhatsApp'))
  const approachedLeadIds = new Set(whatsAppInteractions.map((interaction) => interaction.leadId))
  const respondedLeadIds = new Set(whatsAppInteractions
    .filter((interaction) => /interesse demonstrado|enviar portf[oó]lio|enviar proposta/i.test(interaction.interactionType))
    .map((interaction) => interaction.leadId))
  const contextMap = new Map<string, number>()
  whatsAppInteractions.forEach((interaction) => {
    const context = interaction.interactionType.split('·')[1]?.trim() || 'WhatsApp'
    contextMap.set(context, (contextMap.get(context) || 0) + 1)
  })
  const bestContexts = [...contextMap].map(([context, count]) => ({ context, count })).sort((a, b) => b.count - a.count)
  const dimensionPerformance = (selector: (lead: Lead) => string) => {
    const dimensions = new Map<string, { total: number; responses: number }>()
    visible.filter((lead) => approachedLeadIds.has(lead.id)).forEach((lead) => {
      const label = selector(lead) || 'Não informado'
      const current = dimensions.get(label) || { total: 0, responses: 0 }
      current.total += 1
      if (respondedLeadIds.has(lead.id)) current.responses += 1
      dimensions.set(label, current)
    })
    return [...dimensions].map(([label, values]) => ({
      label,
      ...values,
      rate: Math.round(values.responses / Math.max(1, values.total) * 100),
    })).sort((a, b) => b.rate - a.rate || b.total - a.total)
  }

  const duplicateKeys = new Map<string, number>()
  visible.forEach((lead) => {
    const phoneKey = (lead.whatsapp || lead.phone).replace(/\D/g, '')
    const key = phoneKey
      ? `phone:${phoneKey}`
      : lead.email
        ? `email:${lead.email.trim().toLocaleLowerCase('pt-BR')}`
        : `company:${lead.companyName.trim().toLocaleLowerCase('pt-BR')}`
    if (key) duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1)
  })
  const duplicateCount = [...duplicateKeys.values()].reduce((total, count) => total + Math.max(count - 1, 0), 0)
  const invalidPhoneCount = visible.filter((lead) => {
    const digits = (lead.whatsapp || lead.phone).replace(/\D/g, '')
    return Boolean(digits) && digits.length < 10
  }).length
  const noNextActionCount = visible.filter((lead) => !lead.nextContactAt && !wonStages.has(lead.pipelineStage) && lead.pipelineStage !== 'Perdido').length
  const expiredQuoteCount = (state.quotes || []).filter((quote) => !quote.deletedAt && quote.status === 'Expirada').length
  const inconsistentBalanceCount = (state.projects || []).filter((project) => {
    if (project.deletedAt) return false
    const paid = (state.payments || [])
      .filter((payment) => payment.projectId === project.id && payment.status === 'Recebida' && !payment.deletedAt && !payment.archivedAt)
      .reduce((total, payment) => total + (payment.paymentType === 'Reembolso' ? -payment.amount : payment.amount), 0)
    return Math.abs(project.remainingValue - Math.max(project.totalValue - paid, 0)) > 0.01
  }).length
  const hygieneIssues = [
    { id: 'duplicates', label: 'Possíveis contatos duplicados', count: duplicateCount },
    { id: 'invalid-phone', label: 'Telefones possivelmente inválidos', count: invalidPhoneCount },
    { id: 'no-next-action', label: 'Oportunidades sem próxima ação', count: noNextActionCount },
    { id: 'expired-quotes', label: 'Propostas expiradas', count: expiredQuoteCount },
    { id: 'balance', label: 'Projetos com saldo inconsistente', count: inconsistentBalanceCount },
  ].filter((issue) => issue.count > 0)
  return {
    conversionRate: Math.round(won.length / Math.max(1, visible.length) * 100),
    contactRate: Math.round(visible.filter((lead) => contactedIds.has(lead.id) || lead.lastContactAt).length / Math.max(1, visible.length) * 100),
    stalled,
    sourceConversion,
    outreach: {
      attempts: whatsAppInteractions.length,
      approachedLeads: approachedLeadIds.size,
      responses: respondedLeadIds.size,
      responseRate: Math.round(respondedLeadIds.size / Math.max(1, approachedLeadIds.size) * 100),
      bestContexts,
      categoryPerformance: dimensionPerformance((lead) => lead.leadHunterData?.categoryName || 'Sem categoria'),
      cityPerformance: dimensionPerformance((lead) => lead.city || 'Sem cidade'),
      servicePerformance: dimensionPerformance((lead) => lead.leadHunterData?.recommendedService || lead.serviceInterest),
    },
    hygieneIssues,
    hygieneIssueCount: hygieneIssues.reduce((total, issue) => total + issue.count, 0),
  }
}
