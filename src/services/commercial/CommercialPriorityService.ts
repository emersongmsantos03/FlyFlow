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
