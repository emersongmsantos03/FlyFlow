import { normalizeLeadText } from './LeadDeduplicationService'
import { isEligibleLeadSegment, leadSegmentPriorityPoints } from './LeadTargetingPolicy'

export type SearchScopeFilters = {
  cityIds: string[]
  categoryIds: string[]
  radiusKm: number
  minimumScore: number
  onlyNew: boolean
  includeEligibleKnown: boolean
}

export type SearchScopeInput = {
  activeCities: Array<{ id: string; name: string; distanceFromBaseKm: number; active: boolean; searchCount: number; blockedUntil?: string }>
  activeCategories: Array<{ id: string; name: string; group: string; weight: number; active: boolean; searchCount: number }>
  filters: SearchScopeFilters
  recentCityUsage: Map<string, number>
  recentCategoryUsage: Map<string, number>
  searchLearningProfile: {
    accepted?: number
    rejected?: number
    categoryAdjustments: Record<string, number>
    cityAdjustments: Record<string, number>
  }
}

export const buildLeadHunterNoResultsMessage = (warnings: string[] = []) => {
  const normalizedWarnings = [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))]
  if (!normalizedWarnings.length) {
    return 'Nenhum lead novo foi localizado nesta região. Tente outra cidade, categoria ou raio de busca.'
  }

  const timeouts = normalizedWarnings.filter((warning) => /tempo limite|timeout|não concluída|indisponível|não respondeu/i.test(warning))
  if (timeouts.length) {
    return 'Nenhum lead novo foi localizado nesta região. O provedor público demorou para responder; tente outra cidade, categoria ou raio de busca.'
  }

  return `Nenhum lead novo foi localizado nesta região. ${normalizedWarnings.slice(0, 2).join(' · ')}`
}

export const resolveLeadHunterSearchScope = ({ activeCities, activeCategories, filters, recentCityUsage, recentCategoryUsage, searchLearningProfile }: SearchScopeInput) => {
  const candidateCities = filters.cityIds.length
    ? (() => {
      const selected = activeCities.find((item) => filters.cityIds.includes(item.id))
      if (!selected) return []
      const neighbors = activeCities
        .filter((item) => item.id !== selected.id)
        .sort((a, b) =>
          Math.abs(a.distanceFromBaseKm - selected.distanceFromBaseKm) - Math.abs(b.distanceFromBaseKm - selected.distanceFromBaseKm)
          || a.searchCount - b.searchCount,
        )
      return [selected, ...neighbors]
    })()
    : (() => {
      const greenBeltPriority = (item: (typeof activeCities)[number]) => {
        const name = normalizeLeadText(item.name)
        if (/campo magro|quatro barras|campina grande do sul|balsa nova|bocaiuva do sul|tijucas do sul|mandirituba|lapa/.test(name)) return 3
        if (/sao jose dos pinhais|campo largo|almirante tamandare|rio branco do sul|itaperucu|contenda/.test(name)) return 2
        if (/araucaria|fazenda rio grande|colombo/.test(name)) return 1
        return 0
      }
      const nearby = [...activeCities]
        .filter((item) => item.distanceFromBaseKm <= 70)
        .sort((a, b) =>
          (recentCityUsage.get(a.id) || 0) - (recentCityUsage.get(b.id) || 0)
          || greenBeltPriority(b) - greenBeltPriority(a)
          || a.searchCount - b.searchCount
          || a.distanceFromBaseKm - b.distanceFromBaseKm,
        )
        .slice(0, 6)
      const underSearched = [...activeCities]
        .sort((a, b) =>
          (recentCityUsage.get(a.id) || 0) - (recentCityUsage.get(b.id) || 0)
          || greenBeltPriority(b) - greenBeltPriority(a)
          || a.searchCount - b.searchCount
          || a.distanceFromBaseKm - b.distanceFromBaseKm,
        )
      return [...new Map([...nearby, ...underSearched].map((item) => [item.id, item])).values()]
    })()

  const citiesWithinRadius = candidateCities.filter((item) => item.distanceFromBaseKm <= Math.min(filters.radiusKm, 50))
  const selectedCategories = filters.categoryIds.length
    ? (() => {
      const explicitlySelected = activeCategories.filter((item) => filters.categoryIds.includes(item.id) && isEligibleLeadSegment(item.name))
      const selectedGroups = new Set(explicitlySelected.map((item) => item.group))
      const related = activeCategories
        .filter((item) =>
          !explicitlySelected.some((selected) => selected.id === item.id) &&
          selectedGroups.has(item.group) &&
          isEligibleLeadSegment(item.name),
        )
        .sort((a, b) =>
          (recentCategoryUsage.get(a.id) || 0) - (recentCategoryUsage.get(b.id) || 0)
          || b.weight - a.weight
          || a.searchCount - b.searchCount,
        )
      return [...explicitlySelected, ...related].slice(0, 4)
    })()
    : (() => {
      const eligible = activeCategories.filter((item) => isEligibleLeadSegment(item.name))
      if (!eligible.length) return []
      const maximumPriority = eligible.filter((category) => leadSegmentPriorityPoints(category.name) === 30)
      const ranked = [...(maximumPriority.length ? maximumPriority : eligible)]
        .sort((a, b) =>
          (recentCategoryUsage.get(a.id) || 0) - (recentCategoryUsage.get(b.id) || 0)
          || (leadSegmentPriorityPoints(b.name) + b.weight * 2 - b.searchCount * 4 + (searchLearningProfile.categoryAdjustments[normalizeLeadText(b.name)] || 0)) -
          (leadSegmentPriorityPoints(a.name) + a.weight * 2 - a.searchCount * 4 + (searchLearningProfile.categoryAdjustments[normalizeLeadText(a.name)] || 0)),
        )
      return ranked.slice(0, 2)
    })()

  if (!citiesWithinRadius.length || !selectedCategories.length) {
    return null
  }

  return {
    city: citiesWithinRadius[0],
    citiesWithinRadius,
    selectedCategories,
  }
}
