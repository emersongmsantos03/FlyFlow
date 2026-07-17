import type { LeadHunterProspect, ServiceType } from '../../types'

const normalize = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export const recommendLeadService = (categoryName: string): ServiceType => {
  const category = normalize(categoryName)
  if (/construtora|incorporadora|obra|galpao|industria|logistic/.test(category)) return 'Acompanhamento de obra'
  if (/imobili|corretor|condominio|loteamento|terreno/.test(category)) return 'Filmagem de imóvel'
  if (/energia solar/.test(category)) return 'Inspeção visual de telhado'
  if (/fazenda|sitio|haras|rural|cooperativa|pesqueiro/.test(category)) return 'Filmagem de lote ou terreno'
  if (/hotel|pousada|resort|airbnb|chale|cabana|glamping|hosped/.test(category)) return 'Filmagem de pousada'
  if (/restaurante|shopping|concessionaria|academia|clinica|escola|comercio|vinicola/.test(category)) return 'Filmagem de comércio'
  return 'Vídeo institucional'
}

export type OpportunityLevel = 'Excelente' | 'Boa' | 'Média' | 'Ruim'

export const opportunityLevel = (score: number): OpportunityLevel =>
  score >= 85 ? 'Excelente' : score >= 70 ? 'Boa' : score >= 50 ? 'Média' : 'Ruim'

export const refineLeadOpportunity = (
  lead: Partial<LeadHunterProspect> & Pick<LeadHunterProspect, 'name' | 'categoryName'>,
  distanceKm = 0,
) => {
  const reasons = [...(lead.scoreReasons || [])]
  let adjustment = 0
  const add = (id: string, label: string, points: number) => {
    adjustment += points
    reasons.push({ id, label, points })
  }
  if (distanceKm <= 15) add('nearby', 'Próximo da base, fácil para visitar e produzir', 12)
  else if (distanceKm <= 30) add('nearby', 'Distância favorável para atendimento', 7)
  else if (distanceKm <= 50) add('distance', 'Distância ainda viável', 2)
  else add('distance', 'Deslocamento mais longo', -8)
  if (lead.whatsapp && lead.instagram) add('social-contact', 'WhatsApp e Instagram disponíveis', 15)
  else if (lead.whatsapp) add('whatsapp', 'WhatsApp disponível', 10)
  else if (lead.instagram) add('instagram', 'Instagram disponível para avaliar e abordar', 7)
  if (lead.address) add('address', 'Endereço público confirmado', 2)
  if (/hotel ibis|ibis |accor|slaviero|bourbon|mcdonald|burger king|outback|smart fit|havan|carrefour|atacad[aã]o/i.test(lead.name)) {
    add('large-chain', 'Grande rede: menor prioridade para quem está começando', -20)
  }
  if (/imobili|construtora|incorporadora|loteamento|condom[ií]nio|hotel|pousada|vin[ií]cola|fazenda|s[ií]tio|haras|restaurante|concession[aá]ria/i.test(lead.categoryName)) {
    add('visual-fit', 'Negócio com bom potencial para imagens de drone', 6)
  }
  return {
    score: Math.max(0, Math.min(100, Math.round((lead.score || 50) + adjustment))),
    scoreReasons: reasons,
  }
}

export const leadContactPriority = (lead: Partial<Pick<LeadHunterProspect, 'whatsapp' | 'phone' | 'email' | 'instagram' | 'website' | 'score'>>) =>
  (lead.whatsapp && lead.instagram ? 400 : 0) +
  (lead.whatsapp ? 180 : 0) +
  (lead.instagram ? 130 : 0) +
  (lead.phone ? 30 : 0) +
  (lead.email ? 15 : 0) +
  (lead.website ? 5 : 0) +
  (lead.score || 0)

export const buildInstagramUrl = (instagram: string) => {
  const value = instagram.trim()
  if (/^https?:\/\//i.test(value)) return value
  const handle = value.replace(/^@/, '').replace(/^instagram\.com\//i, '').split(/[/?#]/)[0]
  return `https://www.instagram.com/${handle}/`
}

export const buildGoogleBusinessUrl = (lead: Pick<LeadHunterProspect, 'name' | 'address' | 'city'>) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([lead.name, lead.address, lead.city].filter(Boolean).join(', '))}`

export const leadOpportunitySummary = (lead: LeadHunterProspect) => {
  if (lead.whatsapp && lead.score >= 75) return 'Alta chance de contato: oportunidade qualificada com WhatsApp direto.'
  if (lead.website || lead.instagram) return 'Boa presença digital: abordagem visual pode demonstrar valor rapidamente.'
  if (lead.score >= 75) return 'Negócio aderente aos serviços de drone e com bom potencial comercial.'
  return lead.scoreReasons[0]?.label || 'Empresa real localizada em fonte pública.'
}

export const buildLeadWhatsAppUrl = (lead: LeadHunterProspect) => {
  const digits = lead.whatsapp.replace(/\D/g, '')
  const number = digits.startsWith('55') ? digits : `55${digits}`
  const service = lead.recommendedService || recommendLeadService(lead.categoryName)
  const message = lead.aiFirstMessage || [
    `Olá! Tudo bem? Sou da Hero Drone, de Curitiba.`,
    `Conheci a ${lead.name} e acredito que um trabalho de ${service.toLocaleLowerCase('pt-BR')} pode valorizar bastante a apresentação do negócio.`,
    `Posso te enviar uma ideia rápida, sem compromisso?`,
  ].join(' ')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
