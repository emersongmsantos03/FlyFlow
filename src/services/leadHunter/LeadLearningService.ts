import type { LeadHunterProspect } from '../../types'

const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')

export interface LeadLearningProfile {
  accepted: number
  rejected: number
  categoryAdjustments: Record<string, number>
  cityAdjustments: Record<string, number>
}

export const buildLeadLearningProfile = (prospects: LeadHunterProspect[]): LeadLearningProfile => {
  const decisions = prospects.filter((lead) => lead.decision)
  const accepted = decisions.filter((lead) => lead.decision === 'Aceito').length
  const rejected = decisions.length - accepted
  const categoryStats = new Map<string, { accepted: number; rejected: number }>()
  const cityStats = new Map<string, { accepted: number; rejected: number }>()
  for (const lead of decisions) {
    const update = (map: typeof categoryStats, key: string) => {
      const current = map.get(key) || { accepted: 0, rejected: 0 }
      current[lead.decision === 'Aceito' ? 'accepted' : 'rejected'] += 1
      map.set(key, current)
    }
    update(categoryStats, normalize(lead.categoryName))
    update(cityStats, normalize(lead.city))
  }
  const adjustment = (stats: Map<string, { accepted: number; rejected: number }>) =>
    Object.fromEntries([...stats].map(([key, value]) => {
      const total = value.accepted + value.rejected
      const confidence = Math.min(1, total / 5)
      return [key, Math.round(((value.accepted - value.rejected) / total) * confidence * 12)]
    }))
  return { accepted, rejected, categoryAdjustments: adjustment(categoryStats), cityAdjustments: adjustment(cityStats) }
}

export const learningAdjustmentForLead = (lead: Pick<LeadHunterProspect, 'categoryName' | 'city'>, profile: LeadLearningProfile) =>
  (profile.categoryAdjustments[normalize(lead.categoryName)] || 0) +
  (profile.cityAdjustments[normalize(lead.city)] || 0)

const hasPublicEvidence = (lead: LeadHunterProspect, field: string) =>
  lead.sources.some((source) => new RegExp(`openai|google|instagram|site|${field}`, 'i').test(source)) ||
  lead.sourceUrls.some((url) => new RegExp(`google|instagram|${field}`, 'i').test(url))

export const validateLeadContacts = (lead: LeadHunterProspect, checkedAt = new Date().toISOString()): NonNullable<LeadHunterProspect['contactValidation']> => ({
  whatsapp: !lead.whatsapp ? 'Não informado' : hasPublicEvidence(lead, 'whatsapp') ? 'Confirmado' : 'Provável',
  instagram: !lead.instagram ? 'Não informado' : /instagram\.com/i.test(lead.instagram) || hasPublicEvidence(lead, 'instagram') ? 'Confirmado' : 'Provável',
  email: !lead.email ? 'Não informado' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) ? 'Confirmado' : 'Provável',
  website: !lead.website ? 'Não informado' : /^https?:\/\/|^[\w.-]+\.[a-z]{2,}/i.test(lead.website) ? 'Confirmado' : 'Provável',
  checkedAt,
})

export const leadDecisionMetrics = (prospects: LeadHunterProspect[]) => {
  const decided = prospects.filter((lead) => lead.decision)
  const accepted = decided.filter((lead) => lead.decision === 'Aceito')
  const byCategory = new Map<string, { accepted: number; rejected: number }>()
  for (const lead of decided) {
    const current = byCategory.get(lead.categoryName) || { accepted: 0, rejected: 0 }
    current[lead.decision === 'Aceito' ? 'accepted' : 'rejected'] += 1
    byCategory.set(lead.categoryName, current)
  }
  const categoryPerformance = [...byCategory].map(([category, values]) => ({
    category, ...values,
    rate: Math.round(values.accepted / Math.max(1, values.accepted + values.rejected) * 100),
  })).sort((a, b) => b.rate - a.rate || b.accepted - a.accepted)
  return {
    accepted: accepted.length,
    rejected: decided.length - accepted.length,
    decisionRate: Math.round(decided.length / Math.max(1, prospects.length) * 100),
    contactableAccepted: accepted.filter((lead) => lead.whatsapp || lead.phone || lead.email || lead.instagram).length,
    categoryPerformance,
  }
}
