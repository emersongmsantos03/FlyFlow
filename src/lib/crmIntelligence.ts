import type { Lead, PipelineStage } from '../types'

const DAY = 86_400_000

export const daysSince = (value?: string, now = new Date()) => {
  if (!value) return 0
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY))
}

export const weightedPipelineValue = (leads: Lead[]) =>
  leads.reduce((total, lead) => total + lead.estimatedValue * Math.min(Math.max(lead.probability, 0), 100) / 100, 0)

export const averageOpportunityAge = (leads: Lead[], now = new Date()) =>
  leads.length
    ? Math.round(leads.reduce((total, lead) => total + daysSince(lead.entryDate || lead.createdAt, now), 0) / leads.length)
    : 0

export const stageProbability = (stage: PipelineStage) => {
  const probabilities: Partial<Record<PipelineStage, number>> = {
    Entrada: 10,
    'Novo lead': 10,
    'Contato realizado': 22,
    'Primeiro contato': 22,
    'Aguardando resposta': 28,
    'Em negociação': 48,
    'Entendendo necessidade': 42,
    'Orçamento solicitado': 52,
    Negociação: 58,
    'Proposta enviada': 65,
    'Orçamento enviado': 65,
    'Aguardando aprovação': 72,
    'Aguardando entrada': 86,
    'Aguardando sinal': 86,
    'Serviço confirmado': 100,
    'Serviço agendado': 100,
    'Convertido em cliente': 100,
    Perdido: 0,
  }
  return probabilities[stage] ?? 35
}

export const opportunityHealth = (lead: Lead, now = new Date()) => {
  const age = daysSince(lead.updatedAt || lead.lastContactAt || lead.entryDate, now)
  const overdue = Boolean(lead.nextContactAt && new Date(lead.nextContactAt) < now)
  if (overdue || age >= 10) return { label: 'Em risco', tone: 'danger' as const, age }
  if (!lead.nextContactAt || age >= 5) return { label: 'Atenção', tone: 'warning' as const, age }
  return { label: 'Saudável', tone: 'positive' as const, age }
}
