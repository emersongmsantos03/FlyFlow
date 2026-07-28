import type { LeadHunterCategory, LeadHunterCity, LeadHunterSettings } from '../types'

const now = () => new Date().toISOString()
const slug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const cityDistances: Array<[string, number]> = [
  ['Curitiba', 0], ['São José dos Pinhais', 18], ['Pinhais', 10], ['Colombo', 18], ['Campo Largo', 30],
  ['Araucária', 28], ['Campo Magro', 24], ['Almirante Tamandaré', 18], ['Quatro Barras', 29],
  ['Campina Grande do Sul', 32], ['Fazenda Rio Grande', 30], ['Mandirituba', 45], ['Balsa Nova', 52],
  ['Itaperuçu', 37], ['Rio Branco do Sul', 38], ['Bocaiúva do Sul', 44], ['Tijucas do Sul', 67],
  ['Contenda', 48], ['Lapa', 70],
]

export const createDefaultLeadHunterCities = (): LeadHunterCity[] => cityDistances.map(([name, distanceFromBaseKm]) => ({
  id: `lh-city-${slug(name)}`, name, state: 'PR', distanceFromBaseKm, active: true, searchCount: 0,
  discoveredCount: 0, newLeadCount: 0, createdAt: now(), updatedAt: now(),
}))

const categoryDefinitions: Array<[string, string, LeadHunterCategory['priority'], number]> = [
  ['Chalé', 'Hospedagens', 'Máxima', 10], ['Cabana', 'Hospedagens', 'Máxima', 10], ['Casa de temporada', 'Hospedagens', 'Máxima', 10],
  ['Airbnb', 'Hospedagens', 'Máxima', 10], ['Booking', 'Hospedagens', 'Máxima', 10], ['Chácara para locação', 'Hospedagens', 'Máxima', 10],
  ['Sítio para locação', 'Hospedagens', 'Máxima', 10], ['Resort independente', 'Hospedagens', 'Alta', 7], ['Hotel fazenda', 'Hospedagens', 'Máxima', 10],
  ['Pousada', 'Hospedagens', 'Máxima', 10], ['Glamping', 'Hospedagens', 'Máxima', 10], ['Refúgio', 'Hospedagens', 'Máxima', 10],
  ['Eco Resort independente', 'Hospedagens', 'Alta', 7],
  ['Clube', 'Eventos', 'Alta', 8], ['Clube de campo', 'Eventos', 'Alta', 8], ['Campo de golfe', 'Eventos', 'Alta', 8],
  ['Parque aquático', 'Eventos', 'Alta', 8], ['Parque', 'Eventos', 'Alta', 8], ['Condomínio', 'Imobiliário', 'Alta', 8],
  ['Haras', 'Rural', 'Alta', 8], ['Pesqueiro', 'Rural', 'Alta', 8], ['Vinícola', 'Experiências', 'Alta', 8],
  ['Buffet com área externa', 'Eventos', 'Alta', 8], ['Espaço para eventos', 'Eventos', 'Alta', 8], ['Casa de eventos', 'Eventos', 'Alta', 8],
  ['Concessionária', 'Comércio', 'Média', 6], ['Loteamento', 'Imobiliário', 'Média', 6], ['Incorporadora', 'Imobiliário', 'Média', 6],
  ['Imobiliária', 'Imobiliário', 'Média', 6], ['Construtora', 'Imobiliário', 'Média', 6], ['Empresa de engenharia', 'Técnico', 'Média', 6],
  ['Escritório de engenharia', 'Técnico', 'Média', 6], ['Empresa de inspeção', 'Técnico', 'Média', 6],
  ['Administradora de condomínio', 'Imobiliário', 'Média', 6],
]

export const createDefaultLeadHunterCategories = (): LeadHunterCategory[] => categoryDefinitions.map(([name, group, priority, weight]) => ({
  id: `lh-category-${slug(name)}`, name, group, priority, weight, active: true, searchTerms: [name], searchCount: 0,
  discoveredCount: 0, newLeadCount: 0, createdAt: now(), updatedAt: now(),
}))

export const createDefaultLeadHunterSettings = (): LeadHunterSettings => ({
  radiusKm: 50, maxResultsPerSearch: 10, maxAnalysesPerBatch: 10, maxDailyCalls: 50,
  minimumNewLeadPercentage: 70, maximumReappearances: 5,
  cooldownDays: { discovered: 30, analyzed: 21, contactedNoReply: 30, refused: 90, strongRefusal: 180, visited: 30 },
  scoringWeights: { noDroneContent: 20, outdatedInstagram: 12, largeOutdoorArea: 10, visuallyAttractive: 10, goodGoogleRating: 8, relevantReviews: 6, incompleteData: -10, outsideServiceArea: -20, recentContact: -20, duplicate: -35, professionalDroneContent: -15 },
  categoryDistribution: { Hospedagens: 70, Rural: 15, Eventos: 8, Experiências: 4, Imobiliário: 2, Outras: 1 },
  updatedAt: now(),
})
