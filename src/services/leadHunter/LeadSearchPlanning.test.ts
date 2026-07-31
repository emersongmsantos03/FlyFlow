import { describe, expect, it } from 'vitest'
import { createDefaultLeadHunterCategories, createDefaultLeadHunterCities } from '../../constants/leadHunterDefaults'
import { resolveLeadHunterSearchScope } from './LeadSearchPlanning'

describe('resolveLeadHunterSearchScope', () => {
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
