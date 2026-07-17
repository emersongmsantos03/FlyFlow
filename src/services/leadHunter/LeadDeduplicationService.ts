import type { Client, Lead, LeadHunterProspect } from '../../types'

export const normalizeLeadText = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(hospedagem|hotel|pousada|airbnb|oficial)\b/g, '').replace(/[^a-z0-9]/g, '')
const digits = (value = '') => value.replace(/\D/g, '')
const domain = (value = '') => value.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

export interface DuplicateMatch { type: 'prospect' | 'contact' | 'opportunity'; id: string; confidence: number; reasons: string[] }

const prospectKey = (lead: Pick<LeadHunterProspect, 'name' | 'city'>) =>
  `${normalizeLeadText(lead.name)}|${normalizeLeadText(lead.city)}`

export const deduplicateLeadHunterProspects = (prospects: LeadHunterProspect[]) => {
  const unique = new Map<string, LeadHunterProspect>()
  for (const prospect of prospects) {
    const key = prospectKey(prospect)
    const existing = unique.get(key)
    if (!existing) {
      unique.set(key, prospect)
      continue
    }
    const richer = [existing, prospect].sort((a, b) =>
      Number(Boolean(b.whatsapp)) - Number(Boolean(a.whatsapp)) ||
      Number(Boolean(b.phone)) - Number(Boolean(a.phone)) ||
      Number(Boolean(b.email)) - Number(Boolean(a.email)) ||
      b.score - a.score,
    )[0]
    const other = richer.id === existing.id ? prospect : existing
    unique.set(key, {
      ...other,
      ...richer,
      externalIds: { ...other.externalIds, ...richer.externalIds },
      sources: [...new Set([...other.sources, ...richer.sources])],
      sourceUrls: [...new Set([...other.sourceUrls, ...richer.sourceUrls])],
      scoreReasons: [...new Map([...other.scoreReasons, ...richer.scoreReasons].map((reason) => [reason.id, reason])).values()],
      discoveryCount: Math.max(existing.discoveryCount, prospect.discoveryCount),
      displayCount: Math.max(existing.displayCount, prospect.displayCount),
      firstDiscoveredAt: [existing.firstDiscoveredAt, prospect.firstDiscoveredAt].sort()[0],
      lastDiscoveredAt: [existing.lastDiscoveredAt, prospect.lastDiscoveredAt].sort().at(-1) || richer.lastDiscoveredAt,
    })
  }
  return [...unique.values()]
}

export const findLeadDuplicates = (candidate: Partial<LeadHunterProspect>, prospects: LeadHunterProspect[], contacts: Client[], leads: Lead[]): DuplicateMatch[] => {
  const candidateName = normalizeLeadText(candidate.name)
  const candidatePhone = digits(candidate.whatsapp || candidate.phone)
  const candidateDomain = domain(candidate.website)
  const evaluate = (type: DuplicateMatch['type'], id: string, name: string, phone: string, website: string, city: string): DuplicateMatch | null => {
    const reasons: string[] = []
    let confidence = 0
    if (candidatePhone && candidatePhone === digits(phone)) { confidence += 70; reasons.push('Mesmo telefone ou WhatsApp') }
    if (candidateDomain && candidateDomain === domain(website)) { confidence += 65; reasons.push('Mesmo domínio') }
    if (candidateName && candidateName === normalizeLeadText(name)) { confidence += 45; reasons.push('Mesmo nome normalizado') }
    if (candidate.city && candidate.city.toLowerCase() === city.toLowerCase()) confidence += 10
    return confidence >= 50 ? { type, id, confidence: Math.min(confidence, 100), reasons } : null
  }
  return [
    ...prospects.map((item) => evaluate('prospect', item.id, item.name, item.whatsapp || item.phone, item.website, item.city)),
    ...contacts.map((item) => evaluate('contact', item.id, item.companyName || item.fullName, item.whatsapp || item.phone, '', item.city)),
    ...leads.map((item) => evaluate('opportunity', item.id, item.companyName || item.fullName, item.whatsapp || item.phone, '', item.city)),
  ].filter((item): item is DuplicateMatch => Boolean(item)).sort((a, b) => b.confidence - a.confidence)
}
