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
  ['Airbnb', 'Hospedagens', 'Máxima', 10], ['Chalé', 'Hospedagens', 'Máxima', 10], ['Cabana', 'Hospedagens', 'Máxima', 10],
  ['Pousada', 'Hospedagens', 'Máxima', 10], ['Hotel', 'Hospedagens', 'Máxima', 9], ['Hotel fazenda', 'Hospedagens', 'Máxima', 10],
  ['Glamping', 'Hospedagens', 'Máxima', 10], ['Casa de temporada', 'Hospedagens', 'Máxima', 10],
  ['Chácara para hospedagem', 'Hospedagens', 'Máxima', 10], ['Refúgio', 'Hospedagens', 'Máxima', 10], ['Resort', 'Hospedagens', 'Máxima', 9],
  ['Espaço para eventos', 'Eventos', 'Alta', 8], ['Vinícola', 'Experiências', 'Alta', 8], ['Restaurante com área externa', 'Experiências', 'Alta', 7],
  ['Pesqueiro', 'Rural', 'Alta', 7], ['Haras', 'Rural', 'Alta', 7], ['Clube', 'Eventos', 'Alta', 7], ['Condomínio', 'Imobiliário', 'Alta', 7],
  ['Loteamento', 'Imobiliário', 'Alta', 8], ['Construtora', 'Imobiliário', 'Alta', 8], ['Incorporadora', 'Imobiliário', 'Alta', 8],
  ['Imobiliária', 'Imobiliário', 'Alta', 8], ['Corretor de imóveis', 'Imobiliário', 'Alta', 7],
  ['Concessionária de veículos', 'Comércio', 'Alta', 8], ['Shopping center', 'Comércio', 'Alta', 8],
  ['Academia', 'Comércio', 'Média', 6], ['Clínica', 'Comércio', 'Média', 6], ['Escola particular', 'Comércio', 'Média', 6],
  ['Indústria', 'Empresarial', 'Alta', 8], ['Centro logístico', 'Empresarial', 'Alta', 8], ['Galpão', 'Empresarial', 'Alta', 8],
  ['Empresa de energia solar', 'Técnico', 'Máxima', 10], ['Condomínio residencial', 'Imobiliário', 'Alta', 8],
  ['Fazenda', 'Rural', 'Máxima', 10], ['Sítio', 'Rural', 'Alta', 8], ['Cooperativa agrícola', 'Rural', 'Alta', 8],
]

export const createDefaultLeadHunterCategories = (): LeadHunterCategory[] => categoryDefinitions.map(([name, group, priority, weight]) => ({
  id: `lh-category-${slug(name)}`, name, group, priority, weight, active: true, searchTerms: [name], searchCount: 0,
  discoveredCount: 0, newLeadCount: 0, createdAt: now(), updatedAt: now(),
}))

export const createDefaultLeadHunterSettings = (): LeadHunterSettings => ({
  radiusKm: 50, maxResultsPerSearch: 20, maxAnalysesPerBatch: 20, maxDailyCalls: 50,
  minimumNewLeadPercentage: 70, maximumReappearances: 5,
  cooldownDays: { discovered: 30, analyzed: 21, contactedNoReply: 30, refused: 90, strongRefusal: 180, visited: 30 },
  scoringWeights: { noDroneContent: 20, outdatedInstagram: 12, largeOutdoorArea: 10, visuallyAttractive: 10, goodGoogleRating: 8, relevantReviews: 6, incompleteData: -10, outsideServiceArea: -20, recentContact: -20, duplicate: -35, professionalDroneContent: -15 },
  categoryDistribution: { Hospedagens: 40, Eventos: 20, Imobiliário: 15, Experiências: 10, Rural: 10, Outras: 5 },
  updatedAt: now(),
})
