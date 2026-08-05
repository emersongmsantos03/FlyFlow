import { describe, expect, it } from 'vitest'
import { createDefaultLeadHunterCategories, createDefaultLeadHunterCities } from '../../constants/leadHunterDefaults'
import { buildLeadHunterNoResultsMessage, resolveLeadHunterSearchScope } from './LeadSearchPlanning'

describe('resolveLeadHunterSearchScope', () => {
  it('gera mensagem amigável quando a busca pública demora ou não responde', () => {
    expect(buildLeadHunterNoResultsMessage(['Google Places: a consulta de “Casa de temporada” excedeu o tempo limite.'])).toBe(
      'Nenhum lead novo foi localizado nesta região. O provedor público demorou para responder; tente outra cidade, categoria ou raio de busca.',
    )
  })

  it('retorna nulo quando não há cidades elegíveis no raio ou categorias ativas', () => {
    const cities = createDefaultLeadHunterCities().map((city) => ({ ...city, active: false, distanceFromBaseKm: 80 }))
    const categories = createDefaultLeadHunterCategories().map((category) => ({ ...category, active: false }))

    const result = resolveLeadHunterSearchScope({
      activeCities: cities,
      activeCategories: categories,
      filters: {
        cityIds: [],
        categoryIds: [],
        radiusKm: 10,
        minimumScore: 0,
        onlyNew: false,
        includeEligibleKnown: false,
      },
      recentCityUsage: new Map(),
      recentCategoryUsage: new Map(),
      searchLearningProfile: { categoryAdjustments: {}, cityAdjustments: {} },
    })

    expect(result).toBeNull()
  })
})
