import { describe, expect, it } from 'vitest'
import { createDefaultLeadHunterSettings } from '../../constants/leadHunterDefaults'
import type { LeadHunterProspect } from '../../types'
import { normalizeLeadText } from './LeadDeduplicationService'
import { calculateLeadScore } from './LeadScoringService'
import { shouldDisplayLead } from './LeadRotationService'
import { buildGoogleMapsRouteUrl, recommendDailyMission } from './LeadRouteService'
import { createDefaultLeadHunterCities } from '../../constants/leadHunterDefaults'

const prospect = (overrides: Partial<LeadHunterProspect> = {}): LeadHunterProspect => ({
  id: 'prospect-1', externalIds: {}, name: 'Refúgio Marmeleiros', normalizedName: 'refugiomarmeleiros',
  categoryId: 'cabana', categoryName: 'Cabana', city: 'Curitiba', neighborhood: '', address: '', phone: '',
  whatsapp: '', email: '', instagram: '', website: '', googleMapsUrl: '', sources: ['Manual'], sourceUrls: [],
  score: 70, scoreReasons: [], status: 'Descoberto', isNew: true, firstDiscoveredAt: '2026-07-01T00:00:00.000Z',
  lastDiscoveredAt: '2026-07-01T00:00:00.000Z', discoveryCount: 1, displayCount: 0, changedSinceLastDisplay: false,
  discardedPermanently: false, notes: '', createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z', ...overrides,
})

describe('Lead Hunter services', () => {
  it('normaliza variações de nome para deduplicação', () => {
    expect(normalizeLeadText('Refúgio Marmeleiros Hospedagem')).toBe(normalizeLeadText('Refugio Marmeleiros'))
  })

  it('calcula score com decomposição e limites', () => {
    const result = calculateLeadScore({ noDroneContent: true, largeOutdoorArea: true, duplicate: true }, createDefaultLeadHunterSettings())
    expect(result.score).toBe(45)
    expect(result.reasons).toHaveLength(3)
  })

  it('prioriza inédito e bloqueia cooldown conhecido', () => {
    const settings = createDefaultLeadHunterSettings()
    expect(shouldDisplayLead(prospect(), settings, { includeKnown: false, onlyNew: true }).display).toBe(true)
    const known = prospect({ isNew: false, lastDisplayedAt: new Date().toISOString() })
    const decision = shouldDisplayLead(known, settings, { includeKnown: true, onlyNew: false })
    expect(decision.display).toBe(false)
    expect(decision.reason).toContain('menos de 30 dias')
  })

  it('gera rota externa sem inventar distância ou duração', () => {
    const url = buildGoogleMapsRouteUrl('Curitiba, PR', [prospect({ address: 'Rua A, Curitiba' }), prospect({ id: 'prospect-2', name: 'Cabana B', address: 'Rua B, Curitiba' })])
    expect(url).toContain('google.com/maps/dir')
    expect(url).toContain('waypoints')
  })

  it('recomenda missão com leads reais disponíveis', () => {
    const cities = createDefaultLeadHunterCities()
    const curitiba = cities.find((city) => city.name === 'Curitiba')!
    const mission = recommendDailyMission(cities, [prospect({ cityId: curitiba.id })], [], 'Curitiba')
    expect(mission?.city.name).toBe('Curitiba')
    expect(mission?.newCount).toBe(1)
  })
})
