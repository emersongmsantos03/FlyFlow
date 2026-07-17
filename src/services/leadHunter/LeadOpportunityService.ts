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

export const leadContactPriority = (lead: Partial<Pick<LeadHunterProspect, 'whatsapp' | 'phone' | 'email' | 'website' | 'score'>>) =>
  (lead.whatsapp ? 10_000 : 0) + (lead.phone ? 2_000 : 0) + (lead.email ? 500 : 0) + (lead.website ? 100 : 0) + (lead.score || 0)
