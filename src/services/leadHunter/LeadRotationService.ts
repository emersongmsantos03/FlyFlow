import type { LeadHunterProspect, LeadHunterSettings } from '../../types'

export interface DisplayDecision { display: boolean; reason: string }

const daysSince = (value?: string) => value ? Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000) : Number.POSITIVE_INFINITY

export const shouldDisplayLead = (lead: LeadHunterProspect, settings: LeadHunterSettings, options: { includeKnown: boolean; onlyNew: boolean; explicit?: boolean; availableNewCount?: number }): DisplayDecision => {
  if (lead.discardedPermanently || lead.status === 'Bloqueado') return { display: false, reason: 'Lead bloqueado permanentemente.' }
  if (lead.contactId && lead.leadId) return { display: false, reason: 'Contato já possui oportunidade no Comercial.' }
  if (options.onlyNew && !lead.isNew) return { display: false, reason: 'Busca configurada apenas para leads inéditos.' }
  if (lead.isNew) return { display: true, reason: 'Lead inédito priorizado.' }
  if (options.explicit) return { display: true, reason: 'Reapresentação solicitada pelo usuário.' }
  if (!options.includeKnown) return { display: false, reason: 'Resultados conhecidos não foram incluídos.' }
  if (lead.changedSinceLastDisplay) return { display: true, reason: 'Mudança relevante detectada desde a última exibição.' }
  if (lead.nextDisplayAllowedAt && new Date(lead.nextDisplayAllowedAt) > new Date()) return { display: false, reason: `Cooldown ativo até ${new Date(lead.nextDisplayAllowedAt).toLocaleDateString('pt-BR')}.` }
  const requiredDays = lead.status === 'Analisado' ? settings.cooldownDays.analyzed : lead.status === 'Contatado' ? settings.cooldownDays.contactedNoReply : settings.cooldownDays.discovered
  if (daysSince(lead.lastDisplayedAt) < requiredDays) return { display: false, reason: `Lead exibido há menos de ${requiredDays} dias e sem mudanças relevantes.` }
  if (lead.displayCount >= settings.maximumReappearances && (options.availableNewCount || 0) > 0) return { display: false, reason: 'Limite de reapresentações atingido.' }
  return { display: true, reason: 'Cooldown encerrado e lead ainda relevante.' }
}

export const diversifyLeadBatch = (leads: LeadHunterProspect[], limit: number) => {
  const selected: LeadHunterProspect[] = []
  const cityCount = new Map<string, number>()
  const categoryCount = new Map<string, number>()
  const sorted = [...leads].sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.score - a.score || a.displayCount - b.displayCount)
  while (selected.length < limit && sorted.length) {
    sorted.sort((a, b) => (cityCount.get(a.city) || 0) - (cityCount.get(b.city) || 0) || (categoryCount.get(a.categoryId) || 0) - (categoryCount.get(b.categoryId) || 0) || b.score - a.score)
    const next = sorted.shift()!
    if (selected.some((item) => item.id === next.id)) continue
    selected.push(next)
    cityCount.set(next.city, (cityCount.get(next.city) || 0) + 1)
    categoryCount.set(next.categoryId, (categoryCount.get(next.categoryId) || 0) + 1)
  }
  return selected
}
