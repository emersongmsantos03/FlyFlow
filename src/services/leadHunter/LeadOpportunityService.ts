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

export const leadContactPriority = (lead: Partial<Pick<LeadHunterProspect, 'whatsapp' | 'phone' | 'email' | 'instagram' | 'website' | 'score'>>) =>
  (lead.whatsapp && lead.instagram ? 30_000 : 0) +
  (lead.whatsapp ? 12_000 : 0) +
  (lead.instagram ? 8_000 : 0) +
  (lead.phone ? 2_000 : 0) +
  (lead.email ? 500 : 0) +
  (lead.website ? 100 : 0) +
  (lead.score || 0)

export const buildInstagramUrl = (instagram: string) => {
  const value = instagram.trim()
  if (/^https?:\/\//i.test(value)) return value
  const handle = value.replace(/^@/, '').replace(/^instagram\.com\//i, '').split(/[/?#]/)[0]
  return `https://www.instagram.com/${handle}/`
}

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
  const message = [
    `Olá! Tudo bem? Sou da Hero Drone, de Curitiba.`,
    `Conheci a ${lead.name} e acredito que um trabalho de ${service.toLocaleLowerCase('pt-BR')} pode valorizar bastante a apresentação do negócio.`,
    `Posso te enviar uma ideia rápida, sem compromisso?`,
  ].join(' ')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
