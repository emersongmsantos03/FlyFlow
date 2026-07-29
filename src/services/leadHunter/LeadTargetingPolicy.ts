const normalize = (value = '') =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const MAXIMUM_PRIORITY =
  /chale|cabana|casa de temporada|airbnb|booking|chacara|sitio para locacao|hotel fazenda|hospedagem|pousada|glamping|refugio/
const HIGH_PRIORITY =
  /vinicola|restaurante rural|clube|campo de golfe|resort|condominio.*grande area|parque privado/
const MEDIUM_PRIORITY =
  /concessionaria|loteamento|imobiliaria.*alto padrao|condominio.*construcao/
const FORBIDDEN =
  /bar\b|restaurante urbano|clinica|hospital|consultorio|salao de beleza|farmacia|mercado|supermercado|padaria|shopping|loja|academia|escola|colegio|escritorio|evento|igreja|pequeno comercio/

export const leadSegmentPriority = (value: string) => {
  const normalized = normalize(value)
  if (MAXIMUM_PRIORITY.test(normalized)) return 3
  if (HIGH_PRIORITY.test(normalized)) return 2
  if (MEDIUM_PRIORITY.test(normalized)) return 1
  return 0
}

export const leadSegmentPriorityPoints = (value: string) => {
  const priority = leadSegmentPriority(value)
  return priority === 3 ? 30 : priority === 2 ? 20 : priority === 1 ? 10 : 0
}

export const isForbiddenLeadSegment = (category: string, name = '') =>
  FORBIDDEN.test(normalize(`${category} ${name}`))

export const isEligibleLeadSegment = (category: string, name = '') =>
  !isForbiddenLeadSegment(category, name) && leadSegmentPriority(category) > 0
